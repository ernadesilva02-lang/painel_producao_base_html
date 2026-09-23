import { useState, useMemo } from "react";
import {
  Layers,
  Printer,
  Edit3,
  Trash2,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Scale,
  Package,
  Tag,
} from "lucide-react";
import { PaleteRomaneio, Machine } from "../types/forpack";
import { printOfficialRomaneio } from "./PaleteRomaneioModal";
import { EtiquetaZebraModal } from "./EtiquetaBobinaZebra";

interface PaletesListViewProps {
  paletes: PaleteRomaneio[];
  machines: Machine[];
  onOpenPaleteModal: (palete: PaleteRomaneio | null, machine?: Machine | null) => void;
  onDeletePalete?: (paleteId: string) => Promise<void>;
  selectedSector?: string;
}

export function PaletesListView({
  paletes,
  machines,
  onOpenPaleteModal,
  onDeletePalete,
  selectedSector,
}: PaletesListViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"TODOS" | "ABERTO" | "FECHADO">("TODOS");
  const [machineFilter, setMachineFilter] = useState("TODAS");
  const [zebraPalete, setZebraPalete] = useState<PaleteRomaneio | null>(null);

  const filteredPaletes = useMemo(() => {
    const term = search.toLowerCase().trim();
    return paletes
      .filter((p) => {
        // Sector filter
        if (selectedSector && selectedSector !== "TODOS OS SETORES" && selectedSector !== "TODOS") {
          const mach = machines.find((m) => m.id === p.maquinaId);
          const machSector = (mach?.setor || p.setor || "").toUpperCase();
          if (machSector !== selectedSector.toUpperCase()) return false;
        }

        // Status filter
        if (statusFilter !== "TODOS" && p.status !== statusFilter) return false;

        // Machine filter
        if (machineFilter !== "TODAS" && p.maquinaId !== machineFilter) return false;

        // Text search
        if (!term) return true;
        const target = `${p.numeroPalete} ${p.numeroOp || ""} ${p.opId || ""} ${p.cliente} ${p.descricaoItem} ${p.operador} ${p.auxiliar || ""}`.toLowerCase();
        return target.includes(term);
      })
      .sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""));
  }, [paletes, machines, search, statusFilter, machineFilter, selectedSector]);

  // Aggregate metrics
  const totalVolumes = useMemo(
    () => filteredPaletes.reduce((sum, p) => sum + (p.totalVolumes || 0), 0),
    [filteredPaletes]
  );
  const totalKgLiquido = useMemo(
    () => filteredPaletes.reduce((sum, p) => sum + (p.pesoLiquidoTotal || 0), 0),
    [filteredPaletes]
  );
  const totalFechados = useMemo(
    () => filteredPaletes.filter((p) => p.status === "FECHADO").length,
    [filteredPaletes]
  );
  const totalAbertos = useMemo(
    () => filteredPaletes.filter((p) => p.status === "ABERTO").length,
    [filteredPaletes]
  );

  return (
    <div className="space-y-4">
      {/* BARRA DE FILTROS E PESQUISA DOS PALETES */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* SEARCH */}
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por Nº do palete, OP, cliente ou operador..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* STATUS FILTER TABS */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setStatusFilter("TODOS")}
              className={`px-3 py-1 rounded-md transition ${
                statusFilter === "TODOS"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Todos ({paletes.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("ABERTO")}
              className={`px-3 py-1 rounded-md transition flex items-center gap-1.5 ${
                statusFilter === "ABERTO"
                  ? "bg-amber-500 text-white shadow-2xs"
                  : "text-slate-600 hover:text-amber-700"
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>Em Montagem ({totalAbertos})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("FECHADO")}
              className={`px-3 py-1 rounded-md transition flex items-center gap-1.5 ${
                statusFilter === "FECHADO"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-emerald-700"
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Fechados ({totalFechados})</span>
            </button>
          </div>

          {/* MACHINE SELECTOR */}
          <select
            value={machineFilter}
            onChange={(e) => setMachineFilter(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
          >
            <option value="TODAS">Todas as Máquinas</option>
            {machines
              .filter((m) =>
                !selectedSector || selectedSector === "TODOS OS SETORES"
                  ? true
                  : m.setor.toUpperCase() === selectedSector.toUpperCase()
              )
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
        </div>

        {/* BOTÃO NOVO PALETE */}
        <button
          type="button"
          onClick={() => onOpenPaleteModal(null)}
          className="h-8.5 px-3.5 bg-[#1d68f2] hover:bg-[#1557d0] text-white rounded-md text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>+ Novo Palete</span>
        </button>
      </div>

      {/* METRIC STRIP DOS PALETES */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
            Paletes Registrados
          </span>
          <p className="text-xl font-bold text-slate-900 mt-0.5">
            {filteredPaletes.length} <span className="text-xs font-normal text-slate-400">paletes</span>
          </p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
            Bobinas / Volumes
          </span>
          <p className="text-xl font-bold text-slate-900 mt-0.5">
            {totalVolumes} <span className="text-xs font-normal text-slate-400">bobinas</span>
          </p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
            Produção Líquida Acabada
          </span>
          <p className="text-xl font-bold text-emerald-600 mt-0.5">
            {totalKgLiquido.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}{" "}
            <span className="text-xs font-semibold text-emerald-600">kg</span>
          </p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
            Status dos Paletes
          </span>
          <p className="text-xs font-semibold text-slate-700 mt-1 flex items-center gap-2">
            <span className="text-emerald-600 font-bold">{totalFechados} fechados</span>
            <span className="text-slate-300">·</span>
            <span className="text-amber-600 font-bold">{totalAbertos} em montagem</span>
          </p>
        </div>
      </div>

      {/* LISTA / TABELA DE PALETES */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {filteredPaletes.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Layers className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5]" />
            <p className="text-sm font-semibold text-slate-700">
              Nenhum palete encontrado
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Utilize o botão acima para iniciar a montagem de um novo palete de produto acabado com romaneio impresso.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Palete / Status</th>
                  <th className="py-3 px-4">Máquina & Data</th>
                  <th className="py-3 px-4">OP & Cliente</th>
                  <th className="py-3 px-4 text-center">Volumes</th>
                  <th className="py-3 px-4 text-right">Peso Bruto</th>
                  <th className="py-3 px-4 text-right">Peso Líquido</th>
                  <th className="py-3 px-4">Operador / Auxiliar</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPaletes.map((palete) => {
                  const isClosed = palete.status === "FECHADO";
                  return (
                    <tr
                      key={palete.id}
                      className="hover:bg-slate-50/80 transition-colors duration-150"
                    >
                      {/* PALETE & STATUS */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <strong className="text-xs font-bold text-slate-900 font-mono">
                            {palete.numeroPalete}
                          </strong>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              isClosed
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : "bg-amber-100 text-amber-800 border border-amber-200"
                            }`}
                          >
                            {isClosed ? "FECHADO" : "EM MONTAGEM"}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          ID: {palete.id.slice(-8)}
                        </span>
                      </td>

                      {/* MÁQUINA & DATA */}
                      <td className="py-3 px-4">
                        <span className="text-xs font-semibold text-slate-800 block">
                          {palete.maquinaNome || palete.maquinaId}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {palete.data
                            ? new Date(palete.data + "T12:00:00").toLocaleDateString("pt-BR")
                            : "—"}{" "}
                          · {palete.turno?.split(" ")[0] || "1º Turno"}
                        </span>
                      </td>

                      {/* OP & CLIENTE */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-blue-600">
                            OP #{palete.numeroOp || palete.numeroPedido || palete.opId}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-slate-900 block truncate" title={palete.cliente}>
                          {palete.cliente}
                        </span>
                        <span className="text-[11px] text-slate-500 block truncate" title={palete.descricaoItem}>
                          {palete.descricaoItem}
                        </span>
                      </td>

                      {/* VOLUMES */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-bold text-slate-800 font-mono">
                          <Package className="w-3 h-3 text-slate-500" />
                          <span>{palete.totalVolumes}</span>
                        </span>
                      </td>

                      {/* PESO BRUTO */}
                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        {palete.pesoBrutoTotal.toLocaleString("pt-BR", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}{" "}
                        kg
                      </td>

                      {/* PESO LÍQUIDO */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          {palete.pesoLiquidoTotal.toLocaleString("pt-BR", {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}{" "}
                          kg
                        </span>
                      </td>

                      {/* OPERADOR / AUXILIAR */}
                      <td className="py-3 px-4">
                        <span className="text-xs font-medium text-slate-800 block">
                          {palete.operador}
                        </span>
                        {palete.auxiliar && (
                          <span className="text-[10px] text-slate-500 block">
                            Aux: {palete.auxiliar}
                          </span>
                        )}
                      </td>

                      {/* AÇÕES */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* ETIQUETAS ZEBRA */}
                          <button
                            type="button"
                            onClick={() => setZebraPalete(palete)}
                            className="p-1.5 text-amber-700 hover:text-amber-800 hover:bg-amber-50 rounded-md border border-amber-200 transition cursor-pointer"
                            title="Emitir etiquetas térmicas Zebra para as bobinas deste palete"
                          >
                            <Tag className="w-4 h-4 text-amber-600" />
                          </button>

                          {/* IMPRIMIR ROMANEIO */}
                          <button
                            type="button"
                            onClick={() => printOfficialRomaneio(palete)}
                            className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-md border border-slate-200 transition cursor-pointer"
                            title="Imprimir Romaneio Oficial Forpack"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* EDITAR / CONTINUAR */}
                          <button
                            type="button"
                            onClick={() => onOpenPaleteModal(palete)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md border border-slate-200 transition cursor-pointer"
                            title={isClosed ? "Visualizar detalhes" : "Continuar pesagem"}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* EXCLUIR */}
                          {onDeletePalete && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Deseja realmente excluir o palete ${palete.numeroPalete}?`)) {
                                  onDeletePalete(palete.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                              title="Excluir palete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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

      {/* MODAL DE ETIQUETAS TÉRMICAS ZEBRA */}
      {zebraPalete && (
        <EtiquetaZebraModal
          isOpen={Boolean(zebraPalete)}
          onClose={() => setZebraPalete(null)}
          palete={zebraPalete}
          allBobinas={zebraPalete.itens.map((it) => ({
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
  );
}
