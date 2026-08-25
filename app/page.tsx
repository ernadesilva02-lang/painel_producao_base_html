"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

const SUPABASE_URL = "https://gbgmvqbxozzcloynwdbo.supabase.co";
const SUPABASE_KEY = "sb_publishable_5W3m26faz-Jhr8j42B5_Lg_t4EV6rSy";
const SECTORS = ["EXTRUSÃO", "IMPRESSÃO", "LAMINAÇÃO", "REBOBINADEIRA", "CORTE"] as const;

type StorageRow = { key: string; value: string; updated_at: string };
type Machine = { id: string; name: string; setor: string };
type ClosureSnapshot = { responsavel: string; observacao?: string; data: string; pesoInicial: number; pesoFinal: number; perdaReal: number; perdaDeclarada: number; divergencia: number; aproveitamento: number };
type StatusEvent = { acao: "FECHAMENTO" | "REABERTURA"; data: string; responsavel: string; observacao?: string };
type DeadlineRule = "LISO" | "IMPRESSO_REPETICAO" | "IMPRESSO_NOVO";
type ProductCategory = "SACO_LISO" | "SACO_IMPRESSO" | "SACO_LAMINADO" | "FILME_LISO" | "FILME_IMPRESSO" | "FILME_LAMINADO" | "NAO_CLASSIFICADO";
type Order = { id: string; numeroOp?: string; numeroPedido?: string; data: string; cliente: string; descricaoItem: string; quantidade: string; categoriaProduto?: ProductCategory; statusProducao?: string; material?: string; observacao?: string; maquinaId?: string; prioridade?: number; ordemFila?: number; dataConclusao?: string; tipoPrazo?: DeadlineRule; dataChegadaCliche?: string; fechamento?: ClosureSnapshot; historicoStatus?: StatusEvent[] };
type Production = { id?: string; idPedido?: string; maquinaId?: string; qtdProduzido?: string; dataProducao?: string; turno?: string; operador?: string; aparas?: string; picote?: string; cliente?: string; descricaoItem?: string; material?: string; _key?: string; _updatedAt?: string };
type Totals = Record<string, number>;
type RegistryKind = "operadores" | "clientes" | "produtos" | "materiais";
type RegistryData = Record<RegistryKind, string[]>;

const nav = ["Visão geral", "Central de prazos", "Lançamentos", "Relatório diário", "Painel mensal", "Pedidos / OP", "Programação PCP", "Produção", "Relatórios", "Cadastros"];
const PRODUCT_CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value:"SACO_LISO", label:"Saco liso" }, { value:"SACO_IMPRESSO", label:"Saco impresso" }, { value:"SACO_LAMINADO", label:"Saco laminado" },
  { value:"FILME_LISO", label:"Filme liso" }, { value:"FILME_IMPRESSO", label:"Filme impresso" }, { value:"FILME_LAMINADO", label:"Filme laminado" },
  { value:"NAO_CLASSIFICADO", label:"Não classificado" },
];

function json<T>(value: string, fallback: T): T { try { return JSON.parse(value) as T; } catch { return fallback; } }
function number(value?: string) { if (!value) return 0; const n = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value; return Number(n) || 0; }
function kg(value: number) { return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`; }
function date(value?: string) { if (!value) return "—"; const [y,m,d] = value.slice(0,10).split("-"); return y && m && d ? `${d}/${m}/${y}` : value; }
function inferredCategory(order: Pick<Order,"descricaoItem"|"material"|"tipoPrazo"|"categoriaProduto">): ProductCategory {
  if (order.categoriaProduto) return order.categoriaProduto;
  const text = `${order.descricaoItem || ""} ${order.material || ""}`.toLocaleUpperCase("pt-BR");
  const format = /\bSACO\b/.test(text) ? "SACO" : /\b(FILME|BOBINA)\b/.test(text) ? "FILME" : "";
  const laminated = /\b(LAM|LAMINADO|BOPP\+|PET\+)\b/.test(text);
  const printed = /\b(IMP|IMPRESSO|IMPRESSA)\b/.test(text) || order.tipoPrazo?.startsWith("IMPRESSO");
  if (format === "SACO") return laminated ? "SACO_LAMINADO" : printed ? "SACO_IMPRESSO" : "SACO_LISO";
  if (format === "FILME") return laminated ? "FILME_LAMINADO" : printed ? "FILME_IMPRESSO" : "FILME_LISO";
  return "NAO_CLASSIFICADO";
}
function categoryLabel(order: Pick<Order,"descricaoItem"|"material"|"tipoPrazo"|"categoriaProduto">) { return PRODUCT_CATEGORIES.find(item => item.value === inferredCategory(order))?.label || "Não classificado"; }
function addCalendarDays(value:string, days:number) { const result = new Date(`${value}T12:00:00`); result.setDate(result.getDate() + days); return result.toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" }); }
function deadlineOf(order:Order) {
  const rule = order.tipoPrazo || "IMPRESSO_REPETICAO";
  if (rule === "LISO") return { due: addCalendarDays(order.data,20), label:"Liso · 20 dias", waiting:false, legacy:false };
  if (rule === "IMPRESSO_NOVO") return order.dataChegadaCliche
    ? { due:addCalendarDays(order.dataChegadaCliche,30), label:"Impresso novo · 30 dias após clichê", waiting:false, legacy:false }
    : { due:"", label:"Impresso novo · aguardando clichê", waiting:true, legacy:false };
  return { due:addCalendarDays(order.data,30), label:order.tipoPrazo ? "Impresso repetição · 30 dias" : "Regra geral · 30 dias (confirmar tipo)", waiting:false, legacy:!order.tipoPrazo };
}
function orderBalance(order: Order, records: Production[], machines: Machine[]) {
  const machineMap = new Map(machines.map(machine => [machine.id, machine]));
  const items = records.filter(record => record.idPedido === order.id || record.idPedido === order.numeroOp || record.idPedido === order.numeroPedido);
  const steps = SECTORS.map(sector => {
    const stageRecords = items.filter(record => machineMap.get(String(record.maquinaId || ""))?.setor.toUpperCase() === sector);
    return { sector, produced: stageRecords.reduce((sum,record) => sum + number(record.qtdProduzido),0), loss: stageRecords.reduce((sum,record) => sum + number(record.aparas) + number(record.picote),0), count: stageRecords.length };
  }).filter(step => step.count || step.produced || step.loss).map((step,index,array) => ({ ...step, difference: index ? array[index - 1].produced - step.produced - step.loss : 0 }));
  const initial = steps[0]?.produced || 0;
  const final = steps[steps.length - 1]?.produced || 0;
  const realLoss = Math.max(0, initial - final);
  const declaredLoss = steps.slice(1).reduce((sum,step) => sum + step.loss,0);
  const divergence = steps.slice(1).reduce((sum,step) => sum + Math.abs(step.difference),0);
  return { steps, initial, final, realLoss, declaredLoss, divergence, yieldRate: initial ? final / initial * 100 : 0 };
}
function group(status = "") {
  const s = status.toUpperCase();
  if (s === "FINALIZADO") return "Finalizado";
  if (s.includes("AGUARDANDO PROGRAMAÇÃO")) return "Aguardando";
  if (s.includes("FILA") || s.includes("PRODUÇÃO") || s.includes("EXPEDIÇÃO")) return "Em produção";
  return "Programado";
}
async function loadRows() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/app_storage?select=key,value,updated_at&order=key.asc`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, cache: "no-store"
  });
  if (!response.ok) throw new Error("Não foi possível carregar os dados do painel.");
  return response.json() as Promise<StorageRow[]>;
}
async function saveOrder(order: Order, updatedAt: string) {
  const key = `pedido:${order.id}`;
  const endpoint = `${SUPABASE_URL}/rest/v1/app_storage?key=eq.${encodeURIComponent(key)}&updated_at=eq.${encodeURIComponent(updatedAt)}&select=key,value,updated_at`;
  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ value: JSON.stringify(order), updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error("Não foi possível salvar a programação.");
  const changed = await response.json() as StorageRow[];
  if (!changed.length) throw new Error("Este pedido foi alterado em outra tela. Atualize os dados e tente novamente.");
}
async function createOrder(input: Omit<Order, "id">) {
  const id = `PED-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const order: Order = { ...input, id, numeroOp: input.numeroOp?.trim() || "", numeroPedido: input.numeroPedido?.trim() || "", statusProducao: "AGUARDANDO PROGRAMAÇÃO", maquinaId: "", prioridade: 0 };
  const response = await fetch(`${SUPABASE_URL}/rest/v1/app_storage?select=key,value,updated_at`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ key: `pedido:${id}`, value: JSON.stringify(order), updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(response.status === 409 ? "Já existe um pedido com este identificador. Tente novamente." : "Não foi possível cadastrar o pedido.");
  return order;
}
async function saveProduction(order: Order, machine: Machine, input: Production) {
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const record = {
    id,
    idPedido: order.id,
    maquinaId: machine.id,
    dataPedido: order.data,
    dataProducao: input.dataProducao,
    turno: input.turno,
    operador: input.operador,
    qtdProduzido: input.qtdProduzido,
    aparas: input.aparas || "",
    picote: input.picote || "",
    cliente: order.cliente,
    descricaoItem: order.descricaoItem,
    quantidadePedido: order.quantidade,
    material: order.material || "",
  };
  const key = `record:${input.dataProducao}:${id}`;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/app_storage?select=key,value,updated_at`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ key, value: JSON.stringify(record), updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error("Não foi possível registrar a produção.");
}
async function updateProduction(record: Production) {
  if (!record._key || !record._updatedAt) throw new Error("Não foi possível identificar este apontamento.");
  const { _key, _updatedAt, ...stored } = record;
  const endpoint = `${SUPABASE_URL}/rest/v1/app_storage?key=eq.${encodeURIComponent(_key)}&updated_at=eq.${encodeURIComponent(_updatedAt)}&select=key,value,updated_at`;
  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ value: JSON.stringify(stored), updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error("Não foi possível atualizar o apontamento.");
  const changed = await response.json() as StorageRow[];
  if (!changed.length) throw new Error("Este apontamento foi alterado em outra tela. Atualize os dados e tente novamente.");
}
async function saveRegistry(kind: RegistryKind, values: string[], updatedAt: string) {
  const key = `config:${kind}`;
  const endpoint = `${SUPABASE_URL}/rest/v1/app_storage?key=eq.${encodeURIComponent(key)}&updated_at=eq.${encodeURIComponent(updatedAt)}&select=key,value,updated_at`;
  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ value: JSON.stringify(values), updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error("Não foi possível atualizar o cadastro.");
  const changed = await response.json() as StorageRow[];
  if (!changed.length) throw new Error("Este cadastro foi alterado em outra tela. Atualize os dados e tente novamente.");
}

export default function Home() {
  const [active, setActive] = useState("Pedidos / OP");
  const [rows, setRows] = useState<StorageRow[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Todos ativos");
  const [selected, setSelected] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [machineFilter, setMachineFilter] = useState("Todas");
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pcpView, setPcpView] = useState<"Aguardando" | "Programadas">("Aguardando");
  const [pcpMachine, setPcpMachine] = useState("Todas");
  const [pcpCategory, setPcpCategory] = useState<"Todas" | ProductCategory>("Todas");
  const [pcpSort, setPcpSort] = useState<"Data" | "Manual">("Data");
  const [selectedRecord, setSelectedRecord] = useState<Production | null>(null);
  const [reportMachine, setReportMachine] = useState("Todas");
  const [reportOperator, setReportOperator] = useState("Todos");
  const [reportStart, setReportStart] = useState("");
  const [reportEnd, setReportEnd] = useState("");
  const [dashboardMonth, setDashboardMonth] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" }).slice(0,7));
  const [registryKind, setRegistryKind] = useState<RegistryKind>("operadores");
  const [launchDate, setLaunchDate] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" }));
  const [launchMachine, setLaunchMachine] = useState("Todas");
  const [dailyReportDate, setDailyReportDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - 1);
    return today.toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });
  });
  const [monthlyStart, setMonthlyStart] = useState(() => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });
    return `${today.slice(0,7)}-01`;
  });
  const [monthlyEnd, setMonthlyEnd] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" }));
  const [monthlyMachine, setMonthlyMachine] = useState("Todas");
  const [monthlyOperator, setMonthlyOperator] = useState("Todos");
  const [monthlyOrder, setMonthlyOrder] = useState("Todas");

  async function refresh() {
    setLoading(true); setError("");
    try { setRows(await loadRows()); } catch (e) { setError(e instanceof Error ? e.message : "Erro ao carregar."); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  const data = useMemo(() => {
    const orders = rows.filter(r => r.key.startsWith("pedido:")).map(r => json<Order>(r.value, {} as Order));
    const records = rows.filter(r => r.key.startsWith("record:")).map(r => ({ ...json<Production>(r.value, {}), _key: r.key, _updatedAt: r.updated_at }));
    const machineRow = rows.find(r => r.key === "config:maquinas");
    const machines = machineRow ? json<Machine[]>(machineRow.value, []) : [];
    const config = (key: string) => {
      const row = rows.find(item => item.key === key);
      return row ? json<string[]>(row.value, []) : [];
    };
    const operators = config("config:operadores");
    const clients = config("config:clientes");
    const products = config("config:produtos");
    const materials = config("config:materiais");
    const registries: RegistryData = {
      operadores: operators,
      clientes: clients,
      produtos: products,
      materiais: materials,
    };
    const machineSector = new Map(machines.map(m => [m.id, m.setor.toUpperCase()]));
    const totals = new Map<string, Totals>();
    records.forEach(record => {
      const id = String(record.idPedido || ""); const sector = machineSector.get(String(record.maquinaId || "")) || "";
      if (!id || !sector) return;
      const current = totals.get(id) || {};
      current[sector] = (current[sector] || 0) + number(record.qtdProduzido);
      totals.set(id, current);
    });
    return { orders, records, totals, machines, operators, clients, products, materials, registries };
  }, [rows]);

  const activeOrders = useMemo(() => data.orders.filter(o => group(o.statusProducao) !== "Finalizado").sort((a,b) => (a.data || "").localeCompare(b.data || "")), [data.orders]);
  const finishedOrders = useMemo(() => data.orders.filter(o => group(o.statusProducao) === "Finalizado").sort((a,b) => (b.dataConclusao || b.data || "").localeCompare(a.dataConclusao || a.data || "")), [data.orders]);
  const visible = useMemo(() => {
    const term = query.toLocaleLowerCase("pt-BR").trim();
    const base = active === "Pedidos / OP" && filter === "Finalizados" ? finishedOrders : activeOrders;
    return base.filter(order => {
      const g = group(order.statusProducao);
      return (active !== "Programação PCP" || (pcpView === "Aguardando" ? g === "Aguardando" && (pcpCategory === "Todas" || inferredCategory(order) === pcpCategory) : g !== "Aguardando" && g !== "Finalizado" && (pcpMachine === "Todas" || order.maquinaId === pcpMachine) && (pcpCategory === "Todas" || inferredCategory(order) === pcpCategory)))
        && (active !== "Produção" || (g === "Em produção" && order.maquinaId && (machineFilter === "Todas" || order.maquinaId === machineFilter)))
        && (filter === "Todos ativos" || filter === "Finalizados" || g === filter)
        && (!term || `${order.id} ${order.numeroPedido || ""} ${order.numeroOp || ""} ${order.cliente} ${order.descricaoItem}`.toLocaleLowerCase("pt-BR").includes(term));
    });
  }, [activeOrders, finishedOrders, active, filter, query, machineFilter, pcpView, pcpMachine, pcpCategory]);
  const pcpQueue = useMemo(() => visible.slice().sort((a,b) => {
    const machine = String(a.maquinaId || "").localeCompare(String(b.maquinaId || ""));
    if (pcpMachine === "Todas" && machine) return machine;
    if (pcpSort === "Data") {
      const orderDate = (a.data || "9999-12-31").localeCompare(b.data || "9999-12-31");
      return orderDate || (a.ordemFila ?? Number.MAX_SAFE_INTEGER) - (b.ordemFila ?? Number.MAX_SAFE_INTEGER) || String(a.numeroPedido || a.id).localeCompare(String(b.numeroPedido || b.id), "pt-BR", { numeric:true });
    }
    const position = (a.ordemFila ?? Number.MAX_SAFE_INTEGER) - (b.ordemFila ?? Number.MAX_SAFE_INTEGER);
    return position || (b.prioridade || 0) - (a.prioridade || 0) || (a.data || "").localeCompare(b.data || "");
  }), [visible, pcpMachine, pcpSort]);
  const pcpCategorySummary = useMemo(() => {
    const grouped = new Map<ProductCategory, { category: ProductCategory; label: string; orders: number; totalKg: number }>();
    pcpQueue.forEach(order => {
      const category = inferredCategory(order);
      const current = grouped.get(category) || { category, label: categoryLabel(order), orders: 0, totalKg: 0 };
      current.orders += 1;
      current.totalKg += number(order.quantidade);
      grouped.set(category, current);
    });
    return PRODUCT_CATEGORIES.map(item => grouped.get(item.value)).filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [pcpQueue]);
  const metrics = useMemo(() => ({
    active: activeOrders.length,
    producing: activeOrders.filter(o => group(o.statusProducao) === "Em produção").length,
    programmed: activeOrders.filter(o => !["Aguardando","Finalizado"].includes(group(o.statusProducao))).length,
    waiting: activeOrders.filter(o => group(o.statusProducao) === "Aguardando").length,
    pointed: activeOrders.filter(o => Object.values(data.totals.get(o.id) || {}).some(v => v > 0)).length,
  }), [activeOrders, data.totals]);
  const reportRecords = useMemo(() => {
    const term = query.toLocaleLowerCase("pt-BR").trim();
    return data.records.filter(record => {
      const order = data.orders.find(item => item.id === record.idPedido || item.numeroOp === record.idPedido);
      const searchable = `${record.idPedido || ""} ${order?.numeroOp || ""} ${record.cliente || order?.cliente || ""} ${record.descricaoItem || order?.descricaoItem || ""} ${record.operador || ""}`.toLocaleLowerCase("pt-BR");
      return (reportMachine === "Todas" || record.maquinaId === reportMachine)
        && (reportOperator === "Todos" || record.operador === reportOperator)
        && (!reportStart || (record.dataProducao || "") >= reportStart)
        && (!reportEnd || (record.dataProducao || "") <= reportEnd)
        && (!term || searchable.includes(term));
    }).sort((a,b) => `${b.dataProducao || ""}${b.id || ""}`.localeCompare(`${a.dataProducao || ""}${a.id || ""}`));
  }, [data.records, data.orders, query, reportMachine, reportOperator, reportStart, reportEnd]);
  const monthlyRecords = useMemo(() => data.records.filter(record => (record.dataProducao || "").slice(0,7) === dashboardMonth), [data.records, dashboardMonth]);
  const launchRecords = useMemo(() => data.records.filter(record =>
    record.dataProducao === launchDate
    && (launchMachine === "Todas" || record.maquinaId === launchMachine)
  ).sort((a,b) => `${b._updatedAt || ""}${b.id || ""}`.localeCompare(`${a._updatedAt || ""}${a.id || ""}`)), [data.records, launchDate, launchMachine]);
  const dailyReportRecords = useMemo(
    () => data.records.filter(record => record.dataProducao === dailyReportDate),
    [data.records, dailyReportDate],
  );
  const monthlyReportRecords = useMemo(() => data.records.filter(record =>
    (!monthlyStart || (record.dataProducao || "") >= monthlyStart)
    && (!monthlyEnd || (record.dataProducao || "") <= monthlyEnd)
    && (monthlyMachine === "Todas" || record.maquinaId === monthlyMachine)
    && (monthlyOperator === "Todos" || record.operador === monthlyOperator)
    && (monthlyOrder === "Todas" || record.idPedido === monthlyOrder)
  ).sort((a,b) => `${b.dataProducao || ""}${b.id || ""}`.localeCompare(`${a.dataProducao || ""}${a.id || ""}`)), [data.records, monthlyStart, monthlyEnd, monthlyMachine, monthlyOperator, monthlyOrder]);

  function navigate(item: string) {
    if (!["Visão geral", "Central de prazos", "Lançamentos", "Relatório diário", "Painel mensal", "Pedidos / OP", "Programação PCP", "Produção", "Relatórios", "Cadastros"].includes(item)) return;
    setActive(item); setFilter("Todos ativos"); setMachineFilter("Todas"); setPcpMachine("Todas"); setPcpCategory("Todas"); setPcpView("Aguardando"); setSelected(null); setEditing(false); setMenu(false);
  }

  async function programOrder(order: Order, machineId: string, priority: boolean) {
    const machine = data.machines.find(machine => machine.id === machineId);
    const source = rows.find(row => row.key === `pedido:${order.id}`);
    if (!machine || !source) return;
    const currentQueue = activeOrders.filter(item => item.maquinaId === machine.id && item.id !== order.id && group(item.statusProducao) !== "Finalizado");
    const lastPosition = currentQueue.reduce((max,item) => Math.max(max,item.ordemFila || 0),0);
    const updated: Order = {
      ...order,
      maquinaId: machine.id,
      prioridade: priority ? 1 : 0,
      ordemFila: order.maquinaId === machine.id && order.ordemFila ? order.ordemFila : lastPosition + 1,
      statusProducao: `FILA DA ${machine.setor.toUpperCase()}`,
    };
    setSaving(true); setNotice("");
    try {
      await saveOrder(updated, source.updated_at);
      setSelected(null);
      setNotice(`${order.maquinaId ? "OP reprogramada" : "Pedido programado"} na ${machine.name}.`);
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erro ao salvar a programação.");
    } finally {
      setSaving(false);
    }
  }

  async function returnOrderToWaiting(order: Order) {
    const source = rows.find(row => row.key === `pedido:${order.id}`);
    if (!source) return setNotice("Não foi possível localizar este pedido para reprogramação.");
    const updated: Order = {
      ...order,
      maquinaId: "",
      prioridade: 0,
      ordemFila: undefined,
      statusProducao: "AGUARDANDO PROGRAMAÇÃO",
    };
    setSaving(true); setNotice("");
    try {
      await saveOrder(updated, source.updated_at);
      setSelected(null);
      setNotice(`Pedido ${order.numeroPedido || order.numeroOp || order.id} retornou para Aguardando Programação.`);
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível retornar o pedido para Aguardando Programação.");
    } finally {
      setSaving(false);
    }
  }

  async function movePcpOrder(order: Order, direction: -1 | 1) {
    if (pcpMachine === "Todas") return setNotice("Selecione uma máquina para alterar a sequência da fila.");
    if (pcpSort !== "Manual") return setNotice("Para usar as setas, altere a ordenação para Sequência manual.");
    const queue = pcpQueue.filter(item => item.maquinaId === pcpMachine);
    const index = queue.findIndex(item => item.id === order.id);
    const other = queue[index + direction];
    if (index < 0 || !other) return;
    const sourceA = rows.find(row => row.key === `pedido:${order.id}`);
    const sourceB = rows.find(row => row.key === `pedido:${other.id}`);
    if (!sourceA || !sourceB) return;
    const positionA = order.ordemFila ?? index + 1;
    const positionB = other.ordemFila ?? index + direction + 1;
    setSaving(true); setNotice("");
    try {
      await saveOrder({ ...order, ordemFila: positionB }, sourceA.updated_at);
      await saveOrder({ ...other, ordemFila: positionA }, sourceB.updated_at);
      setNotice("Sequência da fila atualizada.");
      await refresh();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Não foi possível alterar a sequência."); }
    finally { setSaving(false); }
  }

  function printPcpQueue() {
    const machine = data.machines.find(item => item.id === pcpMachine);
    if (!machine) return setNotice("Selecione uma máquina para imprimir a fila.");
    const queue = pcpQueue.filter(item => item.maquinaId === machine.id);
    if (!queue.length) return setNotice("Não há pedidos na fila da máquina selecionada.");
    const produced = (order:Order) => data.records.filter(record => record.maquinaId === machine.id && (record.idPedido === order.id || record.idPedido === order.numeroOp || record.idPedido === order.numeroPedido)).reduce((sum,record) => sum + number(record.qtdProduzido),0);
    const safe = (value:unknown) => String(value ?? "").replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[character] || character));
    const categoryTotals = PRODUCT_CATEGORIES.map(category => {
      const categoryOrders = queue.filter(order => inferredCategory(order) === category.value);
      return { ...category, orders: categoryOrders.length, totalKg: categoryOrders.reduce((sum,order) => sum + number(order.quantidade),0) };
    }).filter(category => category.orders > 0);
    const totalKg = categoryTotals.reduce((sum,category) => sum + category.totalKg,0);
    const categoryCards = categoryTotals.map(category => `<div class="category-card"><span>${safe(category.label)}</span><strong>${safe(category.totalKg.toLocaleString("pt-BR",{maximumFractionDigits:2}))} kg</strong><small>${category.orders} pedido(s)</small></div>`).join("");
    const body = queue.map((order,index) => `<tr><td>${index + 1}º</td><td>${safe(date(order.data))}</td><td>${safe(order.numeroOp || "SEM OP")}</td><td>${safe(order.cliente)}</td><td>${safe(order.descricaoItem)}</td><td>${safe(number(order.quantidade).toLocaleString("pt-BR",{maximumFractionDigits:2}))}</td><td>${safe(produced(order).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}))}</td><td>${safe(order.statusProducao)}</td></tr>`).join("");
    const frame = document.createElement("iframe"); frame.style.cssText = "position:fixed;width:0;height:0;border:0"; document.body.appendChild(frame);
    const printWindow = frame.contentWindow; const printDocument = frame.contentDocument;
    if (!printWindow || !printDocument) { frame.remove(); return setNotice("O navegador bloqueou a preparação da impressão."); }
    printDocument.open(); printDocument.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Fila PCP - ${safe(machine.name)}</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:Arial,sans-serif;color:#111827;margin:0}header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #123b75;padding-bottom:8px;margin-bottom:8px}h1{font-size:19px;color:#123b75;margin:0 0 2px}.machine{font-size:12px;font-weight:700}.meta{text-align:right;font-size:9px;line-height:1.5}.category-summary{break-inside:avoid;margin-bottom:8px;padding:7px;border:1px solid #b8c3d1;border-radius:5px;background:#f7f9fc}.category-heading{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:6px}.category-heading span{font-size:8px;font-weight:800;text-transform:uppercase;color:#41536b}.category-heading strong{font-size:10px;color:#123b75}.category-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}.category-card{padding:5px 6px;border:1px solid #d4dce6;border-left:3px solid #3478f6;border-radius:4px;background:#fff}.category-card span,.category-card strong,.category-card small{display:block}.category-card span{font-size:6px;font-weight:800;text-transform:uppercase;color:#667085}.category-card strong{margin-top:2px;font-size:8px;color:#1f3552}.category-card small{margin-top:1px;font-size:6px;color:#7d8796}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.5px}thead{display:table-header-group}th{background:#123b75;color:#fff;text-transform:uppercase;font-size:6.5px}th,td{border:1px solid #596273;padding:4px;text-align:left;vertical-align:middle}th:nth-child(1){width:5%}th:nth-child(2){width:8%}th:nth-child(3){width:7%}th:nth-child(4){width:16%}th:nth-child(5){width:35%}th:nth-child(6){width:7%}th:nth-child(7){width:9%}th:nth-child(8){width:13%}th:nth-child(7){background:#16794f}td:nth-child(7){background:#e8f7ef;color:#116b47;font-weight:700}td:nth-child(1),td:nth-child(2),td:nth-child(3),td:nth-child(6),td:nth-child(7){text-align:center}tr{break-inside:avoid}footer{display:flex;justify-content:space-between;margin-top:8px;color:#667085;font-size:7px}</style></head><body><header><div><h1>PROGRAMAÇÃO DE PRODUÇÃO</h1><div class="machine">${safe(machine.name)} · ${safe(machine.setor)}</div></div><div class="meta">Emitido em ${new Date().toLocaleString("pt-BR",{timeZone:"America/Fortaleza"})}<br>${queue.length} pedido(s) na fila</div></header><section class="category-summary"><div class="category-heading"><span>Resumo por categoria</span><strong>Total geral: ${safe(totalKg.toLocaleString("pt-BR",{maximumFractionDigits:2}))} kg · ${queue.length} pedido(s)</strong></div><div class="category-grid">${categoryCards}</div></section><table><thead><tr><th>Ordem</th><th>Data pedido</th><th>OP</th><th>Cliente</th><th>Descrição</th><th>Qtd.</th><th>Qtd. produzida</th><th>Status</th></tr></thead><tbody>${body}</tbody></table><footer><span>FORPACK · GUAIÚBA · PAINEL DE PRODUÇÃO</span><span>Sequência oficial da máquina no momento da emissão</span></footer></body></html>`); printDocument.close();
    window.setTimeout(() => { printWindow.focus(); printWindow.print(); window.setTimeout(() => frame.remove(),1000); },250);
  }
  function printWaitingQueue() {
    const queue = pcpQueue;
    if (!queue.length) return setNotice("Não há pedidos aguardando nos filtros selecionados.");
    const safe = (value:unknown) => String(value ?? "").replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[character] || character));
    const categoryTotals = PRODUCT_CATEGORIES.map(category => { const orders = queue.filter(order => inferredCategory(order) === category.value); return {...category,orders:orders.length,totalKg:orders.reduce((sum,order) => sum + number(order.quantidade),0)}; }).filter(category => category.orders);
    const totalKg = categoryTotals.reduce((sum,category) => sum + category.totalKg,0);
    const cards = categoryTotals.map(category => `<div><span>${safe(category.label)}</span><strong>${safe(category.totalKg.toLocaleString("pt-BR",{maximumFractionDigits:2}))} kg</strong><small>${category.orders} pedido(s)</small></div>`).join("");
    const body = queue.map(order => `<tr><td>${safe(date(order.data))}</td><td>${safe(order.numeroPedido || order.id)}</td><td>${safe(order.numeroOp || "SEM OP")}</td><td>${safe(order.cliente)}</td><td>${safe(order.descricaoItem)}</td><td>${safe(categoryLabel(order))}</td><td>${safe(number(order.quantidade).toLocaleString("pt-BR",{maximumFractionDigits:2}))} kg</td><td>${safe(order.statusProducao || "Aguardando programação")}</td></tr>`).join("");
    const frame = document.createElement("iframe"); frame.style.cssText = "position:fixed;width:0;height:0;border:0"; document.body.appendChild(frame);
    const printWindow = frame.contentWindow; const printDocument = frame.contentDocument;
    if (!printWindow || !printDocument) { frame.remove(); return setNotice("O navegador bloqueou a preparação da impressão."); }
    printDocument.open(); printDocument.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Fila aguardando PCP</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:Arial,sans-serif;color:#111827;margin:0}header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #123b75;padding-bottom:8px;margin-bottom:8px}h1{font-size:19px;color:#123b75;margin:0 0 2px}.meta{text-align:right;font-size:9px;line-height:1.5}.summary{padding:7px;border:1px solid #b8c3d1;border-radius:5px;background:#f7f9fc;margin-bottom:8px}.summary>p{display:flex;justify-content:space-between;margin:0 0 6px;font-size:8px;font-weight:800;text-transform:uppercase}.grid{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}.grid div{padding:5px 6px;border:1px solid #d4dce6;border-left:3px solid #3478f6;border-radius:4px;background:#fff}.grid span,.grid strong,.grid small{display:block}.grid span{font-size:6px;font-weight:800;text-transform:uppercase;color:#667085}.grid strong{font-size:8px;margin-top:2px}.grid small{font-size:6px;color:#7d8796;margin-top:1px}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.5px}thead{display:table-header-group}th{background:#123b75;color:#fff;text-transform:uppercase;font-size:6.5px}th,td{border:1px solid #596273;padding:4px;text-align:left}th:nth-child(1){width:8%}th:nth-child(2){width:12%}th:nth-child(3){width:8%}th:nth-child(4){width:17%}th:nth-child(5){width:28%}th:nth-child(6){width:10%}th:nth-child(7){width:8%}th:nth-child(8){width:9%}tr{break-inside:avoid}footer{display:flex;justify-content:space-between;margin-top:8px;color:#667085;font-size:7px}</style></head><body><header><div><h1>FILA AGUARDANDO PROGRAMAÇÃO</h1><small>Programação PCP · pedidos pendentes</small></div><div class="meta">Emitido em ${new Date().toLocaleString("pt-BR",{timeZone:"America/Fortaleza"})}<br>${queue.length} pedido(s) no filtro</div></header><section class="summary"><p><span>Resumo por categoria</span><strong>Total geral: ${safe(totalKg.toLocaleString("pt-BR",{maximumFractionDigits:2}))} kg · ${queue.length} pedido(s)</strong></p><div class="grid">${cards}</div></section><table><thead><tr><th>Data pedido</th><th>Pedido</th><th>OP</th><th>Cliente</th><th>Descrição</th><th>Categoria</th><th>Qtd.</th><th>Status</th></tr></thead><tbody>${body}</tbody></table><footer><span>FORPACK · GUAIÚBA · PAINEL DE PRODUÇÃO</span><span>Fila conforme filtros no momento da emissão</span></footer></body></html>`); printDocument.close();
    window.setTimeout(() => { printWindow.focus(); printWindow.print(); window.setTimeout(() => frame.remove(),1000); },250);
  }
  async function registerProduction(order: Order, input: Production) {
    const machine = data.machines.find(item => item.id === order.maquinaId);
    if (!machine) return;
    setSaving(true); setNotice("");
    try {
      await saveProduction(order, machine, input);
      setSelected(null);
      setNotice(`Produção do pedido ${order.id} registrada com sucesso.`);
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erro ao registrar a produção.");
    } finally {
      setSaving(false);
    }
  }
  async function registerOrder(input: Omit<Order, "id">) {
    setSaving(true); setNotice("");
    try {
      const created = await createOrder(input);
      setNewOrderOpen(false);
      setNotice(`Pedido ${created.numeroPedido || created.id} cadastrado com sucesso.`);
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erro ao cadastrar o pedido.");
    } finally { setSaving(false); }
  }
  async function updateOrder(order: Order) {
    const source = rows.find(row => row.key === `pedido:${order.id}`);
    if (!source) return;
    setSaving(true); setNotice("");
    try {
      await saveOrder(order, source.updated_at);
      setSelected(order); setEditing(false);
      setNotice(`Pedido ${order.numeroPedido || order.id} atualizado com sucesso.`);
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erro ao atualizar o pedido.");
    } finally { setSaving(false); }
  }
  async function changeOrderState(order: Order, action: "finish" | "reopen", closure?: { responsavel: string; observacao?: string }) {
    const source = rows.find(row => row.key === `pedido:${order.id}`);
    if (!source) return;
    const now = new Date().toISOString();
    const balance = orderBalance(order, data.records, data.machines);
    const responsible = closure?.responsavel.trim() || "Ernade Silva";
    const event: StatusEvent = { acao: action === "finish" ? "FECHAMENTO" : "REABERTURA", data: now, responsavel: responsible, observacao: closure?.observacao?.trim() || undefined };
    const updated: Order = action === "finish"
      ? { ...order, statusProducao: "FINALIZADO", dataConclusao: now, fechamento: { responsavel: responsible, observacao: closure?.observacao?.trim() || undefined, data: now, pesoInicial: balance.initial, pesoFinal: balance.final, perdaReal: balance.realLoss, perdaDeclarada: balance.declaredLoss, divergencia: balance.divergence, aproveitamento: balance.yieldRate }, historicoStatus: [...(order.historicoStatus || []), event] }
      : { ...order, statusProducao: "AGUARDANDO PROGRAMAÇÃO", dataConclusao: "", maquinaId: "", prioridade: 0, historicoStatus: [...(order.historicoStatus || []), event] };
    setSaving(true); setNotice("");
    try {
      await saveOrder(updated, source.updated_at);
      setSelected(null); setEditing(false);
      setNotice(action === "finish" ? `OP ${order.numeroOp || order.numeroPedido || order.id} concluída e enviada ao histórico.` : `OP ${order.numeroOp || order.numeroPedido || order.id} reaberta e enviada para Programação PCP.`);
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erro ao alterar o status da OP.");
    } finally { setSaving(false); }
  }
  async function editProduction(record: Production) {
    setSaving(true); setNotice("");
    try {
      await updateProduction(record);
      setSelectedRecord(null);
      setNotice("Produção atualizada com sucesso.");
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erro ao atualizar o apontamento.");
    } finally { setSaving(false); }
  }
  async function updateRegistry(kind: RegistryKind, previousValue: string | null, nextValue: string) {
    const source = rows.find(row => row.key === `config:${kind}`);
    if (!source) return;
    const current = json<string[]>(source.value, []);
    const clean = nextValue.trim();
    if (!clean) return;
    if (current.some(item => item.toLocaleLowerCase("pt-BR") === clean.toLocaleLowerCase("pt-BR") && item !== previousValue)) {
      setNotice("Este item já existe no cadastro.");
      return;
    }
    const updated = previousValue === null ? [...current, clean] : current.map(item => item === previousValue ? clean : item);
    updated.sort((a,b) => a.localeCompare(b, "pt-BR"));
    setSaving(true); setNotice("");
    try {
      await saveRegistry(kind, updated, source.updated_at);
      setNotice(previousValue === null ? "Cadastro adicionado com sucesso." : "Cadastro atualizado com sucesso.");
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erro ao atualizar o cadastro.");
    } finally { setSaving(false); }
  }

  return <main className="app-shell">
    <aside className={`sidebar ${menu ? "open" : ""}`}>
      <div className="brand"><span className="brand-mark">FP</span><div><strong>FORPACK</strong><small>GESTÃO INDUSTRIAL</small></div></div>
      <nav>{nav.map((item, i) => <button key={item} className={active === item ? "nav-item active" : "nav-item"} onClick={() => navigate(item)}>
        <span className="nav-icon">{["▦","◷","↗","▥","▤","▤","⌁","◉","▥","⚙"][i]}</span>{item}
        {item === "Programação PCP" && <b className="nav-badge">{metrics.waiting}</b>}
        {!["Visão geral","Central de prazos","Lançamentos","Relatório diário","Painel mensal","Pedidos / OP","Programação PCP","Produção","Relatórios","Cadastros"].includes(item) && <small className="soon">em breve</small>}
      </button>)}</nav>
      <div className="sidebar-foot"><span className="online-dot" /> Dados reais conectados<small>{rows.length ? `${rows.length} registros sincronizados` : "Sincronizando..."}</small></div>
    </aside>
    {menu && <button className="overlay" aria-label="Fechar menu" onClick={() => setMenu(false)} />}

    <section className="content">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMenu(true)}>☰</button>
        <div className="breadcrumb">Operação <span>/</span> {active}</div>
        <div className="sync"><button className="secondary" onClick={refresh} disabled={loading}>↻ {loading ? "Sincronizando" : "Atualizar dados"}</button><span className="avatar">ES</span><div><strong>Ernade Silva</strong><small>Supervisor de produção</small></div></div>
      </header>

      <div className="workspace">
        {notice && <div className={`notice ${/^(Pedido|Produção|OP|Sequência)/.test(notice) ? "success" : "failure"}`}><span>{notice}</span><button onClick={() => setNotice("")}>×</button></div>}
        <div className="page-heading"><div><p className="eyebrow">DADOS REAIS · SUPABASE</p><h1>{active === "Visão geral" ? "Painel mensal de produção" : active === "Central de prazos" ? "Central de prazos e atrasos" : active === "Lançamentos" ? "Lançamentos do dia" : active === "Relatório diário" ? "Relatório diário por setor" : active === "Painel mensal" ? "Relatório mensal de produção" : active === "Programação PCP" ? "Programação e reprogramação PCP" : active === "Produção" ? "Filas de produção" : active === "Relatórios" ? "Histórico de produção" : active === "Cadastros" ? "Cadastros operacionais" : "Pedidos e ordens de produção"}</h1><p>{active === "Visão geral" ? "Indicadores consolidados para acompanhar volume, perdas e desempenho por setor." : active === "Central de prazos" ? "Priorize pedidos atrasados, próximos do vencimento e sem movimentação recente." : active === "Lançamentos" ? "Acompanhe os apontamentos do turno e acesse rapidamente a OP para registrar nova produção." : active === "Relatório diário" ? "Compare a produção de cada máquina nos turnos da manhã, tarde e noite." : active === "Painel mensal" ? "Consulte produção e perdas por período, setor, máquina, operador e OP." : active === "Programação PCP" ? "Programe pedidos pendentes ou transfira uma OP já programada para outra máquina ou setor." : active === "Produção" ? "Selecione uma OP programada para registrar um novo apontamento." : active === "Relatórios" ? "Consulte e corrija apontamentos reais com filtros operacionais." : active === "Cadastros" ? "Mantenha as listas usadas nos formulários de pedidos e apontamentos." : "Acompanhe o avanço real de cada pedido, do mais antigo ao mais novo."}</p></div>
          {active === "Pedidos / OP" && <button className="new-order-button" onClick={() => { setNotice(""); setNewOrderOpen(true); }}><span>＋</span> Novo pedido</button>}
        </div>
        {active === "Visão geral" ? <MonthlyDashboard records={monthlyRecords} machines={data.machines} month={dashboardMonth} onMonth={setDashboardMonth} />
        : active === "Central de prazos" ? <DeadlineCenter orders={activeOrders} records={data.records} machines={data.machines} onOpen={order => setSelected(order)} />
        : active === "Lançamentos" ? <DailyLaunches records={launchRecords} orders={data.orders} machines={data.machines} selectedDate={launchDate} selectedMachine={launchMachine} onDate={setLaunchDate} onMachine={setLaunchMachine} onOpen={order => setSelected(order)} />
        : active === "Relatório diário" ? <DailySectorReport records={dailyReportRecords} machines={data.machines} selectedDate={dailyReportDate} onDate={setDailyReportDate} />
        : active === "Painel mensal" ? <MonthlyProductionReport records={monthlyReportRecords} allRecords={data.records} orders={data.orders} machines={data.machines} operators={data.operators} start={monthlyStart} end={monthlyEnd} machine={monthlyMachine} operator={monthlyOperator} orderId={monthlyOrder} onStart={setMonthlyStart} onEnd={setMonthlyEnd} onMachine={setMonthlyMachine} onOperator={setMonthlyOperator} onOrder={setMonthlyOrder} />
        : !["Relatórios","Cadastros","Central de prazos"].includes(active) && <section className="metrics">
          <Metric label="Pedidos ativos" value={metrics.active} detail="Exclui OPs finalizadas" tone="blue" />
          <Metric label="Em produção" value={metrics.producing} detail="Alguma etapa em andamento" tone="green" />
          <Metric label="Aguardando PCP" value={metrics.waiting} detail="Programar por ordem de data" tone="orange" />
          <Metric label="Com apontamento" value={metrics.pointed} detail="Produção registrada por setor" tone="red" />
        </section>}

        {active === "Cadastros" ? <RegistryPanel kind={registryKind} onKind={setRegistryKind} values={data.registries[registryKind] || []} query={query} onQuery={setQuery} saving={saving} onSave={updateRegistry} />
        : !["Visão geral","Central de prazos","Lançamentos","Relatório diário","Painel mensal"].includes(active) && <section className="panel">
          <div className="panel-head">
            {active === "Pedidos / OP" && <div className="tabs">{["Todos ativos","Aguardando","Programado","Em produção","Finalizados"].map(item => <button key={item} className={filter === item ? "tab active" : "tab"} onClick={() => { setFilter(item); setSelected(null); }}>{item}{item === "Finalizados" ? ` (${finishedOrders.length})` : ""}</button>)}</div>}
            {active === "Programação PCP" && <><div className="tabs"><button className={pcpView === "Aguardando" ? "tab active" : "tab"} onClick={() => { setPcpView("Aguardando"); setPcpMachine("Todas"); setPcpCategory("Todas"); setSelected(null); }}>Aguardando ({metrics.waiting})</button><button className={pcpView === "Programadas" ? "tab active" : "tab"} onClick={() => { setPcpView("Programadas"); setSelected(null); }}>OPs programadas ({metrics.programmed})</button></div>{pcpView === "Aguardando" ? <div className="pcp-tools pcp-waiting-tools"><label><span>Categoria</span><select value={pcpCategory} onChange={event => setPcpCategory(event.target.value as "Todas" | ProductCategory)}><option value="Todas">Todas as categorias</option>{PRODUCT_CATEGORIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><button className="pcp-print" onClick={printWaitingQueue} disabled={!pcpQueue.length}>▣ Imprimir fila</button><b>{pcpQueue.length} pedido(s) no filtro</b></div> : <div className="pcp-tools"><label><span>Máquina</span><select value={pcpMachine} onChange={event => { setPcpMachine(event.target.value); setSelected(null); }}><option value="Todas">Todas as máquinas</option>{data.machines.map(machine => <option key={machine.id} value={machine.id}>{machine.name} · {machine.setor}</option>)}</select></label><label><span>Categoria</span><select value={pcpCategory} onChange={event => setPcpCategory(event.target.value as "Todas" | ProductCategory)}><option value="Todas">Todas as categorias</option>{PRODUCT_CATEGORIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label><span>Ordenar fila</span><select value={pcpSort} onChange={event => setPcpSort(event.target.value as "Data" | "Manual")}><option value="Data">Pedido mais antigo primeiro</option><option value="Manual">Sequência manual</option></select></label><button className="pcp-print" onClick={printPcpQueue} disabled={pcpMachine === "Todas"}>▣ Imprimir fila</button><b>{pcpQueue.length} pedido(s) no filtro</b></div>}</>}
            {active === "Produção" && <label className="machine-filter"><span>Máquina</span><select value={machineFilter} onChange={event => setMachineFilter(event.target.value)}><option value="Todas">Todas as máquinas</option>{data.machines.map(machine => <option key={machine.id} value={machine.id}>{machine.name} · {machine.setor}</option>)}</select></label>}
            {active === "Relatórios" && <div className="report-filters">
              <label><span>De</span><input type="date" value={reportStart} onChange={event => setReportStart(event.target.value)} /></label>
              <label><span>Até</span><input type="date" value={reportEnd} onChange={event => setReportEnd(event.target.value)} /></label>
              <label><span>Máquina</span><select value={reportMachine} onChange={event => setReportMachine(event.target.value)}><option value="Todas">Todas</option>{data.machines.map(machine => <option key={machine.id} value={machine.id}>{machine.name}</option>)}</select></label>
              <label><span>Operador</span><select value={reportOperator} onChange={event => setReportOperator(event.target.value)}><option value="Todos">Todos</option>{data.operators.map(operator => <option key={operator}>{operator}</option>)}</select></label>
            </div>}
            <label className="search"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar pedido, OP, cliente ou produto" /></label>
          </div>
          {error ? <div className="state error"><strong>Falha na sincronização</strong><span>{error}</span><button className="secondary" onClick={refresh}>Tentar novamente</button></div>
          : loading ? <div className="state"><span className="spinner" /><strong>Carregando dados reais...</strong></div>
          : active === "Relatórios" ? <ProductionReport records={reportRecords} orders={data.orders} machines={data.machines} onEdit={setSelectedRecord} />
          : active === "Programação PCP" && pcpView === "Programadas" ? <><PcpCategorySummary items={pcpCategorySummary} /><PcpQueueTable orders={pcpQueue} machines={data.machines} records={data.records} selectedMachine={pcpMachine} sortMode={pcpSort} saving={saving} onMove={movePcpOrder} onOpen={setSelected} /></>
          : <>{active === "Programação PCP" && pcpView === "Aguardando" && <PcpCategorySummary items={pcpCategorySummary} />}<div className="table-wrap"><table><thead><tr><th>Pedido / OP</th><th>Cliente e produto</th><th>Qtd. pedido</th><th>Status atual</th><th>Produzido por setor</th><th /></tr></thead>
            <tbody>{visible.map(order => <OrderRow key={order.id} order={order} totals={data.totals.get(order.id) || {}} onOpen={() => setSelected(order)} />)}</tbody></table>
            {!visible.length && <div className="empty">Nenhum pedido encontrado nesta visualização.</div>}</div></>}
          {!loading && !error && <footer className="panel-foot"><span>{active === "Relatórios" ? `${reportRecords.length} apontamento(s) · ${kg(reportRecords.reduce((sum, item) => sum + number(item.qtdProduzido), 0))} produzidos` : `Mostrando ${visible.length} pedido(s) ${filter === "Finalizados" ? "concluído(s), mais recentes primeiro" : "em ordem crescente de data"}`}</span><span>{active === "Relatórios" ? "Edição protegida contra alterações simultâneas" : active === "Programação PCP" ? (pcpView === "Programadas" ? "Selecione uma OP para reprogramar" : "Programação habilitada com confirmação") : active === "Produção" ? "Apontamento real habilitado" : filter === "Finalizados" ? "Histórico com opção de reabrir" : "Edição e conclusão de OP habilitadas"}</span></footer>}
        </section>}
      </div>
    </section>

    {selected && <div className="modal-backdrop" onMouseDown={() => !saving && setSelected(null)}><article className="drawer" onMouseDown={e => e.stopPropagation()}>
      <button className="close" onClick={() => { setSelected(null); setEditing(false); }}>×</button><p className="eyebrow">PEDIDO {selected.numeroPedido || selected.id}</p><h2>{selected.numeroOp ? `OP ${selected.numeroOp}` : "OP não emitida"}</h2>
      <p className="drawer-client">{selected.cliente}<br />{selected.descricaoItem}</p>
      <div className="drawer-grid"><div><small>Data do pedido</small><strong>{date(selected.data)}</strong></div><div><small>Quantidade</small><strong>{kg(number(selected.quantidade))}</strong></div><div><small>Status</small><strong>{selected.statusProducao || "Sem status"}</strong></div><div><small>Categoria</small><strong>{categoryLabel(selected)}</strong></div></div>
      {active === "Programação PCP" && selected.maquinaId && <div className="current-programming"><span>Programação atual</span><strong>{data.machines.find(machine => machine.id === selected.maquinaId)?.name || selected.maquinaId}</strong><small>{data.machines.find(machine => machine.id === selected.maquinaId)?.setor || "Setor não identificado"}</small></div>}
      <h3>Quantidade produzida por setor</h3><div className="sector-list">{SECTORS.map(sector => { const value = data.totals.get(selected.id)?.[sector] || 0; return <div key={sector}><span>{sector}</span><strong className={value ? "has-value" : ""}>{value ? kg(value) : "—"}</strong></div>; })}</div>
      {editing
        ? <EditOrderForm order={selected} clients={data.clients} products={data.products} materials={data.materials} saving={saving} onSave={updateOrder} onCancel={() => setEditing(false)} />
        : active === "Programação PCP"
        ? <ProgrammingForm order={selected} machines={data.machines} saving={saving} onSave={programOrder} onReturnToWaiting={returnOrderToWaiting} />
        : active === "Produção" || active === "Lançamentos"
        ? <ProductionForm order={selected} machine={data.machines.find(machine => machine.id === selected.maquinaId)} records={data.records.filter(record => record.idPedido === selected.id && record.maquinaId === selected.maquinaId)} operators={data.operators} saving={saving} onSave={registerProduction} />
        : <OrderManagement order={selected} records={data.records} machines={data.machines} saving={saving} onEdit={() => setEditing(true)} onFinish={closure => changeOrderState(selected,"finish",closure)} onReopen={closure => changeOrderState(selected,"reopen",closure)} />}
    </article></div>}
    {newOrderOpen && <div className="modal-backdrop" onMouseDown={() => !saving && setNewOrderOpen(false)}><article className="drawer order-drawer" onMouseDown={e => e.stopPropagation()}>
      <button className="close" aria-label="Fechar cadastro" onClick={() => setNewOrderOpen(false)}>×</button>
      <p className="eyebrow">CADASTRO</p><h2>Novo pedido</h2>
      <p className="drawer-client">Cadastre o pedido agora. O número da OP pode ser informado depois, na etapa de emissão.</p>
      <NewOrderForm clients={data.clients} products={data.products} materials={data.materials} saving={saving} onSave={registerOrder} onCancel={() => setNewOrderOpen(false)} />
    </article></div>}
    {selectedRecord && <div className="modal-backdrop" onMouseDown={() => !saving && setSelectedRecord(null)}><article className="drawer" onMouseDown={event => event.stopPropagation()}>
      <button className="close" onClick={() => setSelectedRecord(null)}>×</button>
      <p className="eyebrow">CORREÇÃO CONTROLADA</p><h2>Editar apontamento</h2>
      <p className="drawer-client">A alteração atualizará os totais da OP. O registro não será excluído.</p>
      <EditProductionForm record={selectedRecord} operators={data.operators} saving={saving} onSave={editProduction} onCancel={() => setSelectedRecord(null)} />
    </article></div>}
  </main>;
}

const REGISTRY_LABELS: Record<RegistryKind, string> = {
  operadores: "Operadores",
  clientes: "Clientes",
  produtos: "Produtos",
  materiais: "Materiais",
};

function RegistryPanel({kind,onKind,values,query,onQuery,saving,onSave}:{kind:RegistryKind;onKind:(kind:RegistryKind)=>void;values:string[];query:string;onQuery:(value:string)=>void;saving:boolean;onSave:(kind:RegistryKind,previousValue:string|null,nextValue:string)=>Promise<void>}) {
  const [newValue, setNewValue] = useState("");
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const filtered = values.filter(value => value.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")));
  const selectKind = (next:RegistryKind) => { onKind(next); onQuery(""); setNewValue(""); setEditingValue(null); };
  const add = async (event:FormEvent) => {
    event.preventDefault();
    if (!newValue.trim()) return;
    await onSave(kind, null, newValue);
    setNewValue("");
  };
  const edit = async (event:FormEvent) => {
    event.preventDefault();
    if (!editingValue || !editValue.trim()) return;
    await onSave(kind, editingValue, editValue);
    setEditingValue(null);
  };
  return <section className="registry-layout">
    <aside className="registry-nav">
      <p className="eyebrow">TIPOS DE CADASTRO</p>
      {(Object.keys(REGISTRY_LABELS) as RegistryKind[]).map(item => <button key={item} className={kind === item ? "active" : ""} onClick={() => selectKind(item)}>
        <span>{item === "operadores" ? "◉" : item === "clientes" ? "◎" : item === "produtos" ? "▤" : "◇"}</span>
        <strong>{REGISTRY_LABELS[item]}</strong>
        <b>{item === kind ? values.length : ""}</b>
      </button>)}
      <div className="registry-note"><strong>Alterações seguras</strong><span>A exclusão permanece bloqueada para preservar pedidos e apontamentos antigos.</span></div>
    </aside>
    <div className="registry-main panel">
      <header className="registry-head">
        <div><p className="eyebrow">LISTA ATIVA</p><h2>{REGISTRY_LABELS[kind]}</h2><span>{values.length} item(ns) disponível(is) nos formulários</span></div>
        <label className="search"><span>⌕</span><input value={query} onChange={event => onQuery(event.target.value)} placeholder={`Buscar em ${REGISTRY_LABELS[kind].toLowerCase()}`} /></label>
      </header>
      <form className="registry-add" onSubmit={add}>
        <label><span>Adicionar {REGISTRY_LABELS[kind].slice(0,-1).toLowerCase()}</span><input value={newValue} onChange={event => setNewValue(event.target.value)} placeholder={`Nome do novo item`} disabled={saving} /></label>
        <button className="primary-action" disabled={!newValue.trim() || saving}>{saving ? "Salvando..." : "＋ Adicionar"}</button>
      </form>
      <div className="registry-list">
        {filtered.map(value => <div key={value} className="registry-row">
          {editingValue === value ? <form onSubmit={edit}>
            <input autoFocus value={editValue} onChange={event => setEditValue(event.target.value)} disabled={saving} />
            <button className="save-inline" disabled={!editValue.trim() || saving}>Salvar</button>
            <button type="button" className="cancel-inline" onClick={() => setEditingValue(null)} disabled={saving}>Cancelar</button>
          </form> : <>
            <span className="registry-avatar">{value.slice(0,2).toUpperCase()}</span>
            <strong>{value}</strong>
            <button className="edit-inline" onClick={() => { setEditingValue(value); setEditValue(value); }}>Editar</button>
          </>}
        </div>)}
        {!filtered.length && <div className="empty">Nenhum item encontrado neste cadastro.</div>}
      </div>
      <footer className="panel-foot"><span>{filtered.length} item(ns) exibido(s)</span><span>Inclusão e edição habilitadas · exclusão bloqueada</span></footer>
    </div>
  </section>;
}

function PcpCategorySummary({items}:{items:{category:ProductCategory;label:string;orders:number;totalKg:number}[]}) {
  const totalKg = items.reduce((sum,item) => sum + item.totalKg,0);
  const totalOrders = items.reduce((sum,item) => sum + item.orders,0);
  if (!items.length) return null;
  return <section className="pcp-category-summary" aria-label="Resumo da fila por categoria">
    <header><div><strong>Resumo por categoria</strong><span>Quilos dos pedidos exibidos na fila</span></div><div className="pcp-category-total"><small>Total geral</small><strong>{kg(totalKg)}</strong><span>{totalOrders} pedido(s)</span></div></header>
    <div className="pcp-category-grid">{items.map(item => <article key={item.category} className={`pcp-category-card category-${item.category.toLocaleLowerCase("pt-BR").replace(/_/g,"-")}`}>
      <span>{item.label}</span><strong>{kg(item.totalKg)}</strong><small>{item.orders} pedido(s)</small>
    </article>)}</div>
  </section>;
}

function PcpQueueTable({orders,machines,records,selectedMachine,sortMode,saving,onMove,onOpen}:{orders:Order[];machines:Machine[];records:Production[];selectedMachine:string;sortMode:"Data"|"Manual";saving:boolean;onMove:(order:Order,direction:-1|1)=>void;onOpen:(order:Order)=>void}) {
  const machineOf = (order:Order) => machines.find(machine => machine.id === order.maquinaId);
  const produced = (order:Order) => records.filter(record => record.maquinaId === order.maquinaId && (record.idPedido === order.id || record.idPedido === order.numeroOp || record.idPedido === order.numeroPedido)).reduce((sum,record) => sum + number(record.qtdProduzido),0);
  return <div className="table-wrap pcp-queue-wrap"><table className="pcp-queue-table"><thead><tr><th>Ordem</th><th>Data pedido</th><th>OP / pedido</th><th>Cliente</th><th>Descrição</th><th>Qtd.</th><th className="queue-produced">Qtd. produzida</th><th>Máquina / status</th><th>Sequência</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{orders.map((order,index) => { const machine = machineOf(order); const queue = orders.filter(item => item.maquinaId === order.maquinaId); const localIndex = queue.findIndex(item => item.id === order.id); return <tr key={order.id}>
    <td><strong className="queue-position">{selectedMachine === "Todas" ? "—" : `${index + 1}º`}</strong></td>
    <td><strong>{date(order.data)}</strong></td>
    <td><button className="pcp-order-link" onClick={() => onOpen(order)}>{order.numeroOp ? `OP ${order.numeroOp}` : "SEM OP"}</button><small>{order.numeroPedido || order.id}</small></td>
    <td><strong>{order.cliente || "—"}</strong></td><td title={order.descricaoItem || "Descrição não informada"}>{order.descricaoItem || "—"}<small className="category-pill">{categoryLabel(order)}</small></td>
    <td><strong>{kg(number(order.quantidade))}</strong></td><td className="queue-produced"><strong>{kg(produced(order))}</strong></td>
    <td><strong>{machine?.name || order.maquinaId || "—"}</strong><small>{order.statusProducao || machine?.setor || "—"}</small></td>
    <td><div className="queue-actions"><button title={sortMode === "Data" ? "Selecione Sequência manual para reordenar" : "Subir na fila"} disabled={saving || sortMode === "Data" || selectedMachine === "Todas" || localIndex === 0} onClick={() => onMove(order,-1)}>▲</button><button title={sortMode === "Data" ? "Selecione Sequência manual para reordenar" : "Descer na fila"} disabled={saving || sortMode === "Data" || selectedMachine === "Todas" || localIndex === queue.length - 1} onClick={() => onMove(order,1)}>▼</button></div></td>
    <td className="queue-more-cell"><button className="more queue-more" type="button" title="Alterar máquina deste pedido" aria-label={`Alterar máquina do pedido ${order.numeroPedido || order.numeroOp || order.id}`} onClick={() => onOpen(order)}>•••</button></td>
  </tr>; })}</tbody></table>{!orders.length && <div className="empty">Nenhuma OP programada para os filtros selecionados.</div>}</div>;
}

function DailyLaunches({records,orders,machines,selectedDate,selectedMachine,onDate,onMachine,onOpen}:{records:Production[];orders:Order[];machines:Machine[];selectedDate:string;selectedMachine:string;onDate:(value:string)=>void;onMachine:(value:string)=>void;onOpen:(order:Order)=>void}) {
  const produced = records.reduce((sum, record) => sum + number(record.qtdProduzido), 0);
  const scraps = records.reduce((sum, record) => sum + number(record.aparas), 0);
  const cuttings = records.reduce((sum, record) => sum + number(record.picote), 0);
  const operators = new Set(records.map(record => record.operador).filter(Boolean)).size;
  const orderOf = (record:Production) => orders.find(order => order.id === record.idPedido || order.numeroOp === record.idPedido);
  const machineOf = (record:Production) => machines.find(machine => machine.id === record.maquinaId);
  return <section className="launches">
    <div className="dashboard-toolbar launch-toolbar">
      <div><strong>{date(selectedDate)}</strong><small>Resumo dos apontamentos selecionados</small></div>
      <div className="dashboard-actions">
        <label><span>Data</span><input type="date" value={selectedDate} onChange={event => onDate(event.target.value)} /></label>
        <label><span>Máquina</span><select value={selectedMachine} onChange={event => onMachine(event.target.value)}><option value="Todas">Todas as máquinas</option>{machines.map(machine => <option key={machine.id} value={machine.id}>{machine.name} · {machine.setor}</option>)}</select></label>
      </div>
    </div>
    <section className="metrics launch-metrics">
      <Metric label="Apontamentos" value={records.length} detail="Registros no período" tone="blue" />
      <Metric label="Produção (kg)" value={produced} detail="Total produzido" tone="green" />
      <Metric label="Perdas (kg)" value={scraps + cuttings} detail={`Aparas ${kg(scraps)} · picote ${kg(cuttings)}`} tone="orange" />
      <Metric label="Operadores" value={operators} detail="Operadores com lançamento" tone="red" />
    </section>
    <section className="panel">
      <div className="panel-head"><div><p className="eyebrow">MOVIMENTAÇÃO REAL</p><strong className="launch-title">Apontamentos registrados</strong></div><span className="status em-produção">{records.length} registro(s)</span></div>
      <div className="table-wrap"><table className="report-table"><thead><tr><th>Data / turno</th><th>Pedido / OP</th><th>Máquina / setor</th><th>Operador</th><th>Produzido</th><th>Perdas</th><th /></tr></thead>
        <tbody>{records.map(record => { const order = orderOf(record); const machine = machineOf(record); return <tr key={record._key || record.id}>
          <td><strong>{date(record.dataProducao)}</strong><small className="cell-sub">{record.turno || "Turno não informado"}</small></td>
          <td><strong>{order?.numeroOp ? `OP ${order.numeroOp}` : order?.numeroPedido ? `Pedido ${order.numeroPedido}` : record.idPedido}</strong><small className="cell-sub">{record.cliente || order?.cliente || "—"}</small></td>
          <td><strong>{machine?.name || record.maquinaId || "—"}</strong><small className="cell-sub">{machine?.setor || "Setor não identificado"}</small></td>
          <td><strong>{record.operador || "—"}</strong></td>
          <td><strong className="positive">{kg(number(record.qtdProduzido))}</strong></td>
          <td><span>Aparas: {kg(number(record.aparas))}</span><small className="cell-sub">Picote: {kg(number(record.picote))}</small></td>
          <td>{order && group(order.statusProducao) === "Em produção" ? <button className="secondary" onClick={() => onOpen(order)}>Novo lançamento</button> : <span className="cell-sub">OP fora da fila</span>}</td>
        </tr>; })}</tbody></table>{!records.length && <div className="empty">Nenhum lançamento encontrado para esta data e máquina.</div>}</div>
      <footer className="panel-foot"><span>{kg(produced)} produzidos · {kg(scraps + cuttings)} de perdas informadas</span><span>Para correções, utilize Relatórios</span></footer>
    </section>
  </section>;
}

function DailySectorReport({records,machines,selectedDate,onDate}:{records:Production[];machines:Machine[];selectedDate:string;onDate:(value:string)=>void}) {
  const shiftOf = (value = "") => {
    const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    if (normalized.includes("MANHA") || normalized === "1") return "MANHÃ";
    if (normalized.includes("TARDE") || normalized === "2") return "TARDE";
    if (normalized.includes("NOITE") || normalized === "3") return "NOITE";
    return "NÃO INFORMADO";
  };
  const activeMachineIds = new Set(records.map(record => String(record.maquinaId || "")).filter(Boolean));
  const sectors = SECTORS.map(sector => {
    const sectorMachines = machines.filter(machine => machine.setor.toUpperCase() === sector && activeMachineIds.has(machine.id));
    const rows = sectorMachines.map(machine => {
      const machineRecords = records.filter(record => record.maquinaId === machine.id);
      const morning = machineRecords.filter(record => shiftOf(record.turno) === "MANHÃ").reduce((sum, record) => sum + number(record.qtdProduzido), 0);
      const afternoon = machineRecords.filter(record => shiftOf(record.turno) === "TARDE").reduce((sum, record) => sum + number(record.qtdProduzido), 0);
      const night = machineRecords.filter(record => shiftOf(record.turno) === "NOITE").reduce((sum, record) => sum + number(record.qtdProduzido), 0);
      const unreported = machineRecords.filter(record => shiftOf(record.turno) === "NÃO INFORMADO").reduce((sum, record) => sum + number(record.qtdProduzido), 0);
      return { machine, morning, afternoon, night, unreported, total: morning + afternoon + night + unreported };
    });
    return { sector, rows, total: rows.reduce((sum, row) => sum + row.total, 0) };
  }).filter(section => section.rows.length);
  const grandTotal = sectors.reduce((sum, section) => sum + section.total, 0);
  const machineMap = new Map(machines.map(machine => [machine.id, machine]));
  const sectorRecords = (sector: string) => records.filter(record => machineMap.get(String(record.maquinaId || ""))?.setor.toUpperCase() === sector);
  const cutAndRewinderTotal = ["CORTE", "REBOBINADEIRA"].reduce(
    (sum, sector) => sum + sectorRecords(sector).reduce((subtotal, record) => subtotal + number(record.qtdProduzido), 0), 0
  );
  const lossRows = (sectorNames: string[], rewinderLabel = false) => {
    const grouped = new Map<string, { produced: number; scraps: number; cuttings: number }>();
    sectorNames.flatMap(sectorRecords).forEach(record => {
      const sector = machineMap.get(String(record.maquinaId || ""))?.setor.toUpperCase() || "";
      const material = rewinderLabel && sector === "REBOBINADEIRA" ? "REBOBINADEIRA" : (record.material || "OUTRO").trim().toUpperCase() || "OUTRO";
      const current = grouped.get(material) || { produced: 0, scraps: 0, cuttings: 0 };
      current.produced += number(record.qtdProduzido);
      current.scraps += number(record.aparas);
      current.cuttings += number(record.picote);
      grouped.set(material, current);
    });
    return [...grouped.entries()].map(([material, values]) => ({ material, ...values })).filter(row => row.produced || row.scraps || row.cuttings).sort((a,b) => b.produced - a.produced);
  };
  const extrusionLosses = lossRows(["EXTRUSÃO"]);
  const cuttingLosses = lossRows(["CORTE", "REBOBINADEIRA"], true);
  const format = (value:number) => value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const percent = (loss:number, produced:number) => produced ? loss / produced * 100 : 0;
  const exportCsv = () => {
    const escape = (value:string) => `"${value.replace(/"/g, "\"\"")}"`;
    const lines = [
      ["Data", "Setor", "Máquina", "Manhã (kg)", "Tarde (kg)", "Noite (kg)", "Turno não informado (kg)", "Total (kg)"],
      ...sectors.flatMap(section => section.rows.map(row => [
        date(selectedDate), section.sector, row.machine.name, format(row.morning), format(row.afternoon), format(row.night), format(row.unreported), format(row.total),
      ])),
    ];
    const csv = `\uFEFF${lines.map(line => line.map(value => escape(String(value))).join(";")).join("\r\n")}`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `relatorio-diario-${selectedDate}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return <section className="daily-sector-report">
    <header className="daily-print-heading"><div><strong>FORPACK · GUAIÚBA</strong><span>Relatório diário de produção</span></div><div><small>Data</small><strong>{date(selectedDate)}</strong></div></header>
    <div className="daily-report-toolbar">
      <label><span>Data do relatório</span><input type="date" value={selectedDate} onChange={event => onDate(event.target.value)} /></label>
      <div className="daily-report-summary"><small>Total produzido no dia</small><strong>{kg(grandTotal)}</strong></div>
      <div className="daily-report-actions"><button className="secondary daily-print" onClick={() => window.print()} disabled={!records.length}>▣ Imprimir relatório</button><button className="secondary daily-export" onClick={exportCsv} disabled={!records.length}>⇩ Exportar CSV do dia</button></div>
    </div>
    {sectors.map(section => <article className="daily-sector-card" key={section.sector}>
      <header><h2>{section.sector}</h2><strong>{format(section.total)} <small>kg</small></strong></header>
      <div className="hazard-line" />
      <div className="daily-sector-table-wrap"><table className="daily-sector-table">
        <thead><tr><th>Máquina</th><th>Manhã</th><th>Tarde</th><th>Noite</th><th>Total</th></tr></thead>
        <tbody>{section.rows.map(row => <tr key={row.machine.id}>
          <td><strong>{row.machine.name}</strong>{row.unreported > 0 && <small className="unreported">+ {format(row.unreported)} kg sem turno</small>}</td>
          <td>{format(row.morning)}</td><td>{format(row.afternoon)}</td><td>{format(row.night)}</td><td><strong>{format(row.total)}</strong></td>
        </tr>)}</tbody>
      </table></div>
    </article>)}
    {sectors.length > 0 && <><article className="daily-combined-total"><span>Total Corte + Rebobinadeira</span><strong>{format(cutAndRewinderTotal)} <small>kg</small></strong></article><section className="daily-loss-grid"><LossTable title="Perdas Extrusão" rows={extrusionLosses} format={format} percent={percent} /><LossTable title="Perdas Corte" rows={cuttingLosses} format={format} percent={percent} showCuttings /></section></>}
    {!sectors.length && <section className="panel daily-empty"><span>▥</span><strong>Nenhuma produção encontrada</strong><p>Não existem apontamentos registrados para {date(selectedDate)}.</p></section>}
    {sectors.length > 0 && <footer className="daily-report-footer"><span>FORPACK · GUAIÚBA — dados salvos automaticamente e compartilhados entre todos que usam este painel</span><strong>{records.length} apontamento(s) · Total geral: {kg(grandTotal)}</strong></footer>}
  </section>;
}

function LossTable({title,rows,format,percent,showCuttings = false}:{title:string;rows:{material:string;produced:number;scraps:number;cuttings:number}[];format:(value:number)=>string;percent:(loss:number,produced:number)=>number;showCuttings?:boolean}) {
  return <article className="daily-loss-card"><header><h2>{title}</h2></header><div className="daily-sector-table-wrap"><table className="daily-loss-table"><thead><tr><th>Material</th><th>Produção</th><th>Apara</th><th>%</th>{showCuttings && <><th>Ap. picote</th><th>%</th></>}</tr></thead><tbody>{rows.map(row => <tr key={row.material}><td><strong>{row.material}</strong></td><td>{format(row.produced)}</td><td>{row.scraps ? format(row.scraps) : "—"}</td><td className={percent(row.scraps,row.produced) > 5 ? "loss-alert" : "loss-ok"}>{row.scraps ? `${percent(row.scraps,row.produced).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}%` : "—"}</td>{showCuttings && <><td>{row.cuttings ? format(row.cuttings) : "—"}</td><td className={percent(row.cuttings,row.produced) > 5 ? "loss-alert" : "loss-ok"}>{row.cuttings ? `${percent(row.cuttings,row.produced).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}%` : "—"}</td></>}</tr>)}</tbody></table></div>{!rows.length && <div className="daily-loss-empty">Sem perdas registradas neste setor.</div>}</article>;
}

function MonthlyProductionReport({records,allRecords,orders,machines,operators,start,end,machine,operator,orderId,onStart,onEnd,onMachine,onOperator,onOrder}:{records:Production[];allRecords:Production[];orders:Order[];machines:Machine[];operators:string[];start:string;end:string;machine:string;operator:string;orderId:string;onStart:(value:string)=>void;onEnd:(value:string)=>void;onMachine:(value:string)=>void;onOperator:(value:string)=>void;onOrder:(value:string)=>void}) {
  const machineMap = new Map(machines.map(item => [item.id, item]));
  const orderMap = new Map(orders.map(item => [item.id, item]));
  const format = (value:number) => value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const percent = (value:number, produced:number) => produced ? value / produced * 100 : 0;
  const options = [...new Set(allRecords.map(record => record.idPedido).filter((value): value is string => Boolean(value)))].map(id => {
    const order = orderMap.get(id);
    return { id, label: order?.numeroOp || order?.numeroPedido || id };
  }).sort((a,b) => a.label.localeCompare(b.label, "pt-BR", { numeric: true }));
  const sectors = SECTORS.map(sector => {
    const items = records.filter(record => machineMap.get(String(record.maquinaId || ""))?.setor.toUpperCase() === sector);
    return {
      sector,
      count: items.length,
      produced: items.reduce((sum, record) => sum + number(record.qtdProduzido), 0),
      scraps: items.reduce((sum, record) => sum + number(record.aparas), 0),
      cuttings: items.reduce((sum, record) => sum + number(record.picote), 0),
    };
  });
  const balanceRecords = orderId === "Todas" ? records : allRecords.filter(record => record.idPedido === orderId);
  const exportCsv = () => {
    const escape = (value:string) => `"${value.replace(/"/g, "\"\"")}"`;
    const lines = [
      ["Data","OP","Produto","Máquina","Setor","Operador","Turno","Produzido (kg)","Aparas (kg)","Picote / Refile (kg)","Perdas (kg)"],
      ...records.map(record => {
        const order = orderMap.get(String(record.idPedido || ""));
        const machineInfo = machineMap.get(String(record.maquinaId || ""));
        return [date(record.dataProducao),order?.numeroOp || order?.numeroPedido || record.idPedido || "",record.descricaoItem || order?.descricaoItem || "",machineInfo?.name || record.maquinaId || "",machineInfo?.setor || "",record.operador || "",record.turno || "",format(number(record.qtdProduzido)),format(number(record.aparas)),format(number(record.picote)),format(number(record.aparas) + number(record.picote))];
      }),
    ];
    const csv = `\uFEFF${lines.map(line => line.map(value => escape(String(value))).join(";")).join("\r\n")}`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `relatorio-mensal-${start || "inicio"}-a-${end || "fim"}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return <section className="monthly-report">
    <header className="monthly-print-heading"><div><strong>FORPACK · GUAIÚBA</strong><span>Relatório mensal de produção</span></div><div><small>Período</small><strong>{date(start)} a {date(end)}</strong></div></header>
    <div className="monthly-filter-card">
      <div className="monthly-filter-grid">
        <label><span>Data inicial</span><input type="date" value={start} max={end || undefined} onChange={event => onStart(event.target.value)} /></label>
        <label><span>Data final</span><input type="date" value={end} min={start || undefined} onChange={event => onEnd(event.target.value)} /></label>
        <label><span>Máquina</span><select value={machine} onChange={event => onMachine(event.target.value)}><option value="Todas">Todas</option>{machines.map(item => <option key={item.id} value={item.id}>{item.name} · {item.setor}</option>)}</select></label>
        <label><span>Operador</span><select value={operator} onChange={event => onOperator(event.target.value)}><option value="Todos">Todos</option>{operators.map(item => <option key={item}>{item}</option>)}</select></label>
        <label><span>OP</span><select value={orderId} onChange={event => onOrder(event.target.value)}><option value="Todas">Todas</option>{options.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      </div>
      <div className="monthly-filter-actions"><span>{records.length} lançamento(s) conforme os filtros</span><button className="secondary monthly-print" onClick={() => window.print()} disabled={!records.length}>▣ Imprimir relatório</button><button className="secondary monthly-export" onClick={exportCsv} disabled={!records.length}>⇩ Exportar CSV</button></div>
    </div>
    <div className="monthly-section-title"><div><p className="eyebrow">ANÁLISE OPERACIONAL</p><h2>Resumo geral por setor</h2></div><span>{records.length} lançamento(s)</span></div>
    <div className="monthly-sector-grid">{sectors.map(item => {
      const losses = item.scraps + item.cuttings;
      return <article className={`monthly-sector-card sector-${item.sector.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")}`} key={item.sector}>
        <header><h3>Produção - {item.sector[0]}{item.sector.slice(1).toLowerCase()}</h3><span>{item.count} lançamento(s)</span></header>
        <div className={item.sector === "REBOBINADEIRA" ? "monthly-sector-values three" : "monthly-sector-values"}>
          <div><small>Produção</small><strong>{format(item.produced)} <em>kg</em></strong><span>Total do setor</span></div>
          <div><small>{item.sector === "REBOBINADEIRA" ? "Aparas" : "Perdas totais"}</small><strong className="loss">{format(item.sector === "REBOBINADEIRA" ? item.scraps : losses)} <em>kg</em></strong><span>{percent(item.sector === "REBOBINADEIRA" ? item.scraps : losses,item.produced).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}% da produção</span></div>
          {item.sector === "REBOBINADEIRA" && <div><small>Picote / refile</small><strong className="loss">{format(item.cuttings)} <em>kg</em></strong><span>{percent(item.cuttings,item.produced).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}% refilado</span></div>}
        </div>
        {item.sector === "REBOBINADEIRA" && <footer>Perdas totais: {format(losses)} kg · {percent(losses,item.produced).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}%</footer>}
      </article>;
    })}</div>
    <OrderWeightBalance records={balanceRecords} orders={orders} machines={machines} selectedOrder={orderId} />
    <article className="monthly-detail-card">
      <header><div><p className="eyebrow">DETALHAMENTO</p><h2>Apontamentos filtrados</h2></div><span>{records.length} registro(s)</span></header>
      <div className="monthly-table-wrap"><table className="monthly-table"><thead><tr><th>Data</th><th>OP</th><th>Produto</th><th>Máquina</th><th>Operador</th><th>Turno</th><th>Produzido</th><th>Aparas</th><th>Picote / refile</th><th>Perdas</th></tr></thead><tbody>
        {records.map(record => {
          const order = orderMap.get(String(record.idPedido || ""));
          const machineInfo = machineMap.get(String(record.maquinaId || ""));
          const scraps = number(record.aparas); const cuttings = number(record.picote);
          return <tr key={record._key || record.id}><td>{date(record.dataProducao)}</td><td><strong>{order?.numeroOp || order?.numeroPedido || record.idPedido || "—"}</strong></td><td>{record.descricaoItem || order?.descricaoItem || "—"}</td><td>{machineInfo?.name || record.maquinaId || "—"}</td><td>{record.operador || "—"}</td><td>{record.turno || "—"}</td><td>{format(number(record.qtdProduzido))}</td><td>{format(scraps)}</td><td>{format(cuttings)}</td><td><strong>{format(scraps + cuttings)}</strong></td></tr>;
        })}
      </tbody></table>{!records.length && <div className="empty">Nenhum apontamento encontrado para os filtros informados.</div>}</div>
    </article>
    <footer className="monthly-report-footer"><span>FORPACK · GUAIÚBA — Painel de Produção</span><strong>Período: {date(start)} a {date(end)} · {records.length} registro(s)</strong></footer>
  </section>;
}

function OrderWeightBalance({records,orders,machines,selectedOrder}:{records:Production[];orders:Order[];machines:Machine[];selectedOrder:string}) {
  const machineMap = new Map(machines.map(item => [item.id, item]));
  const orderAliases = new Map<string,Order>();
  orders.forEach(order => {
    orderAliases.set(order.id, order);
    if (order.numeroOp) orderAliases.set(order.numeroOp, order);
    if (order.numeroPedido) orderAliases.set(order.numeroPedido, order);
  });
  const grouped = new Map<string,Production[]>();
  records.forEach(record => {
    const rawId = String(record.idPedido || "");
    if (!rawId) return;
    const order = orderAliases.get(rawId);
    const key = order?.id || rawId;
    grouped.set(key, [...(grouped.get(key) || []), record]);
  });
  const balances = [...grouped.entries()].map(([id,items]) => {
    const order = orderAliases.get(id) || orderAliases.get(String(items[0]?.idPedido || ""));
    const steps = SECTORS.map(sector => {
      const stageRecords = items.filter(record => machineMap.get(String(record.maquinaId || ""))?.setor.toUpperCase() === sector);
      const produced = stageRecords.reduce((sum,record) => sum + number(record.qtdProduzido), 0);
      const loss = stageRecords.reduce((sum,record) => sum + number(record.aparas) + number(record.picote), 0);
      return { sector, produced, loss, count: stageRecords.length };
    }).filter(step => step.count > 0 || step.produced > 0 || step.loss > 0);
    const first = steps[0]; const last = steps[steps.length - 1];
    const detailed = steps.map((step,index) => {
      const previous = index ? steps[index - 1].produced : null;
      const difference = previous === null ? null : previous - step.produced - step.loss;
      return { ...step, input: previous ?? step.produced, difference };
    });
    const initial = first?.produced || 0;
    const final = last?.produced || 0;
    const realLoss = Math.max(0, initial - final);
    const declaredLoss = detailed.slice(1).reduce((sum,step) => sum + step.loss, 0);
    const divergence = detailed.slice(1).reduce((sum,step) => sum + Math.abs(step.difference || 0), 0);
    return { id, order, steps: detailed, initial, final, realLoss, declaredLoss, divergence, yieldRate: initial ? final / initial * 100 : 0 };
  }).filter(item => item.steps.length).sort((a,b) => (a.order?.numeroOp || a.id).localeCompare(b.order?.numeroOp || b.id,"pt-BR",{numeric:true}));
  const format = (value:number) => value.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
  const tolerance = 0.05;
  const focus = selectedOrder !== "Todas" && balances.length === 1 ? balances[0] : null;
  const totalInitial = balances.reduce((sum,item) => sum + item.initial,0);
  const totalFinal = balances.reduce((sum,item) => sum + item.final,0);
  const totalLoss = balances.reduce((sum,item) => sum + item.realLoss,0);
  const divergent = balances.filter(item => item.divergence > tolerance).length;
  return <section className="weight-balance">
    <div className="monthly-section-title balance-title"><div><p className="eyebrow">RASTREABILIDADE DE PESO</p><h2>Balanço do pedido por setor</h2></div><span>{selectedOrder === "Todas" ? `${balances.length} OP(s) analisada(s) no período` : "Ciclo completo da OP selecionada"}</span></div>
    {!balances.length ? <div className="balance-empty">Não há etapas suficientes para calcular o balanço de peso.</div> : <>
      <div className="balance-kpis">
        <div><small>Peso inicial extrusado</small><strong>{format(totalInitial)} <em>kg</em></strong></div>
        <div><small>Produção final</small><strong className="positive">{format(totalFinal)} <em>kg</em></strong></div>
        <div><small>Perda real no processo</small><strong className="loss">{format(totalLoss)} <em>kg</em></strong><span>{totalInitial ? (totalLoss/totalInitial*100).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}) : "0,00"}% do peso inicial</span></div>
        <div><small>Conferência de saldo</small><strong className={divergent ? "loss" : "positive"}>{divergent ? `${divergent} divergente(s)` : "Pesos conferidos"}</strong><span>Tolerância de 0,05 kg por passagem</span></div>
      </div>
      {focus ? <article className="balance-flow-card">
        <header><div><small>OP</small><strong>{focus.order?.numeroOp || focus.order?.numeroPedido || focus.id}</strong><span>{focus.order?.descricaoItem || focus.steps[0]?.sector}</span></div><div className={focus.divergence > tolerance ? "balance-status alert" : "balance-status ok"}>{focus.divergence > tolerance ? "⚠ Verificar divergência" : "✓ Saldo conferido"}</div></header>
        <div className="balance-flow">{focus.steps.map((step,index) => <div className="balance-stage-wrap" key={step.sector}>
          {index > 0 && <span className="balance-arrow">→</span>}
          <div className="balance-stage"><small>{step.sector}</small><strong>{format(step.produced)} kg</strong><span>Perda: {format(step.loss)} kg</span>{step.difference !== null && <b className={Math.abs(step.difference) <= tolerance ? "ok" : "alert"}>{Math.abs(step.difference) <= tolerance ? "Saldo fechado" : `${step.difference > 0 ? "Falta" : "Excesso"}: ${format(Math.abs(step.difference))} kg`}</b>}</div>
        </div>)}</div>
        <footer><span>Inicial: <strong>{format(focus.initial)} kg</strong></span><span>Final: <strong>{format(focus.final)} kg</strong></span><span>Perda real: <strong>{format(focus.realLoss)} kg</strong></span><span>Aproveitamento: <strong>{focus.yieldRate.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}%</strong></span></footer>
      </article> : <article className="balance-list-card"><div className="monthly-table-wrap"><table className="balance-table"><thead><tr><th>OP</th><th>Produto</th><th>Fluxo registrado</th><th>Peso inicial</th><th>Produção final</th><th>Perda real</th><th>Aproveitamento</th><th>Conferência</th></tr></thead><tbody>{balances.map(item => <tr key={item.id}><td><strong>{item.order?.numeroOp || item.order?.numeroPedido || item.id}</strong></td><td>{item.order?.descricaoItem || item.steps.map(step => step.sector).join(" → ")}</td><td><div className="mini-flow">{item.steps.map(step => <span key={step.sector}>{step.sector.slice(0,3)} <b>{format(step.produced)}</b></span>)}</div></td><td>{format(item.initial)} kg</td><td>{format(item.final)} kg</td><td className="loss-cell">{format(item.realLoss)} kg</td><td>{item.yieldRate.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}%</td><td><span className={item.divergence > tolerance ? "balance-pill alert" : "balance-pill ok"}>{item.divergence > tolerance ? `Dif. ${format(item.divergence)} kg` : "Conferido"}</span></td></tr>)}</tbody></table></div><footer>Selecione uma OP no filtro acima para abrir o fluxo detalhado de todas as etapas, mesmo quando os lançamentos ocorreram em meses diferentes.</footer></article>}
    </>}
  </section>;
}

function DeadlineCenter({orders,records,machines,onOpen}:{orders:Order[];records:Production[];machines:Machine[];onOpen:(order:Order)=>void}) {
  const [risk, setRisk] = useState("Todos");
  const [term, setTerm] = useState("");
  const [capacityMachine, setCapacityMachine] = useState("");
  const [dailyCapacity, setDailyCapacity] = useState(2500);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });
  const dayMs = 86400000;
  const diffDays = (value: string) => Math.round((Date.parse(`${value}T12:00:00`) - Date.parse(`${today}T12:00:00`)) / dayMs);
  const machineMap = new Map(machines.map(machine => [machine.id, machine]));
  const scheduledMachines = machines.filter(machine => orders.some(order => order.maquinaId === machine.id));
  useEffect(() => {
    if (capacityMachine && machines.some(machine => machine.id === capacityMachine)) return;
    const ef1 = machines.find(machine => machine.name.toLocaleUpperCase("pt-BR").includes("EF1"));
    setCapacityMachine(ef1?.id || scheduledMachines[0]?.id || "");
  }, [capacityMachine, machines, scheduledMachines]);
  const analysis = orders.map(order => {
    const orderRecords = records.filter(record => record.idPedido === order.id || record.idPedido === order.numeroOp || record.idPedido === order.numeroPedido);
    const sorted = [...orderRecords].sort((a,b) => (b.dataProducao || "").localeCompare(a.dataProducao || ""));
    const last = sorted[0];
    const deadline = deadlineOf(order);
    const remaining = deadline.due ? diffDays(deadline.due) : null;
    const idleDays = last?.dataProducao ? Math.max(0, -diffDays(last.dataProducao)) : null;
    const lastMachine = last ? machineMap.get(String(last.maquinaId || "")) : undefined;
    const currentMachine = machineMap.get(String(order.maquinaId || ""));
    const stage = lastMachine?.setor || currentMachine?.setor || (group(order.statusProducao) === "Aguardando" ? "AGUARDANDO PCP" : group(order.statusProducao).toUpperCase());
    const stageWeight = lastMachine ? orderRecords.filter(record => machineMap.get(String(record.maquinaId || ""))?.setor === lastMachine.setor).reduce((sum,record) => sum + number(record.qtdProduzido),0) : 0;
    const category = deadline.waiting ? "Aguardando clichê" : remaining! < 0 ? "Atrasados" : remaining === 0 ? "Vence hoje" : remaining! <= 7 ? "Próximos 7 dias" : (idleDays === null || idleDays >= 3) ? "Sem movimentação" : "No prazo";
    const urgency = deadline.waiting ? 3 : remaining! < 0 ? 0 : remaining === 0 ? 1 : remaining! <= 7 ? 2 : (idleDays === null || idleDays >= 3) ? 4 : 5;
    const touchedSectors = SECTORS.filter(sector => orderRecords.some(record => machineMap.get(String(record.maquinaId || ""))?.setor.toUpperCase() === sector));
    const progress = Math.round(touchedSectors.length / SECTORS.length * 100);
    const action = deadline.waiting
      ? { label:"Confirmar chegada do clichê", reason:"O prazo de 30 dias ainda não começou", tone:"waiting" }
      : !order.maquinaId && !orderRecords.length
        ? { label:"Programar pedido no PCP", reason:"Pedido ainda sem máquina e sem produção", tone:"late" }
        : !orderRecords.length
          ? { label:"Iniciar produção", reason:"Pedido programado, mas sem apontamento", tone:"today" }
          : idleDays !== null && idleDays >= 3
            ? { label:"Retomar etapa parada", reason:`Sem movimentação há ${idleDays} dia(s)`, tone:"late" }
            : remaining !== null && remaining < 0
              ? { label:"Priorizar conclusão", reason:`Prazo vencido há ${Math.abs(remaining)} dia(s)`, tone:"late" }
              : remaining !== null && remaining <= 7
                ? { label:"Garantir próxima etapa", reason:remaining === 0 ? "Prazo vence hoje" : `Restam ${remaining} dia(s)`, tone:"today" }
                : { label:"Manter acompanhamento", reason:"Fluxo dentro do prazo calculado", tone:"normal" };
    return { order, deadline, remaining, idleDays, lastDate: last?.dataProducao || "", stage, stageWeight, category, urgency, touchedSectors, progress, action };
  }).sort((a,b) => a.urgency - b.urgency || (a.remaining ?? 99999) - (b.remaining ?? 99999) || (a.order.data || "").localeCompare(b.order.data || ""));
  const counts = {
    late: analysis.filter(item => item.remaining !== null && item.remaining < 0).length,
    today: analysis.filter(item => item.remaining === 0).length,
    soon: analysis.filter(item => item.remaining !== null && item.remaining > 0 && item.remaining <= 7).length,
    idle: analysis.filter(item => item.idleDays === null || item.idleDays >= 3).length,
    cliche: analysis.filter(item => item.deadline.waiting).length,
  };
  const clean = term.toLocaleLowerCase("pt-BR").trim();
  const visible = analysis.filter(item => (risk === "Todos" || item.category === risk) && (!clean || `${item.order.numeroPedido || ""} ${item.order.numeroOp || ""} ${item.order.cliente} ${item.order.descricaoItem}`.toLocaleLowerCase("pt-BR").includes(clean)));
  const priorityActions = analysis.filter(item => item.action.tone !== "normal").slice(0,3);
  const selectedCapacityMachine = machineMap.get(capacityMachine);
  const machineQueue = orders.filter(order => order.maquinaId === capacityMachine).sort((a,b) => (a.data || "").localeCompare(b.data || "") || (a.ordemFila ?? 999999) - (b.ordemFila ?? 999999));
  const queueWithBalance = machineQueue.map(order => {
    const produced = records.filter(record => record.maquinaId === capacityMachine && (record.idPedido === order.id || record.idPedido === order.numeroOp || record.idPedido === order.numeroPedido)).reduce((sum,record) => sum + number(record.qtdProduzido),0);
    return { order, produced, balance: Math.max(0, number(order.quantidade) - produced) };
  }).filter(item => item.balance > 0);
  const totalQueueKg = queueWithBalance.reduce((sum,item) => sum + item.balance,0);
  const capacity = Math.max(1,dailyCapacity || 0);
  const capacityDays:{date:string;planned:number;allocations:{order:Order;kg:number;balanceAfter:number}[]}[] = [];
  let planDate = today;
  let dayIndex = 0;
  for (const item of queueWithBalance) {
    let remaining = item.balance;
    while (remaining > 0 && dayIndex < 180) {
      if (!capacityDays[dayIndex]) capacityDays[dayIndex] = { date:planDate, planned:0, allocations:[] };
      const currentDay = capacityDays[dayIndex];
      const available = Math.max(0,capacity - currentDay.planned);
      if (available <= 0) { dayIndex += 1; planDate = addCalendarDays(today,dayIndex); continue; }
      const allocated = Math.min(remaining,available);
      remaining -= allocated;
      currentDay.planned += allocated;
      currentDay.allocations.push({ order:item.order,kg:allocated,balanceAfter:remaining });
      if (currentDay.planned >= capacity) { dayIndex += 1; planDate = addCalendarDays(today,dayIndex); }
    }
  }
  return <section className="deadline-center">
    <div className="deadline-kpis">
      <button className="deadline-kpi late" onClick={() => setRisk("Atrasados")}><span>!</span><div><small>Pedidos atrasados</small><strong>{counts.late}</strong><em>Exigem ação imediata</em></div></button>
      <button className="deadline-kpi today" onClick={() => setRisk("Vence hoje")}><span>◷</span><div><small>Vencem hoje</small><strong>{counts.today}</strong><em>Prazo no dia atual</em></div></button>
      <button className="deadline-kpi soon" onClick={() => setRisk("Próximos 7 dias")}><span>7</span><div><small>Próximos 7 dias</small><strong>{counts.soon}</strong><em>Antecipar a programação</em></div></button>
      <button className="deadline-kpi idle" onClick={() => setRisk("Sem movimentação")}><span>―</span><div><small>Sem movimentação</small><strong>{counts.idle}</strong><em>3 dias ou sem apontamento</em></div></button>
      <button className="deadline-kpi cliche" onClick={() => setRisk("Aguardando clichê")}><span>C</span><div><small>Aguardando clichê</small><strong>{counts.cliche}</strong><em>Prazo ainda não iniciado</em></div></button>
    </div>
    <section className="capacity-planner">
      <header><div><p className="eyebrow">PLANEJAMENTO POR CAPACIDADE</p><h2>Agenda diária da máquina</h2><span>Distribuição automática da fila por volume disponível em 24 horas</span></div><div className="capacity-controls"><label><span>Máquina</span><select value={capacityMachine} onChange={event => setCapacityMachine(event.target.value)}>{scheduledMachines.map(machine => <option key={machine.id} value={machine.id}>{machine.name} · {machine.setor}</option>)}</select></label><label><span>Capacidade em 24h</span><div><input type="number" min="1" step="100" value={dailyCapacity} onChange={event => setDailyCapacity(Math.max(1,Number(event.target.value) || 1))} /><b>kg</b></div></label></div></header>
      <div className="capacity-summary"><article><small>Máquina selecionada</small><strong>{selectedCapacityMachine?.name || "Sem máquina"}</strong><span>{selectedCapacityMachine?.setor || "Selecione uma máquina programada"}</span></article><article><small>Pedidos na fila</small><strong>{queueWithBalance.length}</strong><span>Com saldo a produzir</span></article><article><small>Carga programada</small><strong>{kg(totalQueueKg)}</strong><span>Saldo da fila selecionada</span></article><article><small>Previsão de conclusão</small><strong>{capacityDays.length ? date(capacityDays[capacityDays.length - 1].date) : "—"}</strong><span>{capacityDays.length} dia(s) de produção</span></article></div>
      <div className="capacity-days">{capacityDays.map((day,index) => { const utilization = Math.min(100,day.planned/capacity*100); const dayDate = new Date(`${day.date}T12:00:00`); return <article className="capacity-day" key={day.date}>
        <header><div><small>Dia {index + 1}</small><strong>{dayDate.toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"2-digit"})}</strong></div><span>{utilization.toLocaleString("pt-BR",{maximumFractionDigits:0})}% ocupado</span></header>
        <div className="capacity-bar"><i style={{width:`${utilization}%`}} /></div>
        <div className="capacity-day-total"><strong>{kg(day.planned)}</strong><span>de {kg(capacity)}</span></div>
        <div className="capacity-orders">{day.allocations.map((allocation,allocationIndex) => <button key={`${allocation.order.id}-${allocationIndex}`} onClick={() => onOpen(allocation.order)}><span><b>{allocation.order.numeroOp ? `OP ${allocation.order.numeroOp}` : allocation.order.numeroPedido || "Pedido"}</b><small>{allocation.order.cliente}</small></span><strong>{kg(allocation.kg)}</strong>{allocation.balanceAfter > 0 && <em>continua →</em>}</button>)}</div>
      </article>; })}{!capacityDays.length && <div className="capacity-empty">Não há saldo programado para a máquina selecionada.</div>}</div>
      <footer><span>Início: hoje · operação contínua em dias corridos</span><span>Ordem usada: pedido mais antigo primeiro</span></footer>
    </section>
    {!!priorityActions.length && <div className="deadline-action-board">
      <header><div><p className="eyebrow">PLANO DO DIA</p><h2>Próximas ações recomendadas</h2></div><span>Gerado automaticamente pelos prazos e movimentações</span></header>
      <div>{priorityActions.map((item,index) => <button key={item.order.id} onClick={() => onOpen(item.order)}>
        <b>{index + 1}</b><span><small>{item.order.numeroOp ? `OP ${item.order.numeroOp}` : item.order.numeroPedido || "Pedido"}</small><strong>{item.action.label}</strong><em>{item.action.reason}</em></span><i>Ver OP →</i>
      </button>)}</div>
    </div>}
    <div className="deadline-panel">
      <header><div><p className="eyebrow">FILA PRIORIZADA</p><h2>Pedidos que precisam de atenção</h2></div><div className="deadline-controls"><div className="tabs">{["Todos","Atrasados","Vence hoje","Próximos 7 dias","Aguardando clichê","Sem movimentação"].map(item => <button key={item} className={risk === item ? "tab active" : "tab"} onClick={() => setRisk(item)}>{item}</button>)}</div><label className="search"><span>⌕</span><input value={term} onChange={event => setTerm(event.target.value)} placeholder="Buscar pedido, OP ou cliente" /></label></div></header>
      <div className="table-wrap"><table className="deadline-table"><thead><tr><th>Prioridade</th><th>Pedido / OP</th><th>Cliente e produto</th><th>Prazo</th><th>Etapa atual</th><th>Avanço</th><th>Última movimentação</th><th>Produzido na etapa</th><th>Ação recomendada</th><th /></tr></thead><tbody>{visible.map(item => <tr key={item.order.id}>
        <td><span className={`deadline-pill ${item.deadline.waiting ? "waiting" : item.remaining! < 0 ? "late" : item.remaining === 0 ? "today" : item.remaining! <= 7 ? "soon" : "normal"}`}>{item.deadline.waiting ? "Aguardando clichê" : item.remaining! < 0 ? `${Math.abs(item.remaining!)} dia(s) atrasado` : item.remaining === 0 ? "Vence hoje" : `${item.remaining} dia(s)`}</span></td>
        <td><strong>{item.order.numeroPedido || item.order.id}</strong><small>{item.order.numeroOp ? `OP ${item.order.numeroOp}` : "OP não emitida"}</small></td>
        <td><strong>{item.order.cliente}</strong><small>{item.order.descricaoItem}</small></td>
        <td><strong>{item.deadline.due ? date(item.deadline.due) : "Prazo não iniciado"}</strong><small>{item.deadline.label}</small>{item.deadline.legacy && <small className="deadline-confirm">Editar pedido para confirmar</small>}</td>
        <td><strong>{item.stage}</strong><small>{item.order.maquinaId ? machineMap.get(item.order.maquinaId)?.name || "Máquina não identificada" : "Sem máquina programada"}</small></td>
        <td><div className="deadline-progress"><span><i style={{width:`${item.progress}%`}} /></span><strong>{item.touchedSectors.length} setor(es) com registro</strong></div></td>
        <td><strong>{item.lastDate ? date(item.lastDate) : "Sem apontamento"}</strong><small>{item.idleDays === null ? "Aguardando início" : item.idleDays === 0 ? "Movimentado hoje" : `Há ${item.idleDays} dia(s)`}</small></td>
        <td><strong className="deadline-weight">{item.stageWeight ? kg(item.stageWeight) : "—"}</strong><small>Pedido: {kg(number(item.order.quantidade))}</small></td>
        <td><span className={`deadline-action ${item.action.tone}`}><strong>{item.action.label}</strong><small>{item.action.reason}</small></span></td>
        <td><button className="secondary" onClick={() => onOpen(item.order)}>Ver OP →</button></td>
      </tr>)}</tbody></table>{!visible.length && <div className="empty">Nenhum pedido encontrado neste filtro.</div>}</div>
      <footer><span>{visible.length} pedido(s) nesta visualização</span><span>Ordenação automática: atraso → vencimento → falta de movimentação</span></footer>
    </div>
  </section>;
}

function MonthlyDashboard({records,machines,month,onMonth}:{records:Production[];machines:Machine[];month:string;onMonth:(value:string)=>void}) {
  const machineMap = new Map(machines.map(machine => [machine.id, machine]));
  const produced = records.reduce((sum, record) => sum + number(record.qtdProduzido), 0);
  const scraps = records.reduce((sum, record) => sum + number(record.aparas) + number(record.picote), 0);
  const totalInput = produced + scraps;
  const yieldRate = totalInput ? produced / totalInput * 100 : 0;
  const days = new Set(records.map(record => record.dataProducao).filter(Boolean)).size;
  const sectors = SECTORS.map(sector => {
    const items = records.filter(record => machineMap.get(String(record.maquinaId || ""))?.setor.toUpperCase() === sector);
    return {
      sector,
      produced: items.reduce((sum, record) => sum + number(record.qtdProduzido), 0),
      scraps: items.reduce((sum, record) => sum + number(record.aparas) + number(record.picote), 0),
      records: items.length,
    };
  });
  const maxSector = Math.max(...sectors.map(item => item.produced), 1);
  const machineRanking = machines.map(machine => {
    const items = records.filter(record => record.maquinaId === machine.id);
    return { machine, produced: items.reduce((sum, record) => sum + number(record.qtdProduzido), 0), records: items.length };
  }).filter(item => item.records).sort((a,b) => b.produced - a.produced).slice(0,6);
  const monthLabel = month ? new Date(`${month}-02T12:00:00`).toLocaleDateString("pt-BR",{month:"long",year:"numeric"}) : "período";
  return <section className="dashboard">
    <div className="dashboard-toolbar">
      <div><strong>Resumo de {monthLabel}</strong><small>Atualizado pelos apontamentos de produção</small></div>
      <div className="dashboard-actions"><label><span>Mês de referência</span><input type="month" value={month} onChange={event => onMonth(event.target.value)} /></label><button className="secondary" onClick={() => window.print()}>Imprimir resumo</button></div>
    </div>
    <div className="metrics dashboard-metrics">
      <Metric label="Produção do mês" value={Math.round(produced)} detail={`${records.length} apontamentos`} tone="blue" />
      <Metric label="Perdas registradas" value={Math.round(scraps)} detail="Aparas + picote (kg)" tone="red" />
      <Metric label="Aproveitamento" value={Number(yieldRate.toFixed(1))} detail="Produzido ÷ total processado (%)" tone="green" />
      <Metric label="Dias com produção" value={days} detail="Dias com apontamento" tone="orange" />
    </div>
    <div className="dashboard-grid">
      <article className="dashboard-card sector-card">
        <header><div><p className="eyebrow">VOLUME</p><h2>Produção por setor</h2></div><span>{kg(produced)}</span></header>
        <div className="sector-chart">{sectors.map(item => <div className="bar-row" key={item.sector}>
          <div className="bar-label"><strong>{item.sector}</strong><small>{item.records} lançamento(s)</small></div>
          <div className="bar-track"><span style={{width:`${item.produced / maxSector * 100}%`}} /></div>
          <b>{kg(item.produced)}</b>
        </div>)}</div>
      </article>
      <article className="dashboard-card">
        <header><div><p className="eyebrow">DESEMPENHO</p><h2>Máquinas com maior produção</h2></div></header>
        <div className="ranking">{machineRanking.map((item,index) => <div key={item.machine.id}><span>{index + 1}</span><p><strong>{item.machine.name}</strong><small>{item.machine.setor} · {item.records} lançamento(s)</small></p><b>{kg(item.produced)}</b></div>)}
          {!machineRanking.length && <div className="dashboard-empty">Sem apontamentos neste mês.</div>}
        </div>
      </article>
      <article className="dashboard-card loss-card">
        <header><div><p className="eyebrow">PERDAS</p><h2>Aparas e picote por setor</h2></div></header>
        <div className="loss-grid">{sectors.map(item => <div key={item.sector}><small>{item.sector}</small><strong>{kg(item.scraps)}</strong><span>{item.produced + item.scraps ? (item.scraps / (item.produced + item.scraps) * 100).toFixed(1) : "0,0"}% do processado</span></div>)}</div>
      </article>
    </div>
  </section>;
}

function ProductionReport({records,orders,machines,onEdit}:{records:Production[];orders:Order[];machines:Machine[];onEdit:(record:Production)=>void}) {
  const orderOf = (record:Production) => orders.find(order => order.id === record.idPedido || order.numeroOp === record.idPedido);
  const machineOf = (record:Production) => machines.find(machine => machine.id === record.maquinaId);
  return <div className="table-wrap"><table className="report-table"><thead><tr><th>Data</th><th>Pedido / OP</th><th>Máquina / setor</th><th>Operador / turno</th><th>Produzido</th><th>Perdas</th><th /></tr></thead>
    <tbody>{records.map(record => { const order = orderOf(record); const machine = machineOf(record); return <tr key={record._key || record.id}>
      <td><strong>{date(record.dataProducao)}</strong></td>
      <td><strong>{order?.numeroOp ? `OP ${order.numeroOp}` : order?.numeroPedido ? `Pedido ${order.numeroPedido}` : record.idPedido}</strong><small className="cell-sub">{record.cliente || order?.cliente || "—"}</small></td>
      <td><strong>{machine?.name || record.maquinaId || "—"}</strong><small className="cell-sub">{machine?.setor || "Setor não identificado"}</small></td>
      <td><strong>{record.operador || "—"}</strong><small className="cell-sub">{record.turno || "Turno não informado"}</small></td>
      <td><strong className="positive">{kg(number(record.qtdProduzido))}</strong></td>
      <td><span>Aparas: {kg(number(record.aparas))}</span><small className="cell-sub">Picote: {kg(number(record.picote))}</small></td>
      <td><button className="secondary" onClick={() => onEdit(record)}>Editar</button></td>
    </tr>; })}</tbody></table>{!records.length && <div className="empty">Nenhum apontamento encontrado para os filtros informados.</div>}</div>;
}

function EditProductionForm({record,operators,saving,onSave,onCancel}:{record:Production;operators:string[];saving:boolean;onSave:(record:Production)=>void;onCancel:()=>void}) {
  const [input,setInput] = useState<Production>({...record});
  const update = (field:keyof Production,value:string) => setInput(current => ({...current,[field]:value}));
  const valid = Boolean(input.dataProducao && input.turno && input.operador && number(input.qtdProduzido) > 0);
  function submit(event:React.FormEvent) {
    event.preventDefault();
    if (!valid || saving) return;
    if (window.confirm("Salvar a correção deste apontamento? Os totais produzidos da OP serão recalculados com o novo valor.")) onSave(input);
  }
  return <form className="new-order-form edit-order-form" onSubmit={submit}>
    <div className="production-grid">
      <label className="field"><span>Data da produção</span><input type="date" value={input.dataProducao || ""} onChange={event => update("dataProducao",event.target.value)} /></label>
      <label className="field"><span>Turno</span><select value={input.turno || ""} onChange={event => update("turno",event.target.value)}><option value="">Selecione</option><option>MANHÃ</option><option>TARDE</option><option>NOITE</option></select></label>
    </div>
    <label className="field"><span>Operador</span><select value={input.operador || ""} onChange={event => update("operador",event.target.value)}><option value="">Selecione</option>{operators.map(operator => <option key={operator}>{operator}</option>)}</select></label>
    <label className="field"><span>Quantidade produzida (kg)</span><input inputMode="decimal" value={input.qtdProduzido || ""} onChange={event => update("qtdProduzido",event.target.value)} /></label>
    <div className="production-grid">
      <label className="field"><span>Aparas (kg)</span><input inputMode="decimal" value={input.aparas || ""} onChange={event => update("aparas",event.target.value)} /></label>
      <label className="field"><span>Picote (kg)</span><input inputMode="decimal" value={input.picote || ""} onChange={event => update("picote",event.target.value)} /></label>
    </div>
    <div className="form-actions"><button type="button" className="cancel-action" disabled={saving} onClick={onCancel}>Cancelar</button><button type="submit" className="primary-action" disabled={!valid || saving}>{saving ? "Salvando..." : "Salvar correção"}</button></div>
  </form>;
}

function Metric({label,value,detail,tone}:{label:string;value:number;detail:string;tone:string}) {
  return <article className={`metric ${tone}`}><span className="metric-icon">{tone === "blue" ? "▤" : tone === "green" ? "↗" : tone === "orange" ? "⌁" : "✓"}</span><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></article>;
}
function OrderRow({order,totals,onOpen}:{order:Order;totals:Totals;onOpen:()=>void}) {
  const g = group(order.statusProducao);
  return <tr><td><button className="order-id" onClick={onOpen}>Pedido {order.id}</button><small className="cell-sub">{order.numeroOp ? `OP ${order.numeroOp} · ` : ""}{date(order.data)}</small></td>
    <td><strong>{order.cliente}</strong><small className="cell-sub product-name">{order.descricaoItem}</small></td><td><strong>{kg(number(order.quantidade))}</strong></td>
    <td><span className={`status ${g.replace(" ","-").toLowerCase()}`}>{g}</span><small className="cell-sub">{order.statusProducao || "Sem status definido"}</small></td>
    <td><div className="sector-values">{SECTORS.map(sector => <span key={sector} className={totals[sector] ? "done" : ""} title={`${sector}: ${totals[sector] ? kg(totals[sector]) : "sem produção"}`}><b>{totals[sector] ? totals[sector].toLocaleString("pt-BR",{maximumFractionDigits:1}) : "–"}</b><small>{sector.slice(0,3)}</small></span>)}</div></td>
    <td><button className="more" onClick={onOpen}>•••</button></td></tr>;
}

function ProgrammingForm({order,machines,saving,onSave,onReturnToWaiting}:{order:Order;machines:Machine[];saving:boolean;onSave:(order:Order,machineId:string,priority:boolean)=>void;onReturnToWaiting:(order:Order)=>void}) {
  const [machineId, setMachineId] = useState(order.maquinaId || "");
  const [priority, setPriority] = useState(Boolean((order as Order & { prioridade?: number }).prioridade));
  const currentMachine = machines.find(machine => machine.id === order.maquinaId);
  const isReprogramming = Boolean(currentMachine);
  const changedMachine = Boolean(isReprogramming && machineId && machineId !== order.maquinaId);
  const grouped = SECTORS.map(sector => ({ sector, machines: machines.filter(machine => machine.setor.toUpperCase() === sector) })).filter(group => group.machines.length);
  function confirmProgramming() {
    if (!machineId) return;
    if (changedMachine && !window.confirm(`Reprogramar esta OP de ${currentMachine?.name} (${currentMachine?.setor}) para ${machines.find(machine => machine.id === machineId)?.name}? Os apontamentos já realizados serão preservados.`)) return;
    onSave(order,machineId,priority);
  }
  function confirmReturnToWaiting() {
    if (!window.confirm(`Retirar esta OP da fila de ${currentMachine?.name} e retornar para Aguardando Programação? Todo o histórico produzido será preservado.`)) return;
    onReturnToWaiting(order);
  }
  return <section className="programming-card">
    <div className="programming-title"><div><p className="eyebrow">{isReprogramming ? "REPROGRAMAÇÃO PCP" : "PROGRAMAÇÃO PCP"}</p><h3>{isReprogramming ? "Transferir OP para outra máquina/setor" : "Definir próxima máquina"}</h3></div><span>Gravação real</span></div>
    {isReprogramming && <div className="programming-route"><div><small>ATUAL</small><strong>{currentMachine?.name}</strong><span>{currentMachine?.setor}</span></div><b>→</b><div className={changedMachine ? "destination selected" : "destination"}><small>NOVO DESTINO</small><strong>{machines.find(machine => machine.id === machineId)?.name || "Selecione"}</strong><span>{machines.find(machine => machine.id === machineId)?.setor || "Máquina / setor"}</span></div></div>}
    <label className="field"><span>{isReprogramming ? "Nova máquina / setor" : "Máquina / setor"}</span><select value={machineId} onChange={event => setMachineId(event.target.value)}>
      <option value="">Selecione a máquina</option>
      {grouped.map(group => <optgroup key={group.sector} label={group.sector}>{group.machines.map(machine => <option key={machine.id} value={machine.id}>{machine.name}</option>)}</optgroup>)}
    </select></label>
    <label className="priority-check"><input type="checkbox" checked={priority} onChange={event => setPriority(event.target.checked)} /><span><strong>Marcar como prioridade</strong><small>Destaca esta OP na fila da máquina.</small></span></label>
    <button className="primary-action" disabled={!machineId || saving || (isReprogramming && !changedMachine && priority === Boolean(order.prioridade))} onClick={confirmProgramming}>{saving ? "Salvando..." : isReprogramming ? "Confirmar reprogramação" : "Confirmar programação"}</button>
    {isReprogramming && <button className="return-waiting-action" disabled={saving} onClick={confirmReturnToWaiting}>← Retornar para Aguardando Programação</button>}
    <p className="save-warning">{isReprogramming ? "A OP sairá da fila atual e entrará na nova máquina. Todo o histórico produzido continuará vinculado à OP e ao setor onde foi realizado." : "Ao confirmar, o pedido sai de “Aguardando programação” e entra na fila da máquina selecionada."}</p>
  </section>;
}

function ProductionForm({order,machine,records,operators,saving,onSave}:{order:Order;machine?:Machine;records:Production[];operators:string[];saving:boolean;onSave:(order:Order,input:Production)=>void}) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });
  const [input, setInput] = useState<Production>({ dataProducao: today, turno: "", operador: "", qtdProduzido: "", aparas: "", picote: "" });
  const valid = Boolean(machine && input.dataProducao && input.turno && input.operador?.trim() && number(input.qtdProduzido) > 0);
  const update = (field:keyof Production, value:string) => setInput(current => ({...current,[field]:value}));
  return <section className="programming-card">
    <div className="programming-title"><div><p className="eyebrow">APONTAMENTO DE PRODUÇÃO</p><h3>{machine?.name || "Máquina não definida"}</h3></div><span>Gravação real</span></div>
    <div className="production-grid">
      <label className="field"><span>Data da produção</span><input type="date" value={input.dataProducao} onChange={event => update("dataProducao",event.target.value)} /></label>
      <label className="field"><span>Turno</span><select value={input.turno} onChange={event => update("turno",event.target.value)}><option value="">Selecione</option><option>MANHÃ</option><option>TARDE</option><option>NOITE</option></select></label>
    </div>
    <label className="field"><span>Operador</span><select value={input.operador} onChange={event => update("operador",event.target.value)}>
      <option value="">Selecione o operador</option>
      {operators.map(operator => <option key={operator} value={operator}>{operator}</option>)}
    </select></label>
    <label className="field"><span>Quantidade produzida (kg)</span><input inputMode="decimal" value={input.qtdProduzido} onChange={event => update("qtdProduzido",event.target.value)} placeholder="Ex.: 350,5" /></label>
    <div className="production-grid">
      <label className="field"><span>Aparas (kg)</span><input inputMode="decimal" value={input.aparas} onChange={event => update("aparas",event.target.value)} placeholder="Opcional" /></label>
      <label className="field"><span>Picote (kg)</span><input inputMode="decimal" value={input.picote} onChange={event => update("picote",event.target.value)} placeholder="Opcional" /></label>
    </div>
    <button className="primary-action" disabled={!valid || saving} onClick={() => onSave(order,input)}>{saving ? "Registrando..." : "Registrar produção"}</button>
    <p className="save-warning">O lançamento será somado ao produzido desta OP em {machine?.setor || "seu setor"}. A programação não será alterada automaticamente.</p>
    {records.length > 0 && <div className="recent-records"><strong>Últimos apontamentos nesta máquina</strong>{records.slice().sort((a,b) => (b.dataProducao || "").localeCompare(a.dataProducao || "")).slice(0,3).map(record => <div key={record.id}><span>{date(record.dataProducao)} · {record.turno}</span><b>{kg(number(record.qtdProduzido))}</b></div>)}</div>}
  </section>;
}

function OrderManagement({order,records,machines,saving,onEdit,onFinish,onReopen}:{order:Order;records:Production[];machines:Machine[];saving:boolean;onEdit:()=>void;onFinish:(closure:{responsavel:string;observacao?:string})=>void;onReopen:(closure:{responsavel:string;observacao?:string})=>void}) {
  const finished = group(order.statusProducao) === "Finalizado";
  const [closing, setClosing] = useState(false);
  const [responsible, setResponsible] = useState(order.fechamento?.responsavel || "Ernade Silva");
  const [observation, setObservation] = useState("");
  const balance = orderBalance(order,records,machines);
  const snapshot = order.fechamento || { responsavel: responsible, observacao: "", data: order.dataConclusao || "", pesoInicial: balance.initial, pesoFinal: balance.final, perdaReal: balance.realLoss, perdaDeclarada: balance.declaredLoss, divergencia: balance.divergence, aproveitamento: balance.yieldRate };
  function confirmReopen() {
    const reason = window.prompt("Informe o motivo da reabertura da OP:", "Correção ou complemento de produção");
    if (reason !== null && window.confirm("Reabrir esta OP? Ela voltará para Aguardando Programação e poderá ser programada novamente.")) onReopen({responsavel:"Ernade Silva",observacao:reason});
  }
  function printClosure() {
    const source = document.querySelector<HTMLElement>("[data-closure-print]");
    if (!source) return window.alert("Não foi possível preparar o relatório para impressão.");
    const frame = document.createElement("iframe");
    frame.title = "Impressão do fechamento da OP";
    Object.assign(frame.style, { position:"fixed", right:"0", bottom:"0", width:"1px", height:"1px", border:"0", opacity:"0" });
    document.body.appendChild(frame);
    const printWindow = frame.contentWindow;
    const printDocument = frame.contentDocument;
    if (!printWindow || !printDocument) { frame.remove(); return window.alert("O navegador bloqueou a preparação da impressão."); }
    printDocument.open();
    printDocument.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Fechamento da OP</title><style>
      @page{size:A4 landscape;margin:12mm}*{box-sizing:border-box;-webkit-print-color-adjust:economy;print-color-adjust:economy}html,body{margin:0;background:#fff;color:#182334;font-family:Arial,sans-serif}
      .print-title{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:9px;margin-bottom:10px;border-bottom:2px solid #f47b20}.print-title strong,.print-title span,.print-title small{display:block}.print-title strong{font-size:16px}.print-title span{margin-top:3px;color:#667085;font-size:9px;letter-spacing:.08em}.print-title>div:last-child{text-align:right}.print-title small{font-size:8px;color:#778191}.print-title>div:last-child strong{font-size:11px;margin-top:3px}
      .closure-report{border:1px solid #8e99a8;background:#fff;overflow:hidden}.closure-report>header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:#f5f6f8;border-bottom:1px solid #aeb7c3}.closure-report>header small,.closure-report>header strong{display:block}.closure-report>header small{font-size:7px;color:#667085;font-weight:700;letter-spacing:.08em}.closure-report>header strong{font-size:14px;margin-top:3px}.closure-ok,.closure-alert{padding:5px 8px;border:1px solid #8e99a8;border-radius:12px;font-size:8px;font-weight:700}.closure-ok{color:#11764e}.closure-alert{color:#b73535}
      .closure-order{display:grid;grid-template-columns:1fr 1.6fr .8fr;gap:8px;padding:10px 12px;border-bottom:1px solid #d7dce3}.closure-order small,.closure-order strong{display:block}.closure-order small,.closure-kpis small{font-size:7px;color:#667085}.closure-order strong{font-size:9px;margin-top:3px}.closure-kpis{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #d7dce3}.closure-kpis>div{padding:10px 12px;border-right:1px solid #d7dce3}.closure-kpis>div:last-child{border-right:0}.closure-kpis small,.closure-kpis strong{display:block}.closure-kpis strong{font-size:13px;color:#174ea6;margin-top:4px}
      .closure-flow{display:flex;align-items:stretch;padding:12px}.closure-step{display:flex;align-items:center;flex:1}.closure-step>b{margin:0 5px;color:#7d8796}.closure-step>span{display:block;min-width:0;flex:1;padding:9px;background:#fafbfc;border:1px solid #cbd2dc;border-radius:4px}.closure-step small,.closure-step strong,.closure-step em,.closure-step i{display:block}.closure-step small{font-size:7px;font-weight:700;color:#536174}.closure-step strong{font-size:11px;color:#174ea6;margin:5px 0}.closure-step em{font-size:7px;color:#b73535;font-style:normal}.closure-step i{font-size:7px;font-style:normal;font-weight:700;margin-top:6px;padding-top:5px;border-top:1px solid #dfe4eb}.closure-step i.good{color:#11764e}.closure-step i.bad{color:#b73535}
      .closure-report>footer{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px 12px;background:#fafafa;border-top:1px solid #aeb7c3}.closure-report>footer span:last-child{grid-column:1/-1}.closure-report>footer small,.closure-report>footer strong{display:block}.closure-report>footer small{font-size:7px;color:#667085}.closure-report>footer strong{font-size:8px;margin-top:3px}.print-footer{display:flex;justify-content:space-between;margin-top:10px;padding-top:7px;border-top:1px solid #d7dce3;color:#667085;font-size:7px}
    </style></head><body></body></html>`);
    printDocument.close();
    const opLabel = order.numeroOp || order.numeroPedido || order.id;
    const heading = printDocument.createElement("header");
    heading.className = "print-title";
    const identity = printDocument.createElement("div");
    identity.innerHTML = "<strong>FORPACK · GUAIÚBA</strong><span>RELATÓRIO DE FECHAMENTO DE ORDEM DE PRODUÇÃO</span>";
    const op = printDocument.createElement("div");
    const opSmall = printDocument.createElement("small"); opSmall.textContent = "OP";
    const opStrong = printDocument.createElement("strong"); opStrong.textContent = opLabel;
    op.append(opSmall, opStrong); heading.append(identity, op);
    const footer = printDocument.createElement("footer"); footer.className = "print-footer";
    const note = printDocument.createElement("span"); note.textContent = "Painel de Produção · Documento para conferência";
    const issued = printDocument.createElement("span"); issued.textContent = `Emitido em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}`;
    footer.append(note, issued);
    printDocument.body.append(heading, printDocument.importNode(source, true), footer);
    window.setTimeout(() => { printWindow.focus(); printWindow.print(); window.setTimeout(() => frame.remove(), 1000); }, 250);
  }
  return <section className="management-card">
    <div className="programming-title"><div><p className="eyebrow">GERENCIAMENTO DA OP</p><h3>{finished ? "Pedido finalizado" : "Ações disponíveis"}</h3></div><span>{finished ? "Histórico" : "Gravação real"}</span></div>
    {finished && <div className="completion-info"><span>✓</span><div><strong>Conclusão registrada por {snapshot.responsavel}</strong><small>{snapshot.data ? new Date(snapshot.data).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" }) : "Data não informada"}</small></div></div>}
    <article className="closure-report" data-closure-print>
      <header><div><small>RELATÓRIO DE FECHAMENTO</small><strong>OP {order.numeroOp || order.numeroPedido || order.id}</strong></div><span className={snapshot.divergencia > .05 ? "closure-alert" : "closure-ok"}>{snapshot.divergencia > .05 ? "⚠ Divergência" : "✓ Saldo conferido"}</span></header>
      <div className="closure-order"><div><small>Cliente</small><strong>{order.cliente}</strong></div><div><small>Produto</small><strong>{order.descricaoItem}</strong></div><div><small>Quantidade pedida</small><strong>{kg(number(order.quantidade))}</strong></div></div>
      <div className="closure-kpis"><div><small>Peso inicial</small><strong>{kg(snapshot.pesoInicial)}</strong></div><div><small>Produção final</small><strong>{kg(snapshot.pesoFinal)}</strong></div><div><small>Perda real</small><strong>{kg(snapshot.perdaReal)}</strong></div><div><small>Aproveitamento</small><strong>{snapshot.aproveitamento.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}%</strong></div></div>
      <div className="closure-flow">{balance.steps.map((step,index) => <div className="closure-step" key={step.sector}>{index > 0 && <b>→</b>}<span><small>{step.sector}</small><strong>{kg(step.produced)}</strong><em>Perdas: {kg(step.loss)}</em>{index > 0 && <i className={Math.abs(step.difference) > .05 ? "bad" : "good"}>{Math.abs(step.difference) > .05 ? `Diferença: ${kg(Math.abs(step.difference))}` : "Saldo fechado"}</i>}</span></div>)}</div>
      {finished && <footer><span><small>Responsável pelo fechamento</small><strong>{snapshot.responsavel}</strong></span><span><small>Data e hora</small><strong>{snapshot.data ? new Date(snapshot.data).toLocaleString("pt-BR",{timeZone:"America/Fortaleza"}) : "—"}</strong></span>{snapshot.observacao && <span><small>Observação</small><strong>{snapshot.observacao}</strong></span>}</footer>}
    </article>
    {!finished && !closing && <button className="secondary-action" disabled={saving} onClick={onEdit}>Editar dados do pedido / OP</button>}
    {finished
      ? <><button className="secondary-action" onClick={printClosure}>Imprimir fechamento / Salvar PDF</button><button className="reopen-action" disabled={saving} onClick={confirmReopen}>{saving ? "Salvando..." : "Reabrir OP"}</button></>
      : closing ? <div className="closure-form"><label className="field"><span>Responsável pelo fechamento *</span><input value={responsible} onChange={event => setResponsible(event.target.value)} /></label><label className="field"><span>Observação do fechamento</span><textarea rows={3} value={observation} onChange={event => setObservation(event.target.value)} placeholder="Opcional — registre justificativas ou ocorrências." /></label>{balance.divergence > .05 && <p className="closure-warning">Existe divergência de {kg(balance.divergence)}. O fechamento será permitido, mas ficará sinalizado no relatório.</p>}<div className="form-actions"><button className="cancel-action" disabled={saving} onClick={() => setClosing(false)}>Cancelar</button><button className="finish-action compact" disabled={saving || !responsible.trim()} onClick={() => { if (window.confirm("Confirmar o fechamento desta OP com o balanço apresentado?")) onFinish({responsavel:responsible,observacao:observation}); }}>{saving ? "Concluindo..." : "Confirmar fechamento"}</button></div></div>
      : <button className="finish-action" disabled={saving || !balance.steps.length} onClick={() => setClosing(true)}>{balance.steps.length ? "✓ Conferir e fechar OP" : "Sem produção para fechar"}</button>}
    <p className="save-warning">{finished ? "Ao reabrir, a OP retorna para Aguardando Programação. A reabertura fica registrada no histórico." : "O fechamento preserva todos os apontamentos e grava uma fotografia do balanço para rastreabilidade."}</p>
  </section>;
}

function EditOrderForm({order,clients,products,materials,saving,onSave,onCancel}:{order:Order;clients:string[];products:string[];materials:string[];saving:boolean;onSave:(order:Order)=>void;onCancel:()=>void}) {
  const [input, setInput] = useState<Order>({...order});
  const update = (field:keyof Order, value:string) => setInput(current => ({...current,[field]:value}));
  const valid = Boolean(input.data && input.cliente.trim() && input.descricaoItem.trim() && number(input.quantidade) > 0);
  return <form className="new-order-form edit-order-form" onSubmit={event => { event.preventDefault(); if (valid && !saving) onSave(input); }}>
    <div className="programming-title"><div><p className="eyebrow">EDIÇÃO</p><h3>Dados do pedido / OP</h3></div><span>Gravação real</span></div>
    <div className="form-grid">
      <label className="field"><span>Data do pedido *</span><input type="date" value={input.data || ""} onChange={event => update("data",event.target.value)} required /></label>
      <label className="field"><span>Nº do pedido</span><input value={input.numeroPedido || ""} onChange={event => update("numeroPedido",event.target.value)} /></label>
    </div>
    <label className="field"><span>Cliente *</span><input list="clientes-edicao" value={input.cliente} onChange={event => update("cliente",event.target.value)} required /><datalist id="clientes-edicao">{clients.map(client => <option key={client} value={client} />)}</datalist></label>
    <label className="field"><span>Produto / descrição *</span><input list="produtos-edicao" value={input.descricaoItem} onChange={event => update("descricaoItem",event.target.value)} required /><datalist id="produtos-edicao">{products.map(product => <option key={product} value={product} />)}</datalist></label>
    <label className="field"><span>Categoria do produto *</span><select value={input.categoriaProduto || inferredCategory(input)} onChange={event => update("categoriaProduto",event.target.value)}>{PRODUCT_CATEGORIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select><small className="field-help">Confirme a categoria sugerida automaticamente.</small></label>
    <div className="form-grid">
      <label className="field"><span>Quantidade (kg) *</span><input inputMode="decimal" value={input.quantidade} onChange={event => update("quantidade",event.target.value)} required /></label>
      <label className="field"><span>Número da OP</span><input value={input.numeroOp || ""} onChange={event => update("numeroOp",event.target.value)} /></label>
    </div>
    <div className="deadline-form-block">
      <p className="eyebrow">REGRA DE PRAZO</p>
      <label className="field"><span>Tipo do item *</span><select value={input.tipoPrazo || "IMPRESSO_REPETICAO"} onChange={event => update("tipoPrazo",event.target.value)}><option value="LISO">Liso — 20 dias após o pedido</option><option value="IMPRESSO_REPETICAO">Impresso repetição — 30 dias após o pedido</option><option value="IMPRESSO_NOVO">Impresso novo — 30 dias após a chegada do clichê</option></select></label>
      {input.tipoPrazo === "IMPRESSO_NOVO" && <label className="field"><span>Data de chegada do clichê</span><input type="date" value={input.dataChegadaCliche || ""} onChange={event => update("dataChegadaCliche",event.target.value)} /><small className="field-help">Enquanto esta data não for informada, o pedido ficará como “Aguardando clichê”.</small></label>}
    </div>
    <label className="field"><span>Material / estrutura</span><select value={input.material || ""} onChange={event => update("material",event.target.value)}><option value="">Selecione o material</option>{materials.map(material => <option key={material} value={material}>{material}</option>)}</select></label>
    <label className="field"><span>Observações</span><textarea value={input.observacao || ""} onChange={event => update("observacao",event.target.value)} rows={3} /></label>
    <div className="form-actions"><button type="button" className="cancel-action" onClick={onCancel} disabled={saving}>Cancelar</button><button type="submit" className="primary-action" disabled={!valid || saving}>{saving ? "Salvando..." : "Salvar alterações"}</button></div>
  </form>;
}

function NewOrderForm({clients,products,materials,saving,onSave,onCancel}:{clients:string[];products:string[];materials:string[];saving:boolean;onSave:(input:Omit<Order,"id">)=>void;onCancel:()=>void}) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });
  const [input, setInput] = useState<Omit<Order,"id">>({ data: today, numeroPedido: "", numeroOp: "", cliente: "", descricaoItem: "", quantidade: "", categoriaProduto:"NAO_CLASSIFICADO", material: "", observacao: "", statusProducao: "AGUARDANDO PROGRAMAÇÃO", tipoPrazo:"IMPRESSO_REPETICAO", dataChegadaCliche:"" });
  const update = (field:keyof Omit<Order,"id">, value:string) => setInput(current => ({...current,[field]:value}));
  const valid = Boolean(input.data && input.cliente.trim() && input.descricaoItem.trim() && number(input.quantidade) > 0);
  return <form className="new-order-form" onSubmit={event => { event.preventDefault(); if (valid && !saving) onSave(input); }}>
    <div className="form-grid">
      <label className="field"><span>Data do pedido *</span><input type="date" value={input.data} onChange={event => update("data",event.target.value)} required /></label>
      <label className="field"><span>Nº do pedido</span><input value={input.numeroPedido} onChange={event => update("numeroPedido",event.target.value)} placeholder="Ex.: 9479" /></label>
    </div>
    <label className="field"><span>Cliente *</span><input list="clientes-cadastrados" value={input.cliente} onChange={event => update("cliente",event.target.value)} placeholder="Digite para buscar um cliente" autoComplete="off" required />
      <datalist id="clientes-cadastrados">{clients.map(client => <option key={client} value={client} />)}</datalist>
      <small className="field-help">{clients.length} clientes cadastrados disponíveis</small>
    </label>
    <label className="field"><span>Produto / descrição do item *</span><input list="produtos-cadastrados" value={input.descricaoItem} onChange={event => update("descricaoItem",event.target.value)} placeholder="Digite para buscar um produto" autoComplete="off" required />
      <datalist id="produtos-cadastrados">{products.map(product => <option key={product} value={product} />)}</datalist>
      <small className="field-help">{products.length} produtos cadastrados disponíveis</small>
    </label>
    <label className="field"><span>Categoria do produto *</span><select value={input.categoriaProduto || "NAO_CLASSIFICADO"} onChange={event => update("categoriaProduto",event.target.value)}>{PRODUCT_CATEGORIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <div className="form-grid">
      <label className="field"><span>Quantidade do pedido (kg) *</span><input inputMode="decimal" value={input.quantidade} onChange={event => update("quantidade",event.target.value)} placeholder="Ex.: 1.500" required /></label>
      <label className="field"><span>Número da OP</span><input value={input.numeroOp} onChange={event => update("numeroOp",event.target.value)} placeholder="Opcional" /></label>
    </div>
    <div className="deadline-form-block">
      <p className="eyebrow">REGRA DE PRAZO</p>
      <label className="field"><span>Tipo do item *</span><select value={input.tipoPrazo || "IMPRESSO_REPETICAO"} onChange={event => update("tipoPrazo",event.target.value)}><option value="LISO">Liso — 20 dias após o pedido</option><option value="IMPRESSO_REPETICAO">Impresso repetição — 30 dias após o pedido</option><option value="IMPRESSO_NOVO">Impresso novo — 30 dias após a chegada do clichê</option></select></label>
      {input.tipoPrazo === "IMPRESSO_NOVO" && <label className="field"><span>Data de chegada do clichê</span><input type="date" value={input.dataChegadaCliche || ""} onChange={event => update("dataChegadaCliche",event.target.value)} /><small className="field-help">O prazo começará automaticamente quando esta data for informada.</small></label>}
    </div>
    <label className="field"><span>Material / estrutura</span><select value={input.material} onChange={event => update("material",event.target.value)}>
      <option value="">Selecione o material</option>
      {materials.map(material => <option key={material} value={material}>{material}</option>)}
    </select></label>
    <label className="field"><span>Observações</span><textarea value={input.observacao} onChange={event => update("observacao",event.target.value)} placeholder="Informações importantes para o PCP" rows={3} /></label>
    <div className="form-status"><span className="status aguardando">Aguardando</span><p>O novo pedido entrará automaticamente na lista de Programação PCP.</p></div>
    <div className="form-actions"><button type="button" className="cancel-action" onClick={onCancel} disabled={saving}>Cancelar</button><button type="submit" className="primary-action" disabled={!valid || saving}>{saving ? "Cadastrando..." : "Cadastrar pedido"}</button></div>
  </form>;
}
