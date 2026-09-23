import React, { useState, useEffect, useMemo } from "react";
import { OpFinancialSummary, CustoSetorDetalhe } from "../types/forpack";
import {
  loadAllOpFinancials,
  saveOpSellingPrice,
} from "../services/financialEngine";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Sliders,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  FileSpreadsheet,
  Zap,
  Clock,
  Layers,
  Factory,
  Scissors,
  Save,
  X,
} from "lucide-react";

interface OpProfitabilityTabProps {
  onShowNotification?: (msg: string, type: "success" | "error") => void;
}

export function OpProfitabilityTab({ onShowNotification }: OpProfitabilityTabProps) {
  const [data, setData] = useState<{
    summaries: OpFinancialSummary[];
    totalReceita: number;
    totalCusto: number;
    totalLucro: number;
    margemGeralPct: number;
  }>({
    summaries: [],
    totalReceita: 0,
    totalCusto: 0,
    totalLucro: 0,
    margemGeralPct: 0,
  });

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [rentabilidadeFilter, setRentabilidadeFilter] = useState<string>("TODAS");
  const [sortBy, setSortBy] = useState<"OP_DESC" | "MARGEM_ASC" | "MARGEM_DESC" | "CUSTO_DESC" | "VOLUME_DESC">("OP_DESC");

  // Modal de Detalhes da OP / Simulador
  const [selectedOp, setSelectedOp] = useState<OpFinancialSummary | null>(null);
  const [editPrecoVenda, setEditPrecoVenda] = useState<string>("");
  const [savingPrice, setSavingPrice] = useState(false);

  const notify = (msg: string, type: "success" | "error" = "success") => {
    if (onShowNotification) onShowNotification(msg, type);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await loadAllOpFinancials();
      setData(res);
    } catch (err: any) {
      console.error(err);
      notify("Erro ao calcular dados financeiros das OPs.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtragem e Ordenação
  const filteredOps = useMemo(() => {
    return data.summaries
      .filter(op => {
        if (rentabilidadeFilter !== "TODAS" && op.status_lucratividade !== rentabilidadeFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchOp = op.op_id.toLowerCase().includes(q);
          const matchCliente = op.cliente.toLowerCase().includes(q);
          const matchDesc = op.descricao_item.toLowerCase().includes(q);
          const matchMat = op.material.toLowerCase().includes(q);
          return matchOp || matchCliente || matchDesc || matchMat;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "OP_DESC") {
          const numA = parseInt(a.op_id, 10);
          const numB = parseInt(b.op_id, 10);
          if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
          return b.op_id.localeCompare(a.op_id);
        }
        if (sortBy === "MARGEM_ASC") return a.margem_lucro_pct - b.margem_lucro_pct;
        if (sortBy === "MARGEM_DESC") return b.margem_lucro_pct - a.margem_lucro_pct;
        if (sortBy === "CUSTO_DESC") return b.custo_total_fabricacao - a.custo_total_fabricacao;
        if (sortBy === "VOLUME_DESC") return b.quantidade_final_kg - a.quantidade_final_kg;
        return 0;
      });
  }, [data.summaries, searchQuery, rentabilidadeFilter, sortBy]);

  // Contadores por status
  const statusCounts = useMemo(() => {
    const counts = {
      ALTA: 0,
      NORMAL: 0,
      APERTADA: 0,
      PREJUIZO: 0,
    };
    data.summaries.forEach(s => {
      counts[s.status_lucratividade]++;
    });
    return counts;
  }, [data.summaries]);

  // Abertura do Modal de Detalhe
  const handleOpenDetail = (op: OpFinancialSummary) => {
    setSelectedOp(op);
    setEditPrecoVenda(String(op.preco_venda_kg));
  };

  // Salvar novo preço de venda
  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOp) return;
    const novoPreco = parseFloat(editPrecoVenda);
    if (!novoPreco || novoPreco <= 0) {
      notify("Informe um preço de venda válido maior que zero.", "error");
      return;
    }

    setSavingPrice(true);
    try {
      await saveOpSellingPrice(selectedOp.op_id, novoPreco);

      // Recalcula o objeto local
      const receitaTotal = Math.round((selectedOp.quantidade_final_kg * novoPreco) * 100) / 100;
      const lucroBruto = Math.round((receitaTotal - selectedOp.custo_total_fabricacao) * 100) / 100;
      const margemLucroPct = receitaTotal > 0 ? Math.round(((lucroBruto / receitaTotal) * 100) * 10) / 10 : 0;

      let statusLucratividade: "ALTA" | "NORMAL" | "APERTADA" | "PREJUIZO" = "NORMAL";
      if (margemLucroPct >= 25) statusLucratividade = "ALTA";
      else if (margemLucroPct >= 15) statusLucratividade = "NORMAL";
      else if (margemLucroPct >= 5) statusLucratividade = "APERTADA";
      else statusLucratividade = "PREJUIZO";

      const updatedOp: OpFinancialSummary = {
        ...selectedOp,
        preco_venda_kg: novoPreco,
        receita_total: receitaTotal,
        lucro_bruto: lucroBruto,
        margem_lucro_pct: margemLucroPct,
        status_lucratividade: statusLucratividade,
      };

      setSelectedOp(updatedOp);
      setData(prev => ({
        ...prev,
        summaries: prev.summaries.map(s => (s.op_id === updatedOp.op_id ? updatedOp : s)),
      }));

      notify(`Preço de venda da OP #${selectedOp.op_id} atualizado para R$ ${novoPreco.toFixed(2)}/kg!`);
    } catch (err: any) {
      notify("Erro ao salvar preço: " + err.message, "error");
    } finally {
      setSavingPrice(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* KPI CARDS FINANCEIROS GLOBAIS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
            <span>Faturamento Bruto (OPs)</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            R$ {data.totalReceita.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">
            {data.summaries.length} OPs analisadas
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
            <span>Custo Total de Fabricação</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center">
              <Factory className="w-4 h-4 text-rose-600" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-700 tracking-tight mt-1">
            R$ {data.totalCusto.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">
            MP + Máquinas + Horas + Aparas
          </div>
        </div>

        <div className="bg-white border border-emerald-200/80 rounded-2xl p-4 shadow-2xs bg-emerald-50/20 hover:shadow-xs transition">
          <div className="flex items-center justify-between text-xs text-emerald-700 font-semibold mb-1">
            <span>Margem de Contribuição Total</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100/70 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-700" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-800 tracking-tight mt-1">
            R$ {data.totalLucro.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1">
            Lucro Bruto Operacional
          </div>
        </div>

        <div className="bg-white border border-indigo-200/80 rounded-2xl p-4 shadow-2xs bg-indigo-50/20 hover:shadow-xs transition">
          <div className="flex items-center justify-between text-xs text-indigo-700 font-semibold mb-1">
            <span>Rentabilidade Ponderada</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-100/70 flex items-center justify-center">
              <Zap className="w-4 h-4 text-indigo-700" />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-900 tracking-tight mt-1">
            {data.margemGeralPct.toFixed(1)}%
          </div>
          <div className="text-[11px] text-indigo-600 font-medium mt-1">
            Margem Líquida Média
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS, BUSCA E STATUS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por Nº da OP, Cliente, Produto ou Material..."
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

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="h-10 text-xs px-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer"
            >
              <option value="OP_DESC">Mais Recentes (Nº OP)</option>
              <option value="MARGEM_ASC">Margem Menor → Maior (Gargalos)</option>
              <option value="MARGEM_DESC">Margem Maior → Menor (Mais Lucrativas)</option>
              <option value="CUSTO_DESC">Maior Custo Total</option>
              <option value="VOLUME_DESC">Maior Volume (Kg)</option>
            </select>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="h-10 px-3 text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition border border-slate-200 flex items-center justify-center cursor-pointer shadow-2xs active:scale-95"
              title="Recalcular do banco"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            </button>
          </div>
        </div>

        {/* Chips de filtro rápido por rentabilidade */}
        <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-100 text-xs">
          <span className="font-semibold text-slate-500 mr-1 text-[11px]">Filtrar Margem:</span>
          <button
            type="button"
            onClick={() => setRentabilidadeFilter("TODAS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              rentabilidadeFilter === "TODAS"
                ? "bg-slate-800 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Todas ({data.summaries.length})
          </button>

          <button
            type="button"
            onClick={() => setRentabilidadeFilter("ALTA")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              rentabilidadeFilter === "ALTA"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Alta (&ge; 25%) • {statusCounts.ALTA}</span>
          </button>

          <button
            type="button"
            onClick={() => setRentabilidadeFilter("NORMAL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              rentabilidadeFilter === "NORMAL"
                ? "bg-blue-600 text-white shadow-2xs"
                : "bg-blue-50 text-blue-700 hover:bg-blue-100/80"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            <span>Saudável (15-25%) • {statusCounts.NORMAL}</span>
          </button>

          <button
            type="button"
            onClick={() => setRentabilidadeFilter("APERTADA")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              rentabilidadeFilter === "APERTADA"
                ? "bg-amber-600 text-white shadow-2xs"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100/80"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            <span>Apertada (5-15%) • {statusCounts.APERTADA}</span>
          </button>

          <button
            type="button"
            onClick={() => setRentabilidadeFilter("PREJUIZO")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              rentabilidadeFilter === "PREJUIZO"
                ? "bg-rose-600 text-white shadow-2xs"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100/80"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            <span>Alerta / Risco (&lt; 5%) • {statusCounts.PREJUIZO}</span>
          </button>
        </div>
      </div>

      {/* TABELA INDUSTRIAL DE RENTABILIDADE POR OP */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-800">
              Rentabilidade & Formação de Custo Real por Ordem de Produção
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {filteredOps.length} OPs listadas
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
            Processando custos reais de 186 ordens e apontamentos industriais...
          </div>
        ) : filteredOps.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <AlertTriangle className="w-8 h-8 mx-auto text-amber-400 mb-2" />
            <p className="font-medium text-slate-700">Nenhuma OP encontrada com estes filtros</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100/80 text-slate-600 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">OP / Cliente</th>
                  <th className="px-4 py-3">Material & Produto</th>
                  <th className="px-4 py-3 text-right">Volume (Kg)</th>
                  <th className="px-4 py-3 text-right">Custo Real (R$/kg)</th>
                  <th className="px-4 py-3 text-right">Preço Venda (R$/kg)</th>
                  <th className="px-4 py-3 text-right">Custo Total</th>
                  <th className="px-4 py-3 text-right">Receita Total</th>
                  <th className="px-4 py-3 text-center">Margem %</th>
                  <th className="px-4 py-3 text-right">Lucro Bruto</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOps.map(op => {
                  const isLoss = op.lucro_bruto < 0 || op.margem_lucro_pct < 5;
                  const isHigh = op.margem_lucro_pct >= 25;

                  let badgeColor = "bg-blue-50 text-blue-700 border-blue-200";
                  if (isHigh) badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold";
                  else if (op.status_lucratividade === "APERTADA") badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
                  else if (isLoss) badgeColor = "bg-rose-50 text-rose-700 border-rose-200 font-bold";

                  return (
                    <tr
                      key={op.op_id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      onClick={() => handleOpenDetail(op)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            #{op.op_id}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-700 truncate max-w-[180px]" title={op.cliente}>
                          {op.cliente}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 mb-0.5">
                          {op.material}
                        </span>
                        <div className="text-slate-500 truncate max-w-[200px]" title={op.descricao_item}>
                          {op.descricao_item}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-xs">
                        <span className="font-bold text-slate-900">
                          {op.quantidade_final_kg.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
                        </span>
                        <span className="text-slate-400 text-[10px] ml-1">kg</span>
                        {op.perda_real_pct > 0 && (
                          <div className={`text-[10px] ${op.perda_real_pct > 6 ? "text-rose-600 font-semibold" : "text-slate-400"}`}>
                            {op.perda_real_pct}% perda ({op.aparas_total_kg} kg)
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-xs">
                        <span className="font-semibold text-rose-700">
                          R$ {op.custo_real_por_kg.toFixed(2)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-xs">
                        <span className="font-bold text-slate-800">
                          R$ {op.preco_venda_kg.toFixed(2)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">
                        R$ {op.custo_total_fabricacao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-900 font-semibold">
                        R$ {op.receita_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs border ${badgeColor}`}>
                          {op.margem_lucro_pct >= 0 ? (
                            <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3 text-rose-600" />
                          )}
                          {op.margem_lucro_pct.toFixed(1)}%
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-xs">
                        <span
                          className={`font-bold ${
                            op.lucro_bruto >= 0 ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          R$ {op.lucro_bruto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenDetail(op)}
                          className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition-colors inline-flex items-center gap-1"
                          title="Ver Ficha Financeira Completa"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ficha
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: FICHA FINANCEIRA INDUSTRIAL DA OP & SIMULADOR */}
      {selectedOp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-6">
            {/* Cabeçalho */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs font-mono font-bold bg-indigo-100 text-indigo-800 rounded">
                    OP #{selectedOp.op_id}
                  </span>
                  <h3 className="font-bold text-slate-900 text-base">
                    Ficha de Custo Real & Rentabilidade
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedOp.cliente} • {selectedOp.descricao_item}
                </p>
              </div>
              <button
                onClick={() => setSelectedOp(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo da Ficha */}
            <div className="p-6 space-y-6">
              {/* KPIs de Topo da OP */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Volume Entregue</span>
                  <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                    {selectedOp.quantidade_final_kg.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} kg
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Aparas: {selectedOp.aparas_total_kg} kg ({selectedOp.perda_real_pct}%)
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Custo Real / Kg</span>
                  <div className="text-lg font-bold text-rose-700 font-mono mt-0.5">
                    R$ {selectedOp.custo_real_por_kg.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    MP + Operação + Perdas
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Preço Venda / Kg</span>
                  <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                    R$ {selectedOp.preco_venda_kg.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-indigo-600 font-medium">
                    Receita: R$ {selectedOp.receita_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div
                  className={`p-3 rounded-xl border ${
                    selectedOp.lucro_bruto >= 0
                      ? "bg-emerald-50/50 border-emerald-200 text-emerald-800"
                      : "bg-rose-50/50 border-rose-200 text-rose-800"
                  }`}
                >
                  <span className="text-[11px] font-semibold uppercase">Margem Líquida</span>
                  <div className="text-lg font-bold font-mono mt-0.5">
                    {selectedOp.margem_lucro_pct.toFixed(1)}%
                  </div>
                  <span className="text-[10px] font-semibold">
                    Lucro: R$ {selectedOp.lucro_bruto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* SIMULADOR DE PREÇO DE VENDA */}
              <div className="bg-indigo-50/40 border border-indigo-200 rounded-xl p-4">
                <form onSubmit={handleSavePrice} className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-indigo-900 uppercase mb-1">
                      Simular / Salvar Preço de Venda Praticado (R$/kg)
                    </label>
                    <div className="relative max-w-[200px]">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">
                        R$
                      </span>
                      <input
                        type="number"
                        step="0.10"
                        value={editPrecoVenda}
                        onChange={e => setEditPrecoVenda(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-sm font-mono font-bold bg-white border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={savingPrice}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {savingPrice ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Atualizar Preço da OP
                  </button>
                </form>
              </div>

              {/* DECOMPOSIÇÃO DO CUSTO */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-indigo-600" />
                  Decomposição Detalhada do Custo de Fabricação
                </h4>

                {/* Barra de Proporção */}
                {selectedOp.custo_total_fabricacao > 0 && (
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex text-[0px]">
                    <div
                      style={{
                        width: `${Math.min(
                          100,
                          (selectedOp.custo_total_materia_prima / selectedOp.custo_total_fabricacao) * 100
                        )}%`,
                      }}
                      className="bg-blue-500"
                      title="Matéria-Prima"
                    />
                    <div
                      style={{
                        width: `${Math.min(
                          100,
                          (selectedOp.custo_total_operacional / selectedOp.custo_total_fabricacao) * 100
                        )}%`,
                      }}
                      className="bg-indigo-500"
                      title="Operação (Máquinas + Homem)"
                    />
                    <div
                      style={{
                        width: `${Math.min(
                          100,
                          (selectedOp.custo_liquido_aparas / selectedOp.custo_total_fabricacao) * 100
                        )}%`,
                      }}
                      className="bg-amber-400"
                      title="Perdas / Aparas"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 border border-slate-200 rounded-lg bg-white">
                    <div className="flex items-center gap-1.5 text-blue-700 font-semibold mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                      Matéria-Prima & Insumos
                    </div>
                    <div className="text-base font-bold text-slate-900 font-mono">
                      R$ {selectedOp.custo_total_materia_prima.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      R$ {selectedOp.custo_materia_prima_kg.toFixed(2)}/kg • {selectedOp.material}
                    </div>
                  </div>

                  <div className="p-3 border border-slate-200 rounded-lg bg-white">
                    <div className="flex items-center gap-1.5 text-indigo-700 font-semibold mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                      Operacional (Máquina + Mão de Obra)
                    </div>
                    <div className="text-base font-bold text-slate-900 font-mono">
                      R$ {selectedOp.custo_total_operacional.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      Horas apontadas nos setores
                    </div>
                  </div>

                  <div className="p-3 border border-slate-200 rounded-lg bg-white">
                    <div className="flex items-center gap-1.5 text-amber-700 font-semibold mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                      Custo Líquido de Refugo
                    </div>
                    <div className="text-base font-bold text-slate-900 font-mono">
                      R$ {selectedOp.custo_liquido_aparas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      {selectedOp.aparas_total_kg} kg aparas (deduzido moagem)
                    </div>
                  </div>
                </div>
              </div>

              {/* DETALHAMENTO SETOR POR SETOR */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Detalhamento Operacional por Setor Fabril
                </h4>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2">Setor</th>
                        <th className="px-3 py-2 text-right">Kg Processados</th>
                        <th className="px-3 py-2 text-right">Horas</th>
                        <th className="px-3 py-2 text-right">Taxa Máq. (R$/h)</th>
                        <th className="px-3 py-2 text-right">Taxa MO (R$/h)</th>
                        <th className="px-3 py-2 text-right">Custo Máquina</th>
                        <th className="px-3 py-2 text-right">Custo Mão Obra</th>
                        <th className="px-3 py-2 text-right font-bold">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {selectedOp.detalhe_setores.map((det, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60">
                          <td className="px-3 py-2 font-sans font-bold text-slate-800">
                            {det.setor}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-700">
                            {det.kg_produzidos.toFixed(1)} kg
                          </td>
                          <td className="px-3 py-2 text-right text-indigo-700 font-semibold">
                            {det.horas_estimadas.toFixed(1)} h
                          </td>
                          <td className="px-3 py-2 text-right text-slate-500">
                            R$ {det.taxa_hora_maquina.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-500">
                            R$ {det.taxa_hora_homem.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-700">
                            R$ {det.custo_maquina.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-700">
                            R$ {det.custo_homem.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-slate-900 bg-slate-50/50">
                            R$ {det.subtotal_operacional.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Fórmula: Custo Real = (Matéria-Prima + Horas Máquina/Homem + Refugo) ÷ Kg Produzidos
              </span>
              <button
                type="button"
                onClick={() => setSelectedOp(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
