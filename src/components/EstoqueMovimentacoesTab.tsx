import React, { useState, useEffect, useMemo } from "react";
import {
  MovimentacaoEstoque,
  TipoMovimentoEstoque,
  Insumo,
} from "../types/forpack";
import {
  loadMovimentacoesEstoque,
  saveMovimentacaoEstoque,
  loadInsumos,
  saveInsumo,
} from "../services/supabaseApi";
import {
  History,
  TrendingUp,
  TrendingDown,
  Repeat,
  AlertCircle,
  FileCheck,
  Search,
  Filter,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Package,
  Calendar,
  RefreshCw,
  FileText,
  X,
} from "lucide-react";

interface EstoqueMovimentacoesTabProps {
  onShowNotification?: (msg: string, type: "success" | "error") => void;
}

export function EstoqueMovimentacoesTab({
  onShowNotification,
}: EstoqueMovimentacoesTabProps) {
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoEstoque[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("TODOS");

  // Modal de Nova Entrada / Movimento
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [novaMov, setNovaMov] = useState<{
    tipo_movimento: TipoMovimentoEstoque;
    insumo_id: string;
    quantidade: string;
    custo_unitario: string;
    documento_referencia: string;
    observacao: string;
  }>({
    tipo_movimento: "ENTRADA_COMPRA",
    insumo_id: "",
    quantidade: "",
    custo_unitario: "",
    documento_referencia: "",
    observacao: "",
  });

  const notify = (msg: string, type: "success" | "error" = "success") => {
    if (onShowNotification) onShowNotification(msg, type);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [movs, ins] = await Promise.all([
        loadMovimentacoesEstoque(150),
        loadInsumos(),
      ]);

      // Se não houver movimentações, criamos algumas iniciais para ilustrar o histórico de auditoria
      if (movs.length === 0 && ins.length > 0) {
        const seedMovs: Partial<MovimentacaoEstoque>[] = [
          {
            tipo_movimento: "ENTRADA_COMPRA",
            tipo_item: "INSUMO",
            item_id: ins[0]?.id,
            quantidade: 5000,
            custo_unitario: ins[0]?.custo_unitario_medio || 8.45,
            documento_referencia: "NF-89211 (BRASKEM)",
            observacao: "Recebimento lote de resina virgem",
          },
          {
            tipo_movimento: "CONSUMO_OP",
            tipo_item: "INSUMO",
            item_id: ins[0]?.id,
            op_id: "9544",
            setor: "EXTRUSÃO",
            quantidade: 420,
            custo_unitario: ins[0]?.custo_unitario_medio || 8.45,
            documento_referencia: "OP 9544",
            observacao: "Alimentação silo extrusora EF2",
          },
          {
            tipo_movimento: "RETORNO_APARA",
            tipo_item: "INSUMO",
            op_id: "9544",
            setor: "EXTRUSÃO",
            quantidade: 26.2,
            documento_referencia: "Apontamento EF2",
            observacao: "Aparas limpas para moagem interna",
          },
        ];

        try {
          const created: MovimentacaoEstoque[] = [];
          for (const s of seedMovs) {
            const res = await saveMovimentacaoEstoque(s);
            created.push(res);
          }
          setMovimentacoes(created);
        } catch (e) {
          setMovimentacoes([]);
        }
      } else {
        setMovimentacoes(movs);
      }

      setInsumos(ins);
      if (ins.length > 0) {
        setNovaMov(prev => ({
          ...prev,
          insumo_id: ins[0].id,
          custo_unitario: String(ins[0].custo_unitario_medio || ""),
        }));
      }
    } catch (err) {
      console.error(err);
      notify("Erro ao carregar movimentações.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const insumoMap = useMemo(() => {
    const map = new Map<string, Insumo>();
    insumos.forEach(i => map.set(i.id, i));
    return map;
  }, [insumos]);

  // Filtragem
  const filteredMovs = useMemo(() => {
    return movimentacoes.filter(m => {
      if (tipoFilter !== "TODOS" && m.tipo_movimento !== tipoFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const ins = m.item_id ? insumoMap.get(m.item_id) : null;
        const matchObs = (m.observacao || "").toLowerCase().includes(q);
        const matchDoc = (m.documento_referencia || "").toLowerCase().includes(q);
        const matchOp = (m.op_id || "").toLowerCase().includes(q);
        const matchItem = (ins?.nome || "").toLowerCase().includes(q);
        const matchCodigo = (ins?.codigo || "").toLowerCase().includes(q);
        return matchObs || matchDoc || matchOp || matchItem || matchCodigo;
      }
      return true;
    });
  }, [movimentacoes, tipoFilter, searchQuery, insumoMap]);

  // KPIs
  const stats = useMemo(() => {
    const totalEntradasKg = movimentacoes
      .filter(m => m.tipo_movimento === "ENTRADA_COMPRA")
      .reduce((sum, m) => sum + Number(m.quantidade || 0), 0);
    const totalConsumoKg = movimentacoes
      .filter(m => m.tipo_movimento === "CONSUMO_OP")
      .reduce((sum, m) => sum + Number(m.quantidade || 0), 0);
    const totalAparasKg = movimentacoes
      .filter(m => m.tipo_movimento === "RETORNO_APARA")
      .reduce((sum, m) => sum + Number(m.quantidade || 0), 0);
    const totalTransferencias = movimentacoes.filter(
      m => m.tipo_movimento === "TRANSFERENCIA_WIP"
    ).length;

    return {
      totalEntradasKg,
      totalConsumoKg,
      totalAparasKg,
      totalTransferencias,
      totalRegistros: movimentacoes.length,
    };
  }, [movimentacoes]);

  // Registrar movimentação e atualizar estoque do insumo
  const handleSaveMovimento = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtd = parseFloat(novaMov.quantidade);
    if (!qtd || qtd <= 0) {
      notify("Informe uma quantidade válida maior que zero.", "error");
      return;
    }

    const insumoTarget = insumos.find(i => i.id === novaMov.insumo_id);
    if (!insumoTarget && novaMov.tipo_movimento !== "TRANSFERENCIA_WIP") {
      notify("Selecione o insumo para movimentação.", "error");
      return;
    }

    setIsSaving(true);
    try {
      const custo = parseFloat(novaMov.custo_unitario) || (insumoTarget?.custo_unitario_medio || 0);

      // 1. Salvar movimentação
      const savedMov = await saveMovimentacaoEstoque({
        tipo_movimento: novaMov.tipo_movimento,
        tipo_item: "INSUMO",
        item_id: novaMov.insumo_id || null,
        quantidade: qtd,
        custo_unitario: custo,
        documento_referencia: novaMov.documento_referencia || null,
        observacao: novaMov.observacao || null,
      });

      // 2. Atualizar saldo do insumo na tabela `insumos`
      if (insumoTarget) {
        let novoEstoque = insumoTarget.estoque_atual;
        let novoCusto = insumoTarget.custo_unitario_medio;

        if (novaMov.tipo_movimento === "ENTRADA_COMPRA") {
          // Preço médio ponderado se for entrada
          const totalValorAntigo = insumoTarget.estoque_atual * insumoTarget.custo_unitario_medio;
          const totalValorNovo = qtd * custo;
          const estoqueFinal = insumoTarget.estoque_atual + qtd;
          novoCusto = estoqueFinal > 0 ? (totalValorAntigo + totalValorNovo) / estoqueFinal : custo;
          novoEstoque = estoqueFinal;
        } else if (novaMov.tipo_movimento === "CONSUMO_OP") {
          novoEstoque = Math.max(0, insumoTarget.estoque_atual - qtd);
        } else if (novaMov.tipo_movimento === "AJUSTE_INVENTARIO") {
          novoEstoque = qtd; // Ajuste define o novo valor físico
        }

        const updatedInsumo = await saveInsumo({
          ...insumoTarget,
          estoque_atual: novoEstoque,
          custo_unitario_medio: Math.round(novoCusto * 100) / 100,
        });

        // Atualiza estado local de insumos
        setInsumos(prev => prev.map(i => i.id === updatedInsumo.id ? updatedInsumo : i));
      }

      setMovimentacoes(prev => [savedMov, ...prev]);
      setShowModal(false);
      setNovaMov({
        tipo_movimento: "ENTRADA_COMPRA",
        insumo_id: insumos[0]?.id || "",
        quantidade: "",
        custo_unitario: String(insumos[0]?.custo_unitario_medio || ""),
        documento_referencia: "",
        observacao: "",
      });

      notify("Movimentação registrada e estoque atualizado com sucesso!");
    } catch (err: any) {
      notify(err.message || "Erro ao registrar movimentação.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* KPIs DE MOVIMENTAÇÃO */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white border border-emerald-200/80 rounded-2xl p-4 shadow-2xs bg-emerald-50/20 hover:shadow-xs transition">
          <div className="flex items-center justify-between text-xs text-emerald-700 font-semibold mb-1">
            <span>Entradas de Compras (NF)</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100/70 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4 text-emerald-700" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-800 tracking-tight mt-1">
            {stats.totalEntradasKg.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} <span className="text-xs font-semibold text-emerald-600">kg/L</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">Aquisições de insumos</div>
        </div>

        <div className="bg-white border border-blue-200/80 rounded-2xl p-4 shadow-2xs bg-blue-50/20 hover:shadow-xs transition">
          <div className="flex items-center justify-between text-xs text-blue-700 font-semibold mb-1">
            <span>Consumo em Produção</span>
            <div className="w-7 h-7 rounded-lg bg-blue-100/70 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-blue-700" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-800 tracking-tight mt-1">
            {stats.totalConsumoKg.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} <span className="text-xs font-semibold text-blue-600">kg</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">Baixas reais por OP</div>
        </div>

        <div className="bg-white border border-amber-200/80 rounded-2xl p-4 shadow-2xs bg-amber-50/20 hover:shadow-xs transition">
          <div className="flex items-center justify-between text-xs text-amber-700 font-semibold mb-1">
            <span>Retorno de Aparas</span>
            <div className="w-7 h-7 rounded-lg bg-amber-100/70 flex items-center justify-center">
              <Repeat className="w-4 h-4 text-amber-700" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-800 tracking-tight mt-1">
            {stats.totalAparasKg.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} <span className="text-xs font-semibold text-amber-600">kg</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">Aparas pesadas / moagem</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
            <span>Auditoria Total</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
              <History className="w-4 h-4 text-indigo-600" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 tracking-tight mt-1">
            {stats.totalRegistros} <span className="text-xs font-normal text-slate-500">lançamentos</span>
          </div>
          <div className="text-[11px] text-indigo-600 font-semibold mt-1">
            {stats.totalTransferencias} transferências WIP
          </div>
        </div>
      </div>

      {/* BARRA DE PESQUISA, FILTROS E AÇÃO */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar por NF, Insumo, OP ou Observação..."
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

            <select
              value={tipoFilter}
              onChange={e => setTipoFilter(e.target.value)}
              className="h-10 text-xs px-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer"
            >
              <option value="TODOS">Todos os Tipos de Movimento</option>
              <option value="ENTRADA_COMPRA">Entradas de Compras (NF)</option>
              <option value="CONSUMO_OP">Consumo em Ordens de Produção</option>
              <option value="TRANSFERENCIA_WIP">Transferências WIP (Bobinas)</option>
              <option value="RETORNO_APARA">Retorno de Aparas</option>
              <option value="AJUSTE_INVENTARIO">Ajuste de Inventário</option>
            </select>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="h-10 px-3 text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition border border-slate-200 flex items-center justify-center cursor-pointer shadow-2xs active:scale-95"
              title="Atualizar histórico"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Entrada / Ajuste</span>
          </button>
        </div>
      </div>

      {/* TABELA DE MOVIMENTAÇÕES AUDITÁVEIS */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-800">
              Livro de Movimentações & Rastreabilidade de Estoque
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {filteredMovs.length} registros listados
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
            Carregando movimentações do banco...
          </div>
        ) : filteredMovs.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-medium text-slate-700">Nenhuma movimentação encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100/75 text-slate-600 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Data / Hora</th>
                  <th className="px-4 py-3">Tipo Movimento</th>
                  <th className="px-4 py-3">Item / Insumo</th>
                  <th className="px-4 py-3">Quantidade</th>
                  <th className="px-4 py-3">Custo Unitário</th>
                  <th className="px-4 py-3">Referência / NF / OP</th>
                  <th className="px-4 py-3">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMovs.map(mov => {
                  const ins = mov.item_id ? insumoMap.get(mov.item_id) : null;

                  // Cores e ícone por tipo
                  const typeConfig: Record<
                    TipoMovimentoEstoque,
                    { label: string; bg: string; text: string; icon: React.ReactNode }
                  > = {
                    ENTRADA_COMPRA: {
                      label: "Entrada (Compra)",
                      bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
                      text: "text-emerald-700",
                      icon: <ArrowDownRight className="w-3.5 h-3.5" />,
                    },
                    CONSUMO_OP: {
                      label: "Consumo OP",
                      bg: "bg-blue-50 text-blue-700 border-blue-200",
                      text: "text-blue-700",
                      icon: <ArrowUpRight className="w-3.5 h-3.5" />,
                    },
                    TRANSFERENCIA_WIP: {
                      label: "Transferência WIP",
                      bg: "bg-purple-50 text-purple-700 border-purple-200",
                      text: "text-purple-700",
                      icon: <Repeat className="w-3.5 h-3.5" />,
                    },
                    RETORNO_APARA: {
                      label: "Retorno Apara",
                      bg: "bg-amber-50 text-amber-700 border-amber-200",
                      text: "text-amber-700",
                      icon: <Repeat className="w-3.5 h-3.5" />,
                    },
                    AJUSTE_INVENTARIO: {
                      label: "Ajuste Inventário",
                      bg: "bg-slate-100 text-slate-700 border-slate-200",
                      text: "text-slate-700",
                      icon: <FileCheck className="w-3.5 h-3.5" />,
                    },
                  };

                  const currentType = typeConfig[mov.tipo_movimento] || typeConfig.AJUSTE_INVENTARIO;

                  return (
                    <tr key={mov.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                        {mov.created_at
                          ? new Date(mov.created_at).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${currentType.bg}`}
                        >
                          {currentType.icon}
                          {currentType.label}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-xs">
                        {ins ? (
                          <div>
                            <div className="font-semibold text-slate-800">{ins.nome}</div>
                            <span className="text-[10px] font-mono text-slate-400">
                              {ins.codigo} • {ins.categoria}
                            </span>
                          </div>
                        ) : mov.tipo_item === "SEMIACABADO" ? (
                          <div className="font-semibold text-purple-800">
                            Bobina Semi-Acabada (WIP)
                          </div>
                        ) : (
                          <span className="text-slate-400">Geral / Produção</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs">
                        <span className="font-bold text-slate-900 text-sm">
                          {Number(mov.quantidade).toLocaleString("pt-BR", {
                            minimumFractionDigits: 1,
                          })}
                        </span>
                        <span className="text-slate-500 ml-1">
                          {ins ? ins.unidade_medida : "kg"}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-700">
                        {mov.custo_unitario && mov.custo_unitario > 0 ? (
                          <span className="font-medium">
                            R$ {Number(mov.custo_unitario).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs font-mono text-slate-700">
                        {mov.documento_referencia || (mov.op_id ? `OP #${mov.op_id}` : "—")}
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-600 max-w-[280px] truncate" title={mov.observacao || ""}>
                        {mov.observacao || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE NOVO LANÇAMENTO */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-800">
                  Registrar Movimentação de Estoque
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMovimento} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Tipo de Operação *
                </label>
                <select
                  value={novaMov.tipo_movimento}
                  onChange={e => setNovaMov({ ...novaMov, tipo_movimento: e.target.value as TipoMovimentoEstoque })}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-800"
                >
                  <option value="ENTRADA_COMPRA">Entrada de Compra (NF Fornecedor)</option>
                  <option value="CONSUMO_OP">Consumo Manual em Produção</option>
                  <option value="RETORNO_APARA">Retorno de Aparas Pesadas</option>
                  <option value="AJUSTE_INVENTARIO">Ajuste de Balanço Físico / Inventário</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Matéria-Prima / Insumo *
                </label>
                <select
                  value={novaMov.insumo_id}
                  onChange={e => {
                    const sel = insumos.find(i => i.id === e.target.value);
                    setNovaMov({
                      ...novaMov,
                      insumo_id: e.target.value,
                      custo_unitario: sel ? String(sel.custo_unitario_medio) : "",
                    });
                  }}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                >
                  {insumos.map(ins => (
                    <option key={ins.id} value={ins.id}>
                      {ins.nome} ({ins.codigo}) • Estoque Atual: {ins.estoque_atual} {ins.unidade_medida}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Quantidade *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={novaMov.quantidade}
                    onChange={e => setNovaMov({ ...novaMov, quantidade: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Custo Unitário (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={novaMov.custo_unitario}
                    onChange={e => setNovaMov({ ...novaMov, custo_unitario: e.target.value })}
                    placeholder="R$ 0,00"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Documento / Referência (NF, Pedido ou Lote)
                </label>
                <input
                  type="text"
                  value={novaMov.documento_referencia}
                  onChange={e => setNovaMov({ ...novaMov, documento_referencia: e.target.value })}
                  placeholder="Ex: NF-12499 (Braskem) ou Lote 8839"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Observações
                </label>
                <textarea
                  rows={2}
                  value={novaMov.observacao}
                  onChange={e => setNovaMov({ ...novaMov, observacao: e.target.value })}
                  placeholder="Informações adicionais para auditoria..."
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
                  Confirmar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
