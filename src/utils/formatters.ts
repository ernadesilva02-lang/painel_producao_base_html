import { Order, Production, Machine, Totals, ProductCategory, PRODUCT_CATEGORIES, SECTORS } from "../types/forpack";

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
