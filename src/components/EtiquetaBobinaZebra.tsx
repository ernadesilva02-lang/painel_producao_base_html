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
  tipoFilme: string;      // Ex: "FILME PEBD IMP" ou "FILME PEBD LISO"
  aplicacao: string;      // Ex: "PIPOCA LYPE" ou "PADRAO ALIMENTOS" (sem "P/", limpo conforme foto)
  medidas: string;        // Ex: "69X0,028"
  dataImpressao: string;  // Ex: "25/09/2026"
  tamanhoEtiqueta: "43x24" | "60x40" | "70x50" | "100x50" | "custom";
  larguraMm?: number;     // Ex: 43
  alturaMm?: number;      // Ex: 24
  orientacao: "horizontal" | "rotacionada_90" | "rotacionada_270" | "invertida_180" | "vertical"; // horizontal padrão
  formatoRolo: "1_coluna" | "2_colunas"; // Rolo de 2 colunas padrão (pistas duplas 88mm)
  duplicarPistas: boolean; // Imprime a mesma etiqueta nas 2 pistas lado a lado (Foto 2)
  imprimirPesos: boolean; // Se true imprime "PESO B: 30.9   L: 29.3", se false imprime "PESO B:        L:"
  incluirIdentificacaoOp?: boolean; // Padrão false para manter layout limpo idêntico à Foto 2
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
 * Ajustado para o padrão visual real da fábrica Forpack (Foto 2)
 */
export function inferEtiquetaZebraData(
  order: Order | null | undefined,
  palete?: PaleteRomaneio | null
): EtiquetaZebraData {
  const desc = (order?.descricaoItem || palete?.descricaoItem || "FILME PEBD IMP PIPOCA LYPE 69X0,028").trim();
  const mat = (order?.material || "").trim();

  // Tenta extrair dimensões como 69X0,028, 30x0,08, 110x0,06 ou 400x0,060
  const dimMatch = desc.match(/(\d+(?:[.,]\d+)?\s*[xX*]\s*\d+(?:[.,]\d+)?)/);
  const medidas = dimMatch ? dimMatch[1].replace(/\s+/g, "").toUpperCase() : "69X0,028";

  // Identifica Tipo de Filme / Material
  let tipoFilme = "FILME PEBD IMP";
  const descUpper = desc.toUpperCase();

  if (descUpper.startsWith("FILME PEBD IMP") || descUpper.includes("PEBD IMP")) {
    tipoFilme = "FILME PEBD IMP";
  } else if (descUpper.startsWith("FILME PEBD LISO") || (descUpper.includes("PEBD") && descUpper.includes("LISO"))) {
    tipoFilme = "FILME PEBD LISO";
  } else if (descUpper.startsWith("FILME PEAD IMP") || descUpper.includes("PEAD IMP")) {
    tipoFilme = "FILME PEAD IMP";
  } else if (descUpper.startsWith("FILME PP IMP") || descUpper.includes("PP IMP")) {
    tipoFilme = "FILME PP IMP";
  } else if (mat) {
    tipoFilme = mat.toUpperCase();
    if (!tipoFilme.includes("FILME") && !tipoFilme.includes("SACO")) tipoFilme = `FILME ${tipoFilme}`;
  } else if (desc) {
    // Pega as primeiras 3 palavras ou prefixo
    const words = desc.split(/\s+/);
    if (words.length >= 3 && /filme|saco|pebd|pead|pp/i.test(words[0])) {
      tipoFilme = words.slice(0, 3).join(" ").toUpperCase();
    }
  }

  // Nome do Produto / Cliente (Linha 2, limpo e sem 'P/' conforme Foto 2)
  let aplicacao = "";
  if (order?.cliente && order.cliente !== "Cliente Forpack") {
    aplicacao = order.cliente.replace(/^[pP]\/\s*/, "").trim().toUpperCase();
  }

  // Se a descrição do item contiver algo após o tipo e antes das medidas
  let cleanedDesc = desc;
  if (dimMatch) {
    cleanedDesc = cleanedDesc.replace(dimMatch[0], "");
  }
  cleanedDesc = cleanedDesc
    .replace(/FILME\s+PEBD\s+IMP/gi, "")
    .replace(/FILME\s+PEBD\s+LISO/gi, "")
    .replace(/FILME\s+PEBD/gi, "")
    .replace(/FILME\s+PEAD/gi, "")
    .replace(/FILME\s+PP/gi, "")
    .replace(/SACO\s+PEBD/gi, "")
    .replace(/SACO\s+PP/gi, "")
    .replace(/^[pP]\/\s*/, "")
    .replace(/VALVULADO/gi, "")
    .trim();

  if (cleanedDesc.length >= 3) {
    aplicacao = cleanedDesc.toUpperCase();
  }

  if (!aplicacao) {
    aplicacao = "PIPOCA LYPE";
  }

  // Data formatada DD/MM/AAAA
  const rawDate = palete?.data || order?.data || new Date().toISOString().slice(0, 10);
  const [year, month, day] = rawDate.split("-");
  const dataFormatada = year && month && day ? `${day}/${month}/${year}` : new Date().toLocaleDateString("pt-BR");

  return {
    tipoFilme: tipoFilme || "FILME PEBD IMP",
    aplicacao: aplicacao || "PIPOCA LYPE",
    medidas: medidas || "69X0,028",
    dataImpressao: dataFormatada,
    tamanhoEtiqueta: "43x24", // 4,30 cm x 2,40 cm - Padrão Real da Fábrica Forpack
    larguraMm: 43,
    alturaMm: 24,
    orientacao: "horizontal", // Padrão Horizontal
    formatoRolo: "2_colunas", // Padrão: 2 Colunas (88 mm total)
    duplicarPistas: true, // Padrão: Imprime idêntico nas 2 pistas como na Foto 2
    imprimirPesos: true,
    incluirIdentificacaoOp: false, // Padrão false para não poluir o layout compacto de 24mm
    codigoOp: order?.numeroOp || order?.numeroPedido || palete?.numeroOp || "",
    numeroPalete: palete?.numeroPalete || "",
  };
}

/**
 * Função de impressão direta da Etiqueta Térmica Zebra via janela/iframe do navegador
 * Calibrada fielmente para o formato 43x24mm (4,30 x 2,40 cm) em rolo de 2 colunas (88mm)
 * Layout 100% idêntico à etiqueta padrão Forpack (Foto 2)
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

  // Dimensões em mm
  const singleWidthMm = config.larguraMm || 43;
  const singleHeightMm = config.alturaMm || 24;
  const is2Col = config.formatoRolo === "2_colunas";

  // Largura total da folha/rolo
  const pageWidthMm = is2Col ? singleWidthMm * 2 + 2 : singleWidthMm;
  const pageHeightMm = singleHeightMm;

  // Orientação e rotação CSS para neutralizar giros indesejados de drivers térmicos
  let pageRotationCss = "";
  let pageSizeCss = `${pageWidthMm}mm ${pageHeightMm}mm`;

  if (config.orientacao === "rotacionada_90") {
    pageRotationCss = "transform: rotate(90deg); transform-origin: top left; margin-left: 24mm;";
    pageSizeCss = `${pageHeightMm}mm ${pageWidthMm}mm`;
  } else if (config.orientacao === "rotacionada_270") {
    pageRotationCss = "transform: rotate(-90deg); transform-origin: top left; margin-top: 88mm;";
    pageSizeCss = `${pageHeightMm}mm ${pageWidthMm}mm`;
  } else if (config.orientacao === "invertida_180") {
    pageRotationCss = "transform: rotate(180deg); transform-origin: center center;";
  } else if (config.orientacao === "vertical") {
    pageSizeCss = `${pageHeightMm}mm ${pageWidthMm}mm`;
  }

  // Lista base de itens
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

  // Helper para renderizar 1 etiqueta individual (Fiel à Foto 2)
  const renderCardHtml = (item: EtiquetaBobinaItem | null) => {
    if (!item) {
      return `<div class="etiqueta-zebra-card vazio" style="width: ${singleWidthMm}mm; height: ${singleHeightMm}mm; visibility: hidden;"></div>`;
    }

    const hasWeights = config.imprimirPesos && item.pesoBruto > 0;
    const pesoBVal = hasWeights ? item.pesoBruto.toFixed(1) : "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
    const pesoLVal = hasWeights ? item.pesoLiquido.toFixed(1) : "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";

    return `
    <div class="etiqueta-zebra-card" style="width: ${singleWidthMm}mm; height: ${singleHeightMm}mm;">
      <!-- LINHA 1: TIPO DE FILME (Ex: FILME PEBD IMP) -->
      <div class="line-1-material">${config.tipoFilme}</div>

      <!-- LINHA 2: PRODUTO / CLIENTE (Ex: PIPOCA LYPE) -->
      <div class="line-2-aplicacao">${config.aplicacao}</div>

      <!-- LINHA 3: MEDIDAS (Ex: 69X0,028) -->
      <div class="line-3-medidas">${config.medidas}</div>

      <!-- LINHA 4: PESOS (PESO B: ... L: ...) -->
      <div class="line-4-peso">
        <span class="peso-b-label">PESO B:</span>
        <span class="peso-b-val">${pesoBVal}</span>
        <span class="peso-l-label">L:</span>
        <span class="peso-l-val">${pesoLVal}</span>
      </div>

      <!-- LINHA 5: DATA E LOGO FORPACK -->
      <div class="line-5-footer">
        <span class="footer-data">DATA: ${config.dataImpressao}</span>
        <div class="footer-logo">
          <span class="footer-logo-circle">f</span>
          <span class="footer-logo-name">Forpack</span>
        </div>
      </div>

      ${
        config.incluirIdentificacaoOp && (config.codigoOp || item.codigoBobina)
          ? `<div class="trace-line">OP #${config.codigoOp || "—"} · ${item.codigoBobina || `BOB #${item.posicao}`}</div>`
          : ""
      }
    </div>`;
  };

  // Montagem do corpo da impressão: agrupamento de 2 em 2 colunas
  let bodyContent = "";
  if (is2Col) {
    const pairs: Array<[EtiquetaBobinaItem, EtiquetaBobinaItem]> = [];
    if (config.duplicarPistas || baseItens.length === 1) {
      // Duplica a mesma bobina nas 2 pistas (Foto 2)
      for (let i = 0; i < baseItens.length; i++) {
        pairs.push([baseItens[i], baseItens[i]]);
      }
    } else {
      // Sequencial
      for (let i = 0; i < baseItens.length; i += 2) {
        pairs.push([baseItens[i], baseItens[i + 1] || baseItens[i]]);
      }
    }

    bodyContent = pairs
      .map(
        ([item1, item2]) => `
      <div class="etiqueta-page-row" style="width: ${pageWidthMm}mm; height: ${pageHeightMm}mm; ${pageRotationCss}">
        ${renderCardHtml(item1)}
        <div class="col-gap" style="width: 2mm;"></div>
        ${renderCardHtml(item2)}
      </div>`
      )
      .join("");
  } else {
    bodyContent = baseItens
      .map(
        (item) => `
      <div class="etiqueta-page-single" style="width: ${pageWidthMm}mm; height: ${pageHeightMm}mm; ${pageRotationCss}">
        ${renderCardHtml(item)}
      </div>`
      )
      .join("");
  }

  printDoc.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Etiquetas Bobina Forpack 43x24mm</title>
  <style>
    @page {
      size: ${pageSizeCss};
      margin: 0;
    }
    @media print {
      @page {
        size: ${pageSizeCss};
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
      width: ${pageWidthMm}mm;
      height: ${pageHeightMm}mm;
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
      width: ${pageWidthMm}mm;
      height: ${pageHeightMm}mm;
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
      padding: 1.2mm 1.5mm 1mm 1.5mm;
    }
    .line-1-material {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.2px;
      text-transform: uppercase;
      line-height: 1.1;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .line-2-aplicacao {
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: 0.1px;
      text-transform: uppercase;
      line-height: 1.1;
      margin-top: 0.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .line-3-medidas {
      font-size: 12.5px;
      font-weight: 900;
      letter-spacing: 0.4px;
      line-height: 1.1;
      margin-top: 0.5px;
    }
    .line-4-peso {
      font-size: 9.5px;
      font-weight: 800;
      line-height: 1.1;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 3px;
      margin-top: 0.5px;
      padding-left: 0.5mm;
      text-align: left;
    }
    .peso-b-label {
      font-weight: 900;
    }
    .peso-b-val {
      font-weight: 900;
      font-family: Arial, monospace;
      min-width: 11mm;
      display: inline-block;
    }
    .peso-l-label {
      font-weight: 900;
      margin-left: 2px;
    }
    .peso-l-val {
      font-weight: 900;
      font-family: Arial, monospace;
      min-width: 11mm;
      display: inline-block;
    }
    .line-5-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      padding-top: 0.5px;
      line-height: 1;
      padding-left: 0.5mm;
    }
    .footer-data {
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.1px;
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
    .footer-logo-name {
      font-size: 9px;
      font-weight: 900;
      letter-spacing: -0.3px;
    }
    .trace-line {
      font-size: 6px;
      color: #333;
      font-family: monospace;
      letter-spacing: -0.2px;
      line-height: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-align: center;
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
 * Suporte a 2 colunas (88 mm total) idêntico à Foto 2
 */
export function generateZplCode(
  itens: EtiquetaBobinaItem[],
  config: EtiquetaZebraData
): string {
  const list = itens.length > 0 ? itens : [{ posicao: 1, pesoBruto: 0, tara: 1.6, pesoLiquido: 0 }];
  const is2Col = config.formatoRolo === "2_colunas";

  // Orientação ZPL
  let zplOrientation = "^PON";
  if (config.orientacao === "rotacionada_90") zplOrientation = "^POR";
  else if (config.orientacao === "rotacionada_270") zplOrientation = "^POW";
  else if (config.orientacao === "invertida_180") zplOrientation = "^POI";

  // Dimensões em dots para 203 DPI (8 dots por mm)
  // 43mm = 344 dots, 24mm = 192 dots
  const widthDots = config.tamanhoEtiqueta === "60x40" ? 480 : 344;
  const heightDots = config.tamanhoEtiqueta === "60x40" ? 320 : 192;
  const totalWidthDots = is2Col ? widthDots * 2 + 16 : widthDots;

  const buildSingleLabelZpl = (item: EtiquetaBobinaItem | null, xOffset: number) => {
    if (!item) return "";
    const hasWeights = config.imprimirPesos && item.pesoBruto > 0;
    const pesoText = hasWeights
      ? `PESO B: ${item.pesoBruto.toFixed(1)}   L: ${item.pesoLiquido.toFixed(1)}`
      : `PESO B:          L:`;

    const traceText = config.incluirIdentificacaoOp
      ? `OP #${config.codigoOp || ""} · ${item.codigoBobina || `BOB #${item.posicao}`}`
      : "";

    return `^CF0,24
^FO${xOffset + 6},8^FB332,1,0,C^FD${config.tipoFilme}^FS
^CF0,22
^FO${xOffset + 6},36^FB332,1,0,C^FD${config.aplicacao}^FS
^CF0,26
^FO${xOffset + 6},64^FB332,1,0,C^FD${config.medidas}^FS
^CF0,20
^FO${xOffset + 10},100^FD${pesoText}^FS
^CF0,18
^FO${xOffset + 10},138^FDDATA: ${config.dataImpressao}^FS
^FO${xOffset + 242},134^GB18,18,18,B,0^FS
^CF0,15
^FR^FO${xOffset + 248},136^FDf^FS
^CF0,18
^FO${xOffset + 264},136^FDForpack^FS
${traceText ? `^CF0,12\n^FO${xOffset + 6},168^FB332,1,0,C^FD${traceText}^FS` : ""}`;
  };

  if (is2Col) {
    const pairs: Array<[EtiquetaBobinaItem, EtiquetaBobinaItem]> = [];
    if (config.duplicarPistas || list.length === 1) {
      for (let i = 0; i < list.length; i++) {
        pairs.push([list[i], list[i]]);
      }
    } else {
      for (let i = 0; i < list.length; i += 2) {
        pairs.push([list[i], list[i + 1] || list[i]]);
      }
    }

    const pages: string[] = [];
    for (const [item1, item2] of pairs) {
      pages.push(`^XA
^PW${totalWidthDots}
^LL${heightDots}
${zplOrientation}
^LH0,0
${buildSingleLabelZpl(item1, 8)}
${buildSingleLabelZpl(item2, widthDots + 18)}
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
              {/* CARTÃO VISUAL REALISTA DA ETIQUETA ADESIVA ZEBRA (Fiel à Foto 2 da fábrica Forpack) */}
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-1.5 px-1">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Pré-visualização Térmica (Foto 2)
                  </span>
                  <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    2 Pistas (88 x 24 mm) · {config.orientacao === "rotacionada_90" ? "Giro +90°" : config.orientacao === "rotacionada_270" ? "Giro -90°" : config.orientacao === "invertida_180" ? "Giro 180°" : "Horizontal 0°"}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-200 rounded-xl border border-slate-300 shadow-inner flex flex-col items-center justify-center w-full gap-2">
                  {/* SIMULAÇÃO DO ROLO COM 2 PISTAS LADO A LADO (EXATAMENTE COMO NA FOTO 2) */}
                  <div className="flex items-center justify-center gap-2 overflow-x-auto max-w-full p-1">
                    {/* PISTA 1 (ESQUERDA) */}
                    <div
                      className="bg-white text-slate-900 border border-slate-400 rounded-[5px] p-2 shadow-md flex flex-col justify-between text-center select-none shrink-0"
                      style={{
                        width: "185px",
                        height: "115px",
                        fontFamily: "Arial, Helvetica, sans-serif",
                      }}
                    >
                      <div>
                        {/* LINHA 1: FILME PEBD IMP */}
                        <div className="font-black text-[10.5px] tracking-wide uppercase leading-tight truncate">
                          {config.tipoFilme || "FILME PEBD IMP"}
                        </div>
                        {/* LINHA 2: PIPOCA LYPE */}
                        <div className="font-bold text-[9.5px] tracking-tight uppercase leading-tight mt-0.5 truncate text-slate-800">
                          {config.aplicacao || "PIPOCA LYPE"}
                        </div>
                        {/* LINHA 3: 69X0,028 */}
                        <div className="font-black text-[11.5px] tracking-wider leading-tight mt-0.5">
                          {config.medidas || "69X0,028"}
                        </div>
                      </div>

                      {/* LINHA 4: PESO B: ... L: ... */}
                      <div className="font-bold text-[9px] tracking-wide my-0.5 flex items-center justify-start gap-1 px-1">
                        <span className="font-black">PESO B:</span>
                        <span className="font-bold font-mono text-[9.5px] min-w-[32px] text-left">
                          {config.imprimirPesos && previewBobina.pesoBruto > 0
                            ? previewBobina.pesoBruto.toFixed(1)
                            : ""}
                        </span>
                        <span className="font-black ml-1">L:</span>
                        <span className="font-bold font-mono text-[9.5px] min-w-[32px] text-left">
                          {config.imprimirPesos && previewBobina.pesoLiquido > 0
                            ? previewBobina.pesoLiquido.toFixed(1)
                            : ""}
                        </span>
                      </div>

                      {/* LINHA 5: DATA E FORPACK */}
                      <div>
                        <div className="flex items-center justify-between pt-0.5 border-t border-slate-200 px-1">
                          <span className="font-bold text-[8px] text-slate-800">
                            DATA: {config.dataImpressao}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="w-3 h-3 bg-black text-white rounded-full flex items-center justify-center font-bold font-serif text-[7px] leading-none pb-0.5">
                              f
                            </span>
                            <span className="font-black text-[8.5px] tracking-tight text-slate-900">
                              Forpack
                            </span>
                          </div>
                        </div>
                        {config.incluirIdentificacaoOp && (
                          <div className="text-[6.5px] text-slate-500 font-mono tracking-tighter mt-0.5 truncate">
                            OP #{config.codigoOp || "—"} · {previewBobina.codigoBobina || `BOB #${previewBobina.posicao}`}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* PISTA 2 (DIREITA) - SELECIONADO 2 COLUNAS */}
                    {config.formatoRolo === "2_colunas" && (
                      <div
                        className="bg-white text-slate-900 border border-slate-400 rounded-[5px] p-2 shadow-md flex flex-col justify-between text-center select-none shrink-0"
                        style={{
                          width: "185px",
                          height: "115px",
                          fontFamily: "Arial, Helvetica, sans-serif",
                        }}
                      >
                        <div>
                          <div className="font-black text-[10.5px] tracking-wide uppercase leading-tight truncate">
                            {config.tipoFilme || "FILME PEBD IMP"}
                          </div>
                          <div className="font-bold text-[9.5px] tracking-tight uppercase leading-tight mt-0.5 truncate text-slate-800">
                            {config.aplicacao || "PIPOCA LYPE"}
                          </div>
                          <div className="font-black text-[11.5px] tracking-wider leading-tight mt-0.5">
                            {config.medidas || "69X0,028"}
                          </div>
                        </div>

                        <div className="font-bold text-[9px] tracking-wide my-0.5 flex items-center justify-start gap-1 px-1">
                          <span className="font-black">PESO B:</span>
                          <span className="font-bold font-mono text-[9.5px] min-w-[32px] text-left">
                            {config.imprimirPesos && (config.duplicarPistas ? previewBobina.pesoBruto : (allBobinas[1]?.pesoBruto || 0)) > 0
                              ? (config.duplicarPistas ? previewBobina.pesoBruto : allBobinas[1]!.pesoBruto).toFixed(1)
                              : ""}
                          </span>
                          <span className="font-black ml-1">L:</span>
                          <span className="font-bold font-mono text-[9.5px] min-w-[32px] text-left">
                            {config.imprimirPesos && (config.duplicarPistas ? previewBobina.pesoLiquido : (allBobinas[1]?.pesoLiquido || 0)) > 0
                              ? (config.duplicarPistas ? previewBobina.pesoLiquido : allBobinas[1]!.pesoLiquido).toFixed(1)
                              : ""}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center justify-between pt-0.5 border-t border-slate-200 px-1">
                            <span className="font-bold text-[8px] text-slate-800">
                              DATA: {config.dataImpressao}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="w-3 h-3 bg-black text-white rounded-full flex items-center justify-center font-bold font-serif text-[7px] leading-none pb-0.5">
                                f
                              </span>
                              <span className="font-black text-[8.5px] tracking-tight text-slate-900">
                                Forpack
                              </span>
                            </div>
                          </div>
                          {config.incluirIdentificacaoOp && (
                            <div className="text-[6.5px] text-slate-500 font-mono tracking-tighter mt-0.5 truncate">
                              OP #{config.codigoOp || "—"} · {config.duplicarPistas ? (previewBobina.codigoBobina || `BOB #${previewBobina.posicao}`) : (allBobinas[1]?.codigoBobina || "BOB #02")}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* BOTÃO E AVISO DE CORREÇÃO RÁPIDA DE ORIENTAÇÃO (RESOLVE A FOTO 1) */}
                <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 w-full space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Ajuste de Orientação para Zebra:</strong>
                      <span>
                        Se na sua impressora sair virada de lado (cortando na vertical como na Foto 1), clique no botão abaixo para inverter os 90° e alinhar na horizontal:
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setConfig({
                          ...config,
                          orientacao: config.orientacao === "rotacionada_270" ? "horizontal" : "rotacionada_270",
                        })
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                        config.orientacao === "rotacionada_270"
                          ? "bg-amber-600 text-white hover:bg-amber-700"
                          : "bg-white border border-amber-300 text-amber-900 hover:bg-amber-100"
                      }`}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{config.orientacao === "rotacionada_270" ? "✓ Giro -90° Ativo (Correção aplicada)" : "Girar -90° (Corrigir impressão de lado)"}</span>
                    </button>
                    {config.orientacao !== "horizontal" && (
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, orientacao: "horizontal" })}
                        className="text-[11px] text-slate-600 hover:underline cursor-pointer"
                      >
                        Resetar (0°)
                      </button>
                    )}
                  </div>
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
                      <option value="horizontal">Horizontal (0° - Padrão Foto 2)</option>
                      <option value="rotacionada_270">Girar -90° (Anti-horário - Neutraliza giro)</option>
                      <option value="rotacionada_90">Girar +90° (Horário)</option>
                      <option value="invertida_180">Inverter 180°</option>
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
                      onClick={() => setConfig({ ...config, formatoRolo: "2_colunas" })}
                      className={`p-2 rounded-lg border text-left cursor-pointer transition ${
                        config.formatoRolo === "2_colunas"
                          ? "bg-blue-50 border-blue-600 text-blue-900 ring-1 ring-blue-500"
                          : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <strong className="block text-xs">2 Colunas (88 mm)</strong>
                      <span className="text-[10px] text-slate-500">Pistas duplas (Padrão Forpack)</span>
                    </button>

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
                  </div>
                </div>

                {/* Toggle de duplicação nas duas pistas */}
                {config.formatoRolo === "2_colunas" && (
                  <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-lg">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.duplicarPistas}
                        onChange={(e) => setConfig({ ...config, duplicarPistas: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      <div>
                        <span className="font-bold text-slate-900 block text-xs">
                          Duplicar etiqueta nas 2 pistas (Foto 2)
                        </span>
                        <span className="text-[11px] text-slate-600 block">
                          Gera a mesma etiqueta nos 2 lados do rolo para não desperdiçar etiqueta.
                        </span>
                      </div>
                    </label>
                  </div>
                )}

                {/* Tipo de Filme (Linha 1) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Tipo de Filme / Estrutura (Linha 1)
                  </label>
                  <input
                    type="text"
                    value={config.tipoFilme}
                    onChange={(e) => setConfig({ ...config, tipoFilme: e.target.value.toUpperCase() })}
                    placeholder="Ex: FILME PEBD IMP"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-bold text-slate-900 text-xs"
                  />
                </div>

                {/* Produto / Cliente (Linha 2) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Produto / Cliente (Linha 2 - limpo conforme Foto 2)
                  </label>
                  <input
                    type="text"
                    value={config.aplicacao}
                    onChange={(e) => setConfig({ ...config, aplicacao: e.target.value.toUpperCase() })}
                    placeholder="Ex: PIPOCA LYPE"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-bold text-slate-900 text-xs"
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
                      placeholder="Ex: 69X0,028"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-mono font-bold text-slate-900 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Data (Linha 5)
                    </label>
                    <input
                      type="text"
                      value={config.dataImpressao}
                      onChange={(e) => setConfig({ ...config, dataImpressao: e.target.value })}
                      placeholder="DD/MM/AAAA"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-mono text-slate-900 text-xs"
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
                      Imprimir pesos apurados (PESO B: ... L: ...)
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
                    1 etiqueta ({config.duplicarPistas ? "2 pistas impressas" : "1 pista"})
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
                            <span className="text-slate-400">PESO B: &nbsp;&nbsp;&nbsp;&nbsp; L:</span>
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
                    Pronto para envio direto a portas TCP (porta 9100), Zebra Setup Utilities ou PrintNode.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const blob = new Blob([zplString], { type: "text/plain;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `etiquetas_${config.tamanhoEtiqueta}_2colunas.zpl`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-300"
                  >
                    <span>Baixar .ZPL</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyZpl}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-300"
                  >
                    {copiedZpl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedZpl ? "Copiado!" : "Copiar ZPL"}</span>
                  </button>
                </div>
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
            Serão impressas: <strong>{targetItens.length} bobina(s)</strong> ·{" "}
            <strong>{config.tamanhoEtiqueta === "43x24" ? "4,30 x 2,40 cm (Horizontal)" : `${config.tamanhoEtiqueta} mm`}</strong>
            {config.formatoRolo === "2_colunas" ? " · Rolo 2 Colunas (88 mm)" : ""}
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
