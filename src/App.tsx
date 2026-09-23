import { useEffect, useMemo, useState } from "react";
import {
  StorageRow,
  Machine,
  Order,
  Production,
  Totals,
  RegistryKind,
  RegistryData,
  ProductCategory,
  PRODUCT_CATEGORIES,
  StatusEvent,
  PaleteRomaneio,
} from "./types/forpack";
import {
  json,
  number,
  kg,
  date,
  inferredCategory,
  categoryLabel,
  orderBalance,
  getOrderSectorTotal,
  group,
} from "./utils/formatters";
import {
  loadRows,
  saveOrder,
  createOrder,
  saveProduction,
  updateProduction,
  saveRegistry,
  savePalete,
  deletePalete,
} from "./services/supabaseApi";
import {
  LayoutDashboard,
  Clock,
  ArrowUpRight,
  Calendar,
  BarChart3,
  FileText,
  Zap,
  Disc,
  ClipboardList,
  Settings,
  Plus,
  RotateCw,
  Search,
  Menu as MenuIcon,
  Database,
  Coins,
} from "lucide-react";

import { DatabaseMigrationModal } from "./components/DatabaseMigrationModal";
import { TechnicalClosureModal } from "./components/TechnicalClosureModal";
import { CostAndSuppliesView } from "./components/CostAndSuppliesView";
import { PcpCategorySummary, PcpQueueTable } from "./components/PcpQueueTable";
import { RegistryPanel } from "./components/RegistryPanel";
import { DailyLaunches, Metric } from "./components/DailyLaunches";
import { DailySectorReport } from "./components/DailySectorReport";
import { MonthlyProductionReport } from "./components/MonthlyProductionReport";
import { DeadlineCenter } from "./components/DeadlineCenter";
import { MonthlyDashboard } from "./components/MonthlyDashboard";
import { ProductionReport } from "./components/ProductionReport";
import { OrderRow } from "./components/OrderRow";
import {
  EditProductionForm,
  ProgrammingForm,
  ProductionForm,
  OrderManagement,
  EditOrderForm,
  NewOrderForm,
} from "./components/Drawers";

const NAV_ITEMS = [
  { name: "Visão geral", icon: LayoutDashboard },
  { name: "Central de prazos", icon: Clock },
  { name: "Lançamentos", icon: ArrowUpRight },
  { name: "Relatório diário", icon: Calendar },
  { name: "Painel mensal", icon: BarChart3 },
  { name: "Pedidos / OP", icon: FileText },
  { name: "Programação PCP", icon: Zap },
  { name: "Produção", icon: Disc },
  { name: "Relatórios", icon: ClipboardList },
  { name: "Custos & Insumos", icon: Coins },
  { name: "Cadastros", icon: Settings },
];

export default function App() {
  const [active, setActive] = useState("Visão geral");
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
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [technicalClosureOrder, setTechnicalClosureOrder] = useState<Order | null>(null);
  const [pcpView, setPcpView] = useState<"Aguardando" | "Programadas">("Programadas");
  const [pcpMachine, setPcpMachine] = useState("Todas");
  const [pcpCategory, setPcpCategory] = useState<"Todas" | ProductCategory>("Todas");
  const [pcpSort, setPcpSort] = useState<"Data" | "Manual">("Data");
  const [selectedRecord, setSelectedRecord] = useState<Production | null>(null);
  const [reportMachine, setReportMachine] = useState("Todas");
  const [reportOperator, setReportOperator] = useState("Todos");
  const [reportStart, setReportStart] = useState("");
  const [reportEnd, setReportEnd] = useState("");
  const [dashboardMonth, setDashboardMonth] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" }).slice(0, 7)
  );
  const [registryKind, setRegistryKind] = useState<RegistryKind>("operadores");
  const [launchDate, setLaunchDate] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" })
  );
  const [launchMachine, setLaunchMachine] = useState("Todas");
  const [dailyReportDate, setDailyReportDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - 1);
    return today.toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });
  });
  const [monthlyStart, setMonthlyStart] = useState(() => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });
    return `${today.slice(0, 7)}-01`;
  });
  const [monthlyEnd, setMonthlyEnd] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" })
  );
  const [monthlyMachine, setMonthlyMachine] = useState("Todas");
  const [monthlyOperator, setMonthlyOperator] = useState("Todos");
  const [monthlyOrder, setMonthlyOrder] = useState("Todas");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const dataRows = await loadRows();
      setRows(dataRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados do Supabase.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const data = useMemo(() => {
    const orders = rows.filter(r => r.key.startsWith("pedido:")).map(r => json<Order>(r.value, {} as Order));
    const records = rows
      .filter(r => r.key.startsWith("record:"))
      .map(r => ({ ...json<Production>(r.value, {}), _key: r.key, _updatedAt: r.updated_at }));
    const paletes = rows
      .filter(r => r.key.startsWith("palete:"))
      .map(r => ({ ...json<PaleteRomaneio>(r.value, {} as PaleteRomaneio), _key: r.key, _updatedAt: r.updated_at }));
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
    const orderIdentifierMap = new Map<string, string>();
    orders.forEach(o => {
      if (o.id) orderIdentifierMap.set(String(o.id), o.id);
      if (o.numeroPedido) orderIdentifierMap.set(String(o.numeroPedido), o.id);
      if (o.numeroOp) orderIdentifierMap.set(String(o.numeroOp), o.id);
    });

    const totals = new Map<string, Totals>();
    records.forEach(record => {
      const rawId = String(record.idPedido || "");
      const canonicalId = orderIdentifierMap.get(rawId) || rawId;
      const sector = machineSector.get(String(record.maquinaId || "")) || "";
      if (!canonicalId || !sector) return;
      const current = totals.get(canonicalId) || {};
      current[sector] = (current[sector] || 0) + number(record.qtdProduzido);
      totals.set(canonicalId, current);
    });
    return { orders, records, totals, machines, operators, clients, products, materials, registries, paletes };
  }, [rows]);

  useEffect(() => {
    if (data.records.length > 0) {
      const datesWithRecords = [...new Set(data.records.map(r => r.dataProducao).filter(Boolean))].sort().reverse();
      if (datesWithRecords.length > 0) {
        const hasDailyData = data.records.some(r => r.dataProducao === dailyReportDate);
        if (!hasDailyData) {
          setDailyReportDate(datesWithRecords[0]);
        }
      }
    }
  }, [data.records]);

  const activeOrders = useMemo(
    () => data.orders.filter(o => group(o.statusProducao) !== "Finalizado").sort((a, b) => (a.data || "").localeCompare(b.data || "")),
    [data.orders]
  );
  const finishedOrders = useMemo(
    () =>
      data.orders
        .filter(o => group(o.statusProducao) === "Finalizado")
        .sort((a, b) => (b.dataConclusao || b.data || "").localeCompare(a.dataConclusao || a.data || "")),
    [data.orders]
  );

  const visible = useMemo(() => {
    const term = query.toLocaleLowerCase("pt-BR").trim();
    const base = active === "Pedidos / OP" && filter === "Finalizados" ? finishedOrders : activeOrders;
    return base.filter(order => {
      const g = group(order.statusProducao);
      return (
        (active !== "Programação PCP" ||
          (pcpView === "Aguardando"
            ? g === "Aguardando" && (pcpCategory === "Todas" || inferredCategory(order) === pcpCategory)
            : g !== "Aguardando" &&
              g !== "Finalizado" &&
              (pcpMachine === "Todas" || order.maquinaId === pcpMachine) &&
              (pcpCategory === "Todas" || inferredCategory(order) === pcpCategory))) &&
        (active !== "Produção" || (g === "Em produção" && order.maquinaId && (machineFilter === "Todas" || order.maquinaId === machineFilter))) &&
        (filter === "Todos ativos" || filter === "Finalizados" || g === filter) &&
        (!term ||
          `${order.id} ${order.numeroPedido || ""} ${order.numeroOp || ""} ${order.cliente} ${order.descricaoItem}`
            .toLocaleLowerCase("pt-BR")
            .includes(term))
      );
    });
  }, [activeOrders, finishedOrders, active, filter, query, machineFilter, pcpView, pcpMachine, pcpCategory]);

  const pcpQueue = useMemo(() => {
    return visible.slice().sort((a, b) => {
      const machine = String(a.maquinaId || "").localeCompare(String(b.maquinaId || ""));
      if (pcpMachine === "Todas" && machine) return machine;
      if (pcpSort === "Data") {
        const orderDate = (a.data || "9999-12-31").localeCompare(b.data || "9999-12-31");
        return (
          orderDate ||
          (a.ordemFila ?? Number.MAX_SAFE_INTEGER) - (b.ordemFila ?? Number.MAX_SAFE_INTEGER) ||
          String(a.numeroPedido || a.id).localeCompare(String(b.numeroPedido || b.id), "pt-BR", { numeric: true })
        );
      }
      const position = (a.ordemFila ?? Number.MAX_SAFE_INTEGER) - (b.ordemFila ?? Number.MAX_SAFE_INTEGER);
      return position || (b.prioridade || 0) - (a.prioridade || 0) || (a.data || "").localeCompare(b.data || "");
    });
  }, [visible, pcpMachine, pcpSort]);

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

  const metrics = useMemo(
    () => ({
      active: activeOrders.length,
      producing: activeOrders.filter(o => group(o.statusProducao) === "Em produção").length,
      programmed: activeOrders.filter(o => !["Aguardando", "Finalizado"].includes(group(o.statusProducao))).length,
      waiting: activeOrders.filter(o => group(o.statusProducao) === "Aguardando").length,
      pointed: activeOrders.filter(o => Object.values(data.totals.get(o.id) || {}).some(v => Number(v) > 0)).length,
    }),
    [activeOrders, data.totals]
  );

  const reportRecords = useMemo(() => {
    const term = query.toLocaleLowerCase("pt-BR").trim();
    return data.records
      .filter(record => {
        const order = data.orders.find(item => item.id === record.idPedido || item.numeroOp === record.idPedido);
        const searchable = `${record.idPedido || ""} ${order?.numeroOp || ""} ${record.cliente || order?.cliente || ""} ${
          record.descricaoItem || order?.descricaoItem || ""
        } ${record.operador || ""}`.toLocaleLowerCase("pt-BR");
        return (
          (reportMachine === "Todas" || record.maquinaId === reportMachine) &&
          (reportOperator === "Todos" || record.operador === reportOperator) &&
          (!reportStart || (record.dataProducao || "") >= reportStart) &&
          (!reportEnd || (record.dataProducao || "") <= reportEnd) &&
          (!term || searchable.includes(term))
        );
      })
      .sort((a, b) => `${b.dataProducao || ""}${b.id || ""}`.localeCompare(`${a.dataProducao || ""}${a.id || ""}`));
  }, [data.records, data.orders, query, reportMachine, reportOperator, reportStart, reportEnd]);

  const monthlyRecords = useMemo(
    () => data.records.filter(record => (record.dataProducao || "").slice(0, 7) === dashboardMonth),
    [data.records, dashboardMonth]
  );

  const launchRecords = useMemo(
    () =>
      data.records
        .filter(record => record.dataProducao === launchDate && (launchMachine === "Todas" || record.maquinaId === launchMachine))
        .sort((a, b) => `${b._updatedAt || ""}${b.id || ""}`.localeCompare(`${a._updatedAt || ""}${a.id || ""}`)),
    [data.records, launchDate, launchMachine]
  );

  const dailyReportRecords = useMemo(
    () => data.records.filter(record => record.dataProducao === dailyReportDate),
    [data.records, dailyReportDate]
  );

  const monthlyReportRecords = useMemo(
    () =>
      data.records
        .filter(
          record =>
            (!monthlyStart || (record.dataProducao || "") >= monthlyStart) &&
            (!monthlyEnd || (record.dataProducao || "") <= monthlyEnd) &&
            (monthlyMachine === "Todas" || record.maquinaId === monthlyMachine) &&
            (monthlyOperator === "Todos" || record.operador === monthlyOperator) &&
            (monthlyOrder === "Todas" || record.idPedido === monthlyOrder)
        )
        .sort((a, b) => `${b.dataProducao || ""}${b.id || ""}`.localeCompare(`${a.dataProducao || ""}${a.id || ""}`)),
    [data.records, monthlyStart, monthlyEnd, monthlyMachine, monthlyOperator, monthlyOrder]
  );

  function navigate(item: string) {
    if (
      ![
        "Visão geral",
        "Central de prazos",
        "Lançamentos",
        "Relatório diário",
        "Painel mensal",
        "Pedidos / OP",
        "Programação PCP",
        "Produção",
        "Relatórios",
        "Custos & Insumos",
        "Cadastros",
      ].includes(item)
    )
      return;
    setActive(item);
    setFilter("Todos ativos");
    setMachineFilter("Todas");
    setPcpMachine("Todas");
    setPcpCategory("Todas");
    setPcpView("Programadas");
    setSelected(null);
    setEditing(false);
    setMenu(false);
  }

  async function programOrder(order: Order, machineId: string, priority: boolean) {
    const machine = data.machines.find(m => m.id === machineId);
    if (!machine) {
      setNotice("Selecione uma máquina de destino válida.");
      return;
    }
    const source = rows.find(row => row.key === `pedido:${order.id}` || (order.numeroOp && row.key === `pedido:${order.numeroOp}`));
    const currentQueue = activeOrders.filter(item => item.maquinaId === machine.id && item.id !== order.id && group(item.statusProducao) !== "Finalizado");
    const lastPosition = currentQueue.reduce((max, item) => Math.max(max, item.ordemFila || 0), 0);
    const updated: Order = {
      ...order,
      maquinaId: machine.id,
      prioridade: priority ? 1 : 0,
      ordemFila: priority ? 1 : (order.maquinaId === machine.id && order.ordemFila ? order.ordemFila : lastPosition + 1),
      statusProducao: `FILA DA ${machine.setor.toUpperCase()}`,
    };
    setSaving(true);
    setNotice("");
    try {
      await saveOrder(updated, source?.updated_at);
      setSelected(null);
      setNotice(`OP ${order.numeroOp || order.numeroPedido || order.id} reprogramada com sucesso na máquina ${machine.name} (${machine.setor}).`);
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erro ao salvar a programação.");
    } finally {
      setSaving(false);
    }
  }

  async function returnOrderToWaiting(order: Order) {
    const source = rows.find(row => row.key === `pedido:${order.id}` || (order.numeroOp && row.key === `pedido:${order.numeroOp}`));
    const updated: Order = {
      ...order,
      maquinaId: "",
      prioridade: 0,
      ordemFila: undefined,
      statusProducao: "AGUARDANDO PROGRAMAÇÃO",
    };
    setSaving(true);
    setNotice("");
    try {
      await saveOrder(updated, source?.updated_at);
      setSelected(null);
      setNotice(`OP ${order.numeroOp || order.numeroPedido || order.id} retornou para Aguardando Programação.`);
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
    setSaving(true);
    setNotice("");
    try {
      await saveOrder({ ...order, ordemFila: positionB }, sourceA.updated_at);
      await saveOrder({ ...other, ordemFila: positionA }, sourceB.updated_at);
      setNotice("Sequência da fila atualizada.");
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível alterar a sequência.");
    } finally {
      setSaving(false);
    }
  }

  function printPcpQueue() {
    const machine = data.machines.find(item => item.id === pcpMachine);
    if (!machine) return setNotice("Selecione uma máquina para imprimir a fila.");
    const queue = pcpQueue.filter(item => item.maquinaId === machine.id);
    if (!queue.length) return setNotice("Não há pedidos na fila da máquina selecionada.");
    const machineSectorMap = new Map(data.machines.map(m => [m.id, m.setor.toUpperCase()]));
    const targetSector = machine.setor.toUpperCase();

    // ✅ OPÇÃO B: Na impressão, soma todos os apontamentos do pedido feitos no SETOR da máquina
    const produced = (order: Order) =>
      data.records
        .filter(record => {
          const recSector = machineSectorMap.get(String(record.maquinaId || ""));
          const mesmoPedido =
            record.idPedido === order.id ||
            record.idPedido === order.numeroOp ||
            record.idPedido === order.numeroPedido;
          return mesmoPedido && recSector === targetSector;
        })
        .reduce((sum, record) => sum + number(record.qtdProduzido), 0);

    const safe = (value: unknown) =>
      String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] || character));
    const categoryTotals = PRODUCT_CATEGORIES.map(category => {
      const categoryOrders = queue.filter(order => inferredCategory(order) === category.value);
      return { ...category, orders: categoryOrders.length, totalKg: categoryOrders.reduce((sum, order) => sum + number(order.quantidade), 0) };
    }).filter(category => category.orders > 0);
    const totalKg = categoryTotals.reduce((sum, category) => sum + category.totalKg, 0);
    const categoryCards = categoryTotals
      .map(
        category =>
          `<div class="category-card"><span>${safe(category.label)}</span><strong>${safe(
            category.totalKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
          )} kg</strong><small>${category.orders} pedido(s)</small></div>`
      )
      .join("");
    const body = queue
      .map(
        (order, index) =>
          `<tr><td>${index + 1}º</td><td>${safe(date(order.data))}</td><td>${safe(order.numeroOp || "SEM OP")}</td><td>${safe(order.cliente)}</td><td>${safe(
            order.descricaoItem
          )}</td><td>${safe(number(order.quantidade).toLocaleString("pt-BR", { maximumFractionDigits: 2 }))}</td><td>${safe(
            produced(order).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          )}</td><td>${safe(order.statusProducao)}</td></tr>`
      )
      .join("");

    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;width:0;height:0;border:0";
    document.body.appendChild(frame);
    const printWindow = frame.contentWindow;
    const printDocument = frame.contentDocument;
    if (!printWindow || !printDocument) {
      frame.remove();
      return setNotice("O navegador bloqueou a preparação da impressão.");
    }
    printDocument.open();
    printDocument.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Fila PCP - ${safe(
      machine.name
    )}</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:Arial,sans-serif;color:#111827;margin:0}header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #123b75;padding-bottom:8px;margin-bottom:8px}h1{font-size:19px;color:#123b75;margin:0 0 2px}.machine{font-size:12px;font-weight:700}.meta{text-align:right;font-size:9px;line-height:1.5}.category-summary{break-inside:avoid;margin-bottom:8px;padding:7px;border:1px solid #b8c3d1;border-radius:5px;background:#f7f9fc}.category-heading{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:6px}.category-heading span{font-size:8px;font-weight:800;text-transform:uppercase;color:#41536b}.category-heading strong{font-size:10px;color:#123b75}.category-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}.category-card{padding:5px 6px;border:1px solid #d4dce6;border-left:3px solid #3478f6;border-radius:4px;background:#fff}.category-card span,.category-card strong,.category-card small{display:block}.category-card span{font-size:6px;font-weight:800;text-transform:uppercase;color:#667085}.category-card strong{margin-top:2px;font-size:8px;color:#1f3552}.category-card small{margin-top:1px;font-size:6px;color:#7d8796}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.5px}thead{display:table-header-group}th{background:#123b75;color:#fff;text-transform:uppercase;font-size:6.5px}th,td{border:1px solid #596273;padding:4px;text-align:left;vertical-align:middle}th:nth-child(1){width:5%}th:nth-child(2){width:8%}th:nth-child(3){width:7%}th:nth-child(4){width:16%}th:nth-child(5){width:35%}th:nth-child(6){width:7%}th:nth-child(7){width:9%}th:nth-child(8){width:13%}th:nth-child(7){background:#16794f}td:nth-child(7){background:#e8f7ef;color:#116b47;font-weight:700}td:nth-child(1),td:nth-child(2),td:nth-child(3),td:nth-child(6),td:nth-child(7){text-align:center}tr{break-inside:avoid}footer{display:flex;justify-content:space-between;margin-top:8px;color:#667085;font-size:7px}</style></head><body><header><div><h1>PROGRAMAÇÃO DE PRODUÇÃO</h1><div class="machine">${safe(
      machine.name
    )} · ${safe(machine.setor)}</div></div><div class="meta">Emitido em ${new Date().toLocaleString("pt-BR", {
      timeZone: "America/Fortaleza",
    })}<br>${queue.length} pedido(s) na fila</div></header><section class="category-summary"><div class="category-heading"><span>Resumo por categoria</span><strong>Total geral: ${safe(
      totalKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
    )} kg · ${queue.length} pedido(s)</strong></div><div class="category-grid">${categoryCards}</div></section><table><thead><tr><th>Ordem</th><th>Data pedido</th><th>OP</th><th>Cliente</th><th>Descrição</th><th>Qtd.</th><th>Qtd. produzida</th><th>Status</th></tr></thead><tbody>${body}</tbody></table><footer><span>FORPACK · GUAIÚBA · PAINEL DE PRODUÇÃO</span><span>Sequência oficial da máquina no momento da emissão</span></footer></body></html>`);
    printDocument.close();
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      window.setTimeout(() => frame.remove(), 1000);
    }, 250);
  }

  function printWaitingQueue() {
    const queue = pcpQueue;
    if (!queue.length) return setNotice("Não há pedidos aguardando nos filtros selecionados.");
    const safe = (value: unknown) =>
      String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] || character));
    const categoryTotals = PRODUCT_CATEGORIES.map(category => {
      const orders = queue.filter(order => inferredCategory(order) === category.value);
      return { ...category, orders: orders.length, totalKg: orders.reduce((sum, order) => sum + number(order.quantidade), 0) };
    }).filter(category => category.orders);
    const totalKg = categoryTotals.reduce((sum, category) => sum + category.totalKg, 0);
    const cards = categoryTotals
      .map(
        category =>
          `<div><span>${safe(category.label)}</span><strong>${safe(
            category.totalKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
          )} kg</strong><small>${category.orders} pedido(s)</small></div>`
      )
      .join("");
    const body = queue
      .map(
        order =>
          `<tr><td>${safe(date(order.data))}</td><td>${safe(order.numeroPedido || order.id)}</td><td>${safe(order.numeroOp || "SEM OP")}</td><td>${safe(
            order.cliente
          )}</td><td>${safe(order.descricaoItem)}</td><td>${safe(categoryLabel(order))}</td><td>${safe(
            number(order.quantidade).toLocaleString("pt-BR", { maximumFractionDigits: 2 })
          )} kg</td><td>${safe(order.statusProducao || "Aguardando programação")}</td></tr>`
      )
      .join("");

    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;width:0;height:0;border:0";
    document.body.appendChild(frame);
    const printWindow = frame.contentWindow;
    const printDocument = frame.contentDocument;
    if (!printWindow || !printDocument) {
      frame.remove();
      return setNotice("O navegador bloqueou a preparação da impressão.");
    }
    printDocument.open();
    printDocument.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Fila aguardando PCP</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:Arial,sans-serif;color:#111827;margin:0}header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #123b75;padding-bottom:8px;margin-bottom:8px}h1{font-size:19px;color:#123b75;margin:0 0 2px}.meta{text-align:right;font-size:9px;line-height:1.5}.summary{padding:7px;border:1px solid #b8c3d1;border-radius:5px;background:#f7f9fc;margin-bottom:8px}.summary>p{display:flex;justify-content:space-between;margin:0 0 6px;font-size:8px;font-weight:800;text-transform:uppercase}.grid{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}.grid div{padding:5px 6px;border:1px solid #d4dce6;border-left:3px solid #3478f6;border-radius:4px;background:#fff}.grid span,.grid strong,.grid small{display:block}.grid span{font-size:6px;font-weight:800;text-transform:uppercase;color:#667085}.grid strong{font-size:8px;margin-top:2px}.grid small{font-size:6px;color:#7d8796;margin-top:1px}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.5px}thead{display:table-header-group}th{background:#123b75;color:#fff;text-transform:uppercase;font-size:6.5px}th,td{border:1px solid #596273;padding:4px;text-align:left}th:nth-child(1){width:8%}th:nth-child(2){width:12%}th:nth-child(3){width:8%}th:nth-child(4){width:17%}th:nth-child(5){width:28%}th:nth-child(6){width:10%}th:nth-child(7){width:8%}th:nth-child(8){width:9%}tr{break-inside:avoid}footer{display:flex;justify-content:space-between;margin-top:8px;color:#667085;font-size:7px}</style></head><body><header><div><h1>FILA AGUARDANDO PROGRAMAÇÃO</h1><small>Programação PCP · pedidos pendentes</small></div><div class="meta">Emitido em ${new Date().toLocaleString(
      "pt-BR",
      { timeZone: "America/Fortaleza" }
    )}<br>${queue.length} pedido(s) no filtro</div></header><section class="summary"><p><span>Resumo por categoria</span><strong>Total geral: ${safe(
      totalKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
    )} kg · ${queue.length} pedido(s)</strong></p><div class="grid">${cards}</div></section><table><thead><tr><th>Data pedido</th><th>Pedido</th><th>OP</th><th>Cliente</th><th>Descrição</th><th>Categoria</th><th>Qtd.</th><th>Status</th></tr></thead><tbody>${body}</tbody></table><footer><span>FORPACK · GUAIÚBA · PAINEL DE PRODUÇÃO</span><span>Fila conforme filtros no momento da emissão</span></footer></body></html>`);
    printDocument.close();
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      window.setTimeout(() => frame.remove(), 1000);
    }, 250);
  }

  async function registerProduction(order: Order, input: Production) {
    const machine = data.machines.find(item => item.id === (input.maquinaId || order.maquinaId));
    if (!machine) return;
    setSaving(true);
    setNotice("");
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
    setSaving(true);
    setNotice("");
    try {
      const created = await createOrder(input);
      setNewOrderOpen(false);
      setNotice(`Pedido ${created.numeroPedido || created.id} cadastrado com sucesso.`);
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erro ao cadastrar o pedido.");
    } finally {
      setSaving(false);
    }
  }

  async function updateOrder(order: Order) {
    const source = rows.find(row => row.key === `pedido:${order.id}`);
    if (!source) return;
    setSaving(true);
    setNotice("");
    try {
      await saveOrder(order, source.updated_at);
      setSelected(order);
      setEditing(false);
      setNotice(`Pedido ${order.numeroPedido || order.id} atualizado com sucesso.`);
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erro ao atualizar o pedido.");
    } finally {
      setSaving(false);
    }
  }

  async function changeOrderState(order: Order, action: "finish" | "reopen", closure?: { responsavel: string; observacao?: string }) {
    const source = rows.find(row => row.key === `pedido:${order.id}`);
    if (!source) return;
    const now = new Date().toISOString();
    const balance = orderBalance(order, data.records, data.machines);
    const responsible = closure?.responsavel.trim() || "Ernade Silva";
    const event: StatusEvent = {
      acao: action === "finish" ? "FECHAMENTO" : "REABERTURA",
      data: now,
      responsavel: responsible,
      observacao: closure?.observacao?.trim() || undefined,
    };
    const updated: Order =
      action === "finish"
        ? {
            ...order,
            statusProducao: "FINALIZADO",
            dataConclusao: now,
            fechamento: {
              responsavel: responsible,
              observacao: closure?.observacao?.trim() || undefined,
              data: now,
              pesoInicial: balance.initial,
              pesoFinal: balance.final,
              perdaReal: balance.realLoss,
              perdaDeclarada: balance.declaredLoss,
              divergencia: balance.divergence,
              aproveitamento: balance.yieldRate,
            },
            historicoStatus: [...(order.historicoStatus || []), event],
          }
        : {
            ...order,
            statusProducao: "AGUARDANDO PROGRAMAÇÃO",
            dataConclusao: "",
            maquinaId: "",
            prioridade: 0,
            historicoStatus: [...(order.historicoStatus || []), event],
          };
    setSaving(true);
    setNotice("");
    try {
      await saveOrder(updated, source.updated_at);
      setSelected(null);
      setEditing(false);
      setNotice(
        action === "finish"
          ? `OP ${order.numeroOp || order.numeroPedido || order.id} concluída e enviada ao histórico.`
          : `OP ${order.numeroOp || order.numeroPedido || order.id} reaberta e enviada para Programação PCP.`
      );
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erro ao alterar o status da OP.");
    } finally {
      setSaving(false);
    }
  }

  async function editProduction(record: Production) {
    setSaving(true);
    setNotice("");
    try {
      await updateProduction(record);
      setSelectedRecord(null);
      setNotice("Produção atualizada com sucesso.");
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erro ao atualizar o apontamento.");
    } finally {
      setSaving(false);
    }
  }

  async function updateRegistry(kind: RegistryKind, previousValue: string | null, nextValue: string) {
    const source = rows.find(row => row.key === `config:${kind}`);
    const current = source ? json<string[]>(source.value, []) : (data.registries[kind] || []);
    const clean = nextValue.trim();
    if (!clean) return;
    if (current.some(item => item.toLocaleLowerCase("pt-BR") === clean.toLocaleLowerCase("pt-BR") && item !== previousValue)) {
      setNotice("Este item já existe no cadastro.");
      return;
    }
    const updated = previousValue === null ? [...current, clean] : current.map(item => (item === previousValue ? clean : item));
    updated.sort((a, b) => a.localeCompare(b, "pt-BR"));
    setSaving(true);
    setNotice("");
    try {
      await saveRegistry(kind, updated, source?.updated_at);
      setNotice(previousValue === null ? "Cadastro adicionado com sucesso." : "Cadastro atualizado com sucesso.");
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erro ao atualizar o cadastro.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">FP</span>
          <div>
            <strong>FORPACK</strong>
            <small>GESTÃO INDUSTRIAL</small>
          </div>
        </div>
        <nav>
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                className={active === item.name ? "nav-item active" : "nav-item"}
                onClick={() => navigate(item.name)}
              >
                <span className="nav-icon">
                  <Icon size={16} strokeWidth={2} />
                </span>
                {item.name}
                {item.name === "Programação PCP" && <b className="nav-badge">{metrics.waiting}</b>}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <span className="online-dot" /> Dados reais conectados
          <small>{rows.length ? `${rows.length} registros sincronizados` : "Sincronizando..."}</small>
        </div>
      </aside>
      {menu && <button className="overlay" aria-label="Fechar menu" onClick={() => setMenu(false)} />}

      <section className="content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMenu(true)}>
            <MenuIcon size={20} />
          </button>
          <div className="breadcrumb">
            Operação <span>/</span> {active}
          </div>
          <div className="sync">
            <button className="secondary" onClick={refresh} disabled={loading}>
              <RotateCw size={13} className={loading ? "spin" : ""} style={{ marginRight: 6 }} />
              {loading ? "Sincronizando" : "Atualizar dados"}
            </button>
            <span className="avatar">ES</span>
            <div>
              <strong>Ernade Silva</strong>
              <small>Supervisor de produção</small>
            </div>
          </div>
        </header>

        <div className="workspace">
          {notice && (
            <div className={`notice ${/^(Pedido|Produção|OP|Sequência)/.test(notice) ? "success" : "failure"}`}>
              <span>{notice}</span>
              <button onClick={() => setNotice("")}>×</button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <p className="eyebrow">DADOS REAIS · SUPABASE</p>
              <h1>
                {active === "Visão geral"
                  ? "Painel mensal de produção"
                  : active === "Central de prazos"
                  ? "Central de prazos e atrasos"
                  : active === "Lançamentos"
                  ? "Lançamentos do dia"
                  : active === "Relatório diário"
                  ? "Relatório diário por setor"
                  : active === "Painel mensal"
                  ? "Relatório mensal de produção"
                  : active === "Programação PCP"
                  ? "Programação e reprogramação PCP"
                  : active === "Produção"
                  ? "Filas de produção"
                  : active === "Relatórios"
                  ? "Histórico de produção"
                  : active === "Custos & Insumos"
                  ? "Custos por setor & matérias-primas"
                  : active === "Cadastros"
                  ? "Cadastros operacionais"
                  : "Pedidos e ordens de produção"}
              </h1>
              <p>
                {active === "Visão geral"
                  ? "Indicadores consolidados para acompanhar volume, perdas e desempenho por setor."
                  : active === "Central de prazos"
                  ? "Priorize pedidos atrasados, próximos do vencimento e sem movimentação recente."
                  : active === "Lançamentos"
                  ? "Acompanhe os apontamentos do turno e acesse rapidamente a OP para registrar nova produção."
                  : active === "Relatório diário"
                  ? "Compare a produção de cada máquina nos turnos da manhã, tarde e noite."
                  : active === "Painel mensal"
                  ? "Consulte produção e perdas por período, setor, máquina, operador e OP."
                  : active === "Programação PCP"
                  ? "Programe pedidos pendentes ou transfira uma OP já programada para outra máquina ou setor."
                  : active === "Produção"
                  ? "Selecione uma OP programada para registrar um novo apontamento."
                  : active === "Relatórios"
                  ? "Consulte e corrija apontamentos reais com filtros operacionais."
                  : active === "Custos & Insumos"
                  ? "Gestão de matérias-primas, estoque de resinas/tintas, taxas de hora-máquina e fichas técnicas."
                  : active === "Cadastros"
                  ? "Mantenha as listas usadas nos formulários de pedidos e apontamentos."
                  : "Acompanhe o avanço real de cada pedido, do mais antigo ao mais novo."}
              </p>
            </div>
            {active === "Pedidos / OP" && (
              <button
                className="new-order-button"
                onClick={() => {
                  setNotice("");
                  setNewOrderOpen(true);
                }}
              >
                <Plus size={15} strokeWidth={2.5} /> Novo pedido
              </button>
            )}
          </div>

          {active === "Visão geral" ? (
            <MonthlyDashboard records={monthlyRecords} machines={data.machines} month={dashboardMonth} onMonth={setDashboardMonth} />
          ) : active === "Central de prazos" ? (
            <DeadlineCenter orders={activeOrders} records={data.records} machines={data.machines} onOpen={order => setSelected(order)} />
          ) : active === "Lançamentos" ? (
            <DailyLaunches
              records={launchRecords}
              allRecords={data.records}
              orders={data.orders}
              machines={data.machines}
              operators={data.operators}
              paletes={data.paletes || []}
              onSavePalete={async (palete) => {
                await savePalete(palete);
                await refresh();
              }}
              onDeletePalete={async (paleteId) => {
                await deletePalete(paleteId);
                await refresh();
              }}
              selectedDate={launchDate}
              selectedMachine={launchMachine}
              onDate={setLaunchDate}
              onMachine={setLaunchMachine}
              onOpen={order => setSelected(order)}
              onEditRecord={setSelectedRecord}
              onRefresh={refresh}
              onRegisterProduction={registerProduction}
            />
          ) : active === "Relatório diário" ? (
            <DailySectorReport
              records={dailyReportRecords}
              machines={data.machines}
              selectedDate={dailyReportDate}
              onDate={setDailyReportDate}
            />
          ) : active === "Painel mensal" ? (
            <MonthlyProductionReport
              records={monthlyReportRecords}
              allRecords={data.records}
              orders={data.orders}
              machines={data.machines}
              operators={data.operators}
              start={monthlyStart}
              end={monthlyEnd}
              machine={monthlyMachine}
              operator={monthlyOperator}
              orderId={monthlyOrder}
              onEdit={setSelectedRecord}
              onStart={setMonthlyStart}
              onEnd={setMonthlyEnd}
              onMachine={setMonthlyMachine}
              onOperator={setMonthlyOperator}
              onOrder={setMonthlyOrder}
            />
          ) : (
            !["Relatórios", "Cadastros", "Central de prazos", "Custos & Insumos"].includes(active) && (
              <section className="metrics">
                <Metric label="Pedidos ativos" value={metrics.active} detail="Exclui OPs finalizadas" tone="blue" />
                <Metric label="Em produção" value={metrics.producing} detail="Alguma etapa em andamento" tone="green" />
                <Metric label="Aguardando PCP" value={metrics.waiting} detail="Programar por ordem de data" tone="orange" />
                <Metric label="Com apontamento" value={metrics.pointed} detail="Produção registrada por setor" tone="red" />
              </section>
            )
          )}

          {active === "Custos & Insumos" ? (
            <CostAndSuppliesView />
          ) : active === "Cadastros" ? (
            <RegistryPanel
              kind={registryKind}
              onKind={setRegistryKind}
              values={data.registries[registryKind] || []}
              registries={data.registries}
              query={query}
              onQuery={setQuery}
              saving={saving}
              onSave={updateRegistry}
            />
          ) : (
            !["Visão geral", "Central de prazos", "Lançamentos", "Relatório diário", "Painel mensal", "Custos & Insumos"].includes(active) && (
              <section className="panel">
                <div className="panel-head">
                  {active === "Pedidos / OP" && (
                    <div className="tabs">
                      {["Todos ativos", "Aguardando", "Programado", "Em produção", "Finalizados"].map(item => (
                        <button
                          key={item}
                          className={filter === item ? "tab active" : "tab"}
                          onClick={() => {
                            setFilter(item);
                            setSelected(null);
                          }}
                        >
                          {item}
                          {item === "Finalizados" ? ` (${finishedOrders.length})` : ""}
                        </button>
                      ))}
                    </div>
                  )}

                  {active === "Programação PCP" && (
                    <>
                      <div className="tabs">
                        <button
                          className={pcpView === "Aguardando" ? "tab active" : "tab"}
                          onClick={() => {
                            setPcpView("Aguardando");
                            setPcpMachine("Todas");
                            setPcpCategory("Todas");
                            setSelected(null);
                          }}
                        >
                          Aguardando ({metrics.waiting})
                        </button>
                        <button
                          className={pcpView === "Programadas" ? "tab active" : "tab"}
                          onClick={() => {
                            setPcpView("Programadas");
                            setSelected(null);
                          }}
                        >
                          OPs programadas ({metrics.programmed})
                        </button>
                      </div>

                      {pcpView === "Aguardando" ? (
                        <div className="pcp-tools pcp-waiting-tools">
                          <label>
                            <span>Categoria</span>
                            <select value={pcpCategory} onChange={event => setPcpCategory(event.target.value as "Todas" | ProductCategory)}>
                              <option value="Todas">Todas as categorias</option>
                              {PRODUCT_CATEGORIES.map(item => (
                                <option key={item.value} value={item.value}>
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button className="pcp-print" onClick={printWaitingQueue} disabled={!pcpQueue.length}>
                            ▣ Imprimir fila
                          </button>
                          <b>{pcpQueue.length} pedido(s) no filtro</b>
                        </div>
                      ) : (
                        <div className="pcp-tools">
                          <label>
                            <span>Máquina</span>
                            <select
                              value={pcpMachine}
                              onChange={event => {
                                setPcpMachine(event.target.value);
                                setSelected(null);
                              }}
                            >
                              <option value="Todas">Todas as máquinas</option>
                              {data.machines.map(machine => (
                                <option key={machine.id} value={machine.id}>
                                  {machine.name} · {machine.setor}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>Categoria</span>
                            <select value={pcpCategory} onChange={event => setPcpCategory(event.target.value as "Todas" | ProductCategory)}>
                              <option value="Todas">Todas as categorias</option>
                              {PRODUCT_CATEGORIES.map(item => (
                                <option key={item.value} value={item.value}>
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>Ordenar fila</span>
                            <select value={pcpSort} onChange={event => setPcpSort(event.target.value as "Data" | "Manual")}>
                              <option value="Data">Pedido mais antigo primeiro</option>
                              <option value="Manual">Sequência manual</option>
                            </select>
                          </label>
                          <button className="pcp-print" onClick={printPcpQueue} disabled={pcpMachine === "Todas"}>
                            ▣ Imprimir fila
                          </button>
                          <b>{pcpQueue.length} pedido(s) no filtro</b>
                        </div>
                      )}
                    </>
                  )}

                  {active === "Produção" && (
                    <label className="machine-filter">
                      <span>Máquina</span>
                      <select value={machineFilter} onChange={event => setMachineFilter(event.target.value)}>
                        <option value="Todas">Todas as máquinas</option>
                        {data.machines.map(machine => (
                          <option key={machine.id} value={machine.id}>
                            {machine.name} · {machine.setor}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {active === "Relatórios" && (
                    <div className="report-filters">
                      <label>
                        <span>De</span>
                        <input type="date" value={reportStart} onChange={event => setReportStart(event.target.value)} />
                      </label>
                      <label>
                        <span>Até</span>
                        <input type="date" value={reportEnd} onChange={event => setReportEnd(event.target.value)} />
                      </label>
                      <label>
                        <span>Máquina</span>
                        <select value={reportMachine} onChange={event => setReportMachine(event.target.value)}>
                          <option value="Todas">Todas</option>
                          {data.machines.map(machine => (
                            <option key={machine.id} value={machine.id}>
                              {machine.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Operador</span>
                        <select value={reportOperator} onChange={event => setReportOperator(event.target.value)}>
                          <option value="Todos">Todos</option>
                          {data.operators.map(operator => (
                            <option key={operator}>{operator}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}

                  <label className="search">
                    <Search size={14} />
                    <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar pedido, OP, cliente ou produto" />
                  </label>
                </div>

                {error ? (
                  <div className="state error">
                    <strong>Falha na sincronização</strong>
                    <span>{error}</span>
                    <button className="secondary" onClick={refresh}>
                      Tentar novamente
                    </button>
                  </div>
                ) : loading ? (
                  <div className="state">
                    <span className="spinner" />
                    <strong>Carregando dados reais do Supabase...</strong>
                  </div>
                ) : active === "Relatórios" ? (
                  <ProductionReport records={reportRecords} orders={data.orders} machines={data.machines} onEdit={setSelectedRecord} />
                ) : active === "Programação PCP" && pcpView === "Programadas" ? (
                  <>
                    <PcpCategorySummary items={pcpCategorySummary} />
                    <PcpQueueTable
                      orders={pcpQueue}
                      machines={data.machines}
                      records={data.records}
                      selectedMachine={pcpMachine}
                      sortMode={pcpSort}
                      saving={saving}
                      onMove={movePcpOrder}
                      onOpen={setSelected}
                    />
                  </>
                ) : (
                  <>
                    {active === "Programação PCP" && pcpView === "Aguardando" && <PcpCategorySummary items={pcpCategorySummary} />}
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Pedido / OP</th>
                            <th>Cliente e produto</th>
                            <th>Qtd. pedido</th>
                            <th>Status atual</th>
                            <th>Produzido por setor</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map(order => (
                            <OrderRow key={order.id} order={order} totals={data.totals.get(order.id) || {}} onOpen={() => setSelected(order)} />
                          ))}
                        </tbody>
                      </table>
                      {!visible.length && <div className="empty">Nenhum pedido encontrado nesta visualização.</div>}
                    </div>
                  </>
                )}

                {!loading && !error && (
                  <footer className="panel-foot">
                    <span>
                      {active === "Relatórios"
                        ? `${reportRecords.length} apontamento(s) · ${kg(
                            reportRecords.reduce((sum, item) => sum + number(item.qtdProduzido), 0)
                          )} produzidos`
                        : `Mostrando ${visible.length} pedido(s) ${
                            filter === "Finalizados" ? "concluído(s), mais recentes primeiro" : "em ordem crescente de data"
                          }`}
                    </span>
                    <span>
                      {active === "Relatórios"
                        ? "Edição protegida contra alterações simultâneas"
                        : active === "Programação PCP"
                        ? pcpView === "Programadas"
                          ? "Selecione uma OP para reprogramar"
                          : "Programação habilitada com confirmação"
                        : active === "Produção"
                        ? "Apontamento real habilitado"
                        : filter === "Finalizados"
                        ? "Histórico com opção de reabrir"
                        : "Edição e conclusão de OP habilitadas"}
                    </span>
                  </footer>
                )}
              </section>
            )
          )}
        </div>
      </section>

      {selected && (
        <div className="modal-backdrop" onMouseDown={() => !saving && setSelected(null)}>
          <article className="drawer order-drawer" onMouseDown={e => e.stopPropagation()}>
            <button
              className="close"
              onClick={() => {
                setSelected(null);
                setEditing(false);
              }}
            >
              ×
            </button>
            <p className="eyebrow">PEDIDO {selected.numeroPedido || selected.id}</p>
            <h2>{selected.numeroOp ? `OP ${selected.numeroOp}` : "OP não emitida"}</h2>
            <div className="drawer-client">
              <strong>{selected.cliente}</strong>
              <span>{selected.descricaoItem}</span>
            </div>
            <div className="drawer-grid">
              <div>
                <small>Data do pedido</small>
                <strong>{date(selected.data)}</strong>
              </div>
              <div>
                <small>Quantidade</small>
                <strong>{kg(number(selected.quantidade))}</strong>
              </div>
              <div>
                <small>Status</small>
                <strong>{selected.statusProducao || "Sem status"}</strong>
              </div>
              <div>
                <small>Categoria</small>
                <strong>{categoryLabel(selected)}</strong>
              </div>
            </div>

            {active === "Programação PCP" && selected.maquinaId && (
              <div className="current-programming">
                <span>Programação atual</span>
                <strong>{data.machines.find(machine => machine.id === selected.maquinaId)?.name || selected.maquinaId}</strong>
                <small>{data.machines.find(machine => machine.id === selected.maquinaId)?.setor || "Setor não identificado"}</small>
              </div>
            )}

            <section className="drawer-sectors">
              <h3>Quantidade produzida por setor</h3>
              <div className="sector-list">
                {["EXTRUSÃO", "IMPRESSÃO", "LAMINAÇÃO", "REBOBINADEIRA", "CORTE"].map(sector => {
                  const value = getOrderSectorTotal(selected, sector, data.totals, data.records, data.machines);
                  return (
                    <div key={sector}>
                      <span>{sector}</span>
                      <strong className={value ? "has-value" : ""}>{value ? kg(value) : "—"}</strong>
                    </div>
                  );
                })}
              </div>
            </section>

            {editing ? (
              <EditOrderForm
                order={selected}
                clients={data.clients}
                products={data.products}
                materials={data.materials}
                saving={saving}
                onSave={updateOrder}
                onCancel={() => setEditing(false)}
              />
            ) : active === "Programação PCP" ? (
              <ProgrammingForm
                order={selected}
                machines={data.machines}
                saving={saving}
                onSave={programOrder}
                onReturnToWaiting={returnOrderToWaiting}
              />
            ) : active === "Produção" || active === "Lançamentos" ? (
              <ProductionForm
                order={selected}
                machine={data.machines.find(machine => machine.id === selected.maquinaId)}
                records={data.records.filter(record => record.idPedido === selected.id && record.maquinaId === selected.maquinaId)}
                operators={data.operators}
                saving={saving}
                onSave={registerProduction}
                onEditRecord={setSelectedRecord}
              />
            ) : (
              <OrderManagement
                order={selected}
                records={data.records}
                machines={data.machines}
                saving={saving}
                onEdit={() => setEditing(true)}
                onFinish={closure => changeOrderState(selected, "finish", closure)}
                onReopen={closure => changeOrderState(selected, "reopen", closure)}
                onOpenTechnicalClosure={order => setTechnicalClosureOrder(order)}
              />
            )}
          </article>
        </div>
      )}

      {newOrderOpen && (
        <div className="modal-backdrop" onMouseDown={() => !saving && setNewOrderOpen(false)}>
          <article className="drawer order-drawer" onMouseDown={e => e.stopPropagation()}>
            <button className="close" aria-label="Fechar cadastro" onClick={() => setNewOrderOpen(false)}>
              ×
            </button>
            <p className="eyebrow">CADASTRO</p>
            <h2>Novo pedido</h2>
            <p className="drawer-client">Cadastre o pedido agora. O número da OP pode ser informado depois, na etapa de emissão.</p>
            <NewOrderForm
              clients={data.clients}
              products={data.products}
              materials={data.materials}
              saving={saving}
              onSave={registerOrder}
              onCancel={() => setNewOrderOpen(false)}
            />
          </article>
        </div>
      )}

      {selectedRecord && (
        <div className="modal-backdrop" onMouseDown={() => !saving && setSelectedRecord(null)}>
          <article className="drawer" onMouseDown={event => event.stopPropagation()}>
            <button className="close" onClick={() => setSelectedRecord(null)}>
              ×
            </button>
            <p className="eyebrow">CORREÇÃO CONTROLADA</p>
            <h2>Editar apontamento</h2>
            <p className="drawer-client">A alteração atualizará os totais da OP. O registro não será excluído.</p>
            <EditProductionForm
              record={selectedRecord}
              operators={data.operators}
              machines={data.machines}
              saving={saving}
              onSave={editProduction}
              onCancel={() => setSelectedRecord(null)}
            />
          </article>
        </div>
      )}

      <DatabaseMigrationModal
        isOpen={migrationOpen}
        onClose={() => setMigrationOpen(false)}
      />

      {technicalClosureOrder && (
        <TechnicalClosureModal
          order={technicalClosureOrder}
          records={data.records}
          machines={data.machines}
          updatedAtSource={rows.find(row => row.key === `pedido:${technicalClosureOrder.id}`)?.updated_at}
          onClose={() => setTechnicalClosureOrder(null)}
          onCompleted={updatedOrder => {
            refresh();
            setSelected(updatedOrder);
            setTechnicalClosureOrder(updatedOrder);
          }}
          onShowNotification={(msg, type) => {
            if (type === "success") {
              setNotice(msg);
            } else {
              setError(msg);
            }
          }}
        />
      )}
    </main>
  );
}
