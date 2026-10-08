import { Order, Production, Machine, Totals, ProductCategory, PRODUCT_CATEGORIES, SECTORS, PaleteRomaneio } from "../types/forpack";

export function json<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function number(value?: string): number {
  if (!value) return 0;
  const n = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value;
  return Number(n) || 0;
}

export function kg(value: number): string {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`;
}

export function date(value?: string): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}

export function inferredCategory(order: Pick<Order, "descricaoItem" | "material" | "tipoPrazo" | "categoriaProduto">): ProductCategory {
  if (order.categoriaProduto) return order.categoriaProduto;
  const text = `${order.descricaoItem || ""} ${order.material || ""}`.toLocaleUpperCase("pt-BR");
  const format = /\bSACO\b/.test(text) ? "SACO" : /\b(FILME|BOBINA)\b/.test(text) ? "FILME" : "";
  const laminated = /\b(LAM|LAMINADO|BOPP\+|PET\+)\b/.test(text);
  const printed = /\b(IMP|IMPRESSO|IMPRESSA)\b/.test(text) || order.tipoPrazo?.startsWith("IMPRESSO");
  if (format === "SACO") return laminated ? "SACO_LAMINADO" : printed ? "SACO_IMPRESSO" : "SACO_LISO";
  if (format === "FILME") return laminated ? "FILME_LAMINADO" : printed ? "FILME_IMPRESSO" : "FILME_LISO";
  return "NAO_CLASSIFICADO";
}

export function categoryLabel(order: Pick<Order, "descricaoItem" | "material" | "tipoPrazo" | "categoriaProduto">): string {
  return PRODUCT_CATEGORIES.find(item => item.value === inferredCategory(order))?.label || "Não classificado";
}

export function addCalendarDays(value: string, days: number): string {
  const result = new Date(`${value}T12:00:00`);
  result.setDate(result.getDate() + days);
  return result.toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });
}

export function deadlineOf(order: Order) {
  const rule = order.tipoPrazo || "IMPRESSO_REPETICAO";
  if (rule === "LISO") {
    return { due: addCalendarDays(order.data, 20), label: "Liso · 20 dias", waiting: false, legacy: false };
  }
  if (rule === "IMPRESSO_NOVO") {
    return order.dataChegadaCliche
      ? { due: addCalendarDays(order.dataChegadaCliche, 30), label: "Impresso novo · 30 dias após clichê", waiting: false, legacy: false }
      : { due: "", label: "Impresso novo · aguardando clichê", waiting: true, legacy: false };
  }
  return {
    due: addCalendarDays(order.data, 30),
    label: order.tipoPrazo ? "Impresso repetição · 30 dias" : "Regra geral · 30 dias (confirmar tipo)",
    waiting: false,
    legacy: !order.tipoPrazo,
  };
}

export function getOrderSectorTotal(
  order: Order,
  sector: string,
  totals?: Map<string, Totals>,
  records: Production[] = [],
  machines: Machine[] = []
): number {
  if (totals) {
    const directTotal =
      totals.get(order.id)?.[sector] ??
      (order.numeroPedido ? totals.get(String(order.numeroPedido))?.[sector] : undefined) ??
      (order.numeroOp ? totals.get(String(order.numeroOp))?.[sector] : undefined);
    if (directTotal !== undefined && directTotal > 0) return directTotal;
  }

  if (!records.length || !machines.length) return 0;
  const machineSector = new Map(machines.map(m => [m.id, (m.setor || "").toUpperCase()]));
  return records
    .filter(record => {
      const match =
        String(record.idPedido) === String(order.id) ||
        (order.numeroPedido && String(record.idPedido) === String(order.numeroPedido)) ||
        (order.numeroOp && String(record.idPedido) === String(order.numeroOp));
      if (!match) return false;
      const recSector = machineSector.get(String(record.maquinaId || ""));
      return recSector === sector;
    })
    .reduce((sum, record) => sum + number(record.qtdProduzido), 0);
}

export function orderBalance(order: Order, records: Production[], machines: Machine[]) {
  const machineMap = new Map(machines.map(machine => [machine.id, machine]));
  const items = records.filter(
    record => record.idPedido === order.id || record.idPedido === order.numeroOp || record.idPedido === order.numeroPedido
  );
  const steps = SECTORS.map(sector => {
    const stageRecords = items.filter(
      record => machineMap.get(String(record.maquinaId || ""))?.setor.toUpperCase() === sector
    );
    return {
      sector,
      produced: stageRecords.reduce((sum, record) => sum + number(record.qtdProduzido), 0),
      loss: stageRecords.reduce((sum, record) => sum + number(record.aparas) + number(record.picote), 0),
      count: stageRecords.length,
    };
  })
    .filter(step => step.count || step.produced || step.loss)
    .map((step, index, array) => ({
      ...step,
      difference: index ? array[index - 1].produced - step.produced - step.loss : 0,
    }));

  const initial = steps[0]?.produced || 0;
  const final = steps[steps.length - 1]?.produced || 0;
  const realLoss = Math.max(0, initial - final);
  const declaredLoss = steps.slice(1).reduce((sum, step) => sum + step.loss, 0);
  const divergence = steps.slice(1).reduce((sum, step) => sum + Math.abs(step.difference), 0);
  return { steps, initial, final, realLoss, declaredLoss, divergence, yieldRate: initial ? (final / initial) * 100 : 0 };
}

export function group(status = ""): "Finalizado" | "Aguardando" | "Em produção" | "Programado" {
  const s = status.toUpperCase();
  if (s === "FINALIZADO") return "Finalizado";
  if (s.includes("AGUARDANDO PROGRAMAÇÃO")) return "Aguardando";
  if (s.includes("FILA") || s.includes("PRODUÇÃO") || s.includes("EXPEDIÇÃO")) return "Em produção";
  return "Programado";
}

/**
 * Verifica estritamente se uma OP está com status ativo de produção
 * (EM PRODUÇÃO, FILA DA ..., PRODUÇÃO, etc., excluindo Aguardando e Finalizado).
 */
export function isOrderInProduction(order?: Order | null): boolean {
  if (!order) return false;
  const status = (order.statusProducao || "").toUpperCase().trim();
  if (!status || status === "FINALIZADO" || status.includes("AGUARDANDO PROGRAMAÇÃO")) {
    return false;
  }
  return (
    status === "EM PRODUÇÃO" ||
    status === "EM PRODUCAO" ||
    status.includes("PRODUÇÃO") ||
    status.includes("PRODUCAO") ||
    status.includes("FILA") ||
    status.includes("EXPEDIÇÃO") ||
    group(order.statusProducao) === "Em produção"
  );
}

/**
 * Calcula o resumo consolidado de quantidade produzida em cada setor fabril para uma OP
 */
export function getOrderSectorBreakdown(
  order: Order,
  records: Production[] = [],
  machines: Machine[] = [],
  totals?: Map<string, Totals>
) {
  const machineSector = new Map<string, string>();
  machines.forEach(m => {
    if (m.id) machineSector.set(String(m.id).toUpperCase(), (m.setor || "").toUpperCase());
    if (m.name) machineSector.set(String(m.name).toUpperCase(), (m.setor || "").toUpperCase());
  });

  const orderMatches = (record: Production) => {
    const idPed = String(record.idPedido || "").toLowerCase().trim();
    const oId = String(order.id || "").toLowerCase().trim();
    const op = String(order.numeroOp || "").toLowerCase().trim();
    const ped = String(order.numeroPedido || "").toLowerCase().trim();
    return idPed === oId || (op !== "" && idPed === op) || (ped !== "" && idPed === ped);
  };

  const orderRecords = records.filter(orderMatches);

  const breakdown = SECTORS.map(sector => {
    let producedKg = 0;
    if (totals) {
      const direct =
        totals.get(order.id)?.[sector] ??
        (order.numeroPedido ? totals.get(String(order.numeroPedido))?.[sector] : undefined) ??
        (order.numeroOp ? totals.get(String(order.numeroOp))?.[sector] : undefined);
      if (direct !== undefined && direct > 0) {
        producedKg = direct;
      }
    }

    if (producedKg === 0 && orderRecords.length > 0) {
      producedKg = orderRecords
        .filter(r => {
          const recSector = machineSector.get(String(r.maquinaId || "").toUpperCase());
          return recSector === sector;
        })
        .reduce((sum, r) => sum + number(r.qtdProduzido), 0);
    }

    return {
      sector,
      producedKg,
    };
  });

  const totalProduced = breakdown.reduce((sum, b) => sum + b.producedKg, 0);
  const plannedKg = number(order.quantidade);

  return {
    breakdown,
    totalProduced,
    plannedKg,
    activeSectors: breakdown.filter(b => b.producedKg > 0),
  };
}

/**
 * Localiza com precisão cirúrgica a Ordem de Produção (OP) vinculada a um Palete / Romaneio.
 * - Evita comparações de campos vazios/undefined (que causavam falsos positivos com a 1ª OP da lista).
 * - Normaliza números de OP e Pedido retirando prefixos como "OP #", "OP", "PED #".
 * - Se a OP não for encontrada na lista em memória (ex: OP finalizada/arquivada),
 *   sintetiza um objeto Order fiel com os dados reais salvos no próprio Palete,
 *   garantindo que o cliente, número da OP e item jamais sejam substituídos.
 */
export function findOrderForPalete(
  orders: Order[],
  palete: PaleteRomaneio | null | undefined
): Order | null {
  if (!palete) return null;

  const clean = (val: any) =>
    String(val ?? "")
      .replace(/^OP\s*#?/i, "")
      .replace(/^PED\s*#?/i, "")
      .trim();

  const paleteOpId = clean(palete.opId);
  const paleteNumeroOp = clean(palete.numeroOp);
  const paleteNumeroPedido = clean(palete.numeroPedido);

  // Helper para conferir correspondência não-vazia
  const isMatch = (a: string, b: string) =>
    !!a && !!b && a.toLowerCase() === b.toLowerCase();

  // 1. Tentar por ID primário do Pedido/OP
  let found = paleteOpId
    ? orders.find((o) => isMatch(clean(o.id), paleteOpId))
    : undefined;

  // 2. Tentar por número da OP
  if (!found && paleteNumeroOp) {
    found = orders.find(
      (o) =>
        isMatch(clean(o.numeroOp), paleteNumeroOp) ||
        isMatch(clean(o.id), paleteNumeroOp) ||
        isMatch(clean(o.numeroPedido), paleteNumeroOp)
    );
  }

  // 3. Tentar por opId contra numeroOp/numeroPedido
  if (!found && paleteOpId) {
    found = orders.find(
      (o) =>
        isMatch(clean(o.numeroOp), paleteOpId) ||
        isMatch(clean(o.numeroPedido), paleteOpId)
    );
  }

  // 4. Tentar por número do Pedido
  if (!found && paleteNumeroPedido) {
    found = orders.find(
      (o) =>
        isMatch(clean(o.numeroPedido), paleteNumeroPedido) ||
        isMatch(clean(o.numeroOp), paleteNumeroPedido)
    );
  }

  // 5. Tentar por Cliente e Descrição do Item se ambos existirem e cliente não for genérico
  if (
    !found &&
    palete.cliente &&
    palete.cliente.trim() !== "FORPACK CLIENTE" &&
    palete.descricaoItem
  ) {
    const paleteClient = palete.cliente.trim().toLowerCase();
    const paleteItem = palete.descricaoItem.trim().toLowerCase();
    found = orders.find(
      (o) =>
        (o.cliente || "").trim().toLowerCase() === paleteClient &&
        (o.descricaoItem || "").trim().toLowerCase() === paleteItem
    );
  }

  // Se encontrou na lista de OPs em memória, retorna o objeto completo
  if (found) {
    return found;
  }

  // Fallback seguro: se a OP não estiver no array de orders carregados,
  // sintetiza um objeto Order fiel a partir dos dados gravados no próprio palete.
  // JAMAIS retorna nulo ou permite substituir pela OP ativa da máquina!
  return {
    id: palete.opId || palete.numeroOp || `op-${palete.id}`,
    numeroOp: palete.numeroOp || palete.numeroPedido || palete.opId || "",
    numeroPedido: palete.numeroPedido || "",
    cliente: palete.cliente || "Cliente Forpack",
    descricaoItem: palete.descricaoItem || "Produto Acabado",
    quantidade: "0",
    data: palete.data || new Date().toISOString().split("T")[0],
    statusProducao: "EM PRODUÇÃO",
    material: "",
  };
}

/**
 * Compara identificadores de máquina com alta tolerância (id, nome, siglas e códigos de setor)
 * Ex: "REBOBINADEIRA" <-> "REB1", "REBOBINADEIRA 1", "rmtn8qhgh3481my"
 * "EF1" <-> "EF1 - HGR COEX", "CF1" <-> "CF1 - HECE 1100"
 */
export function isMachineMatch(
  machIdOrName: string | undefined | null,
  targetMach: Machine | undefined | null
): boolean {
  if (!machIdOrName || !targetMach) return false;
  const a = machIdOrName.trim().toLowerCase();
  const mId = (targetMach.id || "").trim().toLowerCase();
  const mName = (targetMach.name || "").trim().toLowerCase();

  // 1. Igualdade direta exata
  if (a === mId || a === mName) return true;

  // 2. Normalização alfanumérica
  const normA = a.replace(/[^a-z0-9]/g, "");
  const normId = mId.replace(/[^a-z0-9]/g, "");
  const normName = mName.replace(/[^a-z0-9]/g, "");
  if (normA && (normA === normId || normA === normName)) return true;

  // 3. Prefixo / sufixo
  if (normId && normA.startsWith(normId)) return true;
  if (normName && (normName.startsWith(normA) || normA.startsWith(normName))) return true;

  // 4. Casos Rebobinadeira
  if ((a === "reb1" || a === "reb 1") && normName.includes("rebobinadeira1")) return true;
  if ((a === "reb2" || a === "reb 2") && normName.includes("rebobinadeira2")) return true;
  if (normA.includes("rebobinadeira1") && (mId === "reb1" || normId === "reb1")) return true;
  if (normA.includes("rebobinadeira2") && (mId === "rmtn8qhgh3481my" || normName.includes("rebobinadeira2"))) return true;
  if (normA === "rebobinadeira" && (mId === "reb1" || normName.includes("rebobinadeira1"))) return true;

  // 5. Casos Corte
  if (normA === "cf1" && (normName.startsWith("cf1") || mId === "rmrjqqy8oxdm4gk")) return true;
  if (normA === "cf2" && normName.startsWith("cf2")) return true;
  if (normA === "cf3" && normName.startsWith("cf3")) return true;

  return false;
}

/**
 * Localiza com precisão cirúrgica a Ordem de Produção (OP) vinculada a um apontamento de produção (Production record).
 */
export function findOrderForRecord(
  orders: Order[],
  record: Production | null | undefined
): Order | null {
  if (!record) return null;
  const targetId = (record.idPedido || "").trim();

  if (targetId) {
    // 1. Match exato por ID primário da OP
    const exactId = orders.find((o) => o.id === targetId);
    if (exactId) return exactId;

    // 2. Match normalizado por numeroOp
    const cleanNum = targetId.replace(/^(OP|PED)\s*#?/i, "").trim().toLowerCase();
    const matchOp = orders.find(
      (o) => (o.numeroOp || "").trim().toLowerCase() === cleanNum
    );
    if (matchOp) return matchOp;

    // 3. Match por numeroPedido
    const matchPed = orders.find(
      (o) => (o.numeroPedido || "").trim().toLowerCase() === cleanNum
    );
    if (matchPed) return matchPed;

    // 4. Match numérico puro se houver dígitos suficientes (ex: "9748", "9752", "9296")
    const digitsOnly = targetId.replace(/\D/g, "");
    if (digitsOnly && digitsOnly.length >= 3) {
      const matchDigits = orders.find(
        (o) =>
          (o.numeroOp && o.numeroOp.replace(/\D/g, "") === digitsOnly) ||
          (o.numeroPedido && o.numeroPedido.replace(/\D/g, "") === digitsOnly) ||
          (o.id && o.id.replace(/\D/g, "") === digitsOnly)
      );
      if (matchDigits) return matchDigits;
    }
  }

  // 5. Match por Cliente e Descrição do Item gravados no próprio apontamento
  if (record.cliente && record.descricaoItem) {
    const cTarget = record.cliente.trim().toLowerCase();
    const dTarget = record.descricaoItem.trim().toLowerCase();
    const matchClientItem = orders.find(
      (o) =>
        (o.cliente || "").trim().toLowerCase() === cTarget &&
        (o.descricaoItem || "").trim().toLowerCase() === dTarget
    );
    if (matchClientItem) return matchClientItem;
  }

  // 6. Match por Cliente se cliente for representativo
  if (record.cliente && record.cliente.length > 3 && record.cliente.trim() !== "FORPACK CLIENTE") {
    const cTarget = record.cliente.trim().toLowerCase();
    const matchClient = orders.find(
      (o) =>
        (o.cliente || "").trim().toLowerCase().includes(cTarget) ||
        cTarget.includes((o.cliente || "").trim().toLowerCase())
    );
    if (matchClient) return matchClient;
  }

  // 7. Fallback seguro: sintetiza objeto Order fiel a partir do próprio registro de produção
  if (record.cliente || record.descricaoItem || record.idPedido) {
    return {
      id: record.idPedido || `REC-${record.id || Date.now()}`,
      numeroOp: record.idPedido?.replace(/^(OP|PED)\s*#?/i, "").trim() || "",
      numeroPedido: record.idPedido?.replace(/^(OP|PED)\s*#?/i, "").trim() || "",
      data: record.dataProducao || new Date().toISOString().slice(0, 10),
      cliente: record.cliente || "Cliente Forpack",
      descricaoItem: record.descricaoItem || "Produto em Produção",
      quantidade: record.qtdProduzido || "0",
      maquinaId: record.maquinaId || "",
      statusProducao: "EM PRODUÇÃO",
    };
  }

  return null;
}

