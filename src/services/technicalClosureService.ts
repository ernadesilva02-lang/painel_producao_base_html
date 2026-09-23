import {
  Order,
  ClosureSnapshot,
  LaudoTecnico,
  Insumo,
  BobinaSemiAcabada,
  StatusEvent,
} from "../types/forpack";
import {
  SUPABASE_URL,
  SUPABASE_KEY,
  saveOrder,
  loadInsumos,
  loadBobinasWIP,
  updateStatusBobinaWIP,
  saveBobinaWIP,
  saveMovimentacaoEstoque,
} from "./supabaseApi";

export interface TechnicalClosureInput {
  order: Order;
  responsavel: string;
  observacao?: string;
  dataConclusao?: string;
  // Balanço físico
  pesoInicial: number;
  pesoFinal: number;
  perdaReal: number;
  perdaDeclarada: number;
  divergencia: number;
  aproveitamento: number;
  // Baixa automática de matéria-prima
  darBaixaInsumo: boolean;
  insumoId?: string;
  insumoNome?: string;
  quantidadeBaixaKg: number;
  // Rastreabilidade WIP
  arquivarWips: boolean;
  wipIds: string[];
  // Sobra de chão de fábrica
  registrarSobra: boolean;
  sobraPesoKg?: number;
  sobraSetorOrigem?: string;
  sobraSetorDestino?: string;
  sobraLarguraMm?: number;
  sobraEspessuraMicras?: number;
  // Laudo Técnico e Qualidade
  laudoTecnico: LaudoTecnico;
  updatedAtSource?: string;
}

// Procura o insumo mais adequado para o material da OP
export function findMatchingInsumo(material: string = "", insumos: Insumo[]): Insumo | undefined {
  if (!insumos || insumos.length === 0) return undefined;
  const m = material.toUpperCase();

  // 1. PP
  if (m.includes("PP")) {
    const found = insumos.find(i => i.nome.toUpperCase().includes("PP") || i.codigo.toUpperCase().includes("PP"));
    if (found) return found;
  }

  // 2. RECICLADO
  if (m.includes("RECICLADO") || m.includes("REC")) {
    const found = insumos.find(
      i => (i.nome.toUpperCase().includes("REC") || i.codigo.toUpperCase().includes("REC"))
    );
    if (found) return found;
  }

  // 3. PEAD
  if (m.includes("PEAD") || m.includes("ALTA DENSIDADE")) {
    const found = insumos.find(i => i.nome.toUpperCase().includes("PEAD") || i.codigo.toUpperCase().includes("PEAD"));
    if (found) return found;
  }

  // 4. PEBD / PELBD
  if (m.includes("PELBD") || m.includes("LINEAR")) {
    const found = insumos.find(i => i.nome.toUpperCase().includes("PELBD") || i.codigo.toUpperCase().includes("PELBD"));
    if (found) return found;
  }

  // 5. Default PEBD
  const pebd = insumos.find(i => i.nome.toUpperCase().includes("PEBD") || i.codigo.toUpperCase().includes("PEBD"));
  if (pebd) return pebd;

  // 6. Qualquer resina
  return insumos.find(i => i.categoria === "RESINA") || insumos[0];
}

// Carrega as bobinas WIP vinculadas à OP
export async function getOpWipBobinas(opId: string): Promise<BobinaSemiAcabada[]> {
  try {
    const all = await loadBobinasWIP();
    return all.filter(
      b => b.op_id === opId || b.numero_bobina.includes(opId)
    );
  } catch (err) {
    console.error("Erro ao carregar bobinas da OP:", err);
    return [];
  }
}

// Executa o fechamento técnico completo com baixa automática
export async function executeTechnicalClosure(input: TechnicalClosureInput): Promise<{
  success: boolean;
  order: Order;
  message: string;
}> {
  const { order, responsavel, laudoTecnico } = input;
  const now = input.dataConclusao || new Date().toISOString();
  const opLabel = order.numeroOp || order.numeroPedido || order.id;

  // 1. Snapshot do fechamento
  const snapshot: ClosureSnapshot = {
    responsavel: responsavel.trim() || "Ernade Silva",
    observacao: input.observacao?.trim() || undefined,
    data: now,
    pesoInicial: input.pesoInicial,
    pesoFinal: input.pesoFinal,
    perdaReal: input.perdaReal,
    perdaDeclarada: input.perdaDeclarada,
    divergencia: input.divergencia,
    aproveitamento: input.aproveitamento,
    insumoBaixadoId: input.darBaixaInsumo ? input.insumoId : undefined,
    insumoBaixadoNome: input.darBaixaInsumo ? input.insumoNome : undefined,
    quantidadeBaixadaKg: input.darBaixaInsumo ? input.quantidadeBaixaKg : undefined,
    sobraBobinaKg: input.registrarSobra ? input.sobraPesoKg : undefined,
    sobraNumeroBobina: input.registrarSobra
      ? `BOB-SOBRA-${opLabel}-${Date.now().toString(36).slice(-3).toUpperCase()}`
      : undefined,
    laudoTecnico: laudoTecnico,
  };

  const event: StatusEvent = {
    acao: "FECHAMENTO",
    data: now,
    responsavel: snapshot.responsavel,
    observacao: `Fechamento Técnico Concluído. Laudo: ${laudoTecnico.numeroLaudo}. Aproveitamento: ${snapshot.aproveitamento.toFixed(1)}%`,
  };

  const updatedOrder: Order = {
    ...order,
    statusProducao: "FINALIZADO",
    dataConclusao: now,
    fechamento: snapshot,
    historicoStatus: [...(order.historicoStatus || []), event],
  };

  // 2. Salva o pedido no app_storage
  await saveOrder(updatedOrder, input.updatedAtSource);

  // 3. Sincroniza diretamente na tabela pedidos_op se existir
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/pedidos_op?id=eq.${encodeURIComponent(order.id)}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status_producao: "FINALIZADO",
        data_conclusao: now,
        fechamento: snapshot,
      }),
    });
  } catch (syncErr) {
    console.warn("Aviso ao sincronizar pedidos_op:", syncErr);
  }

  // 4. Baixa de estoque da Matéria-Prima se habilitada
  if (input.darBaixaInsumo && input.insumoId && input.quantidadeBaixaKg > 0) {
    try {
      // Busca insumo atual para decrementar
      const insumoRes = await fetch(
        `${SUPABASE_URL}/rest/v1/insumos?id=eq.${encodeURIComponent(input.insumoId)}&select=*`,
        {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        }
      );
      if (insumoRes.ok) {
        const insumoData = await insumoRes.json();
        if (insumoData.length > 0) {
          const insumo = insumoData[0] as Insumo;
          const novoSaldo = Math.max(0, insumo.estoque_atual - input.quantidadeBaixaKg);

          // Atualiza saldo na tabela insumos
          await fetch(
            `${SUPABASE_URL}/rest/v1/insumos?id=eq.${encodeURIComponent(input.insumoId)}`,
            {
              method: "PATCH",
              headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                estoque_atual: novoSaldo,
                updated_at: new Date().toISOString(),
              }),
            }
          );

          // Registra a movimentação auditável
          await saveMovimentacaoEstoque({
            tipo_movimento: "CONSUMO_OP",
            tipo_item: "INSUMO",
            item_id: insumo.id,
            op_id: order.id,
            setor: "EXTRUSÃO",
            quantidade: input.quantidadeBaixaKg,
            custo_unitario: insumo.custo_unitario_medio,
            documento_referencia: `FECHAMENTO OP ${opLabel}`,
            observacao: `Baixa automática de matéria-prima no fechamento da OP. Cliente: ${order.cliente}`,
          });
        }
      }
    } catch (errBaixa) {
      console.error("Erro na baixa de insumo:", errBaixa);
    }
  }

  // 5. Arquivamento das bobinas WIP para CONSUMIDA
  if (input.arquivarWips && input.wipIds.length > 0) {
    for (const bobinaId of input.wipIds) {
      try {
        await updateStatusBobinaWIP(bobinaId, "CONSUMIDA", "FINALIZADO");
      } catch (errWip) {
        console.warn(`Aviso ao atualizar bobina ${bobinaId}:`, errWip);
      }
    }
  }

  // 6. Registro de Sobra Parcial de Bobina se houver
  if (input.registrarSobra && input.sobraPesoKg && input.sobraPesoKg > 0 && snapshot.sobraNumeroBobina) {
    try {
      await saveBobinaWIP({
        op_id: order.id,
        numero_bobina: snapshot.sobraNumeroBobina,
        setor_origem: (input.sobraSetorOrigem as any) || "CORTE",
        setor_destino: (input.sobraSetorDestino as any) || "REBOBINADEIRA",
        peso_liquido_kg: input.sobraPesoKg,
        largura_mm: input.sobraLarguraMm || null,
        espessura_micras: input.sobraEspessuraMicras || null,
        status: "DISPONIVEL",
        data_fabricacao: now.slice(0, 10),
        operador: snapshot.responsavel,
      });

      // Movimentação de estoque para a sobra
      await saveMovimentacaoEstoque({
        tipo_movimento: "RETORNO_APARA",
        tipo_item: "SEMIACABADO",
        op_id: order.id,
        quantidade: input.sobraPesoKg,
        documento_referencia: snapshot.sobraNumeroBobina,
        observacao: `Retorno de sobra aproveitável da OP ${opLabel} ao pátio WIP`,
      });
    } catch (errSobra) {
      console.error("Erro ao registrar sobra de bobina:", errSobra);
    }
  }

  return {
    success: true,
    order: updatedOrder,
    message: `Fechamento técnico da OP ${opLabel} concluído com sucesso e laudo ${laudoTecnico.numeroLaudo} gerado.`,
  };
}
