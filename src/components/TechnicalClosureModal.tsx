import React, { useState, useEffect, useMemo } from "react";
import {
  Order,
  Production,
  Machine,
  Insumo,
  BobinaSemiAcabada,
  LaudoTecnico,
  SECTORS,
} from "../types/forpack";
import { orderBalance } from "../utils/formatters";
import { loadInsumos } from "../services/supabaseApi";
import {
  findMatchingInsumo,
  getOpWipBobinas,
  executeTechnicalClosure,
} from "../services/technicalClosureService";
import {
  ShieldCheck,
  CheckCircle2,
  FileText,
  Printer,
  PackageCheck,
  AlertTriangle,
  Layers,
  Scale,
  X,
  RefreshCw,
  Box,
  Award,
  ArrowRight,
  ChevronRight,
  Sparkles,
  Info,
  Check,
} from "lucide-react";

interface TechnicalClosureModalProps {
  order: Order;
  records: Production[];
  machines: Machine[];
  updatedAtSource?: string;
  onClose: () => void;
  onCompleted: (updatedOrder: Order) => void;
  onShowNotification?: (msg: string, type: "success" | "error") => void;
}

export function TechnicalClosureModal({
  order,
  records,
  machines,
  updatedAtSource,
  onClose,
  onCompleted,
  onShowNotification,
}: TechnicalClosureModalProps) {
  const isAlreadyFinished = order.statusProducao?.toUpperCase() === "FINALIZADO";
  const opLabel = order.numeroOp || order.numeroPedido || order.id;

  // Tabs de navegação interna do modal
  const [activeStep, setActiveStep] = useState<"auditoria" | "baixa" | "qualidade" | "laudo">(
    isAlreadyFinished ? "laudo" : "auditoria"
  );

  const balance = useMemo(() => orderBalance(order, records, machines), [order, records, machines]);

  // Estados de dados
  const [loadingContext, setLoadingContext] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [wipBobinas, setWipBobinas] = useState<BobinaSemiAcabada[]>([]);

  // Campos de Fechamento & Baixa
  const [responsavel, setResponsavel] = useState(order.fechamento?.responsavel || "Ernade Silva");
  const [observacao, setObservacao] = useState(order.fechamento?.observacao || "");

  const [darBaixaInsumo, setDarBaixaInsumo] = useState(true);
  const [selectedInsumoId, setSelectedInsumoId] = useState<string>("");
  const [quantidadeBaixaKg, setQuantidadeBaixaKg] = useState<number>(0);

  const [arquivarWips, setArquivarWips] = useState(true);

  // Sobra de chão de fábrica
  const [registrarSobra, setRegistrarSobra] = useState(false);
  const [sobraPesoKg, setSobraPesoKg] = useState<number>(25);
  const [sobraSetorOrigem, setSobraSetorOrigem] = useState<string>("CORTE");
  const [sobraSetorDestino, setSobraSetorDestino] = useState<string>("REBOBINADEIRA");
  const [sobraLarguraMm, setSobraLarguraMm] = useState<number>(500);
  const [sobraEspessuraMicras, setSobraEspessuraMicras] = useState<number>(60);

  // Campos do Laudo Técnico
  const existingLaudo = order.fechamento?.laudoTecnico;
  const [numeroLaudo, setNumeroLaudo] = useState(
    existingLaudo?.numeroLaudo || `LAUDO-${new Date().getFullYear()}-${opLabel.slice(-6).toUpperCase()}`
  );
  const [lote, setLote] = useState(existingLaudo?.lote || `LT-${new Date().getFullYear()}-${opLabel}`);
  const [inspetor, setInspetor] = useState(existingLaudo?.inspetor || "Ernade Silva");
  const [espessuraConferida, setEspessuraConferida] = useState<number | undefined>(
    existingLaudo?.espessuraConferidaMicras || 60
  );
  const [larguraConferida, setLarguraConferida] = useState<number | undefined>(
    existingLaudo?.larguraConferidaMm || 450
  );
  const [resistenciaSolda, setResistenciaSolda] = useState<"APROVADO" | "RESSALVA" | "REPROVADO">(
    existingLaudo?.resistenciaTracaoSolda || "APROVADO"
  );
  const [qualidadeImpressao, setQualidadeImpressao] = useState<"APROVADO" | "NAO_APLICAVEL" | "RESSALVA">(
    existingLaudo?.qualidadeImpressao || (order.material?.toUpperCase().includes("IMP") ? "APROVADO" : "NAO_APLICAVEL")
  );
  const [tratamentoCorona, setTratamentoCorona] = useState<number | undefined>(
    existingLaudo?.tratamentoCoronaDinas || 38
  );
  const [aparenciaGeral, setAparenciaGeral] = useState<"CONFORME" | "NAO_CONFORME">(
    existingLaudo?.aparenciaGeral || "CONFORME"
  );
  const [statusLiberacao, setStatusLiberacao] = useState<"LIBERADO" | "LIBERADO_COM_RESSALVA" | "REPROVADO">(
    existingLaudo?.statusLiberacao || "LIBERADO"
  );
  const [obsQualidade, setObsQualidade] = useState(existingLaudo?.observacoesQualidade || "");

  // Inicialização do contexto (insumos e bobinas WIP)
  useEffect(() => {
    let mounted = true;
    async function init() {
      setLoadingContext(true);
      try {
        const [loadedInsumos, loadedBobinas] = await Promise.all([
          loadInsumos().catch(() => []),
          getOpWipBobinas(order.id).catch(() => []),
        ]);

        if (!mounted) return;
        setInsumos(loadedInsumos);
        setWipBobinas(loadedBobinas);

        // Define insumo sugerido
        const matching = findMatchingInsumo(order.material, loadedInsumos);
        if (matching) {
          setSelectedInsumoId(matching.id);
        } else if (loadedInsumos.length > 0) {
          setSelectedInsumoId(loadedInsumos[0].id);
        }

        // Sugestão de quantidade de baixa:
        // Usa o peso inicial apontado (ex: extrusão), ou peso final + perdas, ou planejado
        const sugerido = balance.initial > 0 ? balance.initial : Number(order.quantidade || 0);
        setQuantidadeBaixaKg(Math.round(sugerido * 10) / 10);
      } finally {
        if (mounted) setLoadingContext(false);
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, [order.id, order.material, balance.initial, order.quantidade]);

  const selectedInsumo = useMemo(() => {
    return insumos.find(i => i.id === selectedInsumoId);
  }, [insumos, selectedInsumoId]);

  // Função para executar o fechamento
  const handleConfirmClosure = async () => {
    if (!responsavel.trim()) {
      if (onShowNotification) onShowNotification("Informe o responsável pelo fechamento.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const laudo: LaudoTecnico = {
        numeroLaudo,
        lote,
        dataEmissao: new Date().toISOString(),
        inspetor,
        espessuraConferidaMicras: espessuraConferida,
        larguraConferidaMm: larguraConferida,
        resistenciaTracaoSolda: resistenciaSolda,
        qualidadeImpressao: qualidadeImpressao,
        tratamentoCoronaDinas: tratamentoCorona,
        aparenciaGeral: aparenciaGeral,
        statusLiberacao: statusLiberacao,
        observacoesQualidade: obsQualidade.trim() || undefined,
      };

      const res = await executeTechnicalClosure({
        order,
        responsavel,
        observacao,
        pesoInicial: balance.initial,
        pesoFinal: balance.final,
        perdaReal: balance.realLoss,
        perdaDeclarada: balance.declaredLoss,
        divergencia: balance.divergence,
        aproveitamento: balance.yieldRate,
        darBaixaInsumo,
        insumoId: darBaixaInsumo ? selectedInsumoId : undefined,
        insumoNome: selectedInsumo ? selectedInsumo.nome : undefined,
        quantidadeBaixaKg: darBaixaInsumo ? quantidadeBaixaKg : 0,
        arquivarWips,
        wipIds: wipBobinas.map(b => b.id),
        registrarSobra,
        sobraPesoKg: registrarSobra ? sobraPesoKg : undefined,
        sobraSetorOrigem: registrarSobra ? sobraSetorOrigem : undefined,
        sobraSetorDestino: registrarSobra ? sobraSetorDestino : undefined,
        sobraLarguraMm: registrarSobra ? sobraLarguraMm : undefined,
        sobraEspessuraMicras: registrarSobra ? sobraEspessuraMicras : undefined,
        laudoTecnico: laudo,
        updatedAtSource,
      });

      if (onShowNotification) {
        onShowNotification(`Fechamento da OP #${opLabel} concluído com sucesso!`, "success");
      }
      onCompleted(res.order);
      setActiveStep("laudo");
    } catch (err: any) {
      console.error(err);
      if (onShowNotification) {
        onShowNotification("Erro ao concluir fechamento: " + (err.message || err), "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Impressão limpa do laudo / certificado
  const handlePrintCertificate = () => {
    const source = document.querySelector<HTMLElement>("[data-certificate-print]");
    if (!source) return alert("Não foi possível carregar a área do certificado.");

    const frame = document.createElement("iframe");
    frame.title = `Laudo Técnico - OP ${opLabel}`;
    Object.assign(frame.style, {
      position: "fixed",
      right: "0",
      bottom: "0",
      width: "1px",
      height: "1px",
      border: "0",
      opacity: "0",
    });
    document.body.appendChild(frame);

    const printWindow = frame.contentWindow;
    const printDoc = frame.contentDocument;
    if (!printWindow || !printDoc) {
      frame.remove();
      return alert("Navegador bloqueou a impressão.");
    }

    printDoc.open();
    printDoc.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Certificado de Expedição e Laudo Técnico - OP ${opLabel}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 11px; line-height: 1.4; }
    .cert-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px; }
    .cert-logo h1 { margin: 0; font-size: 18px; font-weight: 900; letter-spacing: -0.5px; }
    .cert-logo p { margin: 2px 0 0; font-size: 9px; color: #64748b; font-weight: 600; text-transform: uppercase; }
    .cert-badge { text-align: right; }
    .cert-badge strong { display: block; font-size: 14px; font-family: monospace; color: #1e293b; }
    .cert-badge span { font-size: 9px; color: #059669; font-weight: bold; }
    .cert-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 12px; }
    .cert-box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; background: #f8fafc; }
    .cert-box h3 { margin: 0 0 6px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
    .cert-box-content { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
    .field label { display: block; font-size: 8px; color: #64748b; text-transform: uppercase; font-weight: bold; }
    .field span { font-size: 11px; font-weight: bold; color: #0f172a; font-family: monospace; }
    .field span.normal { font-family: inherit; }
    .cert-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    .cert-table th { background: #f1f5f9; text-align: left; padding: 6px 8px; font-size: 9px; text-transform: uppercase; border: 1px solid #cbd5e1; color: #334155; }
    .cert-table td { padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 10px; }
    .cert-status-tag { display: inline-block; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 9px; }
    .cert-status-tag.liberado { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .signatures { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 30px; }
    .sig-line { border-top: 1px solid #94a3b8; text-align: center; padding-top: 5px; font-size: 9px; color: #475569; }
    .sig-line strong { display: block; font-size: 10px; color: #0f172a; }
  </style>
</head>
<body>
  ${source.innerHTML}
</body>
</html>`);
    printDoc.close();

    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      window.setTimeout(() => frame.remove(), 1000);
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-4 max-h-[92vh] flex flex-col">
        {/* HEADER DO MODAL */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-200">
                  OP #{opLabel}
                </span>
                <h3 className="text-base font-bold text-white">
                  Fechamento Técnico & Baixa Automática de Estoque
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[500px]">
                {order.cliente} • {order.descricaoItem} ({order.material})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NAVEGAÇÃO ENTRE ETAPAS DO FECHAMENTO */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 shrink-0 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveStep("auditoria")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeStep === "auditoria"
                ? "bg-slate-800 text-white"
                : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            1. Auditoria Física & Balanço
          </button>

          <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />

          <button
            onClick={() => setActiveStep("baixa")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeStep === "baixa"
                ? "bg-slate-800 text-white"
                : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            2. Baixa de Insumo & Bobinas WIP
          </button>

          <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />

          <button
            onClick={() => setActiveStep("qualidade")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeStep === "qualidade"
                ? "bg-slate-800 text-white"
                : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            3. Inspeção Técnica de Qualidade
          </button>

          <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />

          <button
            onClick={() => setActiveStep("laudo")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeStep === "laudo"
                ? "bg-indigo-600 text-white"
                : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            4. Certificado de Expedição & Laudo
          </button>
        </div>

        {/* CONTEÚDO SCROLLÁVEL */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loadingContext ? (
            <div className="p-12 text-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
              Carregando dados de estoque, bobinas WIP e apontamentos...
            </div>
          ) : (
            <>
              {/* ETAPA 1: AUDITORIA FÍSICA & BALANÇO DE MASSA */}
              {activeStep === "auditoria" && (
                <div className="space-y-6">
                  {/* Resumo em 4 Cards de Balanço */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">Volume Planejado</span>
                      <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                        {Number(order.quantidade || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1 })} kg
                      </div>
                      <span className="text-[10px] text-slate-400">Meta comercial</span>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">Volume Produzido</span>
                      <div className="text-xl font-bold font-mono text-indigo-700 mt-0.5">
                        {balance.final.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} kg
                      </div>
                      <span className="text-[10px] text-slate-500">
                        Extrusão: {balance.initial.toFixed(1)} kg
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">Perda Total Real</span>
                      <div className="text-xl font-bold font-mono text-rose-700 mt-0.5">
                        {balance.realLoss.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} kg
                      </div>
                      <span className="text-[10px] text-slate-500">
                        Declaradas: {balance.declaredLoss.toFixed(1)} kg
                      </span>
                    </div>

                    <div className="bg-emerald-50/60 border border-emerald-200 p-3.5 rounded-xl text-emerald-900">
                      <span className="text-[11px] font-bold uppercase">Rendimento Industrial</span>
                      <div className="text-xl font-bold font-mono mt-0.5">
                        {balance.yieldRate.toFixed(1)}%
                      </div>
                      <span className="text-[10px] text-emerald-700 font-medium">
                        {balance.divergence > 0.05 ? "Divergência detectada" : "Balanço 100% conferido"}
                      </span>
                    </div>
                  </div>

                  {/* Fluxo Setor por Setor */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                      <span>Fluxo Operacional de Massa por Setor</span>
                      <span className="text-slate-400 font-normal">{balance.steps.length} etapas registradas</span>
                    </h4>

                    {balance.steps.length === 0 ? (
                      <p className="text-xs text-slate-500 py-3 text-center">
                        Nenhum apontamento registrado para esta OP.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {balance.steps.map((step, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">{step.sector}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 font-semibold text-slate-700">
                                {step.count} apontamentos
                              </span>
                            </div>
                            <div className="text-sm font-bold font-mono text-indigo-900">
                              {step.produced.toFixed(1)} kg produzidos
                            </div>
                            <div className="text-[11px] text-rose-600">
                              Aparas/Picote: {step.loss.toFixed(1)} kg
                            </div>
                            {idx > 0 && (
                              <div
                                className={`text-[10px] font-semibold pt-1 border-t border-slate-200 ${
                                  Math.abs(step.difference) > 0.05 ? "text-amber-600" : "text-emerald-600"
                                }`}
                              >
                                {Math.abs(step.difference) > 0.05
                                  ? `Divergência: ${Math.abs(step.difference).toFixed(1)} kg`
                                  : "✓ Balanço alinhado com setor anterior"}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Responsável e Observações Gerais */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 border border-slate-200 p-4 rounded-xl">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Responsável pelo Fechamento Técnico *
                      </label>
                      <input
                        type="text"
                        value={responsavel}
                        onChange={e => setResponsavel(e.target.value)}
                        className="w-full text-xs font-medium px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Observações do Fechamento
                      </label>
                      <input
                        type="text"
                        value={observacao}
                        onChange={e => setObservacao(e.target.value)}
                        placeholder="Ex: Liberado com sobras registradas / lote aprovado"
                        className="w-full text-xs font-medium px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => setActiveStep("baixa")}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      Avançar para Baixa de Estoque
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ETAPA 2: BAIXA DE ESTOQUE & BOBINAS WIP */}
              {activeStep === "baixa" && (
                <div className="space-y-6">
                  {/* SEÇÃO A: BAIXA AUTOMÁTICA DE MATÉRIA-PRIMA */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="chkBaixaInsumo"
                          checked={darBaixaInsumo}
                          onChange={e => setDarBaixaInsumo(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                        />
                        <label htmlFor="chkBaixaInsumo" className="text-sm font-bold text-slate-900 cursor-pointer">
                          Realizar Baixa Automática de Matéria-Prima (Resina / Insumos)
                        </label>
                      </div>
                      <span className="text-xs text-slate-500">Módulo de Estoque Supabase</span>
                    </div>

                    {darBaixaInsumo && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                            Insumo a ser Baixado
                          </label>
                          <select
                            value={selectedInsumoId}
                            onChange={e => setSelectedInsumoId(e.target.value)}
                            className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          >
                            {insumos.map(i => (
                              <option key={i.id} value={i.id}>
                                [{i.codigo}] {i.nome} (Estoque: {i.estoque_atual.toFixed(0)} {i.unidade_medida})
                              </option>
                            ))}
                          </select>
                          {selectedInsumo && (
                            <p className="text-[11px] text-slate-500 mt-1">
                              Saldo Atual: <strong>{selectedInsumo.estoque_atual.toFixed(1)} kg</strong> • Custo Médio: R$ {selectedInsumo.custo_unitario_medio.toFixed(2)}/kg
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                            Quantidade a Baixar (Kg)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={quantidadeBaixaKg}
                            onChange={e => setQuantidadeBaixaKg(parseFloat(e.target.value) || 0)}
                            className="w-full text-xs font-mono font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                          {selectedInsumo && (
                            <p className="text-[11px] text-indigo-700 font-semibold mt-1">
                              Saldo Projetado após Baixa: {(selectedInsumo.estoque_atual - quantidadeBaixaKg).toFixed(1)} kg
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SEÇÃO B: BOBINAS WIP VINCULADAS À OP */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-600" />
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Bobinas Semi-Acabadas (WIP) da OP ({wipBobinas.length})
                        </h4>
                      </div>
                      {wipBobinas.length > 0 && (
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={arquivarWips}
                            onChange={e => setArquivarWips(e.target.checked)}
                            className="rounded text-indigo-600"
                          />
                          Marcar bobinas como CONSUMIDAS ao fechar
                        </label>
                      )}
                    </div>

                    {wipBobinas.length === 0 ? (
                      <p className="text-xs text-slate-500 py-2">
                        Nenhuma bobina semi-acabada cadastrada especificamente para a OP #{opLabel}.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
                        {wipBobinas.map(b => (
                          <div key={b.id} className="p-2.5 flex items-center justify-between text-xs bg-slate-50/50">
                            <div>
                              <span className="font-mono font-bold text-slate-900 mr-2">{b.numero_bobina}</span>
                              <span className="text-slate-500">{b.setor_origem} → {b.setor_destino || "CORTE"}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-slate-800">{b.peso_liquido_kg} kg</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                                {b.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* SEÇÃO C: SOBRA PARCIAL DE CHÃO DE FÁBRICA */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="chkSobra"
                          checked={registrarSobra}
                          onChange={e => setRegistrarSobra(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                        />
                        <label htmlFor="chkSobra" className="text-xs font-bold text-slate-800 cursor-pointer">
                          Registrar Devolução de Sobra de Bobina ao Pátio WIP
                        </label>
                      </div>
                      <span className="text-[11px] text-slate-500">Aproveitamento de retalho/bobina parcial</span>
                    </div>

                    {registrarSobra && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Peso da Sobra (Kg) *
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            value={sobraPesoKg}
                            onChange={e => setSobraPesoKg(parseFloat(e.target.value) || 0)}
                            className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Setor Origem
                          </label>
                          <select
                            value={sobraSetorOrigem}
                            onChange={e => setSobraSetorOrigem(e.target.value)}
                            className="w-full px-2 py-1.5 font-medium bg-slate-50 border border-slate-200 rounded-lg"
                          >
                            {SECTORS.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Setor Destino
                          </label>
                          <select
                            value={sobraSetorDestino}
                            onChange={e => setSobraSetorDestino(e.target.value)}
                            className="w-full px-2 py-1.5 font-medium bg-slate-50 border border-slate-200 rounded-lg"
                          >
                            {SECTORS.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Largura (mm)
                          </label>
                          <input
                            type="number"
                            value={sobraLarguraMm}
                            onChange={e => setSobraLarguraMm(parseInt(e.target.value, 10) || 0)}
                            className="w-full px-2.5 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded-lg"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <button
                      onClick={() => setActiveStep("auditoria")}
                      className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 text-xs font-bold rounded-lg transition-colors"
                    >
                      ← Voltar para Auditoria
                    </button>
                    <button
                      onClick={() => setActiveStep("qualidade")}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      Avançar para Qualidade & Laudo
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ETAPA 3: INSPEÇÃO TÉCNICA DE QUALIDADE */}
              {activeStep === "qualidade" && (
                <div className="space-y-6">
                  <div className="bg-indigo-50/40 border border-indigo-200 rounded-xl p-4 flex items-center gap-3">
                    <Award className="w-5 h-5 text-indigo-600 shrink-0" />
                    <div className="text-xs text-indigo-900">
                      <strong>Certificação Técnica e Liberação de Lote:</strong> Estes parâmetros farão parte
                      do Laudo Técnico Oficial e do Certificado de Expedição para o cliente.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Nº do Laudo Técnico
                      </label>
                      <input
                        type="text"
                        value={numeroLaudo}
                        onChange={e => setNumeroLaudo(e.target.value)}
                        className="w-full px-3 py-2 font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Lote de Fabricação
                      </label>
                      <input
                        type="text"
                        value={lote}
                        onChange={e => setLote(e.target.value)}
                        className="w-full px-3 py-2 font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Inspetor da Qualidade *
                      </label>
                      <input
                        type="text"
                        value={inspetor}
                        onChange={e => setInspetor(e.target.value)}
                        className="w-full px-3 py-2 font-semibold bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Parâmetros Dimensionais e Testes */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-4">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Ensaios e Parâmetros Dimensionais
                    </h4>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">Espessura (Micras)</label>
                        <input
                          type="number"
                          value={espessuraConferida || ""}
                          onChange={e => setEspessuraConferida(parseFloat(e.target.value) || undefined)}
                          placeholder="Ex: 60"
                          className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">Largura (mm)</label>
                        <input
                          type="number"
                          value={larguraConferida || ""}
                          onChange={e => setLarguraConferida(parseFloat(e.target.value) || undefined)}
                          placeholder="Ex: 450"
                          className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">Trat. Corona (Dinas)</label>
                        <input
                          type="number"
                          value={tratamentoCorona || ""}
                          onChange={e => setTratamentoCorona(parseFloat(e.target.value) || undefined)}
                          placeholder="Ex: 38"
                          className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">Resistência / Solda</label>
                        <select
                          value={resistenciaSolda}
                          onChange={e => setResistenciaSolda(e.target.value as any)}
                          className="w-full px-2 py-1.5 font-semibold bg-slate-50 border border-slate-200 rounded-lg"
                        >
                          <option value="APROVADO">APROVADO</option>
                          <option value="RESSALVA">COM RESSALVA</option>
                          <option value="REPROVADO">REPROVADO</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-slate-100">
                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">Impressão / Registro</label>
                        <select
                          value={qualidadeImpressao}
                          onChange={e => setQualidadeImpressao(e.target.value as any)}
                          className="w-full px-2 py-1.5 font-semibold bg-slate-50 border border-slate-200 rounded-lg"
                        >
                          <option value="APROVADO">APROVADO / CONFORME</option>
                          <option value="NAO_APLICAVEL">NÃO SE APLICA (LISO)</option>
                          <option value="RESSALVA">COM RESSALVA</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">Aparência Geral</label>
                        <select
                          value={aparenciaGeral}
                          onChange={e => setAparenciaGeral(e.target.value as any)}
                          className="w-full px-2 py-1.5 font-semibold bg-slate-50 border border-slate-200 rounded-lg"
                        >
                          <option value="CONFORME">CONFORME (SEM BOLHAS/RUGAS)</option>
                          <option value="NAO_CONFORME">NÃO CONFORME</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">Status de Liberação Final</label>
                        <select
                          value={statusLiberacao}
                          onChange={e => setStatusLiberacao(e.target.value as any)}
                          className={`w-full px-2 py-1.5 font-bold rounded-lg border ${
                            statusLiberacao === "LIBERADO"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : statusLiberacao === "LIBERADO_COM_RESSALVA"
                              ? "bg-amber-50 text-amber-800 border-amber-300"
                              : "bg-rose-50 text-rose-800 border-rose-300"
                          }`}
                        >
                          <option value="LIBERADO">LIBERADO PARA EXPEDIÇÃO</option>
                          <option value="LIBERADO_COM_RESSALVA">LIBERADO COM RESSALVA</option>
                          <option value="REPROVADO">REPROVADO / LOTE BLOQUEADO</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Parecer Técnico da Qualidade
                      </label>
                      <textarea
                        rows={2}
                        value={obsQualidade}
                        onChange={e => setObsQualidade(e.target.value)}
                        placeholder="Ex: Produto aprovado conforme especificações do cliente. Teste de tração e solda atendendo aos requisitos da norma interna."
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* AÇÕES DE FINALIZAÇÃO */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
                    <button
                      onClick={() => setActiveStep("baixa")}
                      className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 text-xs font-bold rounded-lg transition-colors w-full sm:w-auto"
                    >
                      ← Voltar para Baixa
                    </button>

                    <button
                      onClick={handleConfirmClosure}
                      disabled={submitting || !responsavel.trim()}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-colors w-full sm:w-auto"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Processando Fechamento & Baixa...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Concluir Fechamento Técnico & Salvar Laudo
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* ETAPA 4: CERTIFICADO DE EXPEDIÇÃO & LAUDO TÉCNICO OFICIAL */}
              {activeStep === "laudo" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <span>Visualização do Laudo Técnico Oficial da OP #{opLabel}</span>
                    </div>

                    <button
                      onClick={handlePrintCertificate}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
                    >
                      <Printer className="w-4 h-4" />
                      Imprimir Laudo Técnico A4
                    </button>
                  </div>

                  {/* DOCUMENTO OFICIAL FORMATADO PARA IMPRESSÃO E VISUALIZAÇÃO */}
                  <div
                    data-certificate-print
                    className="bg-white border-2 border-slate-800 rounded-xl p-6 sm:p-8 shadow-sm space-y-6 text-slate-900 max-w-3xl mx-auto"
                  >
                    {/* CABEÇALHO DO LAUDO */}
                    <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
                      <div>
                        <h1 className="text-xl font-black tracking-tight text-slate-900">
                          FORPACK INDÚSTRIA DE EMBALAGENS
                        </h1>
                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                          Controle de Qualidade & Certificado de Expedição Industrial
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="block text-xs font-mono font-bold text-slate-900">
                          {numeroLaudo}
                        </span>
                        <span className="inline-block mt-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          ✓ LOTE LIBERADO
                        </span>
                      </div>
                    </div>

                    {/* DADOS GERAIS DO PEDIDO */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
                      <div>
                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Ordem de Produção</span>
                        <strong className="font-mono text-sm">#{opLabel}</strong>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Lote Industrial</span>
                        <strong className="font-mono text-sm">{lote}</strong>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Data do Laudo</span>
                        <strong className="text-xs">{new Date().toLocaleDateString("pt-BR")}</strong>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Inspetor Responsável</span>
                        <strong className="text-xs">{inspetor}</strong>
                      </div>
                    </div>

                    {/* DADOS DO CLIENTE E PRODUTO */}
                    <div className="border border-slate-200 rounded-lg p-3.5 space-y-2 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">Cliente</span>
                          <strong className="text-sm text-slate-900">{order.cliente}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">Material</span>
                          <strong className="text-sm font-mono text-slate-900">{order.material}</strong>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Descrição do Item</span>
                        <p className="text-xs text-slate-700 font-medium">{order.descricaoItem}</p>
                      </div>
                    </div>

                    {/* BALANÇO DE PESOS */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                      <div className="bg-slate-100 px-3 py-2 font-bold uppercase text-[10px] text-slate-600 border-b border-slate-200">
                        Balanço Físico de Expedição
                      </div>
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                          <tr>
                            <th className="px-3 py-1.5">Qtd Planejada</th>
                            <th className="px-3 py-1.5">Qtd Final Produzida</th>
                            <th className="px-3 py-1.5">Refugo Total</th>
                            <th className="px-3 py-1.5">Aproveitamento</th>
                          </tr>
                        </thead>
                        <tbody className="font-mono">
                          <tr>
                            <td className="px-3 py-2">{Number(order.quantidade || 0).toFixed(1)} kg</td>
                            <td className="px-3 py-2 font-bold text-slate-900">{balance.final.toFixed(1)} kg</td>
                            <td className="px-3 py-2 text-rose-700">{balance.realLoss.toFixed(1)} kg</td>
                            <td className="px-3 py-2 font-bold text-emerald-700">{balance.yieldRate.toFixed(1)}%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* RESULTADOS DOS ENSAIOS TÉCNICOS */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                      <div className="bg-slate-100 px-3 py-2 font-bold uppercase text-[10px] text-slate-600 border-b border-slate-200">
                        Ensaios Laboratoriais & Conformidade Dimensional
                      </div>
                      <div className="p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-2 bg-slate-50 rounded border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">Espessura</span>
                          <span className="font-mono font-bold text-slate-900">{espessuraConferida || "—"} µm</span>
                        </div>

                        <div className="p-2 bg-slate-50 rounded border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">Largura</span>
                          <span className="font-mono font-bold text-slate-900">{larguraConferida || "—"} mm</span>
                        </div>

                        <div className="p-2 bg-slate-50 rounded border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">Tratamento Corona</span>
                          <span className="font-mono font-bold text-slate-900">{tratamentoCorona || "—"} Dinas</span>
                        </div>

                        <div className="p-2 bg-slate-50 rounded border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">Resistência Solda</span>
                          <span className="font-bold text-emerald-700">{resistenciaSolda}</span>
                        </div>
                      </div>

                      <div className="px-3.5 pb-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-2 bg-slate-50 rounded border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">Impressão</span>
                          <span className="font-bold text-slate-800">{qualidadeImpressao}</span>
                        </div>

                        <div className="p-2 bg-slate-50 rounded border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">Aparência Visual</span>
                          <span className="font-bold text-slate-800">{aparenciaGeral}</span>
                        </div>
                      </div>

                      {obsQualidade && (
                        <div className="px-3.5 pb-3.5 text-xs text-slate-600 bg-slate-50/50 border-t border-slate-100 pt-2">
                          <span className="font-bold text-slate-700">Parecer Técnico:</span> {obsQualidade}
                        </div>
                      )}
                    </div>

                    {/* ASSINATURAS */}
                    <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
                      <div className="border-t border-slate-400 pt-2">
                        <strong className="block text-slate-900">{inspetor}</strong>
                        <span className="text-[10px] text-slate-500 uppercase">Controle de Qualidade & PCP</span>
                      </div>

                      <div className="border-t border-slate-400 pt-2">
                        <strong className="block text-slate-900">Expedição / Logística</strong>
                        <span className="text-[10px] text-slate-500 uppercase">Recebido para Despacho</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* RODAPÉ GERAL */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            Forpack Industrial • Gestão Integrada de PCP, Estoque e Qualidade
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
