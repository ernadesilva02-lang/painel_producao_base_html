import React, { useState, useEffect } from "react";
import { Insumo, InsumoCategoria, CustoSetorConfig, FichaTecnica, Sector, SECTORS, PRODUCT_CATEGORIES } from "../types/forpack";
import {
  loadInsumos,
  saveInsumo,
  deleteInsumo,
  loadCustosSetor,
  saveCustoSetor,
  loadFichasTecnicas,
  saveFichasTecnicas,
  DEFAULT_CUSTOS_SETORES,
} from "../services/supabaseApi";
import {
  Coins,
  Package,
  Boxes,
  Plus,
  Search,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Layers,
  Factory,
  Calculator,
  RefreshCw,
  Save,
  ArrowDownCircle,
  Clock,
  Gauge,
  Info,
  History,
} from "lucide-react";
import { WipBobinasTab } from "./WipBobinasTab";
import { EstoqueMovimentacoesTab } from "./EstoqueMovimentacoesTab";
import { OpProfitabilityTab } from "./OpProfitabilityTab";

export function CostAndSuppliesView() {
  const [activeTab, setActiveTab] = useState<"rentabilidade" | "wip" | "insumos" | "movimentacoes" | "setores" | "fichas">("rentabilidade");

  // Insumos state
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loadingInsumos, setLoadingInsumos] = useState(true);
  const [insumoQuery, setInsumoQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("TODAS");
  const [editingInsumo, setEditingInsumo] = useState<Partial<Insumo> | null>(null);
  const [quickEntryInsumo, setQuickEntryInsumo] = useState<{ insumo: Insumo; qtd: string; custo: string } | null>(null);

  // Custos Setor state
  const [custos, setCustos] = useState<CustoSetorConfig[]>([]);
  const [loadingCustos, setLoadingCustos] = useState(true);
  const [savingCustos, setSavingCustos] = useState(false);

  // Fichas Tecnicas state
  const [fichas, setFichas] = useState<FichaTecnica[]>([]);
  const [selectedFicha, setSelectedFicha] = useState<FichaTecnica | null>(null);
  const [simWeightKg, setSimWeightKg] = useState<number>(1000);

  const [notification, setNotification] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showNotification = (msg: string, type: "success" | "error" = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const refreshAll = async () => {
    setLoadingInsumos(true);
    setLoadingCustos(true);
    try {
      const [ins, cst, fch] = await Promise.all([loadInsumos(), loadCustosSetor(), loadFichasTecnicas()]);
      setInsumos(ins);
      setCustos(cst);
      setFichas(fch);
      if (fch.length > 0 && !selectedFicha) {
        setSelectedFicha(fch[0]);
      }
    } catch (err) {
      console.error(err);
      showNotification("Erro ao carregar dados do servidor.", "error");
    } finally {
      setLoadingInsumos(false);
      setLoadingCustos(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  // --- Handlers Insumos ---
  const handleSaveInsumo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInsumo || !editingInsumo.nome || !editingInsumo.categoria) return;

    try {
      const saved = await saveInsumo(editingInsumo);
      setInsumos(prev => {
        const idx = prev.findIndex(i => i.id === saved.id || (editingInsumo.id && i.id === editingInsumo.id));
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [saved, ...prev];
      });
      setEditingInsumo(null);
      showNotification("Insumo salvo com sucesso!");
    } catch (err) {
      showNotification("Erro ao salvar insumo.", "error");
    }
  };

  const handleDeleteInsumo = async (id: string, nome: string) => {
    if (!window.confirm(`Deseja realmente excluir o insumo "${nome}"?`)) return;
    try {
      await deleteInsumo(id);
      setInsumos(prev => prev.filter(i => i.id !== id));
      showNotification("Insumo removido.");
    } catch (err) {
      showNotification("Erro ao remover insumo.", "error");
    }
  };

  const handleQuickEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickEntryInsumo) return;
    const qtdNum = parseFloat(quickEntryInsumo.qtd);
    const custoNum = parseFloat(quickEntryInsumo.custo);
    if (isNaN(qtdNum) || qtdNum <= 0) return;

    const current = quickEntryInsumo.insumo;
    const newEstoque = (current.estoque_atual || 0) + qtdNum;
    // Custo médio ponderado se informado
    let newCusto = current.custo_unitario_medio;
    if (!isNaN(custoNum) && custoNum > 0) {
      const valorAnterior = (current.estoque_atual || 0) * (current.custo_unitario_medio || 0);
      const valorNovo = qtdNum * custoNum;
      newCusto = newEstoque > 0 ? (valorAnterior + valorNovo) / newEstoque : custoNum;
    }

    try {
      const updated = await saveInsumo({
        ...current,
        estoque_atual: newEstoque,
        custo_unitario_medio: Math.round(newCusto * 10000) / 10000,
      });
      setInsumos(prev => prev.map(i => (i.id === updated.id ? updated : i)));
      setQuickEntryInsumo(null);
      showNotification(`Entrada de ${qtdNum} ${current.unidade_medida} registrada!`);
    } catch (err) {
      showNotification("Erro ao registrar entrada.", "error");
    }
  };

  // --- Handlers Custos ---
  const handleCustoChange = (setor: string, field: keyof CustoSetorConfig, val: number) => {
    setCustos(prev =>
      prev.map(c => (c.setor === setor ? { ...c, [field]: val } : c))
    );
  };

  const handleSaveCustos = async () => {
    setSavingCustos(true);
    try {
      await Promise.all(custos.map(c => saveCustoSetor(c)));
      showNotification("Taxas de custo por setor atualizadas com sucesso!");
    } catch (err) {
      showNotification("Erro ao salvar custos de setor.", "error");
    } finally {
      setSavingCustos(false);
    }
  };

  // Cálculos de KPI
  const valorTotalEstoque = insumos.reduce(
    (acc, i) => acc + (i.estoque_atual || 0) * (i.custo_unitario_medio || 0),
    0
  );
  const insumosCriticos = insumos.filter(i => (i.estoque_atual || 0) <= (i.estoque_minimo || 0));

  const filteredInsumos = insumos.filter(i => {
    const matchCat = categoryFilter === "TODAS" || i.categoria === categoryFilter;
    const matchQ =
      !insumoQuery ||
      i.nome.toLowerCase().includes(insumoQuery.toLowerCase()) ||
      (i.codigo && i.codigo.toLowerCase().includes(insumoQuery.toLowerCase()));
    return matchCat && matchQ;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Action Bar (Compact & Clean) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Banco Supabase Conectado
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-600 font-medium">Gestão de insumos, hora-máquina, estoques e rentabilidade</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refreshAll}
            disabled={loadingInsumos || loadingCustos}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition shadow-2xs inline-flex items-center gap-2 active:scale-95 cursor-pointer"
            title="Sincronizar dados com o banco"
          >
            <RefreshCw size={13} className={loadingInsumos || loadingCustos ? "animate-spin text-indigo-600" : "text-slate-500"} />
            <span>Sincronizar Dados</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs"
              : "bg-rose-50 text-rose-800 border border-rose-200 shadow-2xs"
          }`}
        >
          {notification.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Valor Total Imobilizado</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Coins size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 tracking-tight">
            {valorTotalEstoque.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">Estoque ativo de insumos</p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Insumos Cadastrados</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 tracking-tight">{insumos.length} itens</p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">Resinas, tintas, aditivos e fitas</p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Insumos em Nível Crítico</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${insumosCriticos.length > 0 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}>
              {insumosCriticos.length > 0 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            </div>
          </div>
          <p className={`text-2xl font-black mt-2 tracking-tight ${insumosCriticos.length > 0 ? "text-amber-600" : "text-emerald-700"}`}>
            {insumosCriticos.length} {insumosCriticos.length === 1 ? "item" : "itens"}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            {insumosCriticos.length > 0 ? "Abaixo do estoque mínimo" : "Estoque em nível seguro"}
          </p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Setores Parametrizados</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Factory size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 tracking-tight">{custos.length} setores</p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">Custo hora-máquina e mão de obra</p>
        </div>
      </div>

      {/* Subtabs Navigation Bar (Segmented Control) */}
      <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200 flex items-center gap-1.5 overflow-x-auto shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab("rentabilidade")}
          className={`shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "rentabilidade"
              ? "bg-white text-indigo-700 font-bold shadow-2xs border border-slate-200/90"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          }`}
        >
          <TrendingUp size={15} className={activeTab === "rentabilidade" ? "text-indigo-600" : "text-slate-400"} />
          <span>Rentabilidade das OPs</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
            activeTab === "rentabilidade" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200/70 text-slate-600"
          }`}>
            DRE
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("wip")}
          className={`shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "wip"
              ? "bg-white text-indigo-700 font-bold shadow-2xs border border-slate-200/90"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          }`}
        >
          <Layers size={15} className={activeTab === "wip" ? "text-indigo-600" : "text-slate-400"} />
          <span>Bobinas WIP</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
            activeTab === "wip" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200/70 text-slate-600"
          }`}>
            Pátio
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("insumos")}
          className={`shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "insumos"
              ? "bg-white text-indigo-700 font-bold shadow-2xs border border-slate-200/90"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          }`}
        >
          <Boxes size={15} className={activeTab === "insumos" ? "text-indigo-600" : "text-slate-400"} />
          <span>Matérias-Primas</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
            activeTab === "insumos" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200/70 text-slate-600"
          }`}>
            {insumos.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("movimentacoes")}
          className={`shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "movimentacoes"
              ? "bg-white text-indigo-700 font-bold shadow-2xs border border-slate-200/90"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          }`}
        >
          <History size={15} className={activeTab === "movimentacoes" ? "text-indigo-600" : "text-slate-400"} />
          <span>Movimentações</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
            activeTab === "movimentacoes" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200/70 text-slate-600"
          }`}>
            Auditoria
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("setores")}
          className={`shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "setores"
              ? "bg-white text-indigo-700 font-bold shadow-2xs border border-slate-200/90"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          }`}
        >
          <Factory size={15} className={activeTab === "setores" ? "text-indigo-600" : "text-slate-400"} />
          <span>Taxas por Setor</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
            activeTab === "setores" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200/70 text-slate-600"
          }`}>
            R$/h
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("fichas")}
          className={`shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "fichas"
              ? "bg-white text-indigo-700 font-bold shadow-2xs border border-slate-200/90"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          }`}
        >
          <Calculator size={15} className={activeTab === "fichas" ? "text-indigo-600" : "text-slate-400"} />
          <span>Fichas Técnicas</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
            activeTab === "fichas" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200/70 text-slate-600"
          }`}>
            BOM
          </span>
        </button>
      </div>

      {/* TAB RENTABILIDADE & CUSTO REAL POR OP (ETAPA 4) */}
      {activeTab === "rentabilidade" && (
        <OpProfitabilityTab onShowNotification={showNotification} />
      )}

      {/* TAB WIP: BOBINAS SEMI-ACABADAS (ETAPA 3) */}
      {activeTab === "wip" && (
        <WipBobinasTab onShowNotification={showNotification} />
      )}

      {/* TAB MOVIMENTAÇÕES: LIVRO DE AUDITORIA DE ESTOQUE (ETAPA 3) */}
      {activeTab === "movimentacoes" && (
        <EstoqueMovimentacoesTab onShowNotification={showNotification} />
      )}

      {/* TAB 1: INSUMOS & MATÉRIAS-PRIMAS */}
      {activeTab === "insumos" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar insumo por nome ou código..."
                  value={insumoQuery}
                  onChange={e => setInsumoQuery(e.target.value)}
                  className="w-full pl-9 pr-3 h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer"
              >
                <option value="TODAS">Todas categorias</option>
                <option value="RESINA">Resinas</option>
                <option value="MASTERBATCH">Masterbatch</option>
                <option value="TINTA">Tintas</option>
                <option value="SOLVENTE">Solventes</option>
                <option value="ADESIVO">Adesivos</option>
                <option value="EMBALAGEM">Embalagens</option>
                <option value="OUTRO">Outros</option>
              </select>

              <button
                type="button"
                onClick={() =>
                  setEditingInsumo({
                    codigo: `INS-${Date.now().toString().slice(-4)}`,
                    nome: "",
                    categoria: "RESINA",
                    unidade_medida: "KG",
                    estoque_atual: 0,
                    estoque_minimo: 100,
                    custo_unitario_medio: 0,
                    ativo: true,
                  })
                }
                className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <Plus size={15} /> <span>Novo Insumo</span>
              </button>
            </div>
          </div>

          {/* Insumos Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="p-3 pl-4">Código / Insumo</th>
                    <th className="p-3">Categoria</th>
                    <th className="p-3 text-right">Estoque Atual</th>
                    <th className="p-3 text-right">Estoque Mínimo</th>
                    <th className="p-3 text-right">Custo Médio Unitário</th>
                    <th className="p-3 text-right">Valor Total Imobilizado</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 pr-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInsumos.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        Nenhum insumo encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredInsumos.map(item => {
                      const isCritico = (item.estoque_atual || 0) <= (item.estoque_minimo || 0);
                      const valorTotal = (item.estoque_atual || 0) * (item.custo_unitario_medio || 0);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-3 pl-4">
                            <span className="font-mono text-[11px] text-slate-400 block">{item.codigo || "S/ COD"}</span>
                            <span className="font-bold text-slate-800 text-xs">{item.nome}</span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                item.categoria === "RESINA"
                                  ? "bg-blue-100 text-blue-800"
                                  : item.categoria === "MASTERBATCH"
                                  ? "bg-purple-100 text-purple-800"
                                  : item.categoria === "TINTA"
                                  ? "bg-rose-100 text-rose-800"
                                  : item.categoria === "SOLVENTE"
                                  ? "bg-amber-100 text-amber-800"
                                  : item.categoria === "ADESIVO"
                                  ? "bg-teal-100 text-teal-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {item.categoria}
                            </span>
                          </td>
                          <td className="p-3 text-right font-bold text-slate-900">
                            {(item.estoque_atual || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1 })} {item.unidade_medida}
                          </td>
                          <td className="p-3 text-right text-slate-500">
                            {(item.estoque_minimo || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1 })} {item.unidade_medida}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-slate-900">
                            {(item.custo_unitario_medio || 0).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                              minimumFractionDigits: 2,
                            })}
                            <span className="text-[10px] text-slate-400">/{item.unidade_medida}</span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-700">
                            {valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </td>
                          <td className="p-3 text-center">
                            {isCritico ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                <AlertTriangle size={11} /> Repor
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Regular
                              </span>
                            )}
                          </td>
                          <td className="p-3 pr-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() =>
                                  setQuickEntryInsumo({
                                    insumo: item,
                                    qtd: "",
                                    custo: item.custo_unitario_medio.toString(),
                                  })
                                }
                                title="Lançar Entrada de Compra"
                                className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-700 transition"
                              >
                                <ArrowDownCircle size={15} />
                              </button>
                              <button
                                onClick={() => setEditingInsumo(item)}
                                title="Editar Insumo"
                                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                onClick={() => handleDeleteInsumo(item.id, item.nome)}
                                title="Excluir"
                                className="p-1.5 rounded-md hover:bg-rose-50 text-rose-600 transition"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOS POR SETOR */}
      {activeTab === "setores" && (
        <div className="space-y-4">
          <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-xs text-amber-900">
            <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Como funcionam as taxas de custo por setor:</strong>
              <p className="mt-0.5 text-amber-800">
                O custo por hora de cada setor é formado pela soma do <strong>Custo Hora-Máquina</strong> (energia, depreciação, manutenção e consumíveis) e <strong>Mão de Obra</strong> (salário, encargos dos operadores e ajudantes). Essas taxas são aplicadas automaticamente no apontamento de produção de cada OP.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {custos.map(item => {
              const totalHora = (Number(item.custo_hora_maquina) || 0) + (Number(item.custo_hora_homem) || 0);

              return (
                <div key={item.setor} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs">
                        <Factory size={16} />
                      </div>
                      <h3 className="font-extrabold text-slate-900 text-sm">{item.setor}</h3>
                    </div>
                    <span className="text-[11px] font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                      Total: {totalHora.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/h
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">
                        Custo Hora-Máquina (R$/h)
                      </label>
                      <input
                        type="number"
                        step="0.50"
                        min="0"
                        value={item.custo_hora_maquina}
                        onChange={e => handleCustoChange(item.setor, "custo_hora_maquina", parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">
                        Custo Mão de Obra Operacional (R$/h)
                      </label>
                      <input
                        type="number"
                        step="0.50"
                        min="0"
                        value={item.custo_hora_homem}
                        onChange={e => handleCustoChange(item.setor, "custo_hora_homem", parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">
                        Tolerância Padrão de Aparas/Perdas (%)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="25"
                          value={item.perda_padrao_tolerada_pct}
                          onChange={e => handleCustoChange(item.setor, "perda_padrao_tolerada_pct", parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800"
                        />
                        <span className="font-bold text-slate-400">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveCustos}
              disabled={savingCustos}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-xs disabled:opacity-50"
            >
              <Save size={15} />
              {savingCustos ? "Salvando..." : "Salvar Taxas de Custo dos Setores"}
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: FICHAS TÉCNICAS & SIMULADOR DE CUSTO/KG */}
      {activeTab === "fichas" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Col 1: Lista de Fichas */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={15} className="text-orange-600" /> Estruturas Padrão (BOM)
              </h3>
            </div>

            <div className="space-y-2">
              {fichas.map(ficha => (
                <button
                  key={ficha.id}
                  onClick={() => setSelectedFicha(ficha)}
                  className={`w-full text-left p-3 rounded-lg border text-xs transition ${
                    selectedFicha?.id === ficha.id
                      ? "border-orange-500 bg-orange-50/50 shadow-xs"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <span className="font-bold text-slate-900 block">{ficha.nomePadrao}</span>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                    <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 font-mono">
                      {ficha.categoriaProduto}
                    </span>
                    <span>• {ficha.setoresProcesso.join(" → ")}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Col 2 & 3: Detalhes & Simulador de Custo */}
          {selectedFicha && (
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[11px] font-bold text-orange-600 uppercase">Ficha Técnica Selecionada</span>
                    <h3 className="text-base font-extrabold text-slate-900">{selectedFicha.nomePadrao}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">Fluxo:</span>
                    <div className="flex items-center gap-1">
                      {selectedFicha.setoresProcesso.map((st, i) => (
                        <span key={st} className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-bold text-slate-700">
                          {st} {i < selectedFicha.setoresProcesso.length - 1 && "→"}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Composição de Matéria-Prima */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wide">
                    Composição da Fórmula (% de Insumos por Kg)
                  </h4>
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2">
                    {selectedFicha.composicao.map((comp, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">{comp.insumo_nome}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-slate-500">
                            {comp.custo_estimado_kg?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/kg
                          </span>
                          <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-900">
                            {comp.proporcao_percentual}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Simulador Interativo */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calculator size={18} className="text-orange-400" />
                      <h4 className="font-bold text-sm">Simulador de Custo Industrial</h4>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <label className="text-slate-300">Lote Simulado (Kg):</label>
                      <input
                        type="number"
                        min="50"
                        step="50"
                        value={simWeightKg}
                        onChange={e => setSimWeightKg(Math.max(1, parseFloat(e.target.value) || 0))}
                        className="w-24 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-right font-mono font-bold text-white text-xs"
                      />
                    </div>
                  </div>

                  {(() => {
                    // Cálculo de Matéria-prima ponderada
                    const custoMpKg = selectedFicha.composicao.reduce(
                      (acc, c) => acc + (c.custo_estimado_kg || 8.0) * (c.proporcao_percentual / 100),
                      0
                    );
                    const custoMpTotal = custoMpKg * simWeightKg;

                    // Cálculo operacional de máquinas envolvidas
                    const horasEstimadas = simWeightKg / (selectedFicha.velocidadeMediaKgHora || 40);
                    let custoOperacionalTotal = 0;
                    selectedFicha.setoresProcesso.forEach(st => {
                      const cfg = custos.find(c => c.setor === st) || DEFAULT_CUSTOS_SETORES.find(c => c.setor === st);
                      if (cfg) {
                        const taxaHora = (Number(cfg.custo_hora_maquina) || 0) + (Number(cfg.custo_hora_homem) || 0);
                        custoOperacionalTotal += horasEstimadas * taxaHora;
                      }
                    });

                    // Custo de Perda Padrão
                    const perdaKg = (simWeightKg * selectedFicha.perdaEstimadaPct) / 100;
                    const custoPerda = perdaKg * custoMpKg;

                    const custoTotalGeral = custoMpTotal + custoOperacionalTotal + custoPerda;
                    const custoPorKgFinal = custoTotalGeral / simWeightKg;

                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-center">
                        <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                          <span className="text-[10px] text-slate-400 block">Matéria-Prima</span>
                          <span className="text-sm font-bold font-mono text-emerald-400">
                            {custoMpTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            ({custoMpKg.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/kg)
                          </span>
                        </div>

                        <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                          <span className="text-[10px] text-slate-400 block">Custos Setores (OP)</span>
                          <span className="text-sm font-bold font-mono text-blue-400">
                            {custoOperacionalTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            ~{horasEstimadas.toFixed(1)}h operação
                          </span>
                        </div>

                        <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                          <span className="text-[10px] text-slate-400 block">Perda Prevista</span>
                          <span className="text-sm font-bold font-mono text-amber-400">
                            {custoPerda.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {perdaKg.toFixed(1)} kg ({selectedFicha.perdaEstimadaPct}%)
                          </span>
                        </div>

                        <div className="bg-orange-600/30 p-2.5 rounded-lg border border-orange-500/50">
                          <span className="text-[10px] text-orange-200 font-bold block">CUSTO FINAL ESTIMADO</span>
                          <span className="text-base font-black font-mono text-white block">
                            {custoPorKgFinal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/kg
                          </span>
                          <span className="text-[10px] text-orange-300 block mt-0.5">
                            Total: {custoTotalGeral.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: CRIAR / EDITAR INSUMO */}
      {editingInsumo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-sm">
                {editingInsumo.id ? "Editar Insumo" : "Cadastrar Novo Insumo"}
              </h3>
              <button
                onClick={() => setEditingInsumo(null)}
                className="text-slate-400 hover:text-slate-700 text-lg leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveInsumo} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Código de Referência</label>
                  <input
                    type="text"
                    required
                    value={editingInsumo.codigo || ""}
                    onChange={e => setEditingInsumo({ ...editingInsumo, codigo: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                    placeholder="Ex: MP-PEBD-02"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Categoria</label>
                  <select
                    value={editingInsumo.categoria || "RESINA"}
                    onChange={e => setEditingInsumo({ ...editingInsumo, categoria: e.target.value as InsumoCategoria })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                  >
                    <option value="RESINA">Resina</option>
                    <option value="MASTERBATCH">Masterbatch</option>
                    <option value="TINTA">Tinta Flexo</option>
                    <option value="SOLVENTE">Solvente</option>
                    <option value="ADESIVO">Adesivo</option>
                    <option value="EMBALAGEM">Embalagem</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Descrição / Nome do Insumo</label>
                <input
                  type="text"
                  required
                  value={editingInsumo.nome || ""}
                  onChange={e => setEditingInsumo({ ...editingInsumo, nome: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                  placeholder="Ex: Polietileno Baixa Densidade Virgem"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Unidade</label>
                  <select
                    value={editingInsumo.unidade_medida || "KG"}
                    onChange={e => setEditingInsumo({ ...editingInsumo, unidade_medida: e.target.value as any })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                  >
                    <option value="KG">KG</option>
                    <option value="L">Litros (L)</option>
                    <option value="UN">Unidade (UN)</option>
                    <option value="M">Metros (M)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Estoque Atual</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={editingInsumo.estoque_atual || 0}
                    onChange={e => setEditingInsumo({ ...editingInsumo, estoque_atual: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Estoque Mínimo</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={editingInsumo.estoque_minimo || 0}
                    onChange={e => setEditingInsumo({ ...editingInsumo, estoque_minimo: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Custo Médio Unitário (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    required
                    value={editingInsumo.custo_unitario_medio || 0}
                    onChange={e => setEditingInsumo({ ...editingInsumo, custo_unitario_medio: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-900"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingInsumo(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg transition shadow-xs"
                >
                  Salvar Insumo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ENTRADA RÁPIDA DE COMPRA */}
      {quickEntryInsumo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Entrada de Compra / Reposição</h3>
                <p className="text-[11px] text-slate-500">{quickEntryInsumo.insumo.nome}</p>
              </div>
              <button
                onClick={() => setQuickEntryInsumo(null)}
                className="text-slate-400 hover:text-slate-700 text-lg leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleQuickEntry} className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between text-slate-700">
                <span>Estoque Atual:</span>
                <strong className="font-mono">
                  {quickEntryInsumo.insumo.estoque_atual} {quickEntryInsumo.insumo.unidade_medida}
                </strong>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Quantidade Recebida ({quickEntryInsumo.insumo.unidade_medida})
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  autoFocus
                  value={quickEntryInsumo.qtd}
                  onChange={e => setQuickEntryInsumo({ ...quickEntryInsumo, qtd: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 text-sm"
                  placeholder="Ex: 1000"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Preço Praticado na Nota (R$/ {quickEntryInsumo.insumo.unidade_medida})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    required
                    value={quickEntryInsumo.custo}
                    onChange={e => setQuickEntryInsumo({ ...quickEntryInsumo, custo: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 text-sm"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  O sistema recalculará o custo médio ponderado do lote automaticamente.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickEntryInsumo(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 size={14} /> Confirmar Entrada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
