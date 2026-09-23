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
} from "./supabaseApi";

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

// Produtividade padrão de máquina em kg/hora quando não há horas explicitamente digitadas
const VELOCIDADE_PADRAO_SETOR: Record<string, number> = {
  EXTRUSÃO: 65, // 65 kg/h
  IMPRESSÃO: 75, // 75 kg/h
  LAMINAÇÃO: 85, // 85 kg/h
  REBOBINADEIRA: 100, // 100 kg/h
  CORTE: 45, // 45 kg/h
};

// Sugestão padrão de preço de venda por tipo de material caso não tenha sido cadastrado
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

// Identifica o custo de matéria-prima baseada na lista de insumos cadastrados
export function getCustoMateriaPrimaKg(material: string = "", insumos: Insumo[] = []): number {
  const m = material.toUpperCase();

  // Procura primeiro insumo correspondente na tabela de insumos
  if (insumos.length > 0) {
    if (m.includes("PP")) {
      const insPP = insumos.find(i => i.nome.toUpperCase().includes("PP") || i.codigo.toUpperCase().includes("PP"));
      if (insPP && insPP.custo_unitario_medio > 0) return insPP.custo_unitario_medio;
    }
    if (m.includes("RECICLADO") || m.includes("REC")) {
      const insRec = insumos.find(i => i.categoria === "RESINA" && (i.nome.toUpperCase().includes("REC") || i.codigo.toUpperCase().includes("REC")));
      if (insRec && insRec.custo_unitario_medio > 0) return insRec.custo_unitario_medio;
    }
    // Resina virgem padrão
    const insVirgem = insumos.find(i => i.categoria === "RESINA");
    if (insVirgem && insVirgem.custo_unitario_medio > 0) return insVirgem.custo_unitario_medio;
  }

  // Fallbacks de mercado plástico
  if (m.includes("PP")) return 9.2;
  if (m.includes("RECICLADO") || m.includes("REC")) return 5.8;
  return 8.45; // PEBD virgem
}

// Carrega preços customizados salvos em app_storage
export async function loadSavedPricing(): Promise<Record<string, number>> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/app_storage?key=eq.config:financial_pricing&select=value`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        cache: "no-store",
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.length > 0 && data[0].value) {
        return JSON.parse(data[0].value);
      }
    }
    return {};
  } catch {
    return {};
  }
}

// Salva preços customizados de OPs
export async function saveOpSellingPrice(opId: string, precoVendaKg: number): Promise<void> {
  const currentPricing = await loadSavedPricing();
  currentPricing[opId] = precoVendaKg;

  await fetch(`${SUPABASE_URL}/rest/v1/app_storage?select=key,value,updated_at`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      key: "config:financial_pricing",
      value: JSON.stringify(currentPricing),
      updated_at: new Date().toISOString(),
    }),
  });
}

// Calcula o resumo financeiro para uma única OP
export function computeOpFinancial(
  op: PedidoOpRaw,
  apontamentos: ApontamentoRaw[],
  custosSetor: CustoSetorConfig[],
  insumos: Insumo[],
  savedPrices: Record<string, number>
): OpFinancialSummary {
  const custoSetorMap = new Map<string, CustoSetorConfig>();
  custosSetor.forEach(c => custoSetorMap.set(c.setor.toUpperCase(), c));

  const material = op.material || (apontamentos[0]?.material) || "PEBD VIRGEM";
  const custoMpKg = getCustoMateriaPrimaKg(material, insumos);

  // Agrupa apontamentos por setor
  const setorMap = new Map<string, { kg: number; aparas: number; horas: number; datas: string[] }>();
  let aparasTotalKg = 0;

  apontamentos.forEach(a => {
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
    // Caso não haja apontamento específico, pega a soma total de kg apontados
    quantidadeFinalKg = Array.from(setorMap.values()).reduce((sum, item) => sum + item.kg, 0);
  }

  // Matéria prima bruta consumida (inclui peso líquido gerado + refugo gerado na extrusão)
  const pesoBrutoExtrusao = extrusaoData ? (extrusaoData.kg + extrusaoData.aparas) : (quantidadeFinalKg + aparasTotalKg);
  const totalMateriaPrimaKg = Math.max(pesoBrutoExtrusao, quantidadeFinalKg + aparasTotalKg);
  let custoTotalMp = totalMateriaPrimaKg * custoMpKg;

  // Se o produto é impresso, adiciona insumo de tinta flexográfica (~ R$ 1.30/kg impresso)
  const impressaoData = setorMap.get("IMPRESSÃO");
  if (impressaoData && impressaoData.kg > 0) {
    custoTotalMp += impressaoData.kg * 1.35; // tintas, solventes, fotopolímeros
  }

  // Custos operacionais por setor
  const detalheSetores: CustoSetorDetalhe[] = [];
  let custoTotalOperacional = 0;

  setorMap.forEach((val, setorNome) => {
    const conf = custoSetorMap.get(setorNome) || {
      setor: setorNome as Sector,
      custo_hora_maquina: 75,
      custo_hora_homem: 35,
      perda_padrao_tolerada_pct: 3,
    };

    // Horas: se apontadas > 0 usa apontadas, senão estima pela produtividade padrão
    const velocidade = VELOCIDADE_PADRAO_SETOR[setorNome] || 60;
    const horasEstimadas = val.horas > 0 ? val.horas : (val.kg > 0 ? Math.round((val.kg / velocidade) * 10) / 10 : 0.5);

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

  // Perdas / Aparas:
  // Custo bruto das aparas = aparasTotalKg * custoMpKg
  // Recuperação por moagem / venda de apara (~45% do valor da resina virgem recuperável)
  const custoBrutoAparas = aparasTotalKg * custoMpKg;
  const recuperacaoApara = custoBrutoAparas * 0.45;
  const custoLiquidoAparas = Math.max(0, custoBrutoAparas - recuperacaoApara);

  // Custo Total de Fabricação
  const custoTotalFabricacao = Math.round((custoTotalMp + custoTotalOperacional + custoLiquidoAparas) * 100) / 100;

  // Custo Real por Kg
  const pesoBaseDivisao = quantidadeFinalKg > 0 ? quantidadeFinalKg : (totalMateriaPrimaKg > 0 ? totalMateriaPrimaKg : 1);
  const custoRealPorKg = Math.round((custoTotalFabricacao / pesoBaseDivisao) * 100) / 100;

  // Preço de venda praticado: prioriza salvo em banco, senão sugerido
  const precoVendaKg = savedPrices[op.id] || op.preco_venda_kg || getPrecoVendaSugerido(material);
  const receitaTotal = Math.round((quantidadeFinalKg * precoVendaKg) * 100) / 100;
  const lucroBruto = Math.round((receitaTotal - custoTotalFabricacao) * 100) / 100;
  const margemLucroPct = receitaTotal > 0 ? Math.round(((lucroBruto / receitaTotal) * 100) * 10) / 10 : 0;

  // Percentual de perda
  const perdaRealPct = totalMateriaPrimaKg > 0 ? Math.round(((aparasTotalKg / totalMateriaPrimaKg) * 100) * 10) / 10 : 0;

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

  // Datas
  const allDates: string[] = [];
  setorMap.forEach(v => allDates.push(...v.datas));
  allDates.sort();
  const dataUltima = allDates.length > 0 ? allDates[allDates.length - 1] : undefined;

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
  };
}

// Carrega todas as OPs com dados financeiros calculados
export async function loadAllOpFinancials(): Promise<{
  summaries: OpFinancialSummary[];
  custosSetor: CustoSetorConfig[];
  insumos: Insumo[];
  totalReceita: number;
  totalCusto: number;
  totalLucro: number;
  margemGeralPct: number;
}> {
  // 1. Carrega em paralelo: pedidos, apontamentos, custos, insumos, preços salvos
  const [pedidosRes, apontamentosRes, custosSetor, insumos, savedPrices] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/pedidos_op?select=id,numero_op,cliente,descricao_item,material,quantidade_planejada_kg,status_producao&limit=2000`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    }).then(r => (r.ok ? r.json() : [])),

    fetch(`${SUPABASE_URL}/rest/v1/apontamentos_producao?select=id,op_id,setor,maquina_id,qtd_produzida_kg,aparas_kg,picote_kg,horas_trabalhadas,material,cliente,descricao_item,data_producao&limit=3000`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    }).then(r => (r.ok ? r.json() : [])),

    loadCustosSetor().catch(() => DEFAULT_CUSTOS_SETORES),
    loadInsumos().catch(() => []),
    loadSavedPricing().catch(() => ({})),
  ]);

  const pedidos = (pedidosRes || []) as PedidoOpRaw[];
  const apontamentos = (apontamentosRes || []) as ApontamentoRaw[];

  // Agrupa apontamentos por op_id
  const apontamentosByOp = new Map<string, ApontamentoRaw[]>();
  apontamentos.forEach(a => {
    if (!a.op_id) return;
    if (!apontamentosByOp.has(a.op_id)) {
      apontamentosByOp.set(a.op_id, []);
    }
    apontamentosByOp.get(a.op_id)!.push(a);
  });

  // Cria mapa de pedidos por id
  const pedidoMap = new Map<string, PedidoOpRaw>();
  pedidos.forEach(p => pedidoMap.set(p.id, p));

  // Coleta todas as OPs que possuem apontamentos OU estão cadastradas como pedidos
  const uniqueOpIds = new Set<string>();
  apontamentosByOp.forEach((_, opId) => uniqueOpIds.add(opId));
  pedidos.forEach(p => {
    if (apontamentosByOp.has(p.id)) {
      uniqueOpIds.add(p.id);
    }
  });

  const summaries: OpFinancialSummary[] = [];

  uniqueOpIds.forEach(opId => {
    const apts = apontamentosByOp.get(opId) || [];
    const firstApt = apts[0];

    const pedido = pedidoMap.get(opId) || {
      id: opId,
      cliente: firstApt?.cliente || "Cliente Industrial",
      descricao_item: firstApt?.descricao_item || "Item Plástico",
      material: firstApt?.material || "PEBD",
      quantidade_planejada_kg: 0,
      status_producao: "FINALIZADO",
    };

    const fin = computeOpFinancial(pedido, apts, custosSetor, insumos, savedPrices);
    // Apenas inclui se houve alguma produção ou apontamento
    if (fin.quantidade_final_kg > 0 || fin.custo_total_fabricacao > 0) {
      summaries.push(fin);
    }
  });

  // Ordena por OP decrescente (mais recentes primeiro)
  summaries.sort((a, b) => {
    const numA = parseInt(a.op_id, 10);
    const numB = parseInt(b.op_id, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
    return b.op_id.localeCompare(a.op_id);
  });

  // Totais agregados
  const totalReceita = summaries.reduce((acc, item) => acc + item.receita_total, 0);
  const totalCusto = summaries.reduce((acc, item) => acc + item.custo_total_fabricacao, 0);
  const totalLucro = totalReceita - totalCusto;
  const margemGeralPct = totalReceita > 0 ? Math.round(((totalLucro / totalReceita) * 100) * 10) / 10 : 0;

  return {
    summaries,
    custosSetor,
    insumos,
    totalReceita,
    totalCusto,
    totalLucro,
    margemGeralPct,
  };
}
