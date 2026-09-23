import React, { useState, useEffect, useMemo } from "react";
import {
  BobinaSemiAcabada,
  StatusBobina,
  Sector,
  MovimentacaoEstoque,
} from "../types/forpack";
import {
  loadBobinasWIP,
  saveBobinaWIP,
  updateStatusBobinaWIP,
  deleteBobinaWIP,
  loadActiveOps,
  saveMovimentacaoEstoque,
} from "../services/supabaseApi";
import {
  Package,
  Layers,
  Search,
  Filter,
  Plus,
  ArrowRight,
  Printer,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  User,
  Scale,
  Maximize2,
  Barcode,
  QrCode,
  FileText,
  X,
  Check,
} from "lucide-react";

interface WipBobinasTabProps {
  onShowNotification?: (msg: string, type: "success" | "error") => void;
}

export function WipBobinasTab({ onShowNotification }: WipBobinasTabProps) {
  const [bobinas, setBobinas] = useState<BobinaSemiAcabada[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("TODOS");
  const [setorFilter, setSetorFilter] = useState<string>("TODOS");

  // OPs ativas para vinculação
  const [activeOps, setActiveOps] = useState<
    {
      id: string;
      cliente: string;
      descricao_item: string;
      quantidade_planejada_kg: number;
      material: string;
    }[]
  >([]);

  // Modais
  const [showModal, setShowModal] = useState(false);
  const [editingBobina, setEditingBobina] = useState<Partial<BobinaSemiAcabada> | null>(null);
  const [transferModal, setTransferModal] = useState<BobinaSemiAcabada | null>(null);
  const [etiquetaBobina, setEtiquetaBobina] = useState<BobinaSemiAcabada | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const notify = (msg: string, type: "success" | "error" = "success") => {
    if (onShowNotification) onShowNotification(msg, type);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [wipList, opsList] = await Promise.all([
        loadBobinasWIP(),
        loadActiveOps(),
      ]);

      // Se a tabela de semi-acabados estiver vazia, podemos sugerir criar bobinas com base nas OPs existentes
      if (wipList.length === 0 && opsList.length > 0) {
        // Criar algumas bobinas de exemplo ligadas às OPs reais para inicializar o pátio
        const seedBobinas: Partial<BobinaSemiAcabada>[] = [
          {
            op_id: opsList[0]?.id || "9544",
            numero_bobina: `BOB-${opsList[0]?.id || "9544"}-01`,
            setor_origem: "EXTRUSÃO",
            setor_destino: "IMPRESSÃO",
            peso_liquido_kg: 320.5,
            largura_mm: 500,
            espessura_micras: 60,
            status: "DISPONIVEL",
            data_fabricacao: new Date().toISOString().slice(0, 10),
            operador: "RICARDO",
          },
          {
            op_id: opsList[0]?.id || "9544",
            numero_bobina: `BOB-${opsList[0]?.id || "9544"}-02`,
            setor_origem: "EXTRUSÃO",
            setor_destino: "IMPRESSÃO",
            peso_liquido_kg: 280.0,
            largura_mm: 500,
            espessura_micras: 60,
            status: "EM_USO",
            data_fabricacao: new Date().toISOString().slice(0, 10),
            operador: "SAMUEL",
          },
          {
            op_id: opsList[1]?.id || "9485",
            numero_bobina: `BOB-${opsList[1]?.id || "9485"}-01`,
            setor_origem: "EXTRUSÃO",
            setor_destino: "CORTE",
            peso_liquido_kg: 450.2,
            largura_mm: 750,
            espessura_micras: 80,
            status: "DISPONIVEL",
            data_fabricacao: new Date().toISOString().slice(0, 10),
            operador: "RICARDO",
          },
        ];

        try {
          const created: BobinaSemiAcabada[] = [];
          for (const s of seedBobinas) {
            const res = await saveBobinaWIP(s);
            created.push(res);
          }
          setBobinas(created);
        } catch (e) {
          console.warn("Could not seed WIP:", e);
          setBobinas([]);
        }
      } else {
        setBobinas(wipList);
      }

      setActiveOps(opsList);
    } catch (err) {
      console.error(err);
      notify("Erro ao carregar bobinas WIP.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map das OPs por ID para busca rápida
  const opMap = useMemo(() => {
    const map = new Map<string, { cliente: string; descricao_item: string; material: string }>();
    activeOps.forEach(op => {
      map.set(op.id, {
        cliente: op.cliente,
        descricao_item: op.descricao_item,
        material: op.material,
      });
    });
    return map;
  }, [activeOps]);

  // Filtragem
  const filteredBobinas = useMemo(() => {
    return bobinas.filter(b => {
      // Status
      if (statusFilter !== "TODOS" && b.status !== statusFilter) return false;
      // Setor
      if (setorFilter !== "TODOS" && b.setor_origem !== setorFilter && b.setor_destino !== setorFilter) return false;
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const opInfo = opMap.get(b.op_id);
        const matchNum = b.numero_bobina.toLowerCase().includes(q);
        const matchOp = b.op_id.toLowerCase().includes(q);
        const matchOperador = (b.operador || "").toLowerCase().includes(q);
        const matchCliente = (opInfo?.cliente || "").toLowerCase().includes(q);
        const matchItem = (opInfo?.descricao_item || "").toLowerCase().includes(q);
        return matchNum || matchOp || matchOperador || matchCliente || matchItem;
      }
      return true;
    });
  }, [bobinas, statusFilter, setorFilter, searchQuery, opMap]);

  // Indicadores / KPIs de Pátio
  const stats = useMemo(() => {
    const totalBobinas = bobinas.length;
    const totalKg = bobinas.reduce((sum, b) => sum + Number(b.peso_liquido_kg || 0), 0);
    const disponiveis = bobinas.filter(b => b.status === "DISPONIVEL");
    const disponiveisKg = disponiveis.reduce((sum, b) => sum + Number(b.peso_liquido_kg || 0), 0);
    const emUso = bobinas.filter(b => b.status === "EM_USO");
    const consumidas = bobinas.filter(b => b.status === "CONSUMIDA");
    const refugadas = bobinas.filter(b => b.status === "REFUGADA");
    const refugadasKg = refugadas.reduce((sum, b) => sum + Number(b.peso_liquido_kg || 0), 0);

    const paraImpressao = bobinas.filter(b => b.status === "DISPONIVEL" && b.setor_destino === "IMPRESSÃO");
    const paraCorte = bobinas.filter(b => b.status === "DISPONIVEL" && b.setor_destino === "CORTE");
    const paraLaminacao = bobinas.filter(b => b.status === "DISPONIVEL" && (b.setor_destino === "LAMINAÇÃO" || b.setor_destino === "REBOBINADEIRA"));

    return {
      totalBobinas,
      totalKg,
      disponiveisCount: disponiveis.length,
      disponiveisKg,
      emUsoCount: emUso.length,
      consumidasCount: consumidas.length,
      refugadasCount: refugadas.length,
      refugadasKg,
      paraImpressaoCount: paraImpressao.length,
      paraCorteCount: paraCorte.length,
      paraLaminacaoCount: paraLaminacao.length,
    };
  }, [bobinas]);

  // Salvar bobina
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBobina?.op_id || !editingBobina?.numero_bobina || !editingBobina?.peso_liquido_kg) {
      notify("Preencha a OP, número da bobina e o peso em kg.", "error");
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveBobinaWIP(editingBobina);
      
      // Registrar no livro de movimentação de estoque
      try {
        await saveMovimentacaoEstoque({
          tipo_movimento: "TRANSFERENCIA_WIP",
          tipo_item: "SEMIACABADO",
          op_id: saved.op_id,
          setor: saved.setor_origem,
          quantidade: saved.peso_liquido_kg,
          observacao: `Geração Bobina WIP ${saved.numero_bobina} (${saved.largura_mm || "?"}mm x ${saved.espessura_micras || "?"}µm) com destino a ${saved.setor_destino || "Pátio"}`,
        });
      } catch (errMov) {
        console.warn("Movimentação registrada com aviso:", errMov);
      }

      setBobinas(prev => {
        const idx = prev.findIndex(b => b.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [saved, ...prev];
      });

      setShowModal(false);
      setEditingBobina(null);
      notify(`Bobina ${saved.numero_bobina} salva com sucesso!`);
    } catch (err: any) {
      notify(err.message || "Erro ao salvar bobina.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Mudar status da bobina
  const handleQuickStatus = async (bobina: BobinaSemiAcabada, newStatus: StatusBobina) => {
    try {
      await updateStatusBobinaWIP(bobina.id, newStatus);
      setBobinas(prev => prev.map(b => b.id === bobina.id ? { ...b, status: newStatus } : b));
      notify(`Status da bobina ${bobina.numero_bobina} atualizado para ${newStatus}.`);
    } catch (err) {
      notify("Erro ao atualizar status.", "error");
    }
  };

  // Transferir setor
  const handleConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferModal) return;

    try {
      const newDestino = (e.currentTarget as any).setor_destino.value;
      const newStatus = (e.currentTarget as any).status.value;
      await updateStatusBobinaWIP(transferModal.id, newStatus, newDestino);
      
      // Registra movimentação de auditoria
      await saveMovimentacaoEstoque({
        tipo_movimento: "TRANSFERENCIA_WIP",
        tipo_item: "SEMIACABADO",
        op_id: transferModal.op_id,
        setor: newDestino,
        quantidade: transferModal.peso_liquido_kg,
        observacao: `Transferência de Bobina ${transferModal.numero_bobina} para setor ${newDestino}`,
      });

      setBobinas(prev => prev.map(b => b.id === transferModal.id ? { ...b, setor_destino: newDestino, status: newStatus } : b));
      setTransferModal(null);
      notify(`Bobina transferida para ${newDestino}!`);
    } catch (err) {
      notify("Erro ao transferir bobina.", "error");
    }
  };

  // Excluir bobina
  const handleDelete = async (bobina: BobinaSemiAcabada) => {
    if (!window.confirm(`Deseja realmente excluir a bobina ${bobina.numero_bobina} (${bobina.peso_liquido_kg} kg)?`)) {
      return;
    }
    try {
      await deleteBobinaWIP(bobina.id);
      setBobinas(prev => prev.filter(b => b.id !== bobina.id));
      notify(`Bobina ${bobina.numero_bobina} excluída.`);
    } catch (err) {
      notify("Erro ao excluir bobina.", "error");
    }
  };

  // Sugestão de código para nova bobina
  const handleSelectOpForNew = (opId: string) => {
    const existingForOp = bobinas.filter(b => b.op_id === opId).length;
    const nextSeq = String(existingForOp + 1).padStart(2, "0");
    setEditingBobina(prev => ({
      ...prev,
      op_id: opId,
      numero_bobina: `BOB-${opId}-${nextSeq}`,
    }));
  };

  return (
    <div className="space-y-5">
      {/* HEADER DE INDICADORES / KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
            <span>Total no Pátio</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Package className="w-4 h-4 text-indigo-600" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-800 tracking-tight mt-1">
            {stats.totalBobinas} <span className="text-xs font-normal text-slate-500">bobinas</span>
          </div>
          <div className="text-[11px] font-semibold text-indigo-600 mt-1">
            {stats.totalKg.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg total
          </div>
        </div>

        <div className="bg-white border border-emerald-200/80 rounded-2xl p-3.5 shadow-2xs bg-emerald-50/20 hover:shadow-xs transition">
          <div className="flex items-center justify-between text-xs text-emerald-700 font-semibold mb-1">
            <span>Disponíveis</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100/70 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-800 tracking-tight mt-1">
            {stats.disponiveisCount}
          </div>
          <div className="text-[11px] font-semibold text-emerald-600 mt-1">
            {stats.disponiveisKg.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} kg livres
          </div>
        </div>

        <div className="bg-white border border-blue-200/80 rounded-2xl p-3.5 shadow-2xs bg-blue-50/20 hover:shadow-xs transition">
          <div className="flex items-center justify-between text-xs text-blue-700 font-semibold mb-1">
            <span>P/ Impressão</span>
            <div className="w-7 h-7 rounded-lg bg-blue-100/70 flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <div className="text-xl font-black text-blue-800 tracking-tight mt-1">
            {stats.paraImpressaoCount} <span className="text-xs font-normal text-blue-600">bobinas</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">Aguardando puxada</div>
        </div>

        <div className="bg-white border border-purple-200/80 rounded-2xl p-3.5 shadow-2xs bg-purple-50/20 hover:shadow-xs transition">
          <div className="flex items-center justify-between text-xs text-purple-700 font-semibold mb-1">
            <span>P/ Laminação/Reb</span>
            <div className="w-7 h-7 rounded-lg bg-purple-100/70 flex items-center justify-center">
              <Layers className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          <div className="text-xl font-black text-purple-800 tracking-tight mt-1">
            {stats.paraLaminacaoCount} <span className="text-xs font-normal text-purple-600">bobinas</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">Semi-processadas</div>
        </div>

        <div className="bg-white border border-amber-200/80 rounded-2xl p-3.5 shadow-2xs bg-amber-50/20 hover:shadow-xs transition">
          <div className="flex items-center justify-between text-xs text-amber-700 font-semibold mb-1">
            <span>P/ Corte</span>
            <div className="w-7 h-7 rounded-lg bg-amber-100/70 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div className="text-xl font-black text-amber-800 tracking-tight mt-1">
            {stats.paraCorteCount} <span className="text-xs font-normal text-amber-600">bobinas</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">Prontas p/ acabamento</div>
        </div>

        <div className="bg-white border border-rose-200/80 rounded-2xl p-3.5 shadow-2xs bg-rose-50/20 hover:shadow-xs transition">
          <div className="flex items-center justify-between text-xs text-rose-700 font-semibold mb-1">
            <span>Refugo / Apara</span>
            <div className="w-7 h-7 rounded-lg bg-rose-100/70 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
          </div>
          <div className="text-xl font-black text-rose-800 tracking-tight mt-1">
            {stats.refugadasCount}
          </div>
          <div className="text-[11px] font-semibold text-rose-600 mt-1">
            {stats.refugadasKg.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} kg perda
          </div>
        </div>
      </div>

      {/* BARRA DE PESQUISA, FILTROS E AÇÃO PRINCIPAL */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Input busca */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar por Nº Bobina, OP, Cliente ou Operador..."
                className="w-full pl-9 pr-8 h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filtro Status */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-10 text-xs px-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="DISPONIVEL">Disponível no Pátio</option>
              <option value="EM_USO">Em Processamento</option>
              <option value="CONSUMIDA">Consumida</option>
              <option value="REFUGADA">Refugada / Apara</option>
            </select>

            {/* Filtro Setor */}
            <select
              value={setorFilter}
              onChange={e => setSetorFilter(e.target.value)}
              className="h-10 text-xs px-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer"
            >
              <option value="TODOS">Todos os Setores</option>
              <option value="EXTRUSÃO">Extrusão</option>
              <option value="IMPRESSÃO">Impressão</option>
              <option value="LAMINAÇÃO">Laminação</option>
              <option value="REBOBINADEIRA">Rebobinadeira</option>
              <option value="CORTE">Corte</option>
            </select>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="h-10 px-3 text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition border border-slate-200 flex items-center justify-center cursor-pointer shadow-2xs active:scale-95"
              title="Atualizar pátio"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingBobina({
                op_id: activeOps[0]?.id || "",
                numero_bobina: activeOps[0]?.id ? `BOB-${activeOps[0].id}-01` : "BOB-01",
                setor_origem: "EXTRUSÃO",
                setor_destino: "IMPRESSÃO",
                peso_liquido_kg: 0,
                largura_mm: 0,
                espessura_micras: 0,
                status: "DISPONIVEL",
                data_fabricacao: new Date().toISOString().slice(0, 10),
                operador: "",
              });
              setShowModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Bobina WIP</span>
          </button>
        </div>
      </div>

      {/* LISTA / TABELA INDUSTRIAL DE BOBINAS */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-800">
              Pátio de Bobinas Intermediárias ({filteredBobinas.length} de {bobinas.length})
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            WIP: Extrusão &rarr; Impressão &rarr; Laminação &rarr; Rebob. &rarr; Corte
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
            Carregando inventário de bobinas semi-acabadas...
          </div>
        ) : filteredBobinas.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-medium text-slate-700">Nenhuma bobina encontrada no pátio</p>
            <p className="text-xs text-slate-400 mt-1">
              Registre a produção da Extrusão clicando no botão "Registrar Bobina WIP".
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100/75 text-slate-600 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Identificação</th>
                  <th className="px-4 py-3">OP / Cliente</th>
                  <th className="px-4 py-3">Peso Líquido</th>
                  <th className="px-4 py-3">Dimensões (mm x µm)</th>
                  <th className="px-4 py-3">Fluxo Setor</th>
                  <th className="px-4 py-3">Operador / Data</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBobinas.map(bobina => {
                  const opInfo = opMap.get(bobina.op_id);

                  // Cor do status
                  const statusColors: Record<StatusBobina, { bg: string; text: string; border: string }> = {
                    DISPONIVEL: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
                    EM_USO: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
                    CONSUMIDA: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
                    REFUGADA: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
                  };
                  const currStatus = statusColors[bobina.status] || statusColors.DISPONIVEL;

                  return (
                    <tr key={bobina.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Identificação */}
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-slate-800 flex items-center gap-1.5">
                          <Barcode className="w-4 h-4 text-slate-400" />
                          {bobina.numero_bobina}
                        </div>
                        <span className="text-[10px] text-slate-400">ID: {bobina.id.slice(0, 8)}...</span>
                      </td>

                      {/* OP / Cliente */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                            OP #{bobina.op_id}
                          </span>
                        </div>
                        <div className="font-medium text-slate-700 text-xs mt-0.5 truncate max-w-[200px]" title={opInfo?.cliente}>
                          {opInfo?.cliente || "Cliente não informado"}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[220px]" title={opInfo?.descricao_item}>
                          {opInfo?.descricao_item || "Filme Tubular / Bobina"}
                        </div>
                      </td>

                      {/* Peso Líquido */}
                      <td className="px-4 py-3">
                        <div className="text-base font-bold text-slate-800">
                          {Number(bobina.peso_liquido_kg).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          <span className="text-xs font-normal text-slate-500 ml-1">kg</span>
                        </div>
                      </td>

                      {/* Dimensões */}
                      <td className="px-4 py-3 text-xs text-slate-700">
                        <div>
                          <span className="text-slate-400">Largura: </span>
                          <span className="font-semibold">{bobina.largura_mm ? `${bobina.largura_mm} mm` : "—"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Espessura: </span>
                          <span className="font-semibold">{bobina.espessura_micras ? `${bobina.espessura_micras} µm` : "—"}</span>
                        </div>
                      </td>

                      {/* Fluxo de Setor */}
                      <td className="px-4 py-3 text-xs">
                        <div className="flex items-center gap-1.5 font-medium text-slate-700">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">
                            {bobina.setor_origem}
                          </span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-semibold rounded border border-indigo-100">
                            {bobina.setor_destino || "PÁTIO"}
                          </span>
                        </div>
                      </td>

                      {/* Operador / Data */}
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <div className="flex items-center gap-1 text-slate-700 font-medium">
                          <User className="w-3 h-3 text-slate-400" />
                          {bobina.operador || "Não especificado"}
                        </div>
                        <div className="text-slate-400 text-[11px] mt-0.5">
                          {bobina.data_fabricacao ? new Date(bobina.data_fabricacao).toLocaleDateString("pt-BR") : "—"}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${currStatus.bg} ${currStatus.text} ${currStatus.border}`}>
                          {bobina.status === "DISPONIVEL" && "Disponível"}
                          {bobina.status === "EM_USO" && "Em Processamento"}
                          {bobina.status === "CONSUMIDA" && "Consumida"}
                          {bobina.status === "REFUGADA" && "Refugo"}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Etiqueta */}
                          <button
                            onClick={() => setEtiquetaBobina(bobina)}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                            title="Imprimir Etiqueta Industrial"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Transferir */}
                          <button
                            onClick={() => setTransferModal(bobina)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200"
                            title="Mover / Transferir Setor"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>

                          {/* Quick Toggle Status */}
                          {bobina.status === "DISPONIVEL" ? (
                            <button
                              onClick={() => handleQuickStatus(bobina, "EM_USO")}
                              className="px-2 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded transition-colors"
                              title="Colocar em máquina"
                            >
                              Puxar
                            </button>
                          ) : bobina.status === "EM_USO" ? (
                            <button
                              onClick={() => handleQuickStatus(bobina, "CONSUMIDA")}
                              className="px-2 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors"
                              title="Marcar como consumida"
                            >
                              Finalizar
                            </button>
                          ) : null}

                          {/* Editar */}
                          <button
                            onClick={() => {
                              setEditingBobina(bobina);
                              setShowModal(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Editar Dados"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Excluir */}
                          <button
                            onClick={() => handleDelete(bobina)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Excluir Bobina"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: NOVA BOBINA / EDITAR BOBINA */}
      {showModal && editingBobina && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-800">
                  {editingBobina.id ? "Editar Bobina Semi-Acabada" : "Registrar Nova Bobina WIP"}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingBobina(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Seleção de OP */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Ordem de Produção (OP Vinculada) *
                </label>
                <select
                  value={editingBobina.op_id || ""}
                  onChange={e => handleSelectOpForNew(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                >
                  <option value="">Selecione uma OP ativa...</option>
                  {activeOps.map(op => (
                    <option key={op.id} value={op.id}>
                      OP #{op.id} - {op.cliente} ({op.quantidade_planejada_kg}kg - {op.descricao_item})
                    </option>
                  ))}
                </select>
              </div>

              {/* Código / Número da Bobina */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Nº da Bobina *
                  </label>
                  <input
                    type="text"
                    value={editingBobina.numero_bobina || ""}
                    onChange={e => setEditingBobina({ ...editingBobina, numero_bobina: e.target.value })}
                    placeholder="Ex: BOB-9544-01"
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Peso Líquido (kg) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingBobina.peso_liquido_kg || ""}
                    onChange={e => setEditingBobina({ ...editingBobina, peso_liquido_kg: parseFloat(e.target.value) || 0 })}
                    placeholder="0.0"
                    className="w-full px-3 py-2 text-sm font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Dimensões: Largura e Espessura */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Largura (mm)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={editingBobina.largura_mm || ""}
                    onChange={e => setEditingBobina({ ...editingBobina, largura_mm: parseFloat(e.target.value) || 0 })}
                    placeholder="Ex: 500"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Espessura (Micras µm)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={editingBobina.espessura_micras || ""}
                    onChange={e => setEditingBobina({ ...editingBobina, espessura_micras: parseFloat(e.target.value) || 0 })}
                    placeholder="Ex: 60"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Setor Origem e Setor Destino */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Setor de Origem (Produzido em)
                  </label>
                  <select
                    value={editingBobina.setor_origem || "EXTRUSÃO"}
                    onChange={e => setEditingBobina({ ...editingBobina, setor_origem: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="EXTRUSÃO">EXTRUSÃO</option>
                    <option value="IMPRESSÃO">IMPRESSÃO</option>
                    <option value="LAMINAÇÃO">LAMINAÇÃO</option>
                    <option value="REBOBINADEIRA">REBOBINADEIRA</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Setor Destino (Próximo Passo)
                  </label>
                  <select
                    value={editingBobina.setor_destino || "IMPRESSÃO"}
                    onChange={e => setEditingBobina({ ...editingBobina, setor_destino: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="IMPRESSÃO">IMPRESSÃO</option>
                    <option value="LAMINAÇÃO">LAMINAÇÃO</option>
                    <option value="REBOBINADEIRA">REBOBINADEIRA</option>
                    <option value="CORTE">CORTE</option>
                    <option value="PÁTIO INTERMEDIÁRIO">PÁTIO INTERMEDIÁRIO</option>
                  </select>
                </div>
              </div>

              {/* Operador, Data e Status */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Operador
                  </label>
                  <input
                    type="text"
                    value={editingBobina.operador || ""}
                    onChange={e => setEditingBobina({ ...editingBobina, operador: e.target.value })}
                    placeholder="Ex: RICARDO"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Data Fabricação
                  </label>
                  <input
                    type="date"
                    value={editingBobina.data_fabricacao || ""}
                    onChange={e => setEditingBobina({ ...editingBobina, data_fabricacao: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Status
                  </label>
                  <select
                    value={editingBobina.status || "DISPONIVEL"}
                    onChange={e => setEditingBobina({ ...editingBobina, status: e.target.value as StatusBobina })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="DISPONIVEL">Disponível no Pátio</option>
                    <option value="EM_USO">Em Processamento</option>
                    <option value="CONSUMIDA">Consumida</option>
                    <option value="REFUGADA">Refugada / Apara</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingBobina(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                >
                  {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Salvar Bobina
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TRANSFERÊNCIA RÁPIDA DE SETOR */}
      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-800">
                  Transferir Bobina {transferModal.numero_bobina}
                </h3>
              </div>
              <button onClick={() => setTransferModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmTransfer} className="p-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs space-y-1">
                <div><span className="text-slate-500">OP Vinculada:</span> <strong className="text-slate-800">#{transferModal.op_id}</strong></div>
                <div><span className="text-slate-500">Peso da Bobina:</span> <strong className="text-slate-800">{transferModal.peso_liquido_kg} kg</strong></div>
                <div><span className="text-slate-500">Setor Origem:</span> <span className="font-medium text-slate-700">{transferModal.setor_origem}</span></div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Próximo Setor de Destino
                </label>
                <select
                  name="setor_destino"
                  defaultValue={transferModal.setor_destino || "IMPRESSÃO"}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-800"
                >
                  <option value="IMPRESSÃO">IMPRESSÃO</option>
                  <option value="LAMINAÇÃO">LAMINAÇÃO</option>
                  <option value="REBOBINADEIRA">REBOBINADEIRA</option>
                  <option value="CORTE">CORTE</option>
                  <option value="PÁTIO INTERMEDIÁRIO">PÁTIO INTERMEDIÁRIO</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Novo Status
                </label>
                <select
                  name="status"
                  defaultValue="DISPONIVEL"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="DISPONIVEL">Disponível no Pátio do Destino</option>
                  <option value="EM_USO">Em Processamento Imediato</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTransferModal(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors"
                >
                  Confirmar Transferência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ETIQUETA INDUSTRIAL DE CHÃO DE FÁBRICA */}
      {etiquetaBobina && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-sm">
                  Etiqueta de Identificação & Rastreabilidade (WIP)
                </h3>
              </div>
              <button onClick={() => setEtiquetaBobina(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* CARTÃO INDUSTRIAL IMPRIMÍVEL */}
            <div className="p-6 bg-slate-100">
              <div className="bg-white border-2 border-dashed border-slate-800 p-5 rounded-xl shadow-xs space-y-4">
                {/* Cabeçalho da etiqueta */}
                <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3">
                  <div>
                    <span className="text-xs font-black tracking-widest text-slate-900 uppercase">
                      FORPACK EMBALAGENS
                    </span>
                    <h4 className="text-base font-black text-indigo-900">
                      CONTROLE DE BOBINA INTERMEDIÁRIA
                    </h4>
                  </div>
                  <div className="text-right font-mono text-xs">
                    <span className="bg-slate-900 text-white px-2 py-1 rounded text-xs font-bold">
                      {etiquetaBobina.status}
                    </span>
                  </div>
                </div>

                {/* Código em destaque */}
                <div className="text-center py-2 bg-slate-50 border border-slate-300 rounded-lg">
                  <div className="text-2xl font-black font-mono tracking-wider text-slate-900">
                    {etiquetaBobina.numero_bobina}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    * {etiquetaBobina.numero_bobina} *
                  </div>
                </div>

                {/* Dados da OP e Cliente */}
                <div className="grid grid-cols-2 gap-3 text-xs border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Ordem de Produção</span>
                    <span className="text-lg font-black text-slate-900">OP #{etiquetaBobina.op_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Setor Destino</span>
                    <span className="text-sm font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {etiquetaBobina.setor_destino || "PÁTIO"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Cliente</span>
                    <span className="font-bold text-slate-800 text-xs truncate block">
                      {opMap.get(etiquetaBobina.op_id)?.cliente || "Cliente Forpack"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Item / Especificação</span>
                    <span className="text-xs text-slate-700">
                      {opMap.get(etiquetaBobina.op_id)?.descricao_item || "Filme Tubular"}
                    </span>
                  </div>
                </div>

                {/* Dados Técnicos Principais */}
                <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Peso Líquido</span>
                    <span className="text-xl font-black text-slate-900">
                      {etiquetaBobina.peso_liquido_kg} <span className="text-xs font-normal">kg</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Largura</span>
                    <span className="text-lg font-bold text-slate-800">
                      {etiquetaBobina.largura_mm ? `${etiquetaBobina.largura_mm} mm` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Espessura</span>
                    <span className="text-lg font-bold text-slate-800">
                      {etiquetaBobina.espessura_micras ? `${etiquetaBobina.espessura_micras} µm` : "—"}
                    </span>
                  </div>
                </div>

                {/* Rodapé da Etiqueta */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <div>
                    <span>Origem: <strong>{etiquetaBobina.setor_origem}</strong></span>
                    <span className="mx-1">•</span>
                    <span>Op: <strong>{etiquetaBobina.operador || "—"}</strong></span>
                  </div>
                  <div>
                    Data: <strong>{etiquetaBobina.data_fabricacao ? new Date(etiquetaBobina.data_fabricacao).toLocaleDateString("pt-BR") : "—"}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Ações da Etiqueta */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Pronta para impressão em folha A4 ou etiqueta térmica
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEtiquetaBobina(null)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Fechar
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir Etiqueta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
