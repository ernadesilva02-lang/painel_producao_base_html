import React, { useState, useMemo } from "react";
import {
  Printer,
  X,
  Tag,
  Copy,
  Check,
  RotateCcw,
  Sliders,
  Layers,
  Sparkles,
  FileCode,
  Eye,
  AlertCircle,
} from "lucide-react";
import { Order, ItemPaleteRomaneio, PaleteRomaneio } from "../types/forpack";

export interface EtiquetaZebraData {
  tipoFilme: string;      // Ex: "FILME PEBD LISO"
  aplicacao: string;      // Ex: "P/ POLPAS DE FRUTA"
  medidas: string;        // Ex: "30x0,08"
  dataImpressao: string;  // Ex: "22/09/2026"
  tamanhoEtiqueta: "43x24" | "60x40" | "70x50" | "100x50" | "custom";
  larguraMm?: number;     // Ex: 43
  alturaMm?: number;      // Ex: 24
  orientacao: "horizontal" | "vertical" | "rotacionada_90"; // horizontal padrão da fábrica
  formatoRolo: "1_coluna" | "2_colunas"; // Rolo de 1 coluna ou 2 colunas lado a lado (pistas duplas)
  imprimirPesos: boolean; // Se true imprime "40.0 / 43.4", se false imprime "_____ / _____"
  incluirIdentificacaoOp?: boolean; // OP #9479 · BOBINA #01
  codigoOp?: string;
  numeroPalete?: string;
}

export interface EtiquetaBobinaItem {
  posicao: number;
  codigoBobina?: string;
  pesoBruto: number;
  tara: number;
  pesoLiquido: number;
  horario?: string;
}

/**
 * Utilitário para deduzir campos da etiqueta a partir da OP ou Palete
 */
export function inferEtiquetaZebraData(
  order: Order | null | undefined,
  palete?: PaleteRomaneio | null
): EtiquetaZebraData {
  const desc = (order?.descricaoItem || palete?.descricaoItem || "FILME PEBD LISO").trim();
  const mat = (order?.material || "").trim();
  const obs = (order?.observacao || palete?.observacoes || "").trim();

  // Tenta extrair dimensões como 30x0,08 ou 30x0.08 ou 30 x 0,08 ou 400x0,060
  const dimMatch = desc.match(/(\d+(?:[.,]\d+)?\s*[xX*]\s*\d+(?:[.,]\d+)?)/);
  const medidas = dimMatch ? dimMatch[1].replace(/\s+/g, "") : "30x0,08";

  // Aplicação: busca "P/ ...", "PARA ...", ou cliente
  let aplicacao = "P/ POLPAS DE FRUTA";
  if (obs.toUpperCase().includes("POLPA") || desc.toUpperCase().includes("POLPA")) {
    aplicacao = "P/ POLPAS DE FRUTA";
  } else if (desc.match(/[pP]\/\s*([^,.\n]+)/)) {
    const match = desc.match(/[pP]\/\s*([^,.\n]+)/);
    if (match) aplicacao = `P/ ${match[1].trim().toUpperCase()}`;
  } else if (order?.cliente && order.cliente !== "Cliente Forpack") {
    aplicacao = `P/ ${order.cliente.toUpperCase()}`;
  }

  // Tipo de filme
  let tipoFilme = "FILME PEBD LISO";
  if (mat) {
    tipoFilme = mat.toUpperCase();
    if (!tipoFilme.includes("FILME")) tipoFilme = `FILME ${tipoFilme}`;
  } else if (desc.toUpperCase().includes("PEBD")) {
    tipoFilme = "FILME PEBD LISO";
  } else if (desc) {
    // Pega a primeira parte antes das medidas
    const parts = desc.split(/[0-9]/);
    tipoFilme = (parts[0] || "FILME PEBD LISO").trim().toUpperCase();
  }

  // Data formatada DD/MM/AAAA
  const rawDate = palete?.data || order?.data || new Date().toISOString().slice(0, 10);
  const [year, month, day] = rawDate.split("-");
  const dataFormatada = year && month && day ? `${day}/${month}/${year}` : new Date().toLocaleDateString("pt-BR");

  return {
    tipoFilme: tipoFilme || "FILME PEBD LISO",
    aplicacao: aplicacao || "P/ POLPAS DE FRUTA",
    medidas: medidas || "30x0,08",
    dataImpressao: dataFormatada,
    tamanhoEtiqueta: "43x24", // 4,30 cm x 2,40 cm - Padrão Real da Fábrica Forpack
    larguraMm: 43,
    alturaMm: 24,
    orientacao: "horizontal",
    formatoRolo: "1_coluna",
    imprimirPesos: true,
    incluirIdentificacaoOp: true,
    codigoOp: order?.numeroOp || order?.numeroPedido || palete?.numeroOp || "",
    numeroPalete: palete?.numeroPalete || "",
  };
}

/**
 * Função de impressão direta da Etiqueta Térmica Zebra via janela/iframe do navegador
 * Configurada para o formato 43x24mm (4,30 x 2,40 cm) na Horizontal (Paisagem)
 */
export function printEtiquetasZebra(
  itens: EtiquetaBobinaItem[],
  config: EtiquetaZebraData
) {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.top = "-9999px";
  frame.style.left = "-9999px";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "none";
  document.body.appendChild(frame);

  const printWindow = frame.contentWindow;
  if (!printWindow) {
    alert("Não foi possível abrir o serviço de impressão da etiqueta.");
    frame.remove();
    return;
  }

  const printDoc = printWindow.document;
  printDoc.open();

  // Dimensões CSS de acordo com o tamanho selecionado
  const dimensionsMap: Record<
    string,
    { widthMm: number; heightMm: number; padding: string }
  > = {
    "43x24": { widthMm: 43, heightMm: 24, padding: "1mm 1.5mm" },
    "60x40": { widthMm: 60, heightMm: 40, padding: "2mm 3mm" },
    "70x50": { widthMm: 70, heightMm: 50, padding: "2.5mm 3.5mm" },
    "100x50": { widthMm: 100, heightMm: 50, padding: "3mm 4mm" },
    "custom": {
      widthMm: config.larguraMm || 43,
      heightMm: config.alturaMm || 24,
      padding: "1mm 1.5mm",
    },
  };

  const dimBase = dimensionsMap[config.tamanhoEtiqueta] || dimensionsMap["43x24"];
  const is2Col = config.formatoRolo === "2_colunas";
  const isRotated90 = config.orientacao === "rotacionada_90";
  const isVertical = config.orientacao === "vertical";

  // Largura e altura da página
  const singleWidthMm = dimBase.widthMm;
  const singleHeightMm = dimBase.heightMm;

  let pageWidthMm = is2Col ? singleWidthMm * 2 + 2 : singleWidthMm;
  let pageHeightMm = singleHeightMm;

  if (isVertical) {
    pageWidthMm = singleHeightMm;
    pageHeightMm = is2Col ? singleWidthMm * 2 + 2 : singleWidthMm;
  }

  const pageSizeStyle = `${pageWidthMm}mm ${pageHeightMm}mm`;

  // Se a lista estiver vazia (ex: impressão prévia em branco)
  const baseItens: EtiquetaBobinaItem[] =
    itens.length > 0
      ? itens
      : [
          {
            posicao: 1,
            pesoBruto: 0,
            tara: 1.6,
            pesoLiquido: 0,
          },
        ];

  // Helper para renderizar 1 etiqueta individual
  const renderCardHtml = (item: EtiquetaBobinaItem | null) => {
    if (!item) {
      return `<div class="etiqueta-zebra-card vazio" style="width: ${singleWidthMm}mm; height: ${singleHeightMm}mm; visibility: hidden;"></div>`;
    }

    const pesoStr =
      config.imprimirPesos && item.pesoBruto > 0
        ? `${item.pesoBruto.toFixed(1)} / ${item.pesoLiquido.toFixed(1)}`
        : `_____ / _____`;

    const isSmall = singleWidthMm <= 50 || singleHeightMm <= 30;

    return `
    <div class="etiqueta-zebra-card ${isRotated90 ? "rot-90" : ""}" style="width: ${singleWidthMm}mm; height: ${singleHeightMm}mm; padding: ${dimBase.padding};">
      <div class="header-group">
        <div class="line-material ${isSmall ? "text-compact-mat" : ""}">${config.tipoFilme}</div>
        <div class="line-aplicacao ${isSmall ? "text-compact-app" : ""}">${config.aplicacao}</div>
        <div class="line-medidas ${isSmall ? "text-compact-med" : ""}">${config.medidas}</div>
      </div>

      <div class="line-peso ${isSmall ? "text-compact-peso" : ""}">
        <span class="peso-label">PESO:</span>
        ${
          config.imprimirPesos && item.pesoBruto > 0
            ? `<span class="peso-values">${pesoStr}</span>`
            : `<span class="peso-blank">${pesoStr}</span>`
        }
      </div>

      <div class="footer-group">
        <div class="line-footer">
          <span class="footer-data ${isSmall ? "text-compact-dt" : ""}">DT: ${config.dataImpressao}</span>
          <div class="footer-logo">
            <span class="footer-logo-circle ${isSmall ? "logo-circle-sm" : ""}">f</span>
            <span class="footer-logo-name ${isSmall ? "logo-name-sm" : ""}">Forpack</span>
          </div>
        </div>
        ${
          config.incluirIdentificacaoOp && (config.codigoOp || item.codigoBobina)
            ? `<div class="trace-line ${isSmall ? "trace-line-sm" : ""}">OP #${config.codigoOp || "—"} · ${item.codigoBobina || `BOB #${item.posicao}`} ${config.numeroPalete ? `· ${config.numeroPalete}` : ""}</div>`
            : ""
        }
      </div>
    </div>`;
  };

  // Se for 2 colunas, agrupamos os itens de 2 em 2
  let bodyContent = "";
  if (is2Col) {
    for (let i = 0; i < baseItens.length; i += 2) {
      const item1 = baseItens[i];
      const item2 = baseItens[i + 1] || null;
      bodyContent += `
      <div class="etiqueta-page-row" style="width: ${pageWidthMm}mm; height: ${pageHeightMm}mm;">
        ${renderCardHtml(item1)}
        <div class="col-gap" style="width: 2mm;"></div>
        ${renderCardHtml(item2)}
      </div>`;
    }
  } else {
    bodyContent = baseItens
      .map((item) => `<div class="etiqueta-page-single" style="width: ${pageWidthMm}mm; height: ${pageHeightMm}mm;">${renderCardHtml(item)}</div>`)
      .join("");
  }

  printDoc.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Etiqueta Bobina 43x24mm - Forpack</title>
  <style>
    @page {
      size: ${pageSizeStyle};
      margin: 0;
    }
    @media print {
      @page {
        size: ${pageSizeStyle};
        margin: 0;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: ${pageWidthMm}mm !important;
        height: ${pageHeightMm}mm !important;
      }
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .etiqueta-page-single {
      page-break-after: always;
      break-after: page;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .etiqueta-page-single:last-child {
      page-break-after: avoid;
      break-after: avoid;
    }
    .etiqueta-page-row {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
    }
    .etiqueta-page-row:last-child {
      page-break-after: avoid;
      break-after: avoid;
    }
    .etiqueta-zebra-card {
      box-sizing: border-box;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      text-align: center;
      position: relative;
      background: #fff;
    }
    .etiqueta-zebra-card.rot-90 {
      transform: rotate(90deg);
      transform-origin: center center;
    }
    .header-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: 0.5px;
    }
    .line-material {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.1px;
      text-transform: uppercase;
      line-height: 1.05;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
    .text-compact-mat {
      font-size: 8.5px !important;
      font-weight: 900 !important;
      line-height: 1 !important;
    }
    .line-aplicacao {
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      line-height: 1.05;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
    .text-compact-app {
      font-size: 7.2px !important;
      font-weight: 800 !important;
      line-height: 1 !important;
    }
    .line-medidas {
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.3px;
      line-height: 1.05;
      margin-top: 0.5px;
    }
    .text-compact-med {
      font-size: 9.2px !important;
      font-weight: 900 !important;
      line-height: 1 !important;
      letter-spacing: 0.2px !important;
    }
    .line-peso {
      font-size: 9.5px;
      font-weight: 800;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 3px;
      margin: 0.5px 0;
    }
    .text-compact-peso {
      font-size: 8px !important;
      line-height: 1 !important;
    }
    .line-peso .peso-label {
      font-weight: 900;
    }
    .line-peso .peso-values {
      font-size: 1.05em;
      font-weight: 900;
      font-family: Arial, monospace;
      letter-spacing: 0.2px;
    }
    .line-peso .peso-blank {
      font-size: 0.95em;
      letter-spacing: 0.5px;
      font-weight: bold;
    }
    .footer-group {
      display: flex;
      flex-direction: column;
      width: 100%;
    }
    .line-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      width: 100%;
      padding-top: 0.5px;
      line-height: 1;
    }
    .footer-data {
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.1px;
    }
    .text-compact-dt {
      font-size: 6.8px !important;
      font-weight: 800 !important;
    }
    .footer-logo {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .footer-logo-circle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 11px;
      height: 11px;
      background: #000;
      color: #fff;
      border-radius: 50%;
      font-size: 8px;
      font-weight: 900;
      font-family: Georgia, serif;
      line-height: 1;
      padding-bottom: 0.5px;
    }
    .logo-circle-sm {
      width: 9.5px !important;
      height: 9.5px !important;
      font-size: 6.8px !important;
    }
    .footer-logo-name {
      font-size: 9px;
      font-weight: 900;
      letter-spacing: -0.3px;
    }
    .logo-name-sm {
      font-size: 7.8px !important;
    }
    .trace-line {
      font-size: 6.5px;
      color: #222;
      font-family: monospace;
      letter-spacing: -0.2px;
      line-height: 1;
      margin-top: 0.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-align: center;
    }
    .trace-line-sm {
      font-size: 5.5px !important;
      line-height: 1 !important;
    }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`);

  printDoc.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
    setTimeout(() => {
      frame.remove();
    }, 2000);
  }, 350);
}

/**
 * Gera o código nativo ZPL (Zebra Programming Language) para envio direto a impressoras térmicas
 * Calibrado em 203 DPI para etiqueta 43x24mm (344 x 192 dots) na horizontal
 */
export function generateZplCode(
  itens: EtiquetaBobinaItem[],
  config: EtiquetaZebraData
): string {
  const list = itens.length > 0 ? itens : [{ posicao: 1, pesoBruto: 0, tara: 1.6, pesoLiquido: 0 }];
  const is2Col = config.formatoRolo === "2_colunas";
  const isRot90 = config.orientacao === "rotacionada_90";
  const isVert = config.orientacao === "vertical";
  const zplOrientation = isRot90 ? "^POR" : isVert ? "^POW" : "^PON";

  // Dimensões em dots para 203 DPI (8 dots por mm)
  // 43mm = 344 dots, 24mm = 192 dots
  const widthDots = config.tamanhoEtiqueta === "60x40" ? 480 : 344;
  const heightDots = config.tamanhoEtiqueta === "60x40" ? 320 : 192;
  const totalWidthDots = is2Col ? widthDots * 2 + 16 : widthDots;

  const buildSingleLabelZpl = (item: EtiquetaBobinaItem | null, xOffset: number) => {
    if (!item) return "";
    const pesoText = config.imprimirPesos && item.pesoBruto > 0
      ? `PESO: ${item.pesoBruto.toFixed(1)} / ${item.pesoLiquido.toFixed(1)}`
      : `PESO: _____ / _____`;

    const traceText = config.incluirIdentificacaoOp
      ? `OP #${config.codigoOp || ""} · ${item.codigoBobina || `BOB #${item.posicao}`} ${config.numeroPalete ? `· ${config.numeroPalete}` : ""}`
      : "";

    return `^CF0,20
^FO${xOffset + 6},8^FB332,1,0,C^FD${config.tipoFilme}^FS
^CF0,16
^FO${xOffset + 6},32^FB332,1,0,C^FD${config.aplicacao}^FS
^CF0,24
^FO${xOffset + 6},52^FB332,1,0,C^FD${config.medidas}^FS
^CF0,20
^FO${xOffset + 6},82^FB332,1,0,C^FD${pesoText}^FS
^CF0,16
^FO${xOffset + 10},122^FDDT: ${config.dataImpressao}^FS
^FO${xOffset + 240},118^GB16,16,16,B,0^FS
^CF0,14
^FR^FO${xOffset + 245},120^FDf^FS
^CF0,17
^FO${xOffset + 260},120^FDForpack^FS
${traceText ? `^CF0,12\n^FO${xOffset + 6},152^FB332,1,0,C^FD${traceText}^FS` : ""}`;
  };

  if (is2Col) {
    const pages: string[] = [];
    for (let i = 0; i < list.length; i += 2) {
      const item1 = list[i];
      const item2 = list[i + 1] || null;
      pages.push(`^XA
^PW${totalWidthDots}
^LL${heightDots}
${zplOrientation}
^LH0,0
${buildSingleLabelZpl(item1, 8)}
${item2 ? buildSingleLabelZpl(item2, widthDots + 16) : ""}
^XZ`);
    }
    return pages.join("\n\n");
  }

  return list
    .map((item) => {
      return `^XA
^PW${widthDots}
^LL${heightDots}
${zplOrientation}
^LH0,0
${buildSingleLabelZpl(item, 6)}
^XZ`;
    })
    .join("\n\n");
}

interface EtiquetaZebraModalProps {
  isOpen: boolean;
  onClose: () => void;
  order?: Order | null;
  palete?: PaleteRomaneio | null;
  singleBobina?: EtiquetaBobinaItem | null;
  allBobinas?: EtiquetaBobinaItem[];
}

export function EtiquetaZebraModal({
  isOpen,
  onClose,
  order = null,
  palete,
  singleBobina,
  allBobinas = [],
}: EtiquetaZebraModalProps) {
  // Config state
  const [config, setConfig] = useState<EtiquetaZebraData>(() =>
    inferEtiquetaZebraData(order, palete)
  );

  // Tab mode
  const [tab, setTab] = useState<"preview" | "lote" | "zpl">("preview");

  // Selection mode: single bobina vs all bobinas from pallet vs blank batch
  const [printScope, setPrintScope] = useState<"single" | "all" | "blank">(
    singleBobina ? "single" : allBobinas.length > 0 ? "all" : "blank"
  );
  const [blankCopies, setBlankCopies] = useState("10");
  const [copiedZpl, setCopiedZpl] = useState(false);

  // Synchronize when order or palete changes
  React.useEffect(() => {
    if (isOpen) {
      setConfig(inferEtiquetaZebraData(order, palete));
      if (singleBobina) {
        setPrintScope("single");
      } else if (allBobinas.length > 0) {
        setPrintScope("all");
      } else {
        setPrintScope("blank");
      }
    }
  }, [isOpen, order, palete, singleBobina, allBobinas.length]);

  // Items to print based on selected scope
  const targetItens = useMemo<EtiquetaBobinaItem[]>(() => {
    if (printScope === "single") {
      if (singleBobina) return [singleBobina];
      if (allBobinas.length > 0) return [allBobinas[0]];
      return [{ posicao: 1, pesoBruto: 10.7, tara: 1.6, pesoLiquido: 10.1, codigoBobina: "BOB-01" }];
    }
    if (printScope === "all") {
      if (allBobinas.length > 0) return allBobinas;
      return [{ posicao: 1, pesoBruto: 10.7, tara: 1.6, pesoLiquido: 10.1, codigoBobina: "BOB-01" }];
    }
    // Blank copies
    const count = Math.max(1, Math.min(200, parseInt(blankCopies, 10) || 1));
    return Array.from({ length: count }, (_, i) => ({
      posicao: i + 1,
      pesoBruto: 0,
      tara: 1.6,
      pesoLiquido: 0,
      codigoBobina: `BOB-${(i + 1).toString().padStart(2, "0")}`,
    }));
  }, [printScope, singleBobina, allBobinas, blankCopies]);

  // Sample bobina for live visual preview
  const previewBobina: EtiquetaBobinaItem = useMemo(() => {
    if (singleBobina) return singleBobina;
    if (allBobinas.length > 0) return allBobinas[0];
    return {
      posicao: 1,
      pesoBruto: 10.7,
      tara: 1.6,
      pesoLiquido: 10.1,
      codigoBobina: "BOB-01",
    };
  }, [singleBobina, allBobinas]);

  // ZPL output string
  const zplString = useMemo(() => {
    return generateZplCode(targetItens, config);
  }, [targetItens, config]);

  const handlePrint = () => {
    printEtiquetasZebra(targetItens, config);
  };

  const handleCopyZpl = () => {
    navigator.clipboard.writeText(zplString);
    setCopiedZpl(true);
    setTimeout(() => setCopiedZpl(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onMouseDown={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                  IMPRESSORA TÉRMICA ZEBRA
                </span>
                <span className="text-[9px] font-mono bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded border border-blue-400/30 font-bold">
                  {config.tamanhoEtiqueta === "43x24" ? "4,30 x 2,40 cm (Horizontal)" : `${config.tamanhoEtiqueta} mm`}
                </span>
                {config.formatoRolo === "2_colunas" && (
                  <span className="text-[9px] font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-400/30 font-bold">
                    2 Colunas (Pistas Duplas)
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Etiqueta Adesiva de Bobina · Padrão Forpack
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-2 gap-2 text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              tab === "preview"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Visualização & Ajustes</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("lote")}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              tab === "lote"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Escopo ({targetItens.length} etiquetas)</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("zpl")}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              tab === "zpl"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Código ZPL (Zebra)</span>
          </button>
        </div>

        {/* CORPO DO MODAL */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {tab === "preview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              {/* CARTÃO VISUAL REALISTA DA ETIQUETA ADESIVA ZEBRA (Fiel às fotos enviadas pelo usuário!) */}
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-1.5 px-1">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Pré-visualização Térmica
                  </span>
                  <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {config.tamanhoEtiqueta === "43x24" ? "4,30 cm x 2,40 cm" : `${config.tamanhoEtiqueta} mm`} · {config.orientacao === "rotacionada_90" ? "Giro 90°" : config.orientacao === "vertical" ? "Vertical" : "Horizontal"}
                  </span>
                </div>

                <div className="p-4 bg-slate-100 rounded-xl border border-slate-300 shadow-inner flex flex-col items-center justify-center w-full gap-2">
                  {/* SIMULAÇÃO DA ETIQUETA ADESIVA (PROPORÇÃO EXATA 43:24 HORIZONTAL) */}
                  <div className="flex items-center justify-center gap-2">
                    {/* ETIQUETA 1 (OU ÚNICA) */}
                    <div
                      className="bg-white text-slate-900 border-2 border-slate-800 rounded-md p-2 shadow-md flex flex-col justify-between text-center select-none"
                      style={{
                        width: config.orientacao === "vertical" ? "156px" : "270px",
                        height: config.orientacao === "vertical" ? "270px" : "156px",
                        fontFamily: "Arial, Helvetica, sans-serif",
                      }}
                    >
                      <div>
                        {/* LINHA 1: FILME PEBD LISO */}
                        <div className="font-black text-[11.5px] tracking-wide uppercase leading-tight truncate">
                          {config.tipoFilme || "FILME PEBD LISO"}
                        </div>
                        {/* LINHA 2: P/ POLPAS DE FRUTA */}
                        <div className="font-bold text-[10px] tracking-tight uppercase leading-tight mt-0.5 truncate text-slate-800">
                          {config.aplicacao || "P/ POLPAS DE FRUTA"}
                        </div>
                        {/* LINHA 3: 30x0,08 */}
                        <div className="font-black text-[13px] tracking-wider leading-tight mt-1">
                          {config.medidas || "30x0,08"}
                        </div>
                      </div>

                      {/* LINHA 4: PESO 40.0 / 43.4 (Bruto / Líquido) */}
                      <div className="font-bold text-[11px] tracking-wide my-1 flex items-center justify-center gap-1.5">
                        <span className="font-black text-slate-900">PESO:</span>
                        {config.imprimirPesos && previewBobina.pesoBruto > 0 ? (
                          <span className="font-black text-[12px] font-mono bg-blue-50 text-blue-900 px-1.5 py-0.5 rounded border border-blue-200">
                            {previewBobina.pesoBruto.toFixed(1)} / {previewBobina.pesoLiquido.toFixed(1)}
                          </span>
                        ) : (
                          <span className="font-mono text-slate-400 text-xs tracking-widest font-normal">
                            _____ / _____
                          </span>
                        )}
                      </div>

                      {/* LINHA 5: DT: 22/09/2026 (f) Forpack */}
                      <div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                          <span className="font-bold text-[9px] text-slate-800">
                            DT: {config.dataImpressao}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="w-3.5 h-3.5 bg-black text-white rounded-full flex items-center justify-center font-bold font-serif text-[8.5px] leading-none pb-0.5">
                              f
                            </span>
                            <span className="font-black text-[10px] tracking-tight text-slate-900">
                              Forpack
                            </span>
                          </div>
                        </div>
                        {config.incluirIdentificacaoOp && (
                          <div className="text-[7.5px] text-slate-500 font-mono tracking-tighter mt-0.5 truncate">
                            OP #{config.codigoOp || "—"} · {previewBobina.codigoBobina || `BOB #${previewBobina.posicao}`}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SE FOR ROLO DE 2 COLUNAS, MOSTRA A SEGUNDA ETIQUETA IRMÃ */}
                    {config.formatoRolo === "2_colunas" && (
                      <div
                        className="bg-white/80 text-slate-700 border-2 border-dashed border-slate-400 rounded-md p-2 shadow-xs flex flex-col justify-between text-center select-none opacity-85 hidden sm:flex"
                        style={{
                          width: config.orientacao === "vertical" ? "156px" : "270px",
                          height: config.orientacao === "vertical" ? "270px" : "156px",
                          fontFamily: "Arial, Helvetica, sans-serif",
                        }}
                      >
                        <div>
                          <div className="font-black text-[11.5px] tracking-wide uppercase leading-tight truncate">
                            {config.tipoFilme || "FILME PEBD LISO"}
                          </div>
                          <div className="font-bold text-[10px] tracking-tight uppercase leading-tight mt-0.5 truncate">
                            {config.aplicacao || "P/ POLPAS DE FRUTA"}
                          </div>
                          <div className="font-black text-[13px] tracking-wider leading-tight mt-1">
                            {config.medidas || "30x0,08"}
                          </div>
                        </div>

                        <div className="font-bold text-[11px] tracking-wide my-1 flex items-center justify-center gap-1.5">
                          <span className="font-black">PESO:</span>
                          <span className="font-black text-[12px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-300">
                            {allBobinas[1] ? `${allBobinas[1].pesoBruto.toFixed(1)} / ${allBobinas[1].pesoLiquido.toFixed(1)}` : "40.0 / 43.4"}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                            <span className="font-bold text-[9px]">DT: {config.dataImpressao}</span>
                            <div className="flex items-center gap-1">
                              <span className="w-3.5 h-3.5 bg-black text-white rounded-full flex items-center justify-center font-bold font-serif text-[8.5px] leading-none pb-0.5">
                                f
                              </span>
                              <span className="font-black text-[10px] tracking-tight">Forpack</span>
                            </div>
                          </div>
                          {config.incluirIdentificacaoOp && (
                            <div className="text-[7.5px] text-slate-500 font-mono tracking-tighter mt-0.5 truncate">
                              OP #{config.codigoOp || "—"} · {allBobinas[1]?.codigoBobina || "BOB #02"}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-2.5 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-center text-[11px] text-emerald-800 w-full">
                  <strong>✓ Formato Calibrado:</strong> Largura <strong>4,30 cm</strong> x Altura <strong>2,40 cm</strong> na <strong>Horizontal</strong> (compatível com a foto do rolo).
                </div>
              </div>

              {/* FORMULÁRIO DE AJUSTES RÁPIDOS DA ETIQUETA */}
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                    Campos & Configuração da Impressão
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfig(inferEtiquetaZebraData(order, palete))}
                    className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Redefinir da OP</span>
                  </button>
                </div>

                {/* Tamanho da etiqueta térmica */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Tamanho da Etiqueta
                    </label>
                    <select
                      value={config.tamanhoEtiqueta}
                      onChange={(e) => setConfig({ ...config, tamanhoEtiqueta: e.target.value as any })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-bold text-blue-900 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="43x24">4,30 x 2,40 cm (Padrão Fábrica Forpack)</option>
                      <option value="60x40">60 mm x 40 mm (Médio)</option>
                      <option value="70x50">70 mm x 50 mm</option>
                      <option value="100x50">100 mm x 50 mm (Largo)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Orientação
                    </label>
                    <select
                      value={config.orientacao}
                      onChange={(e) => setConfig({ ...config, orientacao: e.target.value as any })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-800"
                    >
                      <option value="horizontal">Horizontal / Paisagem (Padrão 4,3x2,4cm)</option>
                      <option value="rotacionada_90">Girar 90° (Caso saia vertical na impressora)</option>
                      <option value="vertical">Vertical / Retrato</option>
                    </select>
                  </div>
                </div>

                {/* Formato do Rolo (1 coluna vs 2 colunas / pistas duplas) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Disposição no Rolo de Etiquetas
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, formatoRolo: "1_coluna" })}
                      className={`p-2 rounded-lg border text-left cursor-pointer transition ${
                        config.formatoRolo === "1_coluna"
                          ? "bg-blue-50 border-blue-600 text-blue-900 ring-1 ring-blue-500"
                          : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <strong className="block text-xs">1 Coluna (43 mm)</strong>
                      <span className="text-[10px] text-slate-500">1 etiqueta por avanço</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, formatoRolo: "2_colunas" })}
                      className={`p-2 rounded-lg border text-left cursor-pointer transition ${
                        config.formatoRolo === "2_colunas"
                          ? "bg-blue-50 border-blue-600 text-blue-900 ring-1 ring-blue-500"
                          : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <strong className="block text-xs">2 Colunas (88 mm)</strong>
                      <span className="text-[10px] text-slate-500">2 pistas lado a lado (Foto 1)</span>
                    </button>
                  </div>
                </div>

                {/* Tipo de Filme */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Tipo de Filme / Material (Linha 1)
                  </label>
                  <input
                    type="text"
                    value={config.tipoFilme}
                    onChange={(e) => setConfig({ ...config, tipoFilme: e.target.value.toUpperCase() })}
                    placeholder="Ex: FILME PEBD LISO"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-semibold text-slate-900"
                  />
                </div>

                {/* Aplicação / Finalidade */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Aplicação / Linha (Linha 2)
                  </label>
                  <input
                    type="text"
                    value={config.aplicacao}
                    onChange={(e) => setConfig({ ...config, aplicacao: e.target.value.toUpperCase() })}
                    placeholder="Ex: P/ POLPAS DE FRUTA"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-semibold text-slate-900"
                  />
                </div>

                {/* Medidas e Data */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Medidas (Linha 3)
                    </label>
                    <input
                      type="text"
                      value={config.medidas}
                      onChange={(e) => setConfig({ ...config, medidas: e.target.value })}
                      placeholder="Ex: 30x0,08"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Data de Fabricação
                    </label>
                    <input
                      type="text"
                      value={config.dataImpressao}
                      onChange={(e) => setConfig({ ...config, dataImpressao: e.target.value })}
                      placeholder="DD/MM/AAAA"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-mono text-slate-900"
                    />
                  </div>
                </div>

                {/* Toggles de formato e pesos */}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.imprimirPesos}
                      onChange={(e) => setConfig({ ...config, imprimirPesos: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="font-semibold text-slate-800">
                      Imprimir pesos apurados (Bruto / Líquido)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.incluirIdentificacaoOp}
                      onChange={(e) => setConfig({ ...config, incluirIdentificacaoOp: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="text-slate-600">
                      Incluir rodapé de rastreio (OP nº e Bobina #)
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {tab === "lote" && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                <Sliders className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Modo de Seleção de Impressão</strong>
                  <span>
                    Escolha se deseja imprimir a etiqueta da bobina atual, todas as bobinas pesadas no palete ou um lote de etiquetas prévias avulsas.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Opção 1: Bobina Atual */}
                <button
                  type="button"
                  onClick={() => setPrintScope("single")}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    printScope === "single"
                      ? "bg-blue-50 border-blue-600 ring-2 ring-blue-500/20"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Individual
                    </span>
                    <strong className="text-sm font-bold text-slate-900 block">
                      Bobina Selecionada
                    </strong>
                    <span className="text-xs text-slate-600 mt-1 block">
                      {singleBobina
                        ? `#${singleBobina.posicao} (${singleBobina.pesoBruto.toFixed(1)} / ${singleBobina.pesoLiquido.toFixed(1)} kg)`
                        : "1 etiqueta apenas"}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-blue-600 mt-3 block">
                    1 etiqueta
                  </span>
                </button>

                {/* Opção 2: Todas as Bobinas do Palete */}
                <button
                  type="button"
                  onClick={() => setPrintScope("all")}
                  disabled={allBobinas.length === 0}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    printScope === "all"
                      ? "bg-blue-50 border-blue-600 ring-2 ring-blue-500/20"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  } ${allBobinas.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Lote do Palete
                    </span>
                    <strong className="text-sm font-bold text-slate-900 block">
                      Todas do Palete
                    </strong>
                    <span className="text-xs text-slate-600 mt-1 block">
                      Imprime a sequência inteira de bobinas já pesadas com seus respectivos pesos.
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-blue-600 mt-3 block">
                    {allBobinas.length} etiquetas sequenciais
                  </span>
                </button>

                {/* Opção 3: Pré-impressão em Branco */}
                <button
                  type="button"
                  onClick={() => setPrintScope("blank")}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    printScope === "blank"
                      ? "bg-blue-50 border-blue-600 ring-2 ring-blue-500/20"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Pré-impressão
                    </span>
                    <strong className="text-sm font-bold text-slate-900 block">
                      Etiquetas Avulsas
                    </strong>
                    <span className="text-xs text-slate-600 mt-1 block">
                      Gera quantidade N para deixar no chão de fábrica (peso em branco para caneta).
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs font-semibold text-slate-700">Qtd:</span>
                    <input
                      type="number"
                      min="1"
                      max="200"
                      value={blankCopies}
                      onChange={(e) => {
                        setBlankCopies(e.target.value);
                        setPrintScope("blank");
                      }}
                      className="w-16 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs font-bold text-center"
                    />
                  </div>
                </button>
              </div>

              {/* Tabela de resumo das bobinas do lote */}
              {targetItens.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 font-bold text-xs text-slate-700 flex justify-between items-center">
                    <span>Lista de Bobinas para Impressão ({targetItens.length})</span>
                    <span className="font-normal text-slate-500">
                      Total líquido: {targetItens.reduce((sum, b) => sum + (b.pesoLiquido || 0), 0).toFixed(1)} kg
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {targetItens.map((b, idx) => (
                      <div key={idx} className="px-3 py-1.5 flex items-center justify-between hover:bg-slate-50">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                            {b.posicao}
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            {b.codigoBobina || `BOB-${b.posicao.toString().padStart(2, "0")}`}
                          </span>
                        </div>
                        <div className="font-mono text-slate-700">
                          {config.imprimirPesos && b.pesoBruto > 0 ? (
                            <span>
                              <strong>{b.pesoBruto.toFixed(1)}</strong> / {b.pesoLiquido.toFixed(1)} kg
                            </span>
                          ) : (
                            <span className="text-slate-400">_____ / _____</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "zpl" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Código ZPL Nativo (Zebra Programming Language)
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Pronto para envio direto a portas TCP (porta 9100), PrintNode, QZ Tray ou Zebra Setup Utilities.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyZpl}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-300"
                >
                  {copiedZpl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedZpl ? "Copiado!" : "Copiar ZPL"}</span>
                </button>
              </div>

              <pre className="bg-slate-900 text-emerald-400 p-3.5 rounded-xl font-mono text-[11px] max-h-64 overflow-y-auto leading-relaxed border border-slate-800 select-all">
                {zplString}
              </pre>
            </div>
          )}
        </div>

        {/* RODAPÉ DE AÇÃO */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-600">
            Serão impressas: <strong>{targetItens.length} etiqueta(s)</strong> ·{" "}
            <strong>{config.tamanhoEtiqueta === "43x24" ? "4,30 x 2,40 cm (Horizontal)" : `${config.tamanhoEtiqueta} mm`}</strong>
            {config.formatoRolo === "2_colunas" ? " · Rolo 2 Colunas" : ""}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-lg text-xs transition shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir na Zebra</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
