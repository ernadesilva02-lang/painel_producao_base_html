import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Printer,
  Package,
  Layers,
  CheckCircle2,
  Trash2,
  Scale,
  Plus,
  ArrowRight,
  Eye,
  AlertTriangle,
  RotateCcw,
  Tag,
} from "lucide-react";
import {
  Order,
  Machine,
  PaleteRomaneio,
  ItemPaleteRomaneio,
  StatusPalete,
} from "../types/forpack";
import {
  EtiquetaZebraModal,
  printEtiquetasZebra,
  inferEtiquetaZebraData,
  EtiquetaBobinaItem,
} from "./EtiquetaBobinaZebra";

interface PaleteRomaneioModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: Machine | null;
  activeOrder: Order | null;
  orders: Order[];
  operators: string[];
  initialPalete?: PaleteRomaneio | null;
  onSavePalete: (palete: PaleteRomaneio) => Promise<void>;
  onClosePaleteAndRegister: (
    palete: PaleteRomaneio,
    order: Order,
    machine: Machine
  ) => Promise<void>;
  onDeletePalete?: (paleteId: string) => Promise<void>;
}

export function PaleteRomaneioModal({
  isOpen,
  onClose,
  machine,
  activeOrder,
  orders,
  operators,
  initialPalete,
  onSavePalete,
  onClosePaleteAndRegister,
  onDeletePalete,
}: PaleteRomaneioModalProps) {
  // Pallet identification state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(
    activeOrder || null
  );
  const [numeroPalete, setNumeroPalete] = useState("");
  const [dataPalete, setDataPalete] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" })
  );
  const [turno, setTurno] = useState("1º Turno (06h - 14h)");
  const [operador, setOperador] = useState(operators[0] || "");
  const [auxiliar, setAuxiliar] = useState("");
  const [taraPadrao, setTaraPadrao] = useState(1.6); // 1.6 kg standard tubete tare
  const [status, setStatus] = useState<StatusPalete>("ABERTO");
  const [observacoes, setObservacoes] = useState("");

  // Items list
  const [itens, setItens] = useState<ItemPaleteRomaneio[]>([]);

  // Fast weighing input station
  const [inputBruto, setInputBruto] = useState("");
  const [inputTaraCustom, setInputTaraCustom] = useState("");
  const [useCustomTara, setUseCustomTara] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [viewMode, setViewMode] = useState<"lista" | "romaneio-grid">("romaneio-grid");

  // Zebra thermal label state
  const [zebraModalOpen, setZebraModalOpen] = useState(false);
  const [selectedBobinaForLabel, setSelectedBobinaForLabel] = useState<EtiquetaBobinaItem | null>(null);
  const [autoPrintZebra, setAutoPrintZebra] = useState<boolean>(() => {
    try {
      return localStorage.getItem("forpack_auto_print_zebra") === "true";
    } catch {
      return false;
    }
  });

  const toggleAutoPrintZebra = (val: boolean) => {
    setAutoPrintZebra(val);
    try {
      localStorage.setItem("forpack_auto_print_zebra", String(val));
    } catch {}
  };

  const inputBrutoRef = useRef<HTMLInputElement>(null);

  // Initialize or reset form when modal opens or initialPalete changes
  useEffect(() => {
    if (!isOpen) return;

    if (initialPalete) {
      setNumeroPalete(initialPalete.numeroPalete);
      setDataPalete(initialPalete.data);
      setTurno(initialPalete.turno || "1º Turno (06h - 14h)");
      setOperador(initialPalete.operador || operators[0] || "");
      setAuxiliar(initialPalete.auxiliar || "");
      setTaraPadrao(initialPalete.taraPadraoTubete || 1.6);
      setStatus(initialPalete.status || "ABERTO");
      setObservacoes(initialPalete.observacoes || "");
      setItens(initialPalete.itens || []);

      const foundOrder = orders.find(
        (o) =>
          o.id === initialPalete.opId ||
          o.numeroOp === initialPalete.numeroOp ||
          o.numeroPedido === initialPalete.numeroPedido
      );
      setSelectedOrder(foundOrder || activeOrder || null);
    } else {
      // New pallet
      const opNum = activeOrder?.numeroOp || activeOrder?.numeroPedido || "OP";
      const randomSeq = Math.floor(1 + Math.random() * 99)
        .toString()
        .padStart(2, "0");
      setNumeroPalete(`PAL-${opNum}-${randomSeq}`);
      setDataPalete(
        new Date().toLocaleDateString("en-CA", {
          timeZone: "America/Fortaleza",
        })
      );
      setTurno("1º Turno (06h - 14h)");
      setOperador(operators[0] || "");
      setAuxiliar("");
      setTaraPadrao(1.6);
      setStatus("ABERTO");
      setObservacoes("");
      setItens([]);
      setSelectedOrder(activeOrder || null);
    }

    setInputBruto("");
    setErrorMsg("");
    setSuccessToast("");

    // Auto focus the weight input for immediate weighing
    setTimeout(() => {
      inputBrutoRef.current?.focus();
    }, 150);
  }, [isOpen, initialPalete, activeOrder, orders, operators]);

  // Derived calculations
  const totalVolumes = itens.length;
  const pesoBrutoTotal = useMemo(
    () => itens.reduce((sum, item) => sum + (Number(item.pesoBruto) || 0), 0),
    [itens]
  );
  const taraTotal = useMemo(
    () => itens.reduce((sum, item) => sum + (Number(item.tara) || 0), 0),
    [itens]
  );
  const pesoLiquidoTotal = useMemo(
    () => itens.reduce((sum, item) => sum + (Number(item.pesoLiquido) || 0), 0),
    [itens]
  );

  // Current prospective item calculation for fast input display
  const currentProspectiveBruto = parseFloat(inputBruto.replace(",", ".")) || 0;
  const currentProspectiveTara = useCustomTara
    ? parseFloat(inputTaraCustom.replace(",", ".")) || 0
    : taraPadrao;
  const currentProspectiveLiquido = Math.max(
    0,
    currentProspectiveBruto - currentProspectiveTara
  );

  // Add item from fast weighing input
  const handleAddBobina = () => {
    const bruto = parseFloat(inputBruto.replace(",", "."));
    if (isNaN(bruto) || bruto <= 0) {
      setErrorMsg("Informe um peso bruto válido para a bobina (kg).");
      inputBrutoRef.current?.focus();
      return;
    }

    const tara = useCustomTara
      ? parseFloat(inputTaraCustom.replace(",", ".")) || 0
      : taraPadrao;

    const liquido = Math.round((bruto - tara) * 100) / 100;
    if (liquido <= 0) {
      setErrorMsg("O peso bruto deve ser superior à tara do tubete.");
      return;
    }

    const nextPos = itens.length + 1;
    const nowTime = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const newItem: ItemPaleteRomaneio = {
      posicao: nextPos,
      pesoBruto: Math.round(bruto * 100) / 100,
      tara: Math.round(tara * 100) / 100,
      pesoLiquido: liquido,
      codigoBobina: `BOB-${nextPos.toString().padStart(2, "0")}`,
      horario: nowTime,
    };

    setItens((prev) => [...prev, newItem]);
    setInputBruto("");
    if (useCustomTara) setInputTaraCustom("");
    setErrorMsg("");
    setSuccessToast(`Bobina #${nextPos} adicionada: ${liquido.toFixed(1)} kg líquido.`);
    setTimeout(() => setSuccessToast(""), 3000);

    // Impressão automática na Zebra se a opção estiver ligada pelo operador
    if (autoPrintZebra) {
      try {
        const itemToPrint: EtiquetaBobinaItem = {
          posicao: newItem.posicao,
          codigoBobina: newItem.codigoBobina,
          pesoBruto: newItem.pesoBruto,
          tara: newItem.tara,
          pesoLiquido: newItem.pesoLiquido,
          horario: newItem.horario,
        };
        const cfg = inferEtiquetaZebraData(selectedOrder, buildPaleteObject());
        printEtiquetasZebra([itemToPrint], cfg);
      } catch (err) {
        console.error("Erro na impressão automática da etiqueta Zebra:", err);
      }
    }

    // Keep focus for rapid continuous conveyor weighing
    setTimeout(() => {
      inputBrutoRef.current?.focus();
    }, 50);
  };

  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddBobina();
    }
  };

  const handleRemoveItem = (posicao: number) => {
    setItens((prev) =>
      prev
        .filter((i) => i.posicao !== posicao)
        .map((item, idx) => ({
          ...item,
          posicao: idx + 1,
          codigoBobina: `BOB-${(idx + 1).toString().padStart(2, "0")}`,
        }))
    );
  };

  const handleUpdateItemWeight = (posicao: number, novoBrutoStr: string) => {
    const novoBruto = parseFloat(novoBrutoStr.replace(",", "."));
    if (isNaN(novoBruto) || novoBruto <= 0) return;

    setItens((prev) =>
      prev.map((item) => {
        if (item.posicao !== posicao) return item;
        const liquido = Math.round((novoBruto - item.tara) * 100) / 100;
        return {
          ...item,
          pesoBruto: Math.round(novoBruto * 100) / 100,
          pesoLiquido: liquido,
        };
      })
    );
  };

  // Compile current pallet object
  const buildPaleteObject = (forcedStatus?: StatusPalete): PaleteRomaneio => {
    const id = initialPalete?.id || `palete-${Date.now()}`;
    const op = selectedOrder;

    return {
      id,
      numeroPalete: numeroPalete.trim() || `PAL-${Date.now().toString().slice(-4)}`,
      opId: op?.id || "",
      numeroOp: op?.numeroOp || "",
      numeroPedido: op?.numeroPedido || "",
      cliente: op?.cliente || "FORPACK CLIENTE",
      descricaoItem: op?.descricaoItem || "PRODUTO ACABADO",
      maquinaId: machine?.id || "REBOBINADEIRA",
      maquinaNome: machine?.name || "REBOBINADEIRA",
      setor: machine?.setor || "REBOBINADEIRA",
      data: dataPalete,
      turno,
      operador: operador.trim() || "Operador",
      auxiliar: auxiliar.trim() || undefined,
      taraPadraoTubete: taraPadrao,
      itens,
      totalVolumes: itens.length,
      pesoBrutoTotal: Math.round(pesoBrutoTotal * 100) / 100,
      taraTotal: Math.round(taraTotal * 100) / 100,
      pesoLiquidoTotal: Math.round(pesoLiquidoTotal * 100) / 100,
      status: forcedStatus || status,
      observacoes: observacoes.trim() || undefined,
      created_at: initialPalete?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      fechado_em:
        forcedStatus === "FECHADO" || status === "FECHADO"
          ? initialPalete?.fechado_em || new Date().toISOString()
          : undefined,
    };
  };

  // Save draft (keeps pallet open)
  const handleSaveDraft = async () => {
    if (itens.length === 0) {
      setErrorMsg("Adicione ao menos uma bobina pesada para salvar o palete.");
      return;
    }
    setSaving(true);
    setErrorMsg("");
    try {
      const palete = buildPaleteObject("ABERTO");
      await onSavePalete(palete);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Erro ao salvar palete em montagem."
      );
    } finally {
      setSaving(false);
    }
  };

  // Close pallet, register production and open print window
  const handleCloseAndPrint = async () => {
    if (itens.length === 0) {
      setErrorMsg("Adicione ao menos uma bobina para fechar o palete.");
      return;
    }
    if (!selectedOrder) {
      setErrorMsg("Selecione a Ordem de Produção (OP) vinculada a este palete.");
      return;
    }
    if (!machine) {
      setErrorMsg("Máquina não identificada.");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    try {
      const paleteFechado = buildPaleteObject("FECHADO");
      await onClosePaleteAndRegister(paleteFechado, selectedOrder, machine);

      // Trigger printing of the official Forpack Romaneio
      printOfficialRomaneio(paleteFechado);

      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Erro ao fechar palete e registrar produção."
      );
    } finally {
      setSaving(false);
    }
  };

  // Direct print action
  const handleDirectPrintOnly = () => {
    const palete = buildPaleteObject();
    printOfficialRomaneio(palete);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end">
      <div className="drawer order-drawer bg-white w-full max-w-4xl h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* CABEÇALHO DO DRAWER (Estilo Padrão Forpack Pedidos/OP) */}
        <div className="drawer-header bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                  {machine?.name || "REBOBINADEIRA"} • PRODUTO ACABADO
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    status === "FECHADO"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  }`}
                >
                  {status === "FECHADO" ? "PALETE FECHADO" : "EM MONTAGEM"}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Romaneio de Palete & Fechamento de Produção
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedBobinaForLabel(null);
                setZebraModalOpen(true);
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="Configurar e emitir etiquetas térmicas Zebra das bobinas deste palete"
            >
              <Tag className="w-4 h-4 text-blue-200" />
              <span>Etiquetas Zebra</span>
            </button>
            <button
              type="button"
              onClick={handleDirectPrintOnly}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Visualizar e imprimir romaneio atual"
            >
              <Printer className="w-4 h-4 text-slate-300" />
              <span>Imprimir Romaneio</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition"
              title="Fechar painel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* FEEDBACK MENSAGENS */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700 flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successToast && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-700 flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* CORPO ROLÁVEL */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* BANNER INFORMATIVO DA OP SELECIONADA */}
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded">
                  ORDEM DE PRODUÇÃO
                </span>
                <span className="text-sm font-bold text-slate-900">
                  OP #{selectedOrder?.numeroOp || selectedOrder?.numeroPedido || selectedOrder?.id || "N/A"}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-800">
                Cliente: <span className="font-normal text-slate-700">{selectedOrder?.cliente || "Sem cliente definido"}</span>
              </p>
              <p className="text-xs text-slate-600">
                Item: <span className="font-medium text-slate-800">{selectedOrder?.descricaoItem || "—"}</span>
              </p>
            </div>

            {/* SELETOR DE OP ALTERNATIVA */}
            <div className="sm:text-right shrink-0">
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                Trocar OP vinculada:
              </label>
              <select
                value={selectedOrder?.id || ""}
                onChange={(e) => {
                  const found = orders.find((o) => o.id === e.target.value);
                  if (found) {
                    setSelectedOrder(found);
                    if (!initialPalete) {
                      const opNum = found.numeroOp || found.numeroPedido || "OP";
                      setNumeroPalete(`PAL-${opNum}-01`);
                    }
                  }
                }}
                className="text-xs bg-white border border-slate-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 max-w-[220px]"
              >
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    OP #{o.numeroOp || o.numeroPedido || o.id} - {o.cliente}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* DADOS CADASTRAIS DO PALETE */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">
                Nº do Palete
              </label>
              <input
                type="text"
                value={numeroPalete}
                onChange={(e) => setNumeroPalete(e.target.value)}
                placeholder="Ex: PAL-9684-01"
                className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 uppercase"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">
                Data Produção
              </label>
              <input
                type="date"
                value={dataPalete}
                onChange={(e) => setDataPalete(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">
                Turno
              </label>
              <select
                value={turno}
                onChange={(e) => setTurno(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
              >
                <option value="1º Turno (06h - 14h)">1º Turno (06h - 14h)</option>
                <option value="2º Turno (14h - 22h)">2º Turno (14h - 22h)</option>
                <option value="3º Turno (22h - 06h)">3º Turno (22h - 06h)</option>
                <option value="Turno Normal">Turno Normal</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">
                Tara Tubete (kg)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={taraPadrao}
                  onChange={(e) => setTaraPadrao(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                  title="Peso do tubete/carretel que será subtraído de cada bobina"
                />
                <span className="absolute right-2.5 top-1.5 text-[10px] font-bold text-slate-400">
                  kg
                </span>
              </div>
            </div>

            <div className="col-span-2">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">
                Operador Responsável
              </label>
              <select
                value={operador}
                onChange={(e) => setOperador(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
              >
                {operators.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">
                Auxiliar de Produção
              </label>
              <input
                type="text"
                value={auxiliar}
                onChange={(e) => setAuxiliar(e.target.value)}
                placeholder="Ex: Nome do auxiliar no palete"
                className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* ESTAÇÃO DE PESAGEM RÁPIDA (CHÃO DE FÁBRICA / BALANÇA) */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 rounded-2xl shadow-lg border border-blue-700/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Estação de Pesagem Rápida · Bobina #{itens.length + 1}
                </h3>
              </div>
              <span className="text-[11px] text-blue-200">
                Dica: Digite o peso bruto e aperte <strong>ENTER</strong> para lançar
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              {/* INPUT PESO BRUTO */}
              <div className="sm:col-span-5">
                <label className="text-xs font-bold text-blue-200 uppercase tracking-wider block mb-1.5">
                  Peso Bruto na Balança (kg)
                </label>
                <div className="relative">
                  <input
                    ref={inputBrutoRef}
                    type="text"
                    inputMode="decimal"
                    value={inputBruto}
                    onChange={(e) => setInputBruto(e.target.value)}
                    onKeyDown={handleKeyDownInput}
                    placeholder="Ex: 49.3"
                    className="w-full h-13 bg-white text-slate-950 font-black text-2xl px-4 rounded-xl shadow-inner border-2 border-transparent focus:border-amber-400 focus:ring-0 outline-none"
                  />
                  <span className="absolute right-4 top-3.5 text-sm font-bold text-slate-400">
                    KG
                  </span>
                </div>
              </div>

              {/* PREVISÃO DE LÍQUIDO */}
              <div className="sm:col-span-4 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 h-13 flex flex-col justify-center">
                <div className="flex items-center justify-between text-[11px] text-blue-200">
                  <span>Tara Tubete: <strong>{currentProspectiveTara.toFixed(1)} kg</strong></span>
                  <button
                    type="button"
                    onClick={() => setUseCustomTara(!useCustomTara)}
                    className="text-[10px] text-amber-300 hover:underline cursor-pointer"
                  >
                    {useCustomTara ? "Usar padrão" : "Ajustar tara"}
                  </button>
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-[10px] font-semibold text-slate-300 uppercase">Líquido:</span>
                  <span className="text-lg font-black text-emerald-400">
                    {currentProspectiveLiquido > 0
                      ? `${currentProspectiveLiquido.toFixed(1)} kg`
                      : "— kg"}
                  </span>
                </div>
              </div>

              {/* BOTÃO ADICIONAR */}
              <div className="sm:col-span-3">
                <button
                  type="button"
                  onClick={handleAddBobina}
                  className="w-full h-13 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition cursor-pointer text-sm"
                >
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                  <span>+ Pesar Bobina</span>
                </button>
              </div>
            </div>

            {/* TARA CUSTOMIZADA SE ATIVA */}
            {useCustomTara && (
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-3">
                <span className="text-xs text-amber-300 font-semibold">
                  Tara avulsa para esta bobina:
                </span>
                <input
                  type="number"
                  step="0.1"
                  placeholder="kg"
                  value={inputTaraCustom}
                  onChange={(e) => setInputTaraCustom(e.target.value)}
                  className="w-24 bg-white text-slate-900 px-2 py-1 rounded text-xs font-bold"
                />
              </div>
            )}

            {/* BARRA DE INTEGRAÇÃO COM IMPRESSORA ZEBRA */}
            <div className="mt-3.5 pt-3 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoPrintZebra}
                  onChange={(e) => toggleAutoPrintZebra(e.target.checked)}
                  className="rounded text-amber-400 focus:ring-amber-400 w-4 h-4 cursor-pointer accent-amber-400"
                />
                <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5 text-amber-300" />
                  Imprimir etiqueta Zebra automaticamente ao pesar (Enter)
                </span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setSelectedBobinaForLabel(null);
                  setZebraModalOpen(true);
                }}
                className="bg-white/15 hover:bg-white/25 text-white px-3 py-1 rounded-lg border border-white/20 flex items-center gap-1.5 font-semibold transition cursor-pointer"
                title="Configurar etiqueta térmica, rolo Zebra e imprimir em lote"
              >
                <Tag className="w-3.5 h-3.5 text-amber-300" />
                <span>Emitir Etiquetas Zebra ({itens.length})</span>
              </button>
            </div>
          </div>

          {/* FAIXA DE TOTAIS EM TEMPO REAL (Métricas da Folha) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Total de Bobinas
              </span>
              <div className="flex items-baseline gap-1.5">
                <strong className="text-2xl font-black text-slate-900">
                  {totalVolumes}
                </strong>
                <span className="text-xs text-slate-400 font-medium">/ 80 max</span>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Peso Bruto Total
              </span>
              <div className="flex items-baseline gap-1.5">
                <strong className="text-2xl font-black text-slate-800">
                  {pesoBrutoTotal.toLocaleString("pt-BR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </strong>
                <span className="text-xs text-slate-500 font-semibold">kg</span>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Tara Total (Tubetes)
              </span>
              <div className="flex items-baseline gap-1.5">
                <strong className="text-2xl font-black text-slate-700">
                  {taraTotal.toLocaleString("pt-BR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </strong>
                <span className="text-xs text-slate-500 font-semibold">kg</span>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl shadow-2xs">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                Peso Líquido Acabado
              </span>
              <div className="flex items-baseline gap-1.5">
                <strong className="text-2xl font-black text-emerald-700">
                  {pesoLiquidoTotal.toLocaleString("pt-BR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </strong>
                <span className="text-xs text-emerald-600 font-bold">kg</span>
              </div>
            </div>
          </div>

          {/* TABELA DE BOBINAS / FORMATO IDÊNTICO À FOLHA DE ANOTAÇÕES */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            {/* CABEÇALHO DA TABELA E ALTERNÂNCIA DE MODO */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 uppercase">
                  Bobinas Apontadas no Palete ({itens.length})
                </span>
                {itens.length > 0 && (
                  <span className="text-[11px] text-slate-500 font-medium">
                    · Média: {(pesoLiquidoTotal / itens.length).toFixed(1)} kg/bobina
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode("romaneio-grid")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded ${
                    viewMode === "romaneio-grid"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  Grade Romaneio (1 a 80)
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("lista")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded ${
                    viewMode === "lista"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  Lista Detalhada
                </button>
                {itens.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Deseja realmente limpar todas as bobinas deste palete?")) {
                        setItens([]);
                      }
                    }}
                    className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                    title="Limpar bobinas"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {itens.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Scale className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
                <p className="text-xs font-semibold text-slate-600">
                  Nenhuma bobina pesada neste palete ainda
                </p>
                <p className="text-[11px] text-slate-400">
                  Pese a primeira bobina na balança e digite o peso bruto no campo acima
                </p>
              </div>
            ) : viewMode === "romaneio-grid" ? (
              /* GRADE DUPLA 1-40 E 41-80 (IDÊNTICA À FOLHA FORPACK) */
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[380px] overflow-y-auto">
                {/* COLUNA ESQUERDA: 1 A 40 */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-1.5 px-2.5 w-16 text-center">QUANTIDADE</th>
                        <th className="py-1.5 px-2.5 text-right">PESO BRUTO</th>
                        <th className="py-1.5 px-2.5 text-right">PESO LÍQUIDO</th>
                        <th className="py-1.5 px-1.5 w-14 text-center">AÇÃO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {Array.from({ length: 40 }).map((_, idx) => {
                        const pos = idx + 1;
                        const item = itens.find((i) => i.posicao === pos);
                        return (
                          <tr
                            key={pos}
                            className={item ? "bg-white hover:bg-blue-50/50" : "bg-slate-50/40 text-slate-300"}
                          >
                            <td className="py-1 px-2.5 text-center font-bold text-slate-500">
                              {pos}
                            </td>
                            <td className="py-1 px-2.5 text-right font-semibold text-slate-800">
                              {item ? item.pesoBruto.toFixed(1) : "—"}
                            </td>
                            <td className="py-1 px-2.5 text-right font-bold text-blue-700">
                              {item ? item.pesoLiquido.toFixed(1) : "—"}
                            </td>
                            <td className="py-1 px-1 text-center">
                              {item && (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedBobinaForLabel({
                                        posicao: item.posicao,
                                        pesoBruto: item.pesoBruto,
                                        tara: item.tara,
                                        pesoLiquido: item.pesoLiquido,
                                        codigoBobina: item.codigoBobina,
                                        horario: item.horario,
                                      });
                                      setZebraModalOpen(true);
                                    }}
                                    className="text-slate-400 hover:text-blue-600 transition"
                                    title={`Imprimir etiqueta Zebra da bobina #${pos}`}
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(item.posicao)}
                                    className="text-slate-400 hover:text-rose-600 transition"
                                    title="Remover bobina"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* COLUNA DIREITA: 41 A 80 */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-1.5 px-2.5 w-16 text-center">QUANTIDADE</th>
                        <th className="py-1.5 px-2.5 text-right">PESO BRUTO</th>
                        <th className="py-1.5 px-2.5 text-right">PESO LÍQUIDO</th>
                        <th className="py-1.5 px-1.5 w-14 text-center">AÇÃO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {Array.from({ length: 40 }).map((_, idx) => {
                        const pos = idx + 41;
                        const item = itens.find((i) => i.posicao === pos);
                        return (
                          <tr
                            key={pos}
                            className={item ? "bg-white hover:bg-blue-50/50" : "bg-slate-50/40 text-slate-300"}
                          >
                            <td className="py-1 px-2.5 text-center font-bold text-slate-500">
                              {pos}
                            </td>
                            <td className="py-1 px-2.5 text-right font-semibold text-slate-800">
                              {item ? item.pesoBruto.toFixed(1) : "—"}
                            </td>
                            <td className="py-1 px-2.5 text-right font-bold text-blue-700">
                              {item ? item.pesoLiquido.toFixed(1) : "—"}
                            </td>
                            <td className="py-1 px-1 text-center">
                              {item && (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedBobinaForLabel({
                                        posicao: item.posicao,
                                        pesoBruto: item.pesoBruto,
                                        tara: item.tara,
                                        pesoLiquido: item.pesoLiquido,
                                        codigoBobina: item.codigoBobina,
                                        horario: item.horario,
                                      });
                                      setZebraModalOpen(true);
                                    }}
                                    className="text-slate-400 hover:text-blue-600 transition"
                                    title={`Imprimir etiqueta Zebra da bobina #${pos}`}
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(item.posicao)}
                                    className="text-slate-400 hover:text-rose-600 transition"
                                    title="Remover bobina"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* LISTA DETALHADA SEQUENCIAL */
              <div className="max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2 px-3"># VOL</th>
                      <th className="py-2 px-3">CÓDIGO</th>
                      <th className="py-2 px-3">HORÁRIO</th>
                      <th className="py-2 px-3 text-right">PESO BRUTO (KG)</th>
                      <th className="py-2 px-3 text-right">TARA (KG)</th>
                      <th className="py-2 px-3 text-right">PESO LÍQUIDO (KG)</th>
                      <th className="py-2 px-3 text-center">AÇÃO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {itens.map((item) => (
                      <tr key={item.posicao} className="hover:bg-slate-50 transition">
                        <td className="py-2 px-3 font-bold text-slate-800">
                          #{item.posicao}
                        </td>
                        <td className="py-2 px-3 text-slate-600 font-sans">
                          {item.codigoBobina || `BOB-${item.posicao}`}
                        </td>
                        <td className="py-2 px-3 text-slate-500 font-sans">
                          {item.horario || "—"}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            step="0.1"
                            value={item.pesoBruto}
                            onChange={(e) =>
                              handleUpdateItemWeight(item.posicao, e.target.value)
                            }
                            className="w-20 text-right bg-white border border-slate-200 rounded px-1.5 py-0.5 font-bold text-slate-900"
                          />
                        </td>
                        <td className="py-2 px-3 text-right text-slate-500">
                          {item.tara.toFixed(1)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-600">
                          {item.pesoLiquido.toFixed(1)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBobinaForLabel({
                                  posicao: item.posicao,
                                  pesoBruto: item.pesoBruto,
                                  tara: item.tara,
                                  pesoLiquido: item.pesoLiquido,
                                  codigoBobina: item.codigoBobina,
                                  horario: item.horario,
                                });
                                setZebraModalOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-blue-600 rounded transition"
                              title={`Imprimir etiqueta Zebra da bobina #${item.posicao}`}
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.posicao)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                              title="Remover bobina"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* RODAPÉ DE TOTAIS DA FOLHA */}
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
              <span className="font-bold text-slate-600">
                TOTAL DE BOBINAS: <strong className="text-slate-900">{itens.length}</strong>
              </span>
              <div className="flex items-center gap-6">
                <span>
                  PESO BRUTO:{" "}
                  <strong className="text-slate-900">{pesoBrutoTotal.toFixed(1)} kg</strong>
                </span>
                <span>
                  TARA TOTAL:{" "}
                  <strong className="text-slate-600">{taraTotal.toFixed(1)} kg</strong>
                </span>
                <span className="text-sm bg-emerald-100 text-emerald-800 px-3 py-1 rounded-md font-bold">
                  PESO LÍQUIDO: {pesoLiquidoTotal.toFixed(1)} kg
                </span>
              </div>
            </div>
          </div>

          {/* OBSERVAÇÕES */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
              Observações do Palete / Romaneio
            </label>
            <textarea
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Palete com cantoneiras de papelão, filme estirável reforçado, lote especial..."
              className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* RODAPÉ FIXO DE AÇÕES */}
        <div className="drawer-footer bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {initialPalete && onDeletePalete && (
              <button
                type="button"
                onClick={async () => {
                  if (confirm("Tem certeza que deseja excluir este palete?")) {
                    setSaving(true);
                    try {
                      await onDeletePalete(initialPalete.id);
                      onClose();
                    } catch (e) {
                      setErrorMsg("Erro ao excluir palete.");
                    } finally {
                      setSaving(false);
                    }
                  }
                }}
                disabled={saving}
                className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-md border border-rose-200 transition cursor-pointer"
              >
                Excluir Palete
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-md text-xs font-semibold shadow-2xs transition cursor-pointer"
            >
              Salvar em Montagem
            </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleCloseAndPrint}
              disabled={saving || itens.length === 0}
              className="px-5 py-2.5 bg-[#1d68f2] hover:bg-[#1557d0] text-white rounded-md text-xs font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>{status === "FECHADO" ? "Reimprimir Romaneio" : "Fechar Palete & Imprimir Romaneio"}</span>
            </button>
          </div>
        </div>

        {/* MODAL DE ETIQUETA ZEBRA (BOBINAS INDIVIDUAIS OU EM LOTE) */}
        {zebraModalOpen && (
          <EtiquetaZebraModal
            isOpen={zebraModalOpen}
            onClose={() => {
              setZebraModalOpen(false);
              setSelectedBobinaForLabel(null);
            }}
            order={selectedOrder}
            palete={buildPaleteObject()}
            singleBobina={selectedBobinaForLabel}
            allBobinas={itens.map((it) => ({
              posicao: it.posicao,
              codigoBobina: it.codigoBobina,
              pesoBruto: it.pesoBruto,
              tara: it.tara,
              pesoLiquido: it.pesoLiquido,
              horario: it.horario,
            }))}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Função utilitária global para imprimir o Romaneio Oficial de Palete Forpack
 * Renderiza em um iframe isolado para não poluir o DOM e chama window.print().
 */
export function printOfficialRomaneio(palete: PaleteRomaneio) {
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

  // Prepara as linhas de 1 a 40 e 41 a 80
  const col1Rows: { pos: number; bruto: string; liq: string }[] = [];
  for (let i = 1; i <= 40; i++) {
    const item = palete.itens.find((it) => it.posicao === i);
    col1Rows.push({
      pos: i,
      bruto: item ? item.pesoBruto.toFixed(1).replace(".", ",") : "",
      liq: item ? item.pesoLiquido.toFixed(1).replace(".", ",") : "",
    });
  }

  const col2Rows: { pos: number; bruto: string; liq: string }[] = [];
  for (let i = 41; i <= 80; i++) {
    const item = palete.itens.find((it) => it.posicao === i);
    col2Rows.push({
      pos: i,
      bruto: item ? item.pesoBruto.toFixed(1).replace(".", ",") : "",
      liq: item ? item.pesoLiquido.toFixed(1).replace(".", ",") : "",
    });
  }

  printDoc.open();
  printDoc.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Romaneio Palete ${palete.numeroPalete}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    }
    body {
      margin: 0;
      padding: 0;
      color: #000;
      background: #fff;
      font-size: 11px;
    }
    .sheet {
      width: 100%;
      border: 2px solid #000;
      padding: 6px;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #000;
      padding-bottom: 6px;
      margin-bottom: 6px;
    }
    .logo-area {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .logo-badge {
      background: #000;
      color: #fff;
      font-size: 16px;
      font-weight: 900;
      padding: 4px 8px;
      border-radius: 4px;
    }
    .logo-text {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: -0.5px;
    }
    .company-info {
      text-align: right;
      font-size: 9.5px;
      line-height: 1.3;
    }
    .company-name {
      font-weight: 900;
      font-size: 11px;
    }
    .title-bar {
      background: #000;
      color: #fff;
      text-align: center;
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 1px;
      padding: 4px;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 4px;
      border: 1.5px solid #000;
      padding: 6px;
      margin-bottom: 6px;
      background: #fdfdfd;
    }
    .info-item {
      font-size: 9.5px;
      line-height: 1.4;
    }
    .info-item strong {
      font-size: 10.5px;
    }
    .tables-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
    }
    th, td {
      border: 1px solid #444;
      padding: 2.2px 4px;
    }
    th {
      background: #e6e6e6;
      font-weight: 900;
      text-align: center;
      font-size: 9px;
      letter-spacing: 0.3px;
    }
    td.col-qty {
      width: 24%;
      text-align: center;
      font-weight: 800;
      background: #f7f7f7;
    }
    td.col-val {
      width: 38%;
      text-align: right;
      font-family: monospace, Courier;
      font-size: 10px;
    }
    .totals-box {
      border: 2px solid #000;
      background: #f3f3f3;
      padding: 6px 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .tot-item {
      font-size: 11px;
      font-weight: 800;
    }
    .tot-item-big {
      font-size: 15px;
      font-weight: 900;
      background: #000;
      color: #fff;
      padding: 4px 10px;
      border-radius: 4px;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      margin-top: 10px;
      padding-top: 6px;
    }
    .sig-line {
      border-top: 1px solid #000;
      text-align: center;
      font-size: 8.5px;
      padding-top: 3px;
      font-weight: bold;
    }
    .barcode-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px dashed #888;
      padding-top: 4px;
      margin-top: 6px;
      font-size: 8px;
      color: #555;
    }
    .barcode-display {
      font-family: monospace;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 2px;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="logo-area">
        <div class="logo-badge">FP</div>
        <div>
          <div class="logo-text">Forpack</div>
          <div style="font-size: 7.5px; font-weight: bold; color: #555;">INDÚSTRIA DE EMBALAGENS</div>
        </div>
      </div>
      <div class="company-info">
        <div class="company-name">FORPACK INDUSTRIA DE EMBALAGENS LTDA</div>
        <div>RODM ESTADUAL CE 060 KM 26 Nº S/N - GUAIÚBA - CE</div>
        <div>CNPJ: 34.522.879/0001-53</div>
      </div>
    </div>

    <div class="title-bar">
      ROMANEIO DE PALETE · PRODUTO ACABADO
    </div>

    <div class="info-grid">
      <div class="info-item">
        <div>PALETE: <strong>${palete.numeroPalete}</strong></div>
        <div>CLIENTE: <strong>${palete.cliente}</strong></div>
        <div>PRODUTO: <strong>${palete.descricaoItem}</strong></div>
      </div>
      <div class="info-item">
        <div>OP: <strong>#${palete.numeroOp || palete.opId}</strong></div>
        <div>MÁQUINA: <strong>${palete.maquinaNome || palete.maquinaId}</strong></div>
        <div>SETOR: <strong>${palete.setor}</strong></div>
      </div>
      <div class="info-item">
        <div>DATA: <strong>${palete.data ? new Date(palete.data + "T12:00:00").toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR")}</strong></div>
        <div>TURNO: <strong>${palete.turno || "1º Turno"}</strong></div>
        <div>OPERADOR: <strong>${palete.operador || "—"}</strong></div>
        ${palete.auxiliar ? `<div>AUXILIAR: <strong>${palete.auxiliar}</strong></div>` : ""}
      </div>
    </div>

    <div class="tables-container">
      <!-- BLOCO 1: 1 A 40 -->
      <table>
        <thead>
          <tr>
            <th class="col-qty">QUANTIDADE</th>
            <th class="col-val">PESO BRUTO</th>
            <th class="col-val">PESO LIQUIDO</th>
          </tr>
        </thead>
        <tbody>
          ${col1Rows
            .map(
              (r) => `<tr>
            <td class="col-qty">${r.pos}</td>
            <td class="col-val">${r.bruto}</td>
            <td class="col-val">${r.liq}</td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>

      <!-- BLOCO 2: 41 A 80 -->
      <table>
        <thead>
          <tr>
            <th class="col-qty">QUANTIDADE</th>
            <th class="col-val">PESO BRUTO</th>
            <th class="col-val">PESO LIQUIDO</th>
          </tr>
        </thead>
        <tbody>
          ${col2Rows
            .map(
              (r) => `<tr>
            <td class="col-qty">${r.pos}</td>
            <td class="col-val">${r.bruto}</td>
            <td class="col-val">${r.liq}</td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>

    <!-- TOTAIS DO PALETE (IDÊNTICO AO RODAPÉ DA FOLHA) -->
    <div class="totals-box">
      <div class="tot-item">
        VOLUMES: <strong>${palete.totalVolumes} bobinas</strong>
      </div>
      <div class="tot-item">
        PESO BRUTO: <strong>${palete.pesoBrutoTotal.toFixed(1).replace(".", ",")} KG</strong>
      </div>
      <div class="tot-item">
        TARA TOTAL (${palete.taraPadraoTubete.toFixed(1).replace(".", ",")} kg/tub): <strong>${palete.taraTotal.toFixed(1).replace(".", ",")} KG</strong>
      </div>
      <div class="tot-item-big">
        PESO LÍQUIDO: ${palete.pesoLiquidoTotal.toFixed(1).replace(".", ",")} KG
      </div>
    </div>

    <!-- ASSINATURAS E EXPEDIÇÃO -->
    <div class="signatures">
      <div>
        <div style="height: 18px;"></div>
        <div class="sig-line">OPERADOR / AUXILIAR</div>
      </div>
      <div>
        <div style="height: 18px;"></div>
        <div class="sig-line">CONFERÊNCIA EXPEDIÇÃO / ESTOQUE</div>
      </div>
      <div>
        <div style="height: 18px;"></div>
        <div class="sig-line">SUPERVISÃO / PCP</div>
      </div>
    </div>

    <div class="barcode-row">
      <span class="barcode-display">*${palete.numeroPalete}*</span>
      <span>FORPACK GESTÃO INDUSTRIAL · EMISSÃO: ${new Date().toLocaleString("pt-BR")}</span>
      <span>STATUS: ${palete.status}</span>
    </div>
  </div>
</body>
</html>`);
  printDoc.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
    setTimeout(() => {
      frame.remove();
    }, 2000);
  }, 400);
}
