import React, { useState, useMemo } from "react";
import { Production, Order, Machine, BobinaSemiAcabada, Sector, PaleteRomaneio, ItemPaleteRomaneio } from "../types/forpack";
import { date, kg, number, group } from "../utils/formatters";
import {
  saveProduction,
  saveBobinaWIP,
  saveMovimentacaoEstoque,
  loadBobinasWIP,
} from "../services/supabaseApi";
import { PaleteRomaneioModal, printOfficialRomaneio } from "./PaleteRomaneioModal";
import { PaletesListView } from "./PaletesListView";
import {
  FileText,
  ArrowUpRight,
  Zap,
  Check,
  Pencil,
  Factory,
  Layers,
  Printer,
  Plus,
  Play,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  User,
  Scale,
  Search,
  X,
  Tag,
  Gauge,
  History,
  Sparkles,
  QrCode,
  Package,
  Calendar,
  ChevronRight,
  Flame,
  Maximize2,
} from "lucide-react";

// Palete semente correspondente exatamente à folha manuscrita de apontamento Forpack
const SEED_PALETES: PaleteRomaneio[] = [
  {
    id: "palete-seed-9684-01",
    numeroPalete: "PAL-9684-01",
    opId: "9684",
    numeroOp: "9684",
    numeroPedido: "9684",
    cliente: "RIO MARIA ALIM",
    descricaoItem: "683-FILME ENFARDADEIRA LISA 76X0,06",
    maquinaId: "REBOBINADEIRA 2",
    maquinaNome: "REBOBINADEIRA 2",
    setor: "REBOBINADEIRA",
    data: "2026-09-22",
    turno: "1º Turno (06h - 14h)",
    operador: "Ernade Silva",
    auxiliar: "Auxiliar Marcos",
    taraPadraoTubete: 1.6,
    totalVolumes: 25,
    pesoBrutoTotal: 1151.8,
    taraTotal: 40.0,
    pesoLiquidoTotal: 1111.8,
    status: "FECHADO",
    observacoes: "Palete fechado com 25 bobinas conferidas na balança. Romaneio pronto para fixação no palete.",
    fechado_em: "2026-09-22T22:44:17.000Z",
    created_at: "2026-09-22T14:00:00.000Z",
    updated_at: "2026-09-22T22:44:17.000Z",
    itens: [
      { posicao: 1, pesoBruto: 49.3, tara: 1.6, pesoLiquido: 47.7, codigoBobina: "BOB-01" },
      { posicao: 2, pesoBruto: 48.5, tara: 1.6, pesoLiquido: 46.9, codigoBobina: "BOB-02" },
      { posicao: 3, pesoBruto: 45.4, tara: 1.6, pesoLiquido: 43.8, codigoBobina: "BOB-03" },
      { posicao: 4, pesoBruto: 46.3, tara: 1.6, pesoLiquido: 44.7, codigoBobina: "BOB-04" },
      { posicao: 5, pesoBruto: 45.8, tara: 1.6, pesoLiquido: 44.2, codigoBobina: "BOB-05" },
      { posicao: 6, pesoBruto: 46.2, tara: 1.6, pesoLiquido: 44.6, codigoBobina: "BOB-06" },
      { posicao: 7, pesoBruto: 46.5, tara: 1.6, pesoLiquido: 44.9, codigoBobina: "BOB-07" },
      { posicao: 8, pesoBruto: 46.8, tara: 1.6, pesoLiquido: 45.2, codigoBobina: "BOB-08" },
      { posicao: 9, pesoBruto: 46.9, tara: 1.6, pesoLiquido: 45.3, codigoBobina: "BOB-09" },
      { posicao: 10, pesoBruto: 45.6, tara: 1.6, pesoLiquido: 44.0, codigoBobina: "BOB-10" },
      { posicao: 11, pesoBruto: 45.1, tara: 1.6, pesoLiquido: 43.5, codigoBobina: "BOB-11" },
      { posicao: 12, pesoBruto: 45.6, tara: 1.6, pesoLiquido: 44.0, codigoBobina: "BOB-12" },
      { posicao: 13, pesoBruto: 45.7, tara: 1.6, pesoLiquido: 44.1, codigoBobina: "BOB-13" },
      { posicao: 14, pesoBruto: 46.5, tara: 1.6, pesoLiquido: 45.0, codigoBobina: "BOB-14" },
      { posicao: 15, pesoBruto: 46.9, tara: 1.6, pesoLiquido: 45.3, codigoBobina: "BOB-15" },
      { posicao: 16, pesoBruto: 47.0, tara: 1.6, pesoLiquido: 45.4, codigoBobina: "BOB-16" },
      { posicao: 17, pesoBruto: 46.0, tara: 1.6, pesoLiquido: 44.4, codigoBobina: "BOB-17" },
      { posicao: 18, pesoBruto: 45.2, tara: 1.6, pesoLiquido: 43.6, codigoBobina: "BOB-18" },
      { posicao: 19, pesoBruto: 45.8, tara: 1.6, pesoLiquido: 44.2, codigoBobina: "BOB-19" },
      { posicao: 20, pesoBruto: 42.2, tara: 1.6, pesoLiquido: 40.6, codigoBobina: "BOB-20" },
      { posicao: 21, pesoBruto: 46.7, tara: 1.6, pesoLiquido: 45.1, codigoBobina: "BOB-21" },
      { posicao: 22, pesoBruto: 46.3, tara: 1.6, pesoLiquido: 44.7, codigoBobina: "BOB-22" },
      { posicao: 23, pesoBruto: 46.4, tara: 1.6, pesoLiquido: 44.8, codigoBobina: "BOB-23" },
      { posicao: 24, pesoBruto: 46.5, tara: 1.6, pesoLiquido: 44.9, codigoBobina: "BOB-24" },
      { posicao: 25, pesoBruto: 42.5, tara: 1.6, pesoLiquido: 40.9, codigoBobina: "BOB-25" },
    ],
  },
];

export function Metric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number | string;
  detail: string;
  tone: string;
}) {
  const Icon =
    tone === "blue"
      ? FileText
      : tone === "green"
      ? ArrowUpRight
      : tone === "orange"
      ? Zap
      : Check;
  return (
    <article className={`metric ${tone}`}>
      <span className="metric-icon">
        <Icon size={22} strokeWidth={2.2} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

export type SectorFilter = "TODOS" | "EXTRUSÃO" | "IMPRESSÃO" | "CORTE" | "LAMINAÇÃO" | "REBOBINADEIRA";

export function DailyLaunches({
  records,
  allRecords,
  orders,
  machines,
  operators = [],
  paletes = [],
  onSavePalete,
  onDeletePalete,
  selectedDate,
  selectedMachine,
  onDate,
  onMachine,
  onOpen,
  onEditRecord,
  onRefresh,
  onRegisterProduction,
}: {
  records: Production[];
  allRecords?: Production[];
  orders: Order[];
  machines: Machine[];
  operators?: string[];
  paletes?: PaleteRomaneio[];
  onSavePalete?: (palete: PaleteRomaneio) => Promise<void>;
  onDeletePalete?: (paleteId: string) => Promise<void>;
  selectedDate: string;
  selectedMachine: string;
  onDate: (value: string) => void;
  onMachine: (value: string) => void;
  onOpen: (order: Order) => void;
  onEditRecord?: (record: Production) => void;
  onRefresh?: () => Promise<void>;
  onRegisterProduction?: (order: Order, input: Production) => Promise<void>;
}) {
  // Modo de exibição: Terminal de Chão de Fábrica (Cards) vs Histórico Tabular vs Paletes & Romaneios
  const [viewMode, setViewMode] = useState<"terminal" | "historico" | "paletes">("terminal");

  // Filtro de Setor / Totem
  const [activeSector, setActiveSector] = useState<SectorFilter>("TODOS");

  // Paletes consolidados (utiliza banco Supabase ou semente visual)
  const allPaletes = useMemo(() => {
    return paletes && paletes.length > 0 ? paletes : SEED_PALETES;
  }, [paletes]);

  // Modal de Palete & Romaneio
  const [paleteModalOpen, setPaleteModalOpen] = useState(false);
  const [selectedPalete, setSelectedPalete] = useState<PaleteRomaneio | null>(null);
  const [paleteModalMachine, setPaleteModalMachine] = useState<Machine | null>(null);
  const [paleteModalOrder, setPaleteModalOrder] = useState<Order | null>(null);

  const handleOpenPaleteModal = (
    palete: PaleteRomaneio | null,
    machine?: Machine | null,
    order?: Order | null
  ) => {
    setSelectedPalete(palete);
    setPaleteModalMachine(
      machine || (palete ? machines.find(m => m.id === palete.maquinaId) || null : null)
    );
    setPaleteModalOrder(
      order || (palete ? orders.find(o => o.id === palete.opId || o.numeroOp === palete.numeroOp) || null : null)
    );
    setPaleteModalOpen(true);
  };

  const handleClosePaleteAndRegister = async (
    palete: PaleteRomaneio,
    order: Order,
    machine: Machine
  ) => {
    if (onSavePalete) {
      await onSavePalete(palete);
    }
    if (onRegisterProduction) {
      const prodInput: Production = {
        qtdProduzido: String(palete.pesoLiquidoTotal),
        dataProducao: palete.data,
        turno: palete.turno,
        operador: palete.operador,
        descricaoItem: `${order.descricaoItem} (Palete ${palete.numeroPalete}: ${palete.totalVolumes} bobinas)`,
      };
      await onRegisterProduction(order, prodInput);
    } else {
      await saveProduction(order, machine, {
        qtdProduzido: String(palete.pesoLiquidoTotal),
        dataProducao: palete.data,
        turno: palete.turno,
        operador: palete.operador,
      });
    }

    notify(`Palete ${palete.numeroPalete} fechado com sucesso! ${palete.pesoLiquidoTotal.toFixed(1)} kg lançados na produção.`);
    if (onRefresh) await onRefresh();
  };

  // Modal de Apontamento Rápido
  const [activeModal, setActiveModal] = useState<{
    machine: Machine;
    order: Order | null;
  } | null>(null);

  // Form State do Apontamento
  const [formData, setFormData] = useState({
    opId: "",
    dataProducao: new Date().toISOString().slice(0, 10),
    turno: "1º Turno (06h - 14h)",
    operador: "",
    qtdProduzido: "",
    aparas: "",
    picote: "",
    // Opção de Bobina WIP (Extrusão)
    gerarBobinaWip: false,
    numeroBobina: "",
    larguraMm: "",
    espessuraMicras: "",
    setorDestino: "IMPRESSÃO" as string,
  });

  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Busca geral no painel de lançamentos (máquina, OP, cliente)
  const [searchQuery, setSearchQuery] = useState("");

  // Filtro de pesquisa e escopo de OPs no modal de apontamento
  const [opSearchQuery, setOpSearchQuery] = useState("");
  const [showAllFactoryOps, setShowAllFactoryOps] = useState(false);

  // Modal de Etiqueta Industrial
  const [etiquetaModal, setEtiquetaModal] = useState<{
    bobina: Partial<BobinaSemiAcabada>;
    op: Order | null;
  } | null>(null);

  const notify = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(null), 4000);
  };

  // Base de registros a ser considerada
  const productionRecords = allRecords && allRecords.length ? allRecords : records;

  // Mapa de OPs ativas programadas por Máquina
  // Regra PCP: Pedidos ativos onde order.maquinaId === machine.id, ordenados por ordemFila
  const machineQueues = useMemo(() => {
    const map = new Map<string, Order[]>();
    machines.forEach(m => map.set(m.id, []));

    orders.forEach(order => {
      const isFinished = group(order.statusProducao) === "Finalizado";
      if (!isFinished && order.maquinaId && map.has(order.maquinaId)) {
        map.get(order.maquinaId)!.push(order);
      }
    });

    // Ordenar fila por ordemFila
    machines.forEach(m => {
      const queue = map.get(m.id) || [];
      queue.sort((a, b) => (a.ordemFila || 999) - (b.ordemFila || 999));
      map.set(m.id, queue);
    });

    return map;
  }, [machines, orders]);

  // Filtragem de Máquinas pelo Setor Ativo e Busca
  const filteredMachines = useMemo(() => {
    let list = machines;
    if (activeSector !== "TODOS") {
      list = list.filter(
        m => m.setor.toUpperCase().trim() === activeSector.toUpperCase().trim()
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(m => {
        const queue = machineQueues.get(m.id) || [];
        const activeOrder = queue[0];
        const matchMachine = m.name.toLowerCase().includes(q) || m.setor.toLowerCase().includes(q);
        const matchOrder = activeOrder && (
          (activeOrder.numeroOp || "").toLowerCase().includes(q) ||
          (activeOrder.numeroPedido || "").toLowerCase().includes(q) ||
          (activeOrder.cliente || "").toLowerCase().includes(q) ||
          (activeOrder.descricaoItem || "").toLowerCase().includes(q)
        );
        return matchMachine || matchOrder;
      });
    }
    return list;
  }, [machines, activeSector, searchQuery, machineQueues]);

  // Encontrar Order de um registro
  const orderOf = (record: Production) =>
    orders.find(
      order =>
        order.id === record.idPedido ||
        order.numeroOp === record.idPedido ||
        order.numeroPedido === record.idPedido
    );

  const machineOf = (record: Production) =>
    machines.find(machine => machine.id === record.maquinaId);

  // Filtragem de registros para o modo histórico
  const filteredTableRecords = useMemo(() => {
    let list = records;
    if (selectedMachine !== "Todas") {
      list = list.filter(r => r.maquinaId === selectedMachine);
    }
    if (activeSector !== "TODOS") {
      const sectorMachineIds = new Set(
        machines
          .filter(m => m.setor.toUpperCase().trim() === activeSector.toUpperCase().trim())
          .map(m => m.id)
      );
      list = list.filter(r => sectorMachineIds.has(r.maquinaId));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r => {
        const order = orderOf(r);
        const machine = machineOf(r);
        return (
          (r.operador || "").toLowerCase().includes(q) ||
          (r.idPedido || "").toLowerCase().includes(q) ||
          (machine?.name || "").toLowerCase().includes(q) ||
          (order?.cliente || "").toLowerCase().includes(q) ||
          (order?.numeroOp || "").toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [records, selectedMachine, activeSector, searchQuery, machines, orders]);

  // Totais do dia selecionado para os cards de topo
  const produced = records.reduce((sum, record) => sum + number(record.qtdProduzido), 0);
  const scraps = records.reduce((sum, record) => sum + number(record.aparas), 0);
  const cuttings = records.reduce((sum, record) => sum + number(record.picote), 0);
  const distinctOperators = new Set(records.map(record => record.operador).filter(Boolean)).size;

  // Abrir modal de apontamento para a máquina
  const handleOpenLaunchModal = (machine: Machine, order: Order | null) => {
    const isExtrusao = machine.setor.toUpperCase().includes("EXTRUS");
    const opNumber = order?.numeroOp || order?.numeroPedido || order?.id || "";

    // Gerar sugestão de número da bobina
    const existingBobinasCount = productionRecords.filter(
      r => r.idPedido === order?.id || (order?.numeroOp && r.idPedido === order?.numeroOp)
    ).length;
    const seq = String(existingBobinasCount + 1).padStart(2, "0");
    const suggestedBobina = opNumber ? `BOB-${opNumber}-${seq}` : `BOB-${Date.now().toString().slice(-4)}`;

    // Extrair largura e espessura do item se houver
    let parsedLargura = "";
    let parsedEspessura = "";
    if (order?.descricaoItem) {
      const matchLargura = order.descricaoItem.match(/(\d+)\s*mm/i) || order.descricaoItem.match(/(\d+)\s*cm/i);
      if (matchLargura) parsedLargura = matchLargura[1];
      const matchMicras = order.descricaoItem.match(/(\d+)\s*mic/i) || order.descricaoItem.match(/(\d+)\s*µm/i);
      if (matchMicras) parsedEspessura = matchMicras[1];
    }

    setFormData({
      opId: order?.id || "",
      dataProducao: new Date().toISOString().slice(0, 10),
      turno: "1º Turno (06h - 14h)",
      operador: operators[0] || "",
      qtdProduzido: "",
      aparas: "",
      picote: "",
      gerarBobinaWip: isExtrusao,
      numeroBobina: suggestedBobina,
      larguraMm: parsedLargura,
      espessuraMicras: parsedEspessura,
      setorDestino: isExtrusao ? "IMPRESSÃO" : "CORTE",
    });

    setOpSearchQuery("");
    setShowAllFactoryOps(false);
    setActiveModal({ machine, order });
  };

  // OPs programadas para a máquina aberta no modal
  const machineProgrammedOrders = useMemo(() => {
    if (!activeModal) return [];
    return machineQueues.get(activeModal.machine.id) || [];
  }, [activeModal, machineQueues]);

  // OPs disponíveis para seleção no modal (filtrando estritamente pelas programadas na máquina por padrão)
  const modalAvailableOrders = useMemo(() => {
    if (!activeModal) return [];
    const machineId = activeModal.machine.id;

    // Se o usuário alternou para ver todas as OPs da fábrica, pega todas as ativas.
    // Padrão solicitado: APENAS as OPs programadas para as respectivas máquinas!
    let baseList = showAllFactoryOps
      ? orders.filter(o => group(o.statusProducao) !== "Finalizado")
      : orders.filter(
          o =>
            group(o.statusProducao) !== "Finalizado" &&
            (o.maquinaId === machineId || (activeModal.order && o.id === activeModal.order.id))
        );

    baseList.sort((a, b) => (a.ordemFila || 999) - (b.ordemFila || 999));

    if (!opSearchQuery.trim()) return baseList;
    const q = opSearchQuery.toLowerCase().trim();
    return baseList.filter(o => {
      const op = (o.numeroOp || "").toLowerCase();
      const ped = (o.numeroPedido || "").toLowerCase();
      const id = (o.id || "").toLowerCase();
      const cli = (o.cliente || "").toLowerCase();
      const desc = (o.descricaoItem || "").toLowerCase();
      return (
        op.includes(q) ||
        ped.includes(q) ||
        id.includes(q) ||
        cli.includes(q) ||
        desc.includes(q)
      );
    });
  }, [activeModal, orders, showAllFactoryOps, opSearchQuery]);

  // Atualizar seleção de OP e recalcular metadados da bobina
  const handleSelectOp = (selectedOpId: string) => {
    const selected = orders.find(o => o.id === selectedOpId);
    const opNum = selected?.numeroOp || selected?.numeroPedido || selected?.id || "";

    const existingCount = productionRecords.filter(
      r => r.idPedido === selected?.id || (selected?.numeroOp && r.idPedido === selected?.numeroOp)
    ).length;
    const seq = String(existingCount + 1).padStart(2, "0");
    const suggestedBobina = opNum ? `BOB-${opNum}-${seq}` : `BOB-${Date.now().toString().slice(-4)}`;

    let parsedLargura = formData.larguraMm;
    let parsedEspessura = formData.espessuraMicras;
    if (selected?.descricaoItem) {
      const matchLargura = selected.descricaoItem.match(/(\d+)\s*mm/i) || selected.descricaoItem.match(/(\d+)\s*cm/i);
      if (matchLargura) parsedLargura = matchLargura[1];
      const matchMicras = selected.descricaoItem.match(/(\d+)\s*mic/i) || selected.descricaoItem.match(/(\d+)\s*µm/i);
      if (matchMicras) parsedEspessura = matchMicras[1];
    }

    setFormData(prev => ({
      ...prev,
      opId: selectedOpId,
      numeroBobina: suggestedBobina,
      larguraMm: parsedLargura,
      espessuraMicras: parsedEspessura,
    }));
  };

  // Salvar Apontamento
  const handleSaveProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModal) return;

    const { machine } = activeModal;
    const selectedOrder =
      orders.find(o => o.id === formData.opId) || activeModal.order;

    if (!selectedOrder) {
      notify("Selecione uma Ordem de Produção válida.");
      return;
    }

    const qtd = number(formData.qtdProduzido);
    if (qtd <= 0) {
      notify("Informe a quantidade produzida em kg.");
      return;
    }

    setSaving(true);
    try {
      const inputRecord: Production = {
        dataProducao: formData.dataProducao,
        turno: formData.turno,
        operador: formData.operador || "Operador",
        qtdProduzido: String(qtd),
        aparas: formData.aparas ? String(number(formData.aparas)) : "0",
        picote: formData.picote ? String(number(formData.picote)) : "0",
        maquinaId: machine.id,
      };

      // 1. Salvar o registro de produção
      if (onRegisterProduction) {
        await onRegisterProduction(selectedOrder, inputRecord);
      } else {
        await saveProduction(selectedOrder, machine, inputRecord);
      }

      let createdBobina: BobinaSemiAcabada | null = null;

      // 2. Se for Extrusão e optou por gerar Bobina WIP
      if (formData.gerarBobinaWip) {
        const numeroBobina =
          formData.numeroBobina.trim() ||
          `BOB-${selectedOrder.numeroOp || selectedOrder.id}-${Date.now().toString().slice(-4)}`;

        const bobinaData: Partial<BobinaSemiAcabada> = {
          op_id: selectedOrder.numeroOp || selectedOrder.id,
          numero_bobina: numeroBobina,
          setor_origem: machine.setor,
          setor_destino: formData.setorDestino || "IMPRESSÃO",
          peso_liquido_kg: qtd,
          largura_mm: formData.larguraMm ? Number(formData.larguraMm) : null,
          espessura_micras: formData.espessuraMicras ? Number(formData.espessuraMicras) : null,
          status: "DISPONIVEL",
          data_fabricacao: formData.dataProducao,
          operador: formData.operador,
        };

        try {
          createdBobina = await saveBobinaWIP(bobinaData);

          // Registrar no Livro de Movimentações
          await saveMovimentacaoEstoque({
            tipo_movimento: "TRANSFERENCIA_WIP",
            tipo_item: "SEMIACABADO",
            op_id: selectedOrder.numeroOp || selectedOrder.id,
            setor: machine.setor,
            quantidade: qtd,
            observacao: `Bobina WIP ${numeroBobina} gerada na ${machine.name} com destino a ${formData.setorDestino}`,
          });
        } catch (wipErr) {
          console.warn("Bobina WIP registrada localmente:", wipErr);
          createdBobina = {
            id: `local-${Date.now()}`,
            ...bobinaData,
          } as BobinaSemiAcabada;
        }
      }

      notify(
        `Apontamento de ${qtd} kg registrado com sucesso na máquina ${machine.name}!`
      );

      setActiveModal(null);
      if (onRefresh) await onRefresh();

      // Se gerou bobina, abrir a etiqueta industrial imediatamente para impressão
      if (createdBobina) {
        setEtiquetaModal({
          bobina: createdBobina,
          op: selectedOrder,
        });
      }
    } catch (err: any) {
      notify(err.message || "Erro ao salvar apontamento.");
    } finally {
      setSaving(false);
    }
  };

  // Função para imprimir etiqueta
  const handlePrintLabel = () => {
    if (!etiquetaModal) return;
    const { bobina, op } = etiquetaModal;

    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;width:0;height:0;border:0";
    document.body.appendChild(frame);
    const printWindow = frame.contentWindow;
    const printDoc = frame.contentDocument;
    if (!printWindow || !printDoc) {
      frame.remove();
      window.print();
      return;
    }

    printDoc.open();
    printDoc.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Etiqueta Bobina ${bobina.numero_bobina}</title>
  <style>
    @page { size: 100mm 150mm; margin: 5mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
    body { margin: 0; padding: 0; color: #000; background: #fff; }
    .label-box { border: 2.5px solid #000; border-radius: 6px; padding: 8px; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: space-between; }
    .header { border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: flex-end; }
    .company { font-size: 14px; font-weight: 900; letter-spacing: 1px; }
    .subhead { font-size: 9px; font-weight: 700; color: #333; }
    .barcode-box { text-align: center; border: 1.5px solid #000; border-radius: 4px; padding: 8px 4px; margin-bottom: 8px; background: #fafafa; }
    .bobina-code { font-size: 24px; font-weight: 900; font-family: monospace; letter-spacing: 2px; }
    .barcode-sub { font-size: 9px; font-family: monospace; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; margin-bottom: 6px; background: #f0f0f0; border: 1px solid #ccc; padding: 6px; border-radius: 4px; text-align: center; }
    .field-label { font-size: 8px; font-weight: 800; text-transform: uppercase; color: #555; display: block; margin-bottom: 2px; }
    .field-value { font-size: 13px; font-weight: 800; }
    .field-value-lg { font-size: 20px; font-weight: 900; }
    .client-box { border-top: 1px solid #ddd; padding-top: 5px; margin-bottom: 6px; }
    .footer { border-top: 2px solid #000; padding-top: 5px; font-size: 8.5px; display: flex; justify-content: space-between; font-weight: 700; }
  </style>
</head>
<body>
  <div class="label-box">
    <div>
      <div class="header">
        <div>
          <div class="company">FORPACK EMBALAGENS</div>
          <div class="subhead">RASTREABILIDADE DE BOBINA (WIP)</div>
        </div>
        <div style="text-align: right; font-size: 9px; font-weight: bold;">
          SETOR: ${bobina.setor_origem || "EXTRUSÃO"}
        </div>
      </div>

      <div class="barcode-box">
        <div class="bobina-code">${bobina.numero_bobina}</div>
        <div class="barcode-sub">*${bobina.numero_bobina}*</div>
      </div>

      <div class="grid-2">
        <div>
          <span class="field-label">Ordem de Produção</span>
          <span class="field-value-lg">OP #${bobina.op_id || op?.numeroOp || op?.id}</span>
        </div>
        <div>
          <span class="field-label">Próximo Setor (Destino)</span>
          <span class="field-value" style="display:inline-block; border: 1px solid #000; padding: 2px 6px; border-radius: 3px;">
            ${bobina.setor_destino || "IMPRESSÃO"}
          </span>
        </div>
      </div>

      <div class="client-box">
        <span class="field-label">Cliente</span>
        <div class="field-value" style="font-size: 12px;">${op?.cliente || "FORPACK CLIENTE"}</div>
        <span class="field-label" style="margin-top: 4px;">Produto / Especificação</span>
        <div style="font-size: 11px; font-weight: 600;">${op?.descricaoItem || "Filme Plástico"}</div>
      </div>

      <div class="grid-3">
        <div>
          <span class="field-label">Peso Líquido</span>
          <div class="field-value-lg">${bobina.peso_liquido_kg} <span style="font-size: 11px;">kg</span></div>
        </div>
        <div>
          <span class="field-label">Largura</span>
          <div class="field-value">${bobina.largura_mm ? `${bobina.largura_mm} mm` : "—"}</div>
        </div>
        <div>
          <span class="field-label">Espessura</span>
          <div class="field-value">${bobina.espessura_micras ? `${bobina.espessura_micras} µm` : "—"}</div>
        </div>
      </div>
    </div>

    <div class="footer">
      <span>Operador: ${bobina.operador || "—"}</span>
      <span>Fabricação: ${bobina.data_fabricacao ? new Date(bobina.data_fabricacao).toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR")}</span>
    </div>
  </div>
</body>
</html>`);
    printDoc.close();

    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      window.setTimeout(() => frame.remove(), 1000);
    }, 250);
  };

  return (
    <div className="space-y-6">
      {/* TOAST DE NOTIFICAÇÃO */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-700 text-white px-5 py-3.5 rounded-xl shadow-xl flex items-center gap-3 animate-in slide-in-from-top-3 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* METRICAS GERAIS DE HOJE (Padrão 4 cards igual Pedidos / OP) */}
      <section className="metrics">
        <Metric
          label="Apontamentos hoje"
          value={records.length}
          detail="Registros no turno"
          tone="blue"
        />
        <Metric
          label="Produção do dia"
          value={`${Math.round(produced).toLocaleString("pt-BR")} kg`}
          detail="Total líquido apontado"
          tone="green"
        />
        <Metric
          label="Perdas apontadas"
          value={`${Math.round(scraps + cuttings).toLocaleString("pt-BR")} kg`}
          detail={`Aparas ${kg(scraps)} · picote ${kg(cuttings)}`}
          tone="orange"
        />
        <Metric
          label="Operadores ativos"
          value={distinctOperators}
          detail="Operando no turno de hoje"
          tone="red"
        />
      </section>

      {/* PAINEL UNIFICADO (Padrão Panel igual Pedidos / OP) */}
      <section className="panel">
        <div className="panel-head">
          <div className="flex items-center gap-3 flex-wrap">
            {/* TABS DE SETOR */}
            <div className="tabs">
              {(
                [
                  "TODOS",
                  "EXTRUSÃO",
                  "IMPRESSÃO",
                  "CORTE",
                  "LAMINAÇÃO",
                  "REBOBINADEIRA",
                ] as SectorFilter[]
              ).map(sec => (
                <button
                  key={sec}
                  type="button"
                  className={activeSector === sec ? "tab active" : "tab"}
                  onClick={() => setActiveSector(sec)}
                >
                  {sec === "TODOS" ? "Todos os setores" : sec}
                </button>
              ))}
            </div>

            {/* SELETOR DE MODO: CARDS VS TABELA VS PALETES */}
            <div className="tabs">
              <button
                type="button"
                className={viewMode === "terminal" ? "tab active" : "tab"}
                onClick={() => setViewMode("terminal")}
              >
                <Gauge size={13} style={{ marginRight: 6, verticalAlign: "middle" }} />
                Cards de Máquinas
              </button>
              <button
                type="button"
                className={viewMode === "historico" ? "tab active" : "tab"}
                onClick={() => setViewMode("historico")}
              >
                <History size={13} style={{ marginRight: 6, verticalAlign: "middle" }} />
                Tabela ({filteredTableRecords.length})
              </button>
              <button
                type="button"
                className={viewMode === "paletes" ? "tab active" : "tab"}
                onClick={() => setViewMode("paletes")}
              >
                <Layers size={13} style={{ marginRight: 6, verticalAlign: "middle" }} />
                Paletes & Romaneios ({allPaletes.length})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* BUSCA */}
            <div className="search">
              <Search size={14} />
              <input
                type="text"
                placeholder="Buscar máquina, OP, cliente ou operador..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-slate-400 hover:text-slate-600 text-xs px-1"
                >
                  ×
                </button>
              )}
            </div>

            {/* DATA DE REFERÊNCIA */}
            <input
              type="date"
              value={selectedDate}
              onChange={event => onDate(event.target.value)}
              className="h-8.5 px-2.5 text-xs bg-white border border-slate-300 rounded-md text-slate-700 font-medium outline-none focus:border-blue-500"
              title="Data de apontamento"
            />

            {/* BOTÃO ATUALIZAR / SINCRONIZAR */}
            <button
              type="button"
              onClick={async () => {
                if (onRefresh) await onRefresh();
                notify("Dados sincronizados com o chão de fábrica.");
              }}
              className="sync-btn h-8.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="Atualizar dados agora"
            >
              <RefreshCw size={12} />
              <span className="hidden sm:inline">Sincronizar</span>
            </button>
          </div>
        </div>

        {/* MODO 1: CARDS DE MÁQUINAS (Terminal Operacional) */}
        {viewMode === "terminal" && (
          <div>
            {/* Barra de contexto e contador */}
            <div className="px-5 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span>
                  Exibindo <strong>{filteredMachines.length}</strong> {filteredMachines.length === 1 ? "máquina" : "máquinas"} {activeSector !== "TODOS" ? `no setor ${activeSector}` : "em todos os setores"}
                </span>
                {searchQuery && (
                  <span className="text-slate-400">
                    · filtrado por "{searchQuery}"
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Toque em <strong>+ Apontar Produção</strong> para lançar a produção na máquina
              </span>
            </div>

            {/* GRID DE CARDS DE MÁQUINAS */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 p-5 sm:p-6 bg-slate-50/40">
              {filteredMachines.map(machine => {
                const queue = machineQueues.get(machine.id) || [];
                const activeOrder = queue[0] || null;
                const hasOrder = !!activeOrder;
                const isExtrusao = machine.setor.toUpperCase().includes("EXTRUS");
                const isRebobinadeira = machine.setor.toUpperCase().includes("REBOBIN");

                // Paletes vinculados a esta máquina
                const machinePaletes = allPaletes.filter(
                  p => p.maquinaId === machine.id || p.maquinaNome === machine.name
                );
                const openPalete = machinePaletes.find(p => p.status === "ABERTO");
                const lastClosedPalete = machinePaletes.find(p => p.status === "FECHADO");

                // Apontamentos feitos nesta máquina hoje
                const machineTodayRecords = productionRecords.filter(
                  r => r.maquinaId === machine.id && r.dataProducao === selectedDate
                );
                const machineTodayKg = machineTodayRecords.reduce(
                  (sum, r) => sum + number(r.qtdProduzido),
                  0
                );
                const lastRecord = machineTodayRecords[machineTodayRecords.length - 1] || null;

                // Progresso da OP ativa se houver
                const targetKg = activeOrder ? number(activeOrder.quantidade) : 0;
                const orderProducedOnMachine = activeOrder
                  ? productionRecords
                      .filter(
                        r =>
                          (r.idPedido === activeOrder.id ||
                            r.idPedido === activeOrder.numeroOp ||
                            r.idPedido === activeOrder.numeroPedido) &&
                          r.maquinaId === machine.id
                      )
                      .reduce((sum, r) => sum + number(r.qtdProduzido), 0)
                  : 0;

                const progressPct =
                  targetKg > 0
                    ? Math.min(100, Math.round((orderProducedOnMachine / targetKg) * 100))
                    : 0;

                return (
                  <div
                    key={machine.id}
                    className={`bg-white border rounded-xl p-5 shadow-2xs transition-all flex flex-col justify-between ${
                      hasOrder
                        ? "border-slate-200/90 hover:border-blue-300 hover:shadow-xs"
                        : "border-slate-200/70 bg-slate-50/30"
                    }`}
                  >
                    <div>
                      {/* TOPO DO CARD: MÁQUINA, SETOR E STATUS */}
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            {machine.setor}
                          </span>
                          <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                            {machine.name}
                          </h3>
                        </div>

                        {hasOrder ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            EM OPERAÇÃO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            DISPONÍVEL
                          </span>
                        )}
                      </div>

                      {/* CONTEÚDO CENTRAL: DETALHES DA OP ATIVA */}
                      {hasOrder ? (
                        <div className="py-3.5 space-y-2.5">
                          {/* OP E FILA */}
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => onOpen(activeOrder)}
                              className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer bg-transparent border-0 p-0 text-left"
                              title="Abrir detalhes deste pedido"
                            >
                              OP #{activeOrder.numeroOp || activeOrder.numeroPedido || activeOrder.id}
                            </button>
                            {queue.length > 1 && (
                              <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                                +{queue.length - 1} na fila
                              </span>
                            )}
                          </div>

                          {/* CLIENTE E PRODUTO (Estilo Pedidos / OP) */}
                          <div>
                            <strong className="text-xs font-bold text-slate-900 block truncate" title={activeOrder.cliente}>
                              {activeOrder.cliente}
                            </strong>
                            <span className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed" title={activeOrder.descricaoItem}>
                              {activeOrder.descricaoItem}
                            </span>
                          </div>

                          {/* BARRA DE PROGRESSO */}
                          <div className="pt-2 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-500 font-medium">Progresso na máquina:</span>
                              <span className="text-slate-800 font-semibold">
                                {orderProducedOnMachine.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} / {targetKg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg{" "}
                                <span className="text-slate-500 font-normal">({progressPct}%)</span>
                              </span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                              <div
                                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>

                          {/* RESUMO DO DIA NESTA MÁQUINA */}
                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100/80">
                            <span>
                              Hoje: <strong className="text-slate-700 font-semibold">{machineTodayKg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg</strong>
                            </span>
                            {lastRecord && (
                              <span className="text-emerald-700 font-medium">
                                Último: {lastRecord.qtdProduzido} kg
                              </span>
                            )}
                          </div>

                          {/* PALETE EM MONTAGEM NA MÁQUINA */}
                          {openPalete && (
                            <div className="mt-2.5 p-2 bg-amber-50/90 border border-amber-200 rounded-lg flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-md bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
                                  <Scale className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <strong className="text-slate-900 font-mono font-bold">{openPalete.numeroPalete}</strong>
                                    <span className="text-[9px] font-bold bg-amber-200 text-amber-900 px-1 py-0.2 rounded-full">EM MONTAGEM</span>
                                  </div>
                                  <span className="text-[11px] text-amber-800">
                                    <strong>{openPalete.totalVolumes} bobinas</strong> · {openPalete.pesoLiquidoTotal.toFixed(1)} kg líq.
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleOpenPaleteModal(openPalete, machine, activeOrder)}
                                className="h-6.5 px-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold rounded text-[11px] transition shadow-2xs cursor-pointer flex items-center gap-1"
                              >
                                <span>Pesar</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-8 text-center flex-1 flex flex-col items-center justify-center space-y-1">
                          <Package className="w-7 h-7 text-slate-300 stroke-[1.5] mb-1" />
                          <p className="text-xs font-semibold text-slate-600">
                            Nenhuma OP em linha no momento
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Aguardando agendamento PCP ou apontamento avulso
                          </p>
                        </div>
                      )}
                    </div>

                    {/* BOTÕES DE AÇÃO DO CARD */}
                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenLaunchModal(machine, activeOrder)}
                        className="flex-1 h-8.5 px-3 bg-[#1d68f2] hover:bg-[#1557d0] text-white rounded-md text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                      >
                        <Plus size={14} strokeWidth={2.5} />
                        <span>Apontar Produção</span>
                      </button>

                      {isRebobinadeira ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenPaleteModal(openPalete || null, machine, activeOrder)}
                            className="h-8.5 px-2.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-xs font-semibold transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                            title="Montar palete de produto acabado com romaneio impresso"
                          >
                            <Layers size={13} className="text-blue-600" />
                            <span className="hidden sm:inline">{openPalete ? "Continuar Palete" : "Montar Palete"}</span>
                            <span className="sm:hidden">Palete</span>
                          </button>

                          {lastClosedPalete && (
                            <button
                              type="button"
                              onClick={() => printOfficialRomaneio(lastClosedPalete)}
                              className="h-8.5 px-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-md text-xs font-medium transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95"
                              title={`Reimprimir romaneio do palete ${lastClosedPalete.numeroPalete}`}
                            >
                              <Printer size={13} />
                            </button>
                          )}

                          {activeOrder && (
                            <button
                              type="button"
                              onClick={() => onOpen(activeOrder)}
                              className="h-8.5 px-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md text-xs font-semibold transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95"
                              title="Ver ficha completa da OP"
                            >
                              <span>Ficha OP</span>
                            </button>
                          )}
                        </div>
                      ) : isExtrusao ? (
                        <button
                          type="button"
                          onClick={() => handleOpenLaunchModal(machine, activeOrder)}
                          className="h-8.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                          title="Pesar bobina e emitir etiqueta industrial"
                        >
                          <Printer size={13} className="text-slate-500" />
                          <span className="hidden sm:inline">Etiqueta</span>
                        </button>
                      ) : activeOrder ? (
                        <button
                          type="button"
                          onClick={() => onOpen(activeOrder)}
                          className="h-8.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                          title="Ver ficha completa da OP"
                        >
                          <span>Ficha OP</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenLaunchModal(machine, null)}
                          className="h-8.5 px-3 bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 rounded-md text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                        >
                          <span>Outra OP</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {!filteredMachines.length && (
              <div className="p-12 text-center text-slate-500 text-xs">
                Nenhuma máquina encontrada para os filtros selecionados.
              </div>
            )}
          </div>
        )}

        {/* MODO 2: HISTÓRICO TABULAR DE APONTAMENTOS */}
        {viewMode === "historico" && (
          <div>
            {/* BARRA DE FILTRO INTERNA DO HISTÓRICO */}
            <div className="px-5 py-2.5 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <strong className="text-slate-800 font-bold block">
                  {date(selectedDate)}
                </strong>
                <small className="text-slate-500">
                  {filteredTableRecords.length} apontamentos registrados nesta data
                </small>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-slate-600">
                  <span className="font-semibold">Filtrar máquina:</span>
                  <select
                    value={selectedMachine}
                    onChange={event => onMachine(event.target.value)}
                    className="h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-md font-medium text-slate-700 outline-none"
                  >
                    <option value="Todas">Todas as máquinas</option>
                    {machines.map(machine => (
                      <option key={machine.id} value={machine.id}>
                        {machine.name} · {machine.setor}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* TABELA DE APONTAMENTOS */}
            <div className="table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Data / turno</th>
                    <th>Pedido / OP</th>
                    <th>Máquina / setor</th>
                    <th>Operador</th>
                    <th>Produzido</th>
                    <th>Perdas</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredTableRecords.map(record => {
                    const order = orderOf(record);
                    const machine = machineOf(record);
                    return (
                      <tr key={record._key || record.id}>
                        <td>
                          <strong>{date(record.dataProducao)}</strong>
                          <small className="cell-sub">
                            {record.turno || "Turno não informado"}
                          </small>
                        </td>
                        <td>
                          <strong>
                            {order?.numeroOp
                              ? `OP ${order.numeroOp}`
                              : order?.numeroPedido
                              ? `Pedido ${order.numeroPedido}`
                              : record.idPedido}
                          </strong>
                          <small className="cell-sub">
                            {record.cliente || order?.cliente || "—"}
                          </small>
                        </td>
                        <td>
                          <strong>{machine?.name || record.maquinaId || "—"}</strong>
                          <small className="cell-sub">
                            {machine?.setor || "Setor não identificado"}
                          </small>
                        </td>
                        <td>
                          <strong>{record.operador || "—"}</strong>
                        </td>
                        <td>
                          <strong className="positive">
                            {kg(number(record.qtdProduzido))}
                          </strong>
                        </td>
                        <td>
                          <span>Aparas: {kg(number(record.aparas))}</span>
                          <small className="cell-sub">
                            Picote: {kg(number(record.picote))}
                          </small>
                        </td>
                        <td>
                          <div className="table-actions-cluster">
                            {onEditRecord && (
                              <button
                                type="button"
                                className="secondary edit-record-action"
                                onClick={() => onEditRecord(record)}
                                title="Editar apontamento"
                              >
                                <Pencil size={13} strokeWidth={2.4} />
                                <span>Editar</span>
                              </button>
                            )}
                            {order && group(order.statusProducao) === "Em produção" && (
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => onOpen(order)}
                              >
                                Ficha OP
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!filteredTableRecords.length && (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Nenhum apontamento encontrado para a data e filtros selecionados.
                </div>
              )}
            </div>

            <footer className="panel-foot border-t border-slate-100 p-3 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span>
                {kg(produced)} produzidos · {kg(scraps + cuttings)} de perdas informadas
              </span>
              <span>Total de {filteredTableRecords.length} apontamentos listados</span>
            </footer>
          </div>
        )}

        {/* MODO 3: GESTÃO DE PALETES & ROMANEIOS (REBOBINADEIRA / PRODUTO ACABADO) */}
        {viewMode === "paletes" && (
          <div className="p-5 sm:p-6 bg-slate-50/40">
            <PaletesListView
              paletes={allPaletes}
              machines={machines}
              onOpenPaleteModal={(palete, mach) => handleOpenPaleteModal(palete, mach || null)}
              onDeletePalete={onDeletePalete}
              selectedSector={activeSector}
            />
          </div>
        )}
      </section>

      {/* MODAL / DRAWER: APONTAMENTO RÁPIDO DE CHÃO DE FÁBRICA (PADRÃO NOVO PEDIDO / FORPACK) */}
      {activeModal && (
        <div className="modal-backdrop" onMouseDown={() => !saving && setActiveModal(null)}>
          <article className="drawer order-drawer" onMouseDown={e => e.stopPropagation()}>
            <button className="close" aria-label="Fechar apontamento" onClick={() => setActiveModal(null)}>
              ×
            </button>
            <p className="eyebrow">{activeModal.machine.setor} • {activeModal.machine.name}</p>
            <h2>Registrar apontamento</h2>
            <div className="drawer-client">
              <strong>MÁQUINA {activeModal.machine.name}</strong>
              <span>Cadastre a produção desta máquina no chão de fábrica em tempo real.</span>
            </div>

            {/* Formulário de Apontamento */}
            <form onSubmit={handleSaveProduction} className="new-order-form">
              {/* Seleção de OP com filtro e busca */}
              <label className="field">
                <div className="flex items-center justify-between">
                  <span>Ordem de Produção (OP / Pedido) *</span>
                  <button
                    type="button"
                    onClick={() => setShowAllFactoryOps(!showAllFactoryOps)}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 underline bg-transparent border-0 p-0 cursor-pointer"
                  >
                    {showAllFactoryOps ? "Ver só desta máquina" : "Buscar em todas as OPs"}
                  </button>
                </div>
                <input
                  type="text"
                  value={opSearchQuery}
                  onChange={e => setOpSearchQuery(e.target.value)}
                  placeholder="Pesquisar por nº OP, pedido, cliente ou produto..."
                  autoComplete="off"
                />
                <select
                  value={formData.opId}
                  onChange={e => handleSelectOp(e.target.value)}
                  required
                >
                  <option value="">
                    {modalAvailableOrders.length === 0
                      ? "Nenhuma OP encontrada no filtro..."
                      : "Selecione a OP desejada..."}
                  </option>
                  {modalAvailableOrders.map((o, idx) => (
                    <option key={o.id} value={o.id}>
                      {o.ordemFila ? `[${o.ordemFila}º na fila] ` : `[${idx + 1}º] `}
                      OP #{o.numeroOp || o.numeroPedido || o.id} — {o.cliente} ({o.descricaoItem}) — {number(o.quantidade)} kg
                    </option>
                  ))}
                </select>
                <small className="field-help">
                  {showAllFactoryOps
                    ? `${modalAvailableOrders.length} OPs ativas na fábrica disponíveis`
                    : `${modalAvailableOrders.length} OPs programadas para ${activeModal.machine.name}`}
                </small>
              </label>

              {/* Atalhos rápidos de toque das OPs programadas */}
              {modalAvailableOrders.length > 0 && (
                <div className="mb-3">
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                    Toque rápido na OP da fila:
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                    {modalAvailableOrders.map((o, idx) => {
                      const isSelected = formData.opId === o.id;
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => handleSelectOp(o.id)}
                          className={`px-2.5 py-1.5 rounded-md text-xs transition cursor-pointer border flex items-center gap-1.5 text-left ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600 font-bold shadow-xs"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                          }`}
                        >
                          <span className="opacity-75 text-[10px]">
                            {o.ordemFila ? `${o.ordemFila}º` : `${idx + 1}º`}
                          </span>
                          <span>OP #{o.numeroOp || o.numeroPedido || o.id}</span>
                          <span className="truncate max-w-[120px] font-normal opacity-85">
                            · {o.cliente}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 ml-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Data da Produção e Turno */}
              <div className="form-grid">
                <label className="field">
                  <span>Data da produção *</span>
                  <input
                    type="date"
                    value={formData.dataProducao}
                    onChange={e => setFormData({ ...formData, dataProducao: e.target.value })}
                    required
                  />
                </label>
                <label className="field">
                  <span>Turno *</span>
                  <select
                    value={formData.turno}
                    onChange={e => setFormData({ ...formData, turno: e.target.value })}
                    required
                  >
                    <option value="1º Turno (06h - 14h)">1º Turno (06h - 14h)</option>
                    <option value="2º Turno (14h - 22h)">2º Turno (14h - 22h)</option>
                    <option value="3º Turno (22h - 06h)">3º Turno (22h - 06h)</option>
                    <option value="Comercial / Administrativo">Comercial / Administrativo</option>
                  </select>
                </label>
              </div>

              {/* Operador com datalist */}
              <label className="field">
                <span>Operador responsável *</span>
                <input
                  list="operadores-cadastrados-apontamento"
                  value={formData.operador}
                  onChange={e => setFormData({ ...formData, operador: e.target.value })}
                  placeholder="Digite para buscar ou selecione o operador"
                  autoComplete="off"
                  required
                />
                <datalist id="operadores-cadastrados-apontamento">
                  {operators.map(op => (
                    <option key={op} value={op} />
                  ))}
                </datalist>
                <small className="field-help">
                  {operators.length} operadores cadastrados disponíveis
                </small>
              </label>

              {/* Quantidade produzida */}
              <label className="field">
                <span>Peso líquido produzido (kg) *</span>
                <input
                  inputMode="decimal"
                  value={formData.qtdProduzido}
                  onChange={e => setFormData({ ...formData, qtdProduzido: e.target.value })}
                  placeholder="Ex.: 350.5"
                  autoFocus
                  required
                />
              </label>

              {/* Seção: Perdas e refugos */}
              <div className="deadline-form-block">
                <p className="eyebrow">PERDAS & REFUGOS</p>
                <div className="form-grid">
                  <label className="field">
                    <span>Aparas (kg)</span>
                    <input
                      inputMode="decimal"
                      value={formData.aparas}
                      onChange={e => setFormData({ ...formData, aparas: e.target.value })}
                      placeholder="0.0"
                    />
                  </label>
                  <label className="field">
                    <span>Picote / Borda (kg)</span>
                    <input
                      inputMode="decimal"
                      value={formData.picote}
                      onChange={e => setFormData({ ...formData, picote: e.target.value })}
                      placeholder="0.0"
                    />
                  </label>
                </div>
              </div>

              {/* Seção: WIP & Etiqueta */}
              <div className="deadline-form-block">
                <p className="eyebrow">CONTROLE DE BOBINA (WIP) & ETIQUETA</p>
                <label className="flex items-center gap-2 cursor-pointer mt-1 mb-2">
                  <input
                    type="checkbox"
                    checked={formData.gerarBobinaWip}
                    onChange={e => setFormData({ ...formData, gerarBobinaWip: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300"
                  />
                  <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-blue-600" />
                    Gerar Bobina Intermediária (WIP) & Emitir Etiqueta
                  </span>
                </label>

                {formData.gerarBobinaWip && (
                  <div className="space-y-3 pt-1">
                    <label className="field">
                      <span>Código da Bobina (Identificador Único) *</span>
                      <input
                        value={formData.numeroBobina}
                        onChange={e => setFormData({ ...formData, numeroBobina: e.target.value })}
                        placeholder="Ex.: BOB-..."
                        required={formData.gerarBobinaWip}
                      />
                    </label>

                    <div className="grid grid-cols-3 gap-2.5">
                      <label className="field">
                        <span>Largura (mm)</span>
                        <input
                          type="number"
                          value={formData.larguraMm}
                          onChange={e => setFormData({ ...formData, larguraMm: e.target.value })}
                          placeholder="500"
                        />
                      </label>
                      <label className="field">
                        <span>Espessura (µm)</span>
                        <input
                          type="number"
                          value={formData.espessuraMicras}
                          onChange={e => setFormData({ ...formData, espessuraMicras: e.target.value })}
                          placeholder="60"
                        />
                      </label>
                      <label className="field">
                        <span>Próximo setor</span>
                        <select
                          value={formData.setorDestino}
                          onChange={e => setFormData({ ...formData, setorDestino: e.target.value })}
                        >
                          <option value="IMPRESSÃO">IMPRESSÃO</option>
                          <option value="LAMINAÇÃO">LAMINAÇÃO</option>
                          <option value="REBOBINADEIRA">REBOBINADEIRA</option>
                          <option value="CORTE">CORTE</option>
                          <option value="PÁTIO">PÁTIO INTERM.</option>
                        </select>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Botões do Rodapé padronizados */}
              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-action"
                  onClick={() => setActiveModal(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="primary-action flex items-center gap-2"
                >
                  {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {formData.gerarBobinaWip ? "Salvar & Emitir Etiqueta" : "Confirmar Apontamento"}
                  </span>
                </button>
              </div>
            </form>
          </article>
        </div>
      )}

      {/* MODAL / DRAWER: VISUALIZAÇÃO & IMPRESSÃO DA ETIQUETA INDUSTRIAL */}
      {etiquetaModal && (
        <div className="modal-backdrop" onMouseDown={() => setEtiquetaModal(null)}>
          <article className="drawer order-drawer" onMouseDown={e => e.stopPropagation()}>
            <button className="close" aria-label="Fechar etiqueta" onClick={() => setEtiquetaModal(null)}>
              ×
            </button>
            <p className="eyebrow">ETIQUETA INDUSTRIAL</p>
            <h2>Controle de Bobina (WIP)</h2>
            <div className="drawer-client">
              <strong>BOBINA {etiquetaModal.bobina.numero_bobina}</strong>
              <span>Pré-visualização pronta para conferência e impressão térmica ou folha A4.</span>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg my-2">
              {/* CARTÃO INDUSTRIAL VISUAL */}
              <div className="bg-white border-2 border-slate-800 p-5 rounded-lg shadow-xs space-y-3.5">
                <div className="flex items-center justify-between border-b-2 border-slate-800 pb-2.5">
                  <div>
                    <span className="text-[10px] font-black tracking-widest text-slate-900 uppercase block">
                      FORPACK EMBALAGENS
                    </span>
                    <h4 className="text-xs font-black text-blue-900 mt-0.5">
                      CONTROLE DE BOBINA (WIP)
                    </h4>
                  </div>
                  <span className="bg-slate-900 text-white px-2.5 py-1 rounded text-[10px] font-bold font-mono">
                    {etiquetaModal.bobina.setor_origem || "EXTRUSÃO"}
                  </span>
                </div>

                <div className="text-center py-3 bg-slate-50 border border-slate-300 rounded-lg">
                  <div className="text-2xl font-black font-mono tracking-wider text-slate-900">
                    {etiquetaModal.bobina.numero_bobina}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    *{etiquetaModal.bobina.numero_bobina}*
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-bold">
                      Ordem de Produção
                    </span>
                    <strong className="text-sm font-black text-slate-900">
                      OP #{etiquetaModal.bobina.op_id}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-bold">
                      Próximo Setor
                    </span>
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-200 inline-block mt-0.5">
                      {etiquetaModal.bobina.setor_destino || "IMPRESSÃO"}
                    </span>
                  </div>
                  <div className="col-span-2 pt-1">
                    <span className="text-slate-500 block text-[9px] uppercase font-bold">
                      Cliente
                    </span>
                    <strong className="text-xs text-slate-800 truncate block mt-0.5">
                      {etiquetaModal.op?.cliente || "Cliente Forpack"}
                    </strong>
                  </div>
                  <div className="col-span-2 pt-1">
                    <span className="text-slate-500 block text-[9px] uppercase font-bold">
                      Especificação
                    </span>
                    <span className="text-[11px] text-slate-600 block line-clamp-1 mt-0.5">
                      {etiquetaModal.op?.descricaoItem || "Filme Tubular"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase font-bold">
                      Peso Líquido
                    </span>
                    <strong className="text-base font-black text-slate-900">
                      {etiquetaModal.bobina.peso_liquido_kg} kg
                    </strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase font-bold">
                      Largura
                    </span>
                    <strong className="text-xs font-bold text-slate-800 block mt-0.5">
                      {etiquetaModal.bobina.largura_mm ? `${etiquetaModal.bobina.largura_mm} mm` : "—"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase font-bold">
                      Espessura
                    </span>
                    <strong className="text-xs font-bold text-slate-800 block mt-0.5">
                      {etiquetaModal.bobina.espessura_micras ? `${etiquetaModal.bobina.espessura_micras} µm` : "—"}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5">
                  <span>Op: <strong>{etiquetaModal.bobina.operador || "—"}</strong></span>
                  <span>Data: <strong>{new Date().toLocaleDateString("pt-BR")}</strong></span>
                </div>
              </div>
            </div>

            <div className="form-actions mt-auto">
              <button
                type="button"
                className="cancel-action"
                onClick={() => setEtiquetaModal(null)}
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handlePrintLabel}
                className="primary-action flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Etiqueta</span>
              </button>
            </div>
          </article>
        </div>
      )}

      {/* MODAL / DRAWER DE PALETE & ROMANEIO DE PRODUTO ACABADO */}
      {paleteModalOpen && (
        <PaleteRomaneioModal
          isOpen={paleteModalOpen}
          onClose={() => {
            setPaleteModalOpen(false);
            setSelectedPalete(null);
            setPaleteModalMachine(null);
            setPaleteModalOrder(null);
          }}
          machine={paleteModalMachine}
          activeOrder={paleteModalOrder}
          orders={orders}
          operators={operators}
          initialPalete={selectedPalete}
          onSavePalete={async (palete) => {
            if (onSavePalete) {
              await onSavePalete(palete);
            }
            notify(`Palete ${palete.numeroPalete} salvo com sucesso!`);
            if (onRefresh) await onRefresh();
          }}
          onClosePaleteAndRegister={handleClosePaleteAndRegister}
          onDeletePalete={onDeletePalete ? async (paleteId) => {
            await onDeletePalete(paleteId);
            notify("Palete excluído com sucesso.");
            if (onRefresh) await onRefresh();
          } : undefined}
        />
      )}
    </div>
  );
}
