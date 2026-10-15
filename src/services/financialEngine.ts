import {
  OpFinancialSummary,
  CustoSetorDetalhe,
  CustoSetorConfig,
  Insumo,
  Sector,
} from "../types/forpack";
import {
  SUPABASE_URL,
  SUPABASE_KEY,
  loadCustosSetor,
  loadInsumos,
  DEFAULT_CUSTOS_SETORES,
  readStorageJson,
  getDataSourceFlags,
} from "./supabaseApi";

// ============================================================================
// TIPOS
// ============================================================================

export interface ApontamentoRaw {
  id: string;
  op_id: string;
  maquina_id?: string;
  setor: string;
  data_producao?: string;
  turno?: string;
  operador?: string;
  qtd_produzida_kg: number;
  aparas_kg: number;
  picote_kg?: number;
  horas_trabalhadas?: number;
  material?: string;
  cliente?: string;
  descricao_item?: string;
}

export interface PedidoOpRaw {
  id: string;
  numero_op?: string | null;
  cliente: string;
  descricao_item: string;
  material: string;
  quantidade_planejada_kg: number;
  status_producao?: string;
  preco_venda_kg?: number;
}

/**
 * Mesmo resumo de antes, com quatro avisos novos que a tela pode usar:
 *  - preco_estimado:       o preço de venda NÃO foi informado (é sugestão do sistema)
 *  - parcial:              a OP ainda não está finalizada (margem provisória)
 *  - custo_mp_estimado:    não achou a resina nos insumos; usou valor padrão
 *  - horas_estimadas_flag: alguma hora de máquina/mão de obra foi estimada, não apontada
 */
export interface OpFinancialSummaryExt extends OpFinancialSummary {
  preco_estimado: boolean;
  parcial: boolean;
  custo_mp_estimado: boolean;
  horas_estimadas_flag: boolean;
  status_producao?: string;
}

export interface TotaisFinanceiros {
  quantidade: number;
  totalReceita: number;
  totalCusto: number;
  totalLucro: number;
  margemPct: number;
}

export interface LoadAllOpFinancialsResult {
  summaries: OpFinancialSummaryExt[];
  custosSetor: CustoSetorConfig[];
  insumos: Insumo[];
  totalReceita: number;
  totalCusto: number;
  totalLucro: number;
  margemGeralPct: number;
  /** Totais só das OPs finalizadas (sem a distorção das que estão em andamento). */
  finalizadas: TotaisFinanceiros;
  quantidadeParciais: number;
  quantidadePrecoEstimado: number;
  /** Mensagens para exibir na tela (falhas de leitura, valores padrão em uso etc.). */
  avisos: string[];
}

// ============================================================================
// PARÂMETROS DO CÁLCULO (ajuste aqui, em um só lugar)
// ============================================================================

// Percentual do valor da resina que se recupera ao moer/vender a apara.
const RECUPERACAO_APARA = 0.45;

// Custo de tinta/solvente/fotopolímero por kg impresso. Valor fixo de estimativa.
const CUSTO_TINTA_POR_KG_IMPRESSO = 1.35;

// Produtividade padrão (kg/hora) quando não há horas apontadas.
const VELOCIDADE_PADRAO_SETOR: Record<string, number> = {
  EXTRUSÃO: 65,
  IMPRESSÃO: 75,
  LAMINAÇÃO: 85,
  REBOBINADEIRA: 100,
  CORTE: 45,
};

const PRICING_KEY = "config:financial_pricing";

// ============================================================================
// PREÇO DE VENDA
// ============================================================================

// Sugestão de preço quando a OP não tem preço informado. É uma ESTIMATIVA.
export function getPrecoVendaSugerido(material: string = ""): number {
  const m = material.toUpperCase();
  if (m.includes("IMPRESSO")) {
    if (m.includes("PP")) return 22.5;
    return 21.0;
  }
  if (m.includes("PP")) return 17.8;
  if (m.includes("RECICLADO") || m.includes("REC")) return 12.8;
  if (m.includes("LIXO")) return 11.5;
  return 16.5; // PEBD virgem padrão
}

// Lê os preços salvos. Nunca lança erro (para a tela abrir mesmo se falhar).
export async function loadSavedPricing(): Promise<Record<string, number>> {
  try {
    return (await readStorageJson<Record<string, number>>(PRICING_KEY)) ?? {};
  } catch (err) {
    console.error("[financialEngine] não foi possível ler os preços salvos:", err);
    return {};
  }
}

/**
 * Salva (ou remove, se o preço for vazio/zero) o preço de venda de uma OP.
 * Correções em relação à versão anterior:
 *  - se a leitura dos preços atuais falhar, NÃO grava (antes, uma falha de leitura
 *    fazia o sistema gravar um mapa só com este preço e apagar todos os outros);
 *  - confere se o banco confirmou a gravação e lança erro se não confirmou.
 */
export async function saveOpSellingPrice(opId: string, precoVendaKg: number): Promise<void> {
  if (!opId) throw new Error("OP inválida para salvar o preço.");

  const atual = (await readStorageJson<Record<string, number>>(PRICING_KEY)) ?? {};
  const preco = Number(precoVendaKg);
  if (Number.isFinite(preco) && preco > 0) {
    atual[opId] = preco;
  } else {
    delete atual[opId];
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_storage?on_conflict=key&select=key,value,updated_at`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      key: PRICING_KEY,
      value: JSON.stringify(atual),
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) throw new Error("Não foi possível salvar o preço de venda.");
}

// ============================================================================
// CUSTO DA MATÉRIA-PRIMA
// ============================================================================

type FamiliaResina = "PP" | "PEAD" | "PELBD" | "RECICLADO" | "PEBD";

function familiaDaResina(material: string): FamiliaResina {
  const m = material.toUpperCase();
  if (m.includes("PP")) return "PP";
  if (m.includes("RECICLADO") || m.includes("REC")) return "RECICLADO";
  if (m.includes("PELBD")) return "PELBD";
  if (m.includes("PEAD")) return "PEAD";
  return "PEBD"; // virgem / padrão
}

// Palavras que identificam a resina no código ou no nome do insumo cadastrado.
const BUSCA_INSUMO: Record<FamiliaResina, string[]> = {
  PP: ["PP", "POLIPROPILENO"],
  PEAD: ["PEAD"],
  PELBD: ["PELBD", "LINEAR"],
  RECICLADO: ["REC"],
  PEBD: ["PEBD"],
};

// Valores de mercado usados só quando a resina não está cadastrada nos insumos.
const CUSTO_MP_PADRAO: Record<FamiliaResina, number> = {
  PP: 9.2,
  PEAD: 8.45,
  PELBD: 8.45,
  RECICLADO: 5.8,
  PEBD: 8.45,
};

/**
 * Custo por kg da resina do material. Antes, o sistema pegava a PRIMEIRA resina
 * da lista (por ordem alfabética, o PEAD) para qualquer material virgem. Agora
 * procura a resina correspondente ao material; se não achar, usa o valor padrão
 * e marca como estimado.
 */
export function resolveCustoMateriaPrima(
  material: string = "",
  insumos: Insumo[] = []
): { valor: number; estimado: boolean } {
  const familia = familiaDaResina(material);
  const palavras = BUSCA_INSUMO[familia];

  const achado = insumos.find(
    (i) =>
      i.categoria === "RESINA" &&
      Number(i.custo_unitario_medio) > 0 &&
      palavras.some((p) => `${i.codigo ?? ""} ${i.nome ?? ""}`.toUpperCase().includes(p))
  );

  if (achado) return { valor: Number(achado.custo_unitario_medio), estimado: false };
  return { valor: CUSTO_MP_PADRAO[familia], estimado: true };
}

export function getCustoMateriaPrimaKg(material: string = "", insumos: Insumo[] = []): number {
  return resolveCustoMateriaPrima(material, insumos).valor;
}

// ============================================================================
// CÁLCULO DE UMA OP
// ============================================================================

export function computeOpFinancial(
  op: PedidoOpRaw,
  apontamentos: ApontamentoRaw[],
  custosSetor: CustoSetorConfig[],
  insumos: Insumo[],
  savedPrices: Record<string, number>
): OpFinancialSummaryExt {
  const custoSetorMap = new Map<string, CustoSetorConfig>();
  custosSetor.forEach((c) => custoSetorMap.set(c.setor.toUpperCase(), c));

  const material = op.material || apontamentos[0]?.material || "PEBD VIRGEM";
  const mp = resolveCustoMateriaPrima(material, insumos);
  const custoMpKg = mp.valor;

  // Agrupa apontamentos por setor
  const setorMap = new Map<string, { kg: number; aparas: number; horas: number; datas: string[] }>();
  let aparasTotalKg = 0;

  apontamentos.forEach((a) => {
    const s = (a.setor || "EXTRUSÃO").toUpperCase();
    if (!setorMap.has(s)) {
      setorMap.set(s, { kg: 0, aparas: 0, horas: 0, datas: [] });
    }
    const bucket = setorMap.get(s)!;
    bucket.kg += Number(a.qtd_produzida_kg || 0);
    bucket.aparas += Number(a.aparas_kg || 0);
    bucket.horas += Number(a.horas_trabalhadas || 0);
    if (a.data_producao) bucket.datas.push(a.data_producao);
    aparasTotalKg += Number(a.aparas_kg || 0);
  });

  // Quantidade final: se houve corte, o kg do corte é o produto acabado entregue.
  // Se não passou por corte, usa rebobinadeira ou extrusão.
  const corteData = setorMap.get("CORTE");
  const rebobinadeiraData = setorMap.get("REBOBINADEIRA");
  const extrusaoData = setorMap.get("EXTRUSÃO");

  let quantidadeFinalKg = 0;
  if (corteData && corteData.kg > 0) {
    quantidadeFinalKg = corteData.kg;
  } else if (rebobinadeiraData && rebobinadeiraData.kg > 0) {
    quantidadeFinalKg = rebobinadeiraData.kg;
  } else if (extrusaoData && extrusaoData.kg > 0) {
    quantidadeFinalKg = extrusaoData.kg;
  } else {
    quantidadeFinalKg = Array.from(setorMap.values()).reduce((sum, item) => sum + item.kg, 0);
  }

  // Resina total processada (produto bom + aparas)
  const pesoBrutoExtrusao = extrusaoData
    ? extrusaoData.kg + extrusaoData.aparas
    : quantidadeFinalKg + aparasTotalKg;
  const totalMateriaPrimaKg = Math.max(pesoBrutoExtrusao, quantidadeFinalKg + aparasTotalKg);

  // CORREÇÃO (aparas contadas duas vezes):
  // a resina das aparas é cobrada UMA vez, em "custo líquido das aparas" (abaixo,
  // já descontada a recuperação). Aqui entra só a resina do produto bom.
  const kgMpBoa = Math.max(totalMateriaPrimaKg - aparasTotalKg, 0);
  let custoTotalMp = kgMpBoa * custoMpKg;

  // Produto impresso: tinta, solvente e fotopolímero (estimativa fixa por kg impresso)
  const impressaoData = setorMap.get("IMPRESSÃO");
  if (impressaoData && impressaoData.kg > 0) {
    custoTotalMp += impressaoData.kg * CUSTO_TINTA_POR_KG_IMPRESSO;
  }

  // Custos operacionais por setor
  const detalheSetores: CustoSetorDetalhe[] = [];
  let custoTotalOperacional = 0;
  let algumaHoraEstimada = false;

  setorMap.forEach((val, setorNome) => {
    const conf =
      custoSetorMap.get(setorNome) ||
      ({
        setor: setorNome as Sector,
        custo_hora_maquina: 75,
        custo_hora_homem: 35,
        perda_padrao_tolerada_pct: 3,
      } as CustoSetorConfig);

    // Horas: usa as apontadas; senão estima pela produtividade padrão do setor
    const velocidade = VELOCIDADE_PADRAO_SETOR[setorNome] || 60;
    const horasApontadas = val.horas > 0;
    if (!horasApontadas) algumaHoraEstimada = true;
    const horasEstimadas = horasApontadas
      ? val.horas
      : val.kg > 0
      ? Math.round((val.kg / velocidade) * 10) / 10
      : 0.5;

    const custoMaq = Math.round(horasEstimadas * conf.custo_hora_maquina * 100) / 100;
    const custoHomem = Math.round(horasEstimadas * conf.custo_hora_homem * 100) / 100;
    const subtotal = custoMaq + custoHomem;

    custoTotalOperacional += subtotal;

    detalheSetores.push({
      setor: setorNome,
      kg_produzidos: Math.round(val.kg * 10) / 10,
      horas_estimadas: horasEstimadas,
      taxa_hora_maquina: conf.custo_hora_maquina,
      taxa_hora_homem: conf.custo_hora_homem,
      custo_maquina: custoMaq,
      custo_homem: custoHomem,
      subtotal_operacional: subtotal,
    });
  });

  // Aparas: custo bruto menos o que se recupera ao moer/vender
  const custoBrutoAparas = aparasTotalKg * custoMpKg;
  const recuperacaoApara = custoBrutoAparas * RECUPERACAO_APARA;
  const custoLiquidoAparas = Math.max(0, custoBrutoAparas - recuperacaoApara);

  // Custo total de fabricação
  const custoTotalFabricacao =
    Math.round((custoTotalMp + custoTotalOperacional + custoLiquidoAparas) * 100) / 100;

  // Custo real por kg
  const pesoBaseDivisao =
    quantidadeFinalKg > 0 ? quantidadeFinalKg : totalMateriaPrimaKg > 0 ? totalMateriaPrimaKg : 1;
  const custoRealPorKg = Math.round((custoTotalFabricacao / pesoBaseDivisao) * 100) / 100;

  // Preço de venda: 1) salvo pelo usuário, 2) do pedido, 3) sugestão do sistema (ESTIMADO)
  const precoSalvo = Number(savedPrices[op.id]) || 0;
  const precoPedido = Number(op.preco_venda_kg) || 0;
  const precoEstimado = precoSalvo <= 0 && precoPedido <= 0;
  const precoVendaKg =
    precoSalvo > 0 ? precoSalvo : precoPedido > 0 ? precoPedido : getPrecoVendaSugerido(material);

  const receitaTotal = Math.round(quantidadeFinalKg * precoVendaKg * 100) / 100;
  const lucroBruto = Math.round((receitaTotal - custoTotalFabricacao) * 100) / 100;
  const margemLucroPct =
    receitaTotal > 0 ? Math.round((lucroBruto / receitaTotal) * 100 * 10) / 10 : 0;

  const perdaRealPct =
    totalMateriaPrimaKg > 0 ? Math.round((aparasTotalKg / totalMateriaPrimaKg) * 100 * 10) / 10 : 0;

  // Status de lucratividade
  let statusLucratividade: "ALTA" | "NORMAL" | "APERTADA" | "PREJUIZO" = "NORMAL";
  if (margemLucroPct >= 25) {
    statusLucratividade = "ALTA";
  } else if (margemLucroPct >= 15) {
    statusLucratividade = "NORMAL";
  } else if (margemLucroPct >= 5) {
    statusLucratividade = "APERTADA";
  } else {
    statusLucratividade = "PREJUIZO";
  }

  // Última data de produção
  const allDates: string[] = [];
  setorMap.forEach((v) => allDates.push(...v.datas));
  allDates.sort();
  const dataUltima = allDates.length > 0 ? allDates[allDates.length - 1] : undefined;

  // OP em andamento = margem provisória (a receita só conta o que já foi entregue,
  // mas parte do custo já foi gasto).
  const statusOp = (op.status_producao || "FINALIZADO").toUpperCase();
  const parcial = statusOp !== "FINALIZADO";

  return {
    op_id: op.id,
    cliente: op.cliente || "Cliente Industrial",
    descricao_item: op.descricao_item || "Item Plástico Fabricado",
    material,
    quantidade_planejada_kg: Number(op.quantidade_planejada_kg) || 0,
    quantidade_final_kg: Math.round(quantidadeFinalKg * 10) / 10,
    aparas_total_kg: Math.round(aparasTotalKg * 10) / 10,
    perda_real_pct: perdaRealPct,
    custo_materia_prima_kg: custoMpKg,
    custo_total_materia_prima: Math.round(custoTotalMp * 100) / 100,
    detalhe_setores: detalheSetores,
    custo_total_operacional: Math.round(custoTotalOperacional * 100) / 100,
    custo_liquido_aparas: Math.round(custoLiquidoAparas * 100) / 100,
    custo_total_fabricacao: custoTotalFabricacao,
    custo_real_por_kg: custoRealPorKg,
    preco_venda_kg: precoVendaKg,
    receita_total: receitaTotal,
    lucro_bruto: lucroBruto,
    margem_lucro_pct: margemLucroPct,
    status_lucratividade: statusLucratividade,
    data_ultima_producao: dataUltima,
    // avisos novos
    preco_estimado: precoEstimado,
    parcial,
    custo_mp_estimado: mp.estimado,
    horas_estimadas_flag: algumaHoraEstimada,
    status_producao: op.status_producao,
  };
}

// ============================================================================
// CARREGAMENTO DE TODAS AS OPs
// ============================================================================

// Lê uma tabela inteira em blocos de 1000 (o Supabase corta respostas grandes).
// Antes, as consultas usavam limit=2000/3000 sem paginar e podiam perder dados sem aviso.
async function fetchAllRows<T>(path: string): Promise<T[]> {
  const pageSize = 1000;
  const out: T[] = [];

  for (let page = 0; page < 200; page++) {
    const from = page * pageSize;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${from}-${from + pageSize - 1}`,
        "Range-Unit": "items",
      },
      cache: "no-store",
    });

    if (res.status === 416) break; // passou do fim
    if (!res.ok) throw new Error(`Falha ao ler ${path.split("?")[0]} (HTTP ${res.status}).`);

    const batch = (await res.json()) as T[];
    out.push(...batch);
    if (batch.length < pageSize) break;
  }

  return out;
}

function totaisDe(list: OpFinancialSummaryExt[]): TotaisFinanceiros {
  const totalReceita = list.reduce((acc, item) => acc + item.receita_total, 0);
  const totalCusto = list.reduce((acc, item) => acc + item.custo_total_fabricacao, 0);
  const totalLucro = totalReceita - totalCusto;
  const margemPct = totalReceita > 0 ? Math.round((totalLucro / totalReceita) * 100 * 10) / 10 : 0;
  return { quantidade: list.length, totalReceita, totalCusto, totalLucro, margemPct };
}

export async function loadAllOpFinancials(): Promise<LoadAllOpFinancialsResult> {
  const avisos: string[] = [];

  // Pedidos: select=* para funcionar com ou sem a coluna preco_venda_kg.
  // Apontamentos: mesmas colunas de antes.
  const [pedidos, apontamentos, custosSetor, insumos, savedPrices] = await Promise.all([
    fetchAllRows<PedidoOpRaw>("pedidos_op?select=*&order=id.asc").catch((err) => {
      console.error("[financialEngine] pedidos_op:", err);
      avisos.push("Não foi possível carregar os pedidos (pedidos_op). Os dados abaixo podem estar incompletos.");
      return [] as PedidoOpRaw[];
    }),

    fetchAllRows<ApontamentoRaw>(
      "apontamentos_producao?select=id,op_id,setor,maquina_id,qtd_produzida_kg,aparas_kg,picote_kg,horas_trabalhadas,material,cliente,descricao_item,data_producao&order=id.asc"
    ).catch((err) => {
      console.error("[financialEngine] apontamentos_producao:", err);
      avisos.push("Não foi possível carregar os apontamentos de produção. Os custos abaixo podem estar incompletos.");
      return [] as ApontamentoRaw[];
    }),

    loadCustosSetor().catch(() => DEFAULT_CUSTOS_SETORES),
    loadInsumos().catch(() => [] as Insumo[]),

    readStorageJson<Record<string, number>>(PRICING_KEY)
      .then((v) => v ?? {})
      .catch((err) => {
        console.error("[financialEngine] preços salvos:", err);
        avisos.push("Não foi possível ler os preços de venda salvos; todos aparecem como estimados.");
        return {} as Record<string, number>;
      }),
  ]);

  if (getDataSourceFlags().custosSetorPadrao) {
    avisos.push("As taxas por setor ainda são os valores padrão do sistema; custo de máquina e mão de obra são estimativas.");
  }

  // Agrupa apontamentos por OP
  const apontamentosByOp = new Map<string, ApontamentoRaw[]>();
  apontamentos.forEach((a) => {
    if (!a.op_id) return;
    if (!apontamentosByOp.has(a.op_id)) apontamentosByOp.set(a.op_id, []);
    apontamentosByOp.get(a.op_id)!.push(a);
  });

  const pedidoMap = new Map<string, PedidoOpRaw>();
  pedidos.forEach((p) => pedidoMap.set(p.id, p));

  const summaries: OpFinancialSummaryExt[] = [];

  apontamentosByOp.forEach((apts, opId) => {
    const firstApt = apts[0];

    // Se não há cadastro do pedido, usa os dados do próprio apontamento.
    const pedido: PedidoOpRaw = pedidoMap.get(opId) || {
      id: opId,
      cliente: firstApt?.cliente || "Cliente Industrial",
      descricao_item: firstApt?.descricao_item || "Item Plástico",
      material: firstApt?.material || "PEBD",
      quantidade_planejada_kg: 0,
      status_producao: "FINALIZADO",
    };

    const fin = computeOpFinancial(pedido, apts, custosSetor, insumos, savedPrices);
    if (fin.quantidade_final_kg > 0 || fin.custo_total_fabricacao > 0) {
      summaries.push(fin);
    }
  });

  // Ordem: produção mais recente primeiro; empate pelo número da OP.
  // (O comparador antigo misturava números e textos e podia gerar ordem instável.)
  summaries.sort((a, b) => {
    const da = a.data_ultima_producao ?? "";
    const db = b.data_ultima_producao ?? "";
    if (da !== db) return db.localeCompare(da);
    return b.op_id.localeCompare(a.op_id, undefined, { numeric: true });
  });

  const todas = totaisDe(summaries);
  const finalizadas = totaisDe(summaries.filter((s) => !s.parcial));
  const quantidadeParciais = summaries.filter((s) => s.parcial).length;
  const quantidadePrecoEstimado = summaries.filter((s) => s.preco_estimado).length;

  if (quantidadePrecoEstimado > 0) {
    avisos.push(
      `${quantidadePrecoEstimado} de ${summaries.length} OPs usam preço de venda estimado; faturamento e margem são aproximados.`
    );
  }

  return {
    summaries,
    custosSetor,
    insumos,
    totalReceita: todas.totalReceita,
    totalCusto: todas.totalCusto,
    totalLucro: todas.totalLucro,
    margemGeralPct: todas.margemPct,
    finalizadas,
    quantidadeParciais,
    quantidadePrecoEstimado,
    avisos,
  };
}
