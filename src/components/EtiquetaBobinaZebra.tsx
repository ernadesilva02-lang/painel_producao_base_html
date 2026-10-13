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
  HelpCircle,
  Wrench,
  CheckCircle2,
  Info,
  ArrowRight,
  ArrowDown,
  RotateCw,
  RefreshCw,
  Compass,
  FileDown,
  Terminal,
  Table,
  Download,
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
  // Campos de ajuste avançado de direção e envio para impressoras térmicas
  modoEnvioCss?: "dimensoes_puras" | "auto" | "forcar_paisagem" | "forcar_retrato" | "tamanho_invertido";
  deslocamentoVerticalMm?: number; // Ajuste fino -5mm a +5mm
  deslocamentoHorizontalMm?: number; // Ajuste fino -5mm a +5mm
  espacamentoColunasMm?: number; // Gap entre as duas pistas, padrão 2mm
  // Modo de saída ao clicar em imprimir:
  modoSaidaImpressao?: "arquivo_prn" | "arquivo_csv" | "arquivo_bat" | "navegador"; // Padrão: "arquivo_prn" (Gera arquivo para impressão direta no Windows)
}

export interface EtiquetaBobinaItem {
  posicao: number;
  codigoBobina?: string;
  pesoBruto: number;
  tara: number;
  pesoLiquido: number;
  horario?: string;
}

export const ZEBRA_CONFIG_STORAGE_KEY = "forpack_etiqueta_zebra_config";

/**
 * Carrega preferências da impressora Zebra salvas pelo operador neste terminal
 */
export function loadSavedEtiquetaZebraPreferences(): Partial<EtiquetaZebraData> {
  try {
    const raw = localStorage.getItem(ZEBRA_CONFIG_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn("Erro ao carregar preferências da Zebra:", err);
  }
  return {};
}

/**
 * Salva permanentemente as preferências de sentido e formato de etiqueta para próximas impressões
 */
export function saveEtiquetaZebraPreferences(config: Partial<EtiquetaZebraData>): void {
  try {
    const prev = loadSavedEtiquetaZebraPreferences();
    const toSave: Partial<EtiquetaZebraData> = {
      ...prev,
      tamanhoEtiqueta: config.tamanhoEtiqueta ?? prev.tamanhoEtiqueta,
      larguraMm: config.larguraMm ?? prev.larguraMm,
      alturaMm: config.alturaMm ?? prev.alturaMm,
      orientacao: config.orientacao ?? prev.orientacao,
      formatoRolo: config.formatoRolo ?? prev.formatoRolo,
      duplicarPistas: config.duplicarPistas ?? prev.duplicarPistas,
      imprimirPesos: config.imprimirPesos ?? prev.imprimirPesos,
      incluirIdentificacaoOp: config.incluirIdentificacaoOp ?? prev.incluirIdentificacaoOp,
      modoEnvioCss: config.modoEnvioCss ?? prev.modoEnvioCss,
      deslocamentoVerticalMm: config.deslocamentoVerticalMm ?? prev.deslocamentoVerticalMm,
      deslocamentoHorizontalMm: config.deslocamentoHorizontalMm ?? prev.deslocamentoHorizontalMm,
      espacamentoColunasMm: config.espacamentoColunasMm ?? prev.espacamentoColunasMm,
      modoSaidaImpressao: config.modoSaidaImpressao ?? prev.modoSaidaImpressao,
    };
    localStorage.setItem(ZEBRA_CONFIG_STORAGE_KEY, JSON.stringify(toSave));
  } catch (err) {
    console.warn("Erro ao salvar preferências da Zebra:", err);
  }
}

/**
 * Restaura preferências para o padrão original da fábrica
 */
export function resetEtiquetaZebraPreferences(): void {
  try {
    localStorage.removeItem(ZEBRA_CONFIG_STORAGE_KEY);
  } catch (err) {
    console.warn("Erro ao redefinir preferências da Zebra:", err);
  }
}

/**
 * Utilitário para deduzir campos da etiqueta a partir da OP ou Palete
 * Mesclando com preferências persistidas no navegador do operador
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

  const saved = loadSavedEtiquetaZebraPreferences();

  return {
    tipoFilme: tipoFilme || "FILME PEBD IMP",
    aplicacao: aplicacao || "PIPOCA LYPE",
    medidas: medidas || "69X0,028",
    dataImpressao: dataFormatada,
    tamanhoEtiqueta: (saved.tamanhoEtiqueta as any) || "43x24",
    larguraMm: saved.larguraMm || 43,
    alturaMm: saved.alturaMm || 24,
    orientacao: saved.orientacao || "horizontal",
    formatoRolo: saved.formatoRolo || "2_colunas",
    duplicarPistas: saved.duplicarPistas ?? true,
    imprimirPesos: saved.imprimirPesos ?? true,
    incluirIdentificacaoOp: saved.incluirIdentificacaoOp ?? false,
    modoEnvioCss: saved.modoEnvioCss || "dimensoes_puras",
    deslocamentoVerticalMm: saved.deslocamentoVerticalMm ?? 0,
    deslocamentoHorizontalMm: saved.deslocamentoHorizontalMm ?? 0,
    espacamentoColunasMm: saved.espacamentoColunasMm ?? 2,
    modoSaidaImpressao: (saved.modoSaidaImpressao as any) || "arquivo_prn",
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
  const singleWidthMm = config.larguraMm || (config.tamanhoEtiqueta === "60x40" ? 60 : 43);
  const singleHeightMm = config.alturaMm || (config.tamanhoEtiqueta === "60x40" ? 40 : 24);
  const is2Col = config.formatoRolo === "2_colunas";
  const gapMm = config.espacamentoColunasMm ?? 2;
  const offX = config.deslocamentoHorizontalMm ?? 0;
  const offY = config.deslocamentoVerticalMm ?? 0;

  // Largura total da folha/rolo
  const pageWidthMm = is2Col ? singleWidthMm * 2 + gapMm : singleWidthMm;
  const pageHeightMm = singleHeightMm;
  const modoEnvio = config.modoEnvioCss || "dimensoes_puras";

  // Configuração precisa de tamanho de página e dimensões do body para evitar giros indesejados no Chrome
  const isRotated = config.orientacao === "rotacionada_90" || config.orientacao === "rotacionada_270";

  let pageSizeCss = `${pageWidthMm}mm ${pageHeightMm}mm`;
  let bodyWidthMm = pageWidthMm;
  let bodyHeightMm = pageHeightMm;

  if (isRotated) {
    if (modoEnvio === "forcar_retrato") {
      pageSizeCss = `${pageHeightMm}mm ${pageWidthMm}mm portrait`;
    } else if (modoEnvio === "forcar_paisagem") {
      pageSizeCss = `${pageWidthMm}mm ${pageHeightMm}mm landscape`;
    } else if (modoEnvio === "tamanho_invertido") {
      pageSizeCss = `${pageHeightMm}mm ${pageWidthMm}mm`;
    } else {
      pageSizeCss = `${pageHeightMm}mm ${pageWidthMm}mm`;
    }
    bodyWidthMm = pageHeightMm;
    bodyHeightMm = pageWidthMm;
  } else if (config.orientacao === "vertical") {
    if (modoEnvio === "forcar_retrato") {
      pageSizeCss = `${pageWidthMm}mm ${pageHeightMm}mm portrait`;
    } else if (modoEnvio === "tamanho_invertido") {
      pageSizeCss = `${pageHeightMm}mm ${pageWidthMm}mm`;
      bodyWidthMm = pageHeightMm;
      bodyHeightMm = pageWidthMm;
    } else {
      pageSizeCss = `${pageWidthMm}mm ${pageHeightMm}mm`;
    }
  } else {
    // horizontal ou invertida_180
    if (modoEnvio === "forcar_paisagem") {
      pageSizeCss = `${pageWidthMm}mm ${pageHeightMm}mm landscape`;
    } else if (modoEnvio === "forcar_retrato") {
      pageSizeCss = `${pageWidthMm}mm ${pageHeightMm}mm portrait`;
    } else if (modoEnvio === "tamanho_invertido") {
      pageSizeCss = `${pageHeightMm}mm ${pageWidthMm}mm`;
      bodyWidthMm = pageHeightMm;
      bodyHeightMm = pageWidthMm;
    } else {
      // Padrão Puro Milimétrico: Chrome respeita exatamente 88x24 sem girar!
      pageSizeCss = `${pageWidthMm}mm ${pageHeightMm}mm`;
    }
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

  // Helper para encapsular o conteúdo de acordo com a rotação
  const wrapPageContent = (innerHtml: string) => {
    const shiftCss = offX !== 0 || offY !== 0 ? `transform: translate(${offX}mm, ${offY}mm);` : "";
    if (config.orientacao === "rotacionada_270") {
      return `
      <div class="page-wrapper-rot270" style="width: ${pageHeightMm}mm; height: ${pageWidthMm}mm; position: relative; overflow: hidden; page-break-after: always; break-after: page;">
        <div style="width: ${pageWidthMm}mm; height: ${pageHeightMm}mm; position: absolute; top: 0; left: 0; transform-origin: 0 0; transform: rotate(-90deg) translateX(-${pageWidthMm}mm) translate(${offX}mm, ${offY}mm); display: flex; flex-direction: row; align-items: center; justify-content: space-between;">
          ${innerHtml}
        </div>
      </div>`;
    }
    if (config.orientacao === "rotacionada_90") {
      return `
      <div class="page-wrapper-rot90" style="width: ${pageHeightMm}mm; height: ${pageWidthMm}mm; position: relative; overflow: hidden; page-break-after: always; break-after: page;">
        <div style="width: ${pageWidthMm}mm; height: ${pageHeightMm}mm; position: absolute; top: 0; left: 0; transform-origin: 0 0; transform: rotate(90deg) translateY(-${pageHeightMm}mm) translate(${offX}mm, ${offY}mm); display: flex; flex-direction: row; align-items: center; justify-content: space-between;">
          ${innerHtml}
        </div>
      </div>`;
    }
    if (config.orientacao === "invertida_180") {
      return `
      <div class="page-wrapper-inv180" style="width: ${pageWidthMm}mm; height: ${pageHeightMm}mm; overflow: hidden; page-break-after: always; break-after: page; transform: rotate(180deg) translate(${offX}mm, ${offY}mm); transform-origin: center center; display: flex; flex-direction: row; align-items: center; justify-content: space-between;">
        ${innerHtml}
      </div>`;
    }
    return `
    <div class="etiqueta-page-row" style="width: ${pageWidthMm}mm; height: ${pageHeightMm}mm; display: flex; flex-direction: row; align-items: center; justify-content: space-between; page-break-after: always; break-after: page; overflow: hidden; ${shiftCss}">
      ${innerHtml}
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
        ([item1, item2]) =>
          wrapPageContent(`
            ${renderCardHtml(item1)}
            <div class="col-gap" style="width: ${gapMm}mm;"></div>
            ${renderCardHtml(item2)}
          `)
      )
      .join("");
  } else {
    bodyContent = baseItens
      .map((item) => wrapPageContent(renderCardHtml(item)))
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
      margin: 0 !important;
    }
    @media print {
      @page {
        size: ${pageSizeCss};
        margin: 0 !important;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: ${bodyWidthMm}mm !important;
        height: ${bodyHeightMm}mm !important;
        overflow: hidden !important;
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

  // Deslocamento milimétrico convertido para dots (203 DPI = 8 dots/mm)
  const offXdots = Math.round((config.deslocamentoHorizontalMm || 0) * 8);
  const offYdots = Math.round((config.deslocamentoVerticalMm || 0) * 8);
  const lhCommand = (offXdots !== 0 || offYdots !== 0)
    ? `^LH${Math.max(0, offXdots)},${Math.max(0, offYdots)}`
    : "^LH0,0";

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
${lhCommand}
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
${lhCommand}
${buildSingleLabelZpl(item, 6)}
^XZ`;
    })
    .join("\n\n");
}

/**
 * Baixa um arquivo diretamente no computador do operador (Windows)
 */
export function downloadEtiquetaFile(
  content: string,
  filename: string,
  mimeType: string = "text/plain;charset=utf-8"
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Gera arquivo de dados CSV com todas as bobinas selecionadas
 * Pronto para importação direta no ZebraDesigner 3, Seagull BarTender, NiceLabel ou Excel
 */
export function generateCsvData(
  itens: EtiquetaBobinaItem[],
  config: EtiquetaZebraData
): string {
  const headers = [
    "OP",
    "BOBINA_POSICAO",
    "CODIGO_BOBINA",
    "CLIENTE_PRODUTO",
    "TIPO_FILME",
    "APLICACAO",
    "MEDIDAS",
    "PESO_BRUTO_KG",
    "TARA_KG",
    "PESO_LIQUIDO_KG",
    "DATA_IMPRESSAO",
    "HORARIO",
    "CODIGO_BARRAS",
  ];

  const rows = itens.map((item) => {
    return [
      config.codigoOp || "",
      item.posicao,
      item.codigoBobina || `BOB-${item.posicao.toString().padStart(2, "0")}`,
      config.aplicacao || "",
      config.tipoFilme || "",
      config.aplicacao || "",
      config.medidas || "",
      item.pesoBruto > 0 ? item.pesoBruto.toFixed(1) : "",
      item.tara > 0 ? item.tara.toFixed(1) : "",
      item.pesoLiquido > 0 ? item.pesoLiquido.toFixed(1) : "",
      config.dataImpressao || "",
      item.horario || "",
      `${config.codigoOp || "OP"}-${item.posicao}`,
    ]
      .map((val) => `"${String(val).replace(/"/g, '""')}"`)
      .join(";");
  });

  return [headers.join(";"), ...rows].join("\r\n");
}

/**
 * Gera script executável do Windows (.bat) para enviar o arquivo .prn diretamente à Zebra
 * com apenas 1 duplo-clique, sem passar por navegador
 */
export function generateBatScript(
  prnFilename: string,
  printerName: string = "Zebra"
): string {
  return `@echo off
chcp 65001 > nul
cls
echo ===================================================================
echo   FORPACK EMBALAGENS - ENVIO DIRETO DE ETIQUETAS ZEBRA NO WINDOWS
echo ===================================================================
echo.
echo Arquivo de etiquetas selecionado: ${prnFilename}
echo.

if not exist "%~dp0${prnFilename}" (
    echo [ERRO] O arquivo "${prnFilename}" nao foi encontrado nesta pasta.
    echo Por favor, coloque este arquivo .bat e o arquivo "${prnFilename}" juntos na mesma pasta (ex: Downloads).
    echo.
    pause
    exit /b 1
)

echo Tentando enviar para a impressora Zebra no Windows...
echo [Metodo 1] Enviando para compartilhamento local \\\\127.0.0.1\\${printerName} ...
copy /b "%~dp0${prnFilename}" "\\\\127.0.0.1\\${printerName}" > nul 2>&1
if not errorlevel 1 (
    echo.
    echo [SUCESSO] Etiquetas enviadas com sucesso para a Zebra!
    echo.
    timeout /t 3 > nul
    exit /b 0
)

echo [Metodo 2] Enviando via comando PRINT do Windows (/D:"${printerName}") ...
print /d:"${printerName}" "%~dp0${prnFilename}" > nul 2>&1
if not errorlevel 1 (
    echo.
    echo [SUCESSO] Etiquetas enviadas para a fila de impressao da ${printerName}!
    echo.
    timeout /t 3 > nul
    exit /b 0
)

echo.
echo ===================================================================
echo AVISO: O envio automatico via script encontrou um bloqueio de porta.
echo.
echo OPCOES SIMPLES PARA IMPRIMIR NO WINDOWS:
echo 1) Zebra Setup Utilities (Mais facil e confiavel):
echo    - Abra o Zebra Setup Utilities
echo    - Selecione sua impressora e clique em "Action" ^> "Send File"
echo    - Selecione o arquivo "${prnFilename}".
echo.
echo 2) Compartilhar a impressora no Windows com o nome "${printerName}":
echo    - Painel de Controle ^> Dispositivos e Impressoras
echo    - Clique com botao direito na Zebra ^> Propriedades da Impressora
echo    - Aba "Compartilhamento" ^> Marque "Compartilhar esta impressora"
echo    - Nome do compartilhamento: ${printerName}
echo    - Apos isso, execute este arquivo .bat novamente!
echo ===================================================================
echo.
pause
`;
}

/**
 * Função principal que executa a saída de etiquetas:
 * - Gera e baixa arquivo .PRN / .ZPL (Recomendado para Windows - sem corte/rotação)
 * - Gera e baixa arquivo de dados .CSV
 * - Gera script Windows .BAT
 * - Ou abre diálogo direto do navegador
 */
export function emitirEtiquetasZebra(
  itens: EtiquetaBobinaItem[],
  config: EtiquetaZebraData,
  forceAction?: "arquivo_prn" | "arquivo_csv" | "arquivo_bat" | "navegador"
): { type: "download" | "print"; filename?: string } {
  const action = forceAction || config.modoSaidaImpressao || "arquivo_prn";

  if (action === "arquivo_prn") {
    const zpl = generateZplCode(itens, config);
    const opPart = config.codigoOp ? `OP_${config.codigoOp}` : "Bobinas";
    const posPart =
      itens.length === 1
        ? `_bobina_${itens[0].posicao}`
        : `_${itens.length}_bobinas`;
    const filename = `etiquetas_zebra_${opPart}${posPart}.prn`;
    downloadEtiquetaFile(zpl, filename, "text/plain;charset=utf-8");
    return { type: "download", filename };
  }

  if (action === "arquivo_csv") {
    const csv = generateCsvData(itens, config);
    const opPart = config.codigoOp ? `OP_${config.codigoOp}` : "Bobinas";
    const filename = `dados_bobinas_zebra_${opPart}.csv`;
    downloadEtiquetaFile(csv, filename, "text/csv;charset=utf-8");
    return { type: "download", filename };
  }

  if (action === "arquivo_bat") {
    const zpl = generateZplCode(itens, config);
    const opPart = config.codigoOp ? `OP_${config.codigoOp}` : "Bobinas";
    const prnName = `etiquetas_${opPart}.prn`;
    downloadEtiquetaFile(zpl, prnName, "text/plain;charset=utf-8");
    const batContent = generateBatScript(prnName);
    downloadEtiquetaFile(batContent, `imprimir_${opPart}_windows.bat`, "text/plain;charset=utf-8");
    return { type: "download", filename: prnName };
  }

  // Fallback: Diálogo direto do navegador
  printEtiquetasZebra(itens, config);
  return { type: "print" };
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
  const [savedNotice, setSavedNotice] = useState(false);

  // Tab mode
  const [tab, setTab] = useState<"preview" | "arquivos" | "lote" | "guia" | "zpl">("preview");
  const [downloadToast, setDownloadToast] = useState<{ title: string; message: string } | null>(null);

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

  // Atualização com salvamento automático persistente no navegador
  const updateConfig = (patch: Partial<EtiquetaZebraData>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      saveEtiquetaZebraPreferences(next);
      return next;
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2200);
  };

  const handleResetToDefaults = () => {
    resetEtiquetaZebraPreferences();
    setConfig(inferEtiquetaZebraData(order, palete));
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2200);
  };

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

  const showToast = (title: string, message: string) => {
    setDownloadToast({ title, message });
    setTimeout(() => setDownloadToast(null), 5000);
  };

  const handleEmitir = (forceAction?: "arquivo_prn" | "arquivo_csv" | "arquivo_bat" | "navegador") => {
    const res = emitirEtiquetasZebra(targetItens, config, forceAction);
    if (res.type === "download") {
      showToast(
        "Arquivo Gerado com Sucesso!",
        `O arquivo "${res.filename}" foi baixado. Pronto para impressão direta no Windows.`
      );
    }
  };

  const handleEmitirTest = (forceAction?: "arquivo_prn" | "arquivo_csv" | "navegador") => {
    // Imprime ou gera arquivo com apenas 1 avanço (1 par em 2 colunas) para testar alinhamento
    const testItem: EtiquetaBobinaItem = {
      posicao: 1,
      pesoBruto: previewBobina.pesoBruto > 0 ? previewBobina.pesoBruto : 28.5,
      tara: 1.6,
      pesoLiquido: previewBobina.pesoLiquido > 0 ? previewBobina.pesoLiquido : 26.9,
      codigoBobina: "TESTE",
    };
    const res = emitirEtiquetasZebra([testItem], config, forceAction);
    if (res.type === "download") {
      showToast(
        "Teste Gerado com Sucesso!",
        `O arquivo de teste "${res.filename}" foi baixado para validação direta no Windows.`
      );
    }
  };

  const handleCopyZpl = () => {
    navigator.clipboard.writeText(zplString);
    setCopiedZpl(true);
    setTimeout(() => setCopiedZpl(false), 2500);
  };

  // Preview card transform style based on selected orientation
  const previewRotationStyle = useMemo(() => {
    if (config.orientacao === "rotacionada_270") {
      return { transform: "rotate(-90deg) scale(0.92)", transition: "transform 0.2s ease" };
    }
    if (config.orientacao === "rotacionada_90") {
      return { transform: "rotate(90deg) scale(0.92)", transition: "transform 0.2s ease" };
    }
    if (config.orientacao === "invertida_180") {
      return { transform: "rotate(180deg)", transition: "transform 0.2s ease" };
    }
    return { transform: "none", transition: "transform 0.2s ease" };
  }, [config.orientacao]);

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
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                  IMPRESSORA TÉRMICA ZEBRA
                </span>
                <span className="text-[9px] font-mono bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded border border-blue-400/30 font-bold">
                  {config.tamanhoEtiqueta === "43x24" ? "4,30 x 2,40 cm (Horizontal)" : `${config.tamanhoEtiqueta} mm`}
                </span>
                {config.formatoRolo === "2_colunas" && (
                  <span className="text-[9px] font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-400/30 font-bold">
                    2 Colunas (88 mm total)
                  </span>
                )}
                {savedNotice && (
                  <span className="text-[9px] font-bold bg-emerald-500/30 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-400/40 flex items-center gap-1 animate-pulse">
                    <Check className="w-2.5 h-2.5" />
                    <span>Salvo no Navegador</span>
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
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-2 gap-2 text-xs font-semibold shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              tab === "preview"
                ? "border-blue-600 text-blue-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-blue-600" />
            <span>Sentido & Alinhamento</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("arquivos")}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              tab === "arquivos"
                ? "border-emerald-600 text-emerald-700 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileDown className="w-3.5 h-3.5 text-emerald-600" />
            <span className="flex items-center gap-1">
              <span>Arquivos Windows (Direto)</span>
              <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-black">
                Solução
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("lote")}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              tab === "lote"
                ? "border-blue-600 text-blue-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Escopo ({targetItens.length} etiquetas)</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("guia")}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              tab === "guia"
                ? "border-blue-600 text-blue-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Wrench className="w-3.5 h-3.5 text-amber-500" />
            <span>Guia da Impressora & Driver</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("zpl")}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              tab === "zpl"
                ? "border-blue-600 text-blue-600 font-bold"
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
            <div className="space-y-4">
              {/* CARD: IMPRESSÃO DIRETA NO WINDOWS (GERAÇÃO DE ARQUIVO) */}
              <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-3.5 rounded-xl border border-blue-400/30 shadow-sm space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
                      <FileDown className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-2">
                        <span>Impressão Direta no Windows (Geração de Arquivo)</span>
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-1.5 py-0.2 rounded font-black">
                          Recomendado
                        </span>
                      </h4>
                      <p className="text-[10.5px] text-blue-200/80">
                        Elimina o diálogo do navegador — o arquivo é impresso direto pelo Windows sem margens erradas ou giros indesejados.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab("arquivos")}
                    className="text-[10px] text-blue-300 hover:text-white underline cursor-pointer ml-auto font-semibold"
                  >
                    Ver instruções completas →
                  </button>
                </div>

                {/* SELETOR DO MODO DE SAÍDA */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => updateConfig({ modoSaidaImpressao: "arquivo_prn" })}
                    className={`p-2 rounded-lg text-left transition cursor-pointer border flex flex-col justify-between ${
                      (config.modoSaidaImpressao || "arquivo_prn") === "arquivo_prn"
                        ? "bg-blue-600/50 border-blue-400 text-white shadow-2xs"
                        : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold flex items-center gap-1.5">
                        <FileDown className="w-3.5 h-3.5 text-blue-300" />
                        Arquivo .PRN / .ZPL
                      </span>
                      {(config.modoSaidaImpressao || "arquivo_prn") === "arquivo_prn" && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </div>
                    <span className="text-[9.5px] text-blue-200/70">
                      Código nativo Zebra. Envio sem distorção.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateConfig({ modoSaidaImpressao: "arquivo_csv" })}
                    className={`p-2 rounded-lg text-left transition cursor-pointer border flex flex-col justify-between ${
                      config.modoSaidaImpressao === "arquivo_csv"
                        ? "bg-blue-600/50 border-blue-400 text-white shadow-2xs"
                        : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold flex items-center gap-1.5">
                        <Table className="w-3.5 h-3.5 text-amber-300" />
                        Planilha .CSV
                      </span>
                      {config.modoSaidaImpressao === "arquivo_csv" && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </div>
                    <span className="text-[9.5px] text-blue-200/70">
                      Para BarTender, ZebraDesigner 3 ou Excel.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateConfig({ modoSaidaImpressao: "navegador" })}
                    className={`p-2 rounded-lg text-left transition cursor-pointer border flex flex-col justify-between ${
                      config.modoSaidaImpressao === "navegador"
                        ? "bg-blue-600/50 border-blue-400 text-white shadow-2xs"
                        : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold flex items-center gap-1.5">
                        <Printer className="w-3.5 h-3.5 text-slate-300" />
                        Diálogo Navegador
                      </span>
                      {config.modoSaidaImpressao === "navegador" && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </div>
                    <span className="text-[9.5px] text-blue-200/70">
                      Janela comum do Chrome / Edge (Ctrl+P).
                    </span>
                  </button>
                </div>

                {/* BOTÕES RÁPIDOS DE DOWNLOAD IMEDIATO */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/10">
                  <span className="text-[10px] text-blue-200 font-semibold mr-1">Baixar agora:</span>
                  <button
                    type="button"
                    onClick={() => handleEmitir("arquivo_prn")}
                    className="px-2.5 py-1 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-lg text-[10.5px] flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                    title="Baixa arquivo .PRN de todas as bobinas selecionadas"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Baixar .PRN ({targetItens.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEmitir("arquivo_csv")}
                    className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white font-bold rounded-lg text-[10.5px] flex items-center gap-1.5 transition cursor-pointer border border-white/20 active:scale-95"
                    title="Baixa arquivo CSV formatado para BarTender ou ZebraDesigner"
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>Baixar .CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEmitir("arquivo_bat")}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[10.5px] flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                    title="Baixa o .prn acompanhado do script .bat do Windows para enviar com duplo-clique"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Script Windows .BAT</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              {/* COLUNA ESQUERDA: SIMULADOR REAL DO ROLO TÉRMICO COM SENTIDO DE SAÍDA */}
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-1.5 px-1">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-blue-600" />
                    <span>Sentido Físico no Rolo</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {config.orientacao === "rotacionada_270"
                      ? "Giro -90° (Compensado)"
                      : config.orientacao === "rotacionada_90"
                      ? "Giro +90°"
                      : config.orientacao === "invertida_180"
                      ? "Invertido 180°"
                      : "Horizontal 0°"}
                  </span>
                </div>

                {/* SIMULADOR DO ROLO DE ETIQUETAS */}
                <div className="p-3.5 bg-slate-800 rounded-xl border border-slate-700 shadow-inner flex flex-col items-center justify-center w-full gap-2 text-white">
                  {/* CABEÇOTE DA IMPRESSORA / INDICADOR DE SAÍDA */}
                  <div className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1 px-2.5 flex items-center justify-between text-[10px] text-amber-300 font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <Printer className="w-3.5 h-3.5 text-amber-400" />
                      <span>Cabeçote Térmico Zebra</span>
                    </span>
                    <span className="flex items-center gap-1 text-[9px] text-amber-200">
                      <span>Saída do Papel</span>
                      <ArrowDown className="w-3 h-3 text-amber-400 animate-bounce" />
                    </span>
                  </div>

                  {/* SIMULAÇÃO DO PAPEL SILICONE COM 2 PISTAS LADO A LADO */}
                  <div className="bg-amber-100/90 rounded-md p-2 border border-amber-300 shadow-md w-full flex items-center justify-center gap-2 overflow-x-auto min-h-[145px]">
                    {/* PISTA 1 (ESQUERDA) */}
                    <div
                      className="bg-white text-slate-900 border border-slate-400 rounded-[5px] p-2 shadow-md flex flex-col justify-between text-center select-none shrink-0"
                      style={{
                        width: "165px",
                        height: "105px",
                        fontFamily: "Arial, Helvetica, sans-serif",
                        ...previewRotationStyle,
                      }}
                    >
                      <div>
                        {/* LINHA 1: FILME PEBD IMP */}
                        <div className="font-black text-[9.5px] tracking-wide uppercase leading-tight truncate">
                          {config.tipoFilme || "FILME PEBD IMP"}
                        </div>
                        {/* LINHA 2: PIPOCA LYPE */}
                        <div className="font-bold text-[8.5px] tracking-tight uppercase leading-tight mt-0.5 truncate text-slate-800">
                          {config.aplicacao || "PIPOCA LYPE"}
                        </div>
                        {/* LINHA 3: 69X0,028 */}
                        <div className="font-black text-[10.5px] tracking-wider leading-tight mt-0.5">
                          {config.medidas || "69X0,028"}
                        </div>
                      </div>

                      {/* LINHA 4: PESO B: ... L: ... */}
                      <div className="font-bold text-[8.5px] tracking-wide my-0.5 flex items-center justify-start gap-1 px-0.5">
                        <span className="font-black">PESO B:</span>
                        <span className="font-bold font-mono text-[8.5px] min-w-[28px] text-left">
                          {config.imprimirPesos && previewBobina.pesoBruto > 0
                            ? previewBobina.pesoBruto.toFixed(1)
                            : ""}
                        </span>
                        <span className="font-black ml-1">L:</span>
                        <span className="font-bold font-mono text-[8.5px] min-w-[28px] text-left">
                          {config.imprimirPesos && previewBobina.pesoLiquido > 0
                            ? previewBobina.pesoLiquido.toFixed(1)
                            : ""}
                        </span>
                      </div>

                      {/* LINHA 5: DATA E FORPACK */}
                      <div>
                        <div className="flex items-center justify-between pt-0.5 border-t border-slate-200 px-0.5">
                          <span className="font-bold text-[7.5px] text-slate-800">
                            DATA: {config.dataImpressao}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 bg-black text-white rounded-full flex items-center justify-center font-bold font-serif text-[6px] leading-none pb-0.5">
                              f
                            </span>
                            <span className="font-black text-[7.5px] tracking-tight text-slate-900">
                              Forpack
                            </span>
                          </div>
                        </div>
                        {config.incluirIdentificacaoOp && (
                          <div className="text-[6px] text-slate-500 font-mono tracking-tighter mt-0.5 truncate">
                            OP #{config.codigoOp || "—"} · {previewBobina.codigoBobina || `BOB #${previewBobina.posicao}`}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* PISTA 2 (DIREITA) */}
                    {config.formatoRolo === "2_colunas" && (
                      <div
                        className="bg-white text-slate-900 border border-slate-400 rounded-[5px] p-2 shadow-md flex flex-col justify-between text-center select-none shrink-0"
                        style={{
                          width: "165px",
                          height: "105px",
                          fontFamily: "Arial, Helvetica, sans-serif",
                          ...previewRotationStyle,
                        }}
                      >
                        <div>
                          <div className="font-black text-[9.5px] tracking-wide uppercase leading-tight truncate">
                            {config.tipoFilme || "FILME PEBD IMP"}
                          </div>
                          <div className="font-bold text-[8.5px] tracking-tight uppercase leading-tight mt-0.5 truncate text-slate-800">
                            {config.aplicacao || "PIPOCA LYPE"}
                          </div>
                          <div className="font-black text-[10.5px] tracking-wider leading-tight mt-0.5">
                            {config.medidas || "69X0,028"}
                          </div>
                        </div>

                        <div className="font-bold text-[8.5px] tracking-wide my-0.5 flex items-center justify-start gap-1 px-0.5">
                          <span className="font-black">PESO B:</span>
                          <span className="font-bold font-mono text-[8.5px] min-w-[28px] text-left">
                            {config.imprimirPesos && (config.duplicarPistas ? previewBobina.pesoBruto : (allBobinas[1]?.pesoBruto || 0)) > 0
                              ? (config.duplicarPistas ? previewBobina.pesoBruto : allBobinas[1]!.pesoBruto).toFixed(1)
                              : ""}
                          </span>
                          <span className="font-black ml-1">L:</span>
                          <span className="font-bold font-mono text-[8.5px] min-w-[28px] text-left">
                            {config.imprimirPesos && (config.duplicarPistas ? previewBobina.pesoLiquido : (allBobinas[1]?.pesoLiquido || 0)) > 0
                              ? (config.duplicarPistas ? previewBobina.pesoLiquido : allBobinas[1]!.pesoLiquido).toFixed(1)
                              : ""}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center justify-between pt-0.5 border-t border-slate-200 px-0.5">
                            <span className="font-bold text-[7.5px] text-slate-800">
                              DATA: {config.dataImpressao}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="w-2.5 h-2.5 bg-black text-white rounded-full flex items-center justify-center font-bold font-serif text-[6px] leading-none pb-0.5">
                                f
                              </span>
                              <span className="font-black text-[7.5px] tracking-tight text-slate-900">
                                Forpack
                              </span>
                            </div>
                          </div>
                          {config.incluirIdentificacaoOp && (
                            <div className="text-[6px] text-slate-500 font-mono tracking-tighter mt-0.5 truncate">
                              OP #{config.codigoOp || "—"} · {config.duplicarPistas ? (previewBobina.codigoBobina || `BOB #${previewBobina.posicao}`) : (allBobinas[1]?.codigoBobina || "BOB #02")}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* LEGENDA DO AVANÇO */}
                  <div className="w-full flex items-center justify-between text-[10px] text-slate-400 px-1 pt-0.5">
                    <span>Largura do rolo: <strong>88 mm (Pistas duplas)</strong></span>
                    <span>Avanço: <strong>24 mm por etiqueta</strong></span>
                  </div>
                </div>

                {/* BOTÃO RÁPIDO PARA TESTAR NA IMPRESSORA FÍSICA */}
                <div className="mt-3 w-full flex items-center justify-between gap-2 p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl">
                  <div className="text-left">
                    <span className="text-[11px] font-bold text-emerald-950 block">
                      Validação Imediata na Zebra:
                    </span>
                    <span className="text-[10px] text-emerald-800 block">
                      Imprime apenas 1 avanço para confirmar o sentido físico.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEmitirTest()}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer active:scale-95 shrink-0"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Testar 1 Par Agora</span>
                  </button>
                </div>
              </div>

              {/* COLUNA DIREITA: SELEÇÃO DE SENTIDO & ASSISTENTE INTELIGENTE DE RESOLUÇÃO */}
              <div className="space-y-3.5 text-xs">
                {/* 1. SELETOR DE SENTIDO / ORIENTAÇÃO */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 uppercase tracking-wide text-[10.5px] flex items-center gap-1.5">
                      <Compass className="w-4 h-4 text-blue-600" />
                      <span>Sentido da Impressão (Orientação)</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleResetToDefaults}
                      className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                      title="Restaura os padrões de fábrica"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restaurar Padrão</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-tight">
                    Escolha a direção em que o texto é enviado para a impressora. Se a sua etiqueta estiver saindo de lado, selecione o <strong>Modo 2</strong>:
                  </p>

                  {/* 4 BOTÕES DE SENTIDO ILUSTRADOS */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* MODO 1: HORIZONTAL 0° */}
                    <button
                      type="button"
                      onClick={() => updateConfig({ orientacao: "horizontal", modoEnvioCss: "dimensoes_puras" })}
                      className={`p-2 rounded-xl text-left transition cursor-pointer border ${
                        config.orientacao === "horizontal"
                          ? "bg-blue-600 text-white border-blue-700 font-bold shadow-xs ring-2 ring-blue-400/30"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold">1. Horizontal (0°)</span>
                        <ArrowRight className={`w-3.5 h-3.5 ${config.orientacao === "horizontal" ? "text-white" : "text-slate-400"}`} />
                      </div>
                      <span className={`text-[10px] block ${config.orientacao === "horizontal" ? "text-blue-100" : "text-slate-500"}`}>
                        Texto no sentido da largura do rolo (88x24 mm)
                      </span>
                    </button>

                    {/* MODO 2: GIRAR -90° (COMPENSAR GIRO ZEBRA/CHROME) */}
                    <button
                      type="button"
                      onClick={() => updateConfig({ orientacao: "rotacionada_270", modoEnvioCss: "dimensoes_puras" })}
                      className={`p-2 rounded-xl text-left transition cursor-pointer border ${
                        config.orientacao === "rotacionada_270"
                          ? "bg-amber-600 text-white border-amber-700 font-bold shadow-xs ring-2 ring-amber-400/50"
                          : "bg-amber-50/70 border-amber-300 text-amber-950 hover:bg-amber-100/70"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold flex items-center gap-1">
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>2. Girar -90° (Compensar)</span>
                        </span>
                        <span className="text-[8px] uppercase tracking-wider bg-amber-200 text-amber-900 px-1 py-0.2 rounded font-black">
                          Solução
                        </span>
                      </div>
                      <span className={`text-[10px] block ${config.orientacao === "rotacionada_270" ? "text-amber-100" : "text-amber-800"}`}>
                        Corrige se sair de lado cortando na vertical (Foto 1)
                      </span>
                    </button>

                    {/* MODO 3: GIRAR +90° */}
                    <button
                      type="button"
                      onClick={() => updateConfig({ orientacao: "rotacionada_90", modoEnvioCss: "dimensoes_puras" })}
                      className={`p-2 rounded-xl text-left transition cursor-pointer border ${
                        config.orientacao === "rotacionada_90"
                          ? "bg-blue-600 text-white border-blue-700 font-bold shadow-xs ring-2 ring-blue-400/30"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold flex items-center gap-1">
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>3. Girar +90°</span>
                        </span>
                      </div>
                      <span className={`text-[10px] block ${config.orientacao === "rotacionada_90" ? "text-blue-100" : "text-slate-500"}`}>
                        Sentido horário ao longo do avanço
                      </span>
                    </button>

                    {/* MODO 4: INVERTER 180° */}
                    <button
                      type="button"
                      onClick={() => updateConfig({ orientacao: "invertida_180", modoEnvioCss: "dimensoes_puras" })}
                      className={`p-2 rounded-xl text-left transition cursor-pointer border ${
                        config.orientacao === "invertida_180"
                          ? "bg-blue-600 text-white border-blue-700 font-bold shadow-xs ring-2 ring-blue-400/30"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold flex items-center gap-1">
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>4. Inverter 180°</span>
                        </span>
                      </div>
                      <span className={`text-[10px] block ${config.orientacao === "invertida_180" ? "text-blue-100" : "text-slate-500"}`}>
                        De ponta-cabeça (inverte direção de leitura)
                      </span>
                    </button>
                  </div>
                </div>

                {/* 2. ASSISTENTE RÁPIDO DE DIAGNÓSTICO EM 1 CLIQUE */}
                <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="font-bold text-xs text-blue-950">
                      Assistente de Resolução em 1 Clique:
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-900 leading-snug">
                    Como a etiqueta saiu impressa no papel físico da sua máquina Zebra?
                  </p>

                  <div className="space-y-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        updateConfig({ orientacao: "rotacionada_270", modoEnvioCss: "dimensoes_puras" });
                        handleEmitirTest();
                      }}
                      className="w-full p-2 bg-white hover:bg-amber-50 border border-amber-300 rounded-lg text-left flex items-center justify-between transition cursor-pointer group shadow-2xs"
                    >
                      <div>
                        <strong className="text-[11px] text-amber-950 block group-hover:text-amber-800">
                          👉 "O texto saiu em pé / deitado cortando as laterais"
                        </strong>
                        <span className="text-[10px] text-slate-600 block">
                          Aplica compensação de -90° e dispara teste imediatamente
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded shrink-0">
                        Corrigir Agora
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        updateConfig({ orientacao: "invertida_180" });
                        handleEmitirTest();
                      }}
                      className="w-full p-2 bg-white hover:bg-blue-100/60 border border-blue-200 rounded-lg text-left flex items-center justify-between transition cursor-pointer group shadow-2xs"
                    >
                      <div>
                        <strong className="text-[11px] text-blue-950 block group-hover:text-blue-800">
                          👉 "O texto saiu de cabeça para baixo"
                        </strong>
                        <span className="text-[10px] text-slate-600 block">
                          Gira 180° e dispara teste de validação
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded shrink-0">
                        Inverter
                      </span>
                    </button>
                  </div>
                </div>

                {/* 3. AJUSTES AVANÇADOS DE DRIVER & DESLOCAMENTO */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                  <span className="font-bold text-slate-800 uppercase tracking-wide text-[10.5px] block">
                    Modo de Envio ao Driver & Calibração Fina (mm)
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* MODO DE ENVIO CSS */}
                    <div>
                      <label className="block text-[10.5px] font-semibold text-slate-700 mb-1">
                        Modo CSS @page do Navegador
                      </label>
                      <select
                        value={config.modoEnvioCss || "dimensoes_puras"}
                        onChange={(e) => updateConfig({ modoEnvioCss: e.target.value as any })}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-[11px] font-semibold text-slate-800"
                      >
                        <option value="dimensoes_puras">Puro Milimétrico (88x24 mm - Sem Landscape)</option>
                        <option value="forcar_paisagem">Forçar Paisagem no Chrome</option>
                        <option value="forcar_retrato">Forçar Retrato no Chrome</option>
                        <option value="tamanho_invertido">Inverter Largura/Altura (24x88 mm)</option>
                      </select>
                      <span className="text-[9.5px] text-slate-500 mt-0.5 block">
                        O modo Puro Milimétrico impede o Chrome de rotacionar o rolo.
                      </span>
                    </div>

                    {/* GAP ENTRE AS PISTAS */}
                    <div>
                      <label className="block text-[10.5px] font-semibold text-slate-700 mb-1">
                        Espaçamento entre Pistas (Gap)
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          max="8"
                          step="0.5"
                          value={config.espacamentoColunasMm ?? 2}
                          onChange={(e) => updateConfig({ espacamentoColunasMm: parseFloat(e.target.value) || 0 })}
                          className="w-20 px-2 py-1.5 bg-white border border-slate-300 rounded-md text-[11px] font-bold text-slate-900"
                        />
                        <span className="text-[11px] text-slate-600 font-semibold">mm</span>
                        <span className="text-[9.5px] text-slate-400 ml-auto">Padrão Forpack: 2,0 mm</span>
                      </div>
                    </div>
                  </div>

                  {/* DESLOCAMENTOS VERTICAL E HORIZONTAL (OFFSET EM MM) */}
                  <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10.5px] font-semibold text-slate-700 mb-0.5">
                        Deslocamento Vertical (+/- mm)
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateConfig({ deslocamentoVerticalMm: (config.deslocamentoVerticalMm ?? 0) - 1 })}
                          className="px-2 py-1 bg-white hover:bg-slate-200 border border-slate-300 rounded text-xs font-bold cursor-pointer"
                        >
                          -1
                        </button>
                        <input
                          type="number"
                          step="0.5"
                          value={config.deslocamentoVerticalMm ?? 0}
                          onChange={(e) => updateConfig({ deslocamentoVerticalMm: parseFloat(e.target.value) || 0 })}
                          className="w-14 px-1 py-1 bg-white border border-slate-300 rounded text-center text-xs font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => updateConfig({ deslocamentoVerticalMm: (config.deslocamentoVerticalMm ?? 0) + 1 })}
                          className="px-2 py-1 bg-white hover:bg-slate-200 border border-slate-300 rounded text-xs font-bold cursor-pointer"
                        >
                          +1
                        </button>
                      </div>
                      <span className="text-[9px] text-slate-500 block mt-0.5">Sobe ou desce o texto</span>
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-semibold text-slate-700 mb-0.5">
                        Deslocamento Horizontal (+/- mm)
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateConfig({ deslocamentoHorizontalMm: (config.deslocamentoHorizontalMm ?? 0) - 1 })}
                          className="px-2 py-1 bg-white hover:bg-slate-200 border border-slate-300 rounded text-xs font-bold cursor-pointer"
                        >
                          -1
                        </button>
                        <input
                          type="number"
                          step="0.5"
                          value={config.deslocamentoHorizontalMm ?? 0}
                          onChange={(e) => updateConfig({ deslocamentoHorizontalMm: parseFloat(e.target.value) || 0 })}
                          className="w-14 px-1 py-1 bg-white border border-slate-300 rounded text-center text-xs font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => updateConfig({ deslocamentoHorizontalMm: (config.deslocamentoHorizontalMm ?? 0) + 1 })}
                          className="px-2 py-1 bg-white hover:bg-slate-200 border border-slate-300 rounded text-xs font-bold cursor-pointer"
                        >
                          +1
                        </button>
                      </div>
                      <span className="text-[9px] text-slate-500 block mt-0.5">Move para esquerda ou direita</span>
                    </div>
                  </div>
                </div>

                {/* 4. CAMPOS DO CONTEÚDO DA ETIQUETA */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">
                      Dados Textuais da Bobina
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfig(inferEtiquetaZebraData(order, palete))}
                      className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Atualizar da OP</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        Tipo de Filme (Linha 1)
                      </label>
                      <input
                        type="text"
                        value={config.tipoFilme}
                        onChange={(e) => updateConfig({ tipoFilme: e.target.value.toUpperCase() })}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        Produto / Aplicação (Linha 2)
                      </label>
                      <input
                        type="text"
                        value={config.aplicacao}
                        onChange={(e) => updateConfig({ aplicacao: e.target.value.toUpperCase() })}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        Medidas (Linha 3)
                      </label>
                      <input
                        type="text"
                        value={config.medidas}
                        onChange={(e) => updateConfig({ medidas: e.target.value })}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        Data (Linha 5)
                      </label>
                      <input
                        type="text"
                        value={config.dataImpressao}
                        onChange={(e) => updateConfig({ dataImpressao: e.target.value })}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.imprimirPesos}
                        onChange={(e) => updateConfig({ imprimirPesos: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="text-[11px] font-semibold text-slate-800">
                        Imprimir pesos (PESO B: ... L: ...)
                      </span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.duplicarPistas}
                        onChange={(e) => updateConfig({ duplicarPistas: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="text-[11px] font-semibold text-slate-800">
                        Duplicar nas 2 pistas
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}

          {tab === "arquivos" && (
            <div className="space-y-4">
              {/* BANNER PRINCIPAL EXPLICATIVO */}
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <FileDown className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                      <span>Impressão Direta no Windows (Elimina Erros do Navegador)</span>
                      <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-black">
                        Solução 100% Estável
                      </span>
                    </h4>
                    <p className="text-xs text-emerald-900/90 mt-1 leading-relaxed">
                      Ao imprimir direto pelo navegador (Chrome/Edge), o Windows passa pelo renderizador Web, que pode cortar margens, distorcer a escala ou girar a folha de lado.
                      <br />
                      <strong>Ao gerar o arquivo abaixo</strong>, você envia os comandos técnicos nativos diretamente para a impressora Zebra no Windows, garantindo precisão milimétrica, alinhamento perfeito e velocidade instantânea!
                    </p>
                  </div>
                </div>
              </div>

              {/* OPÇÕES DE ARQUIVOS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* 1. ARQUIVO .PRN / .ZPL */}
                <div className="bg-white border-2 border-blue-400 rounded-xl p-4 shadow-xs flex flex-col justify-between space-y-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-blue-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-bl-lg tracking-wider">
                    Mais Utilizado
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase mb-1">
                      <FileDown className="w-4 h-4" />
                      <span>Arquivo .PRN / .ZPL</span>
                    </div>
                    <strong className="text-sm font-bold text-slate-900 block">
                      Código Nativo Zebra (203 DPI)
                    </strong>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Contém o código ZPL oficial calibrado para etiqueta de 43x24 mm em 2 colunas. Ideal para envio direto sem navegador.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleEmitir("arquivo_prn")}
                      className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Baixar .PRN ({targetItens.length} bobinas)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEmitirTest("arquivo_prn")}
                      className="w-full py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-800 font-semibold rounded-lg text-[11px] flex items-center justify-center gap-1.5 border border-blue-200 transition cursor-pointer"
                    >
                      <span>Baixar Teste .PRN (1 Par)</span>
                    </button>
                  </div>
                </div>

                {/* 2. SCRIPT EXECUTÁVEL .BAT DO WINDOWS */}
                <div className="bg-white border border-emerald-300 rounded-xl p-4 shadow-xs flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase mb-1">
                      <Terminal className="w-4 h-4" />
                      <span>Script .BAT Windows</span>
                    </div>
                    <strong className="text-sm font-bold text-slate-900 block">
                      Envio Automático (1 Duplo-Clique)
                    </strong>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Gera um script executável do Windows que manda o arquivo .PRN direto para a porta ou fila da Zebra sem precisar abrir nada.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleEmitir("arquivo_bat")}
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs active:scale-95"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span>Baixar Pacote .BAT</span>
                    </button>
                    <span className="text-[10px] text-slate-500 block text-center">
                      Salvar na mesma pasta do .PRN e dar duplo-clique.
                    </span>
                  </div>
                </div>

                {/* 3. PLANILHA DE DADOS .CSV */}
                <div className="bg-white border border-amber-300 rounded-xl p-4 shadow-xs flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase mb-1">
                      <Table className="w-4 h-4" />
                      <span>Planilha .CSV de Dados</span>
                    </div>
                    <strong className="text-sm font-bold text-slate-900 block">
                      BarTender / ZebraDesigner 3
                    </strong>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Todas as bobinas, pesos, OP, cliente e código em colunas prontas para mesclagem no seu modelo do Windows ou Excel.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleEmitir("arquivo_csv")}
                      className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs active:scale-95"
                    >
                      <Table className="w-3.5 h-3.5" />
                      <span>Baixar Planilha .CSV</span>
                    </button>
                    <span className="text-[10px] text-slate-500 block text-center">
                      Compatível com BarTender, ZebraDesigner e Excel.
                    </span>
                  </div>
                </div>
              </div>

              {/* GUIA PASSO A PASSO: COMO IMPRIMIR O ARQUIVO NO WINDOWS */}
              <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-400" />
                  <span>Como Imprimir o Arquivo no Windows (Escolha o seu método preferido):</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700 space-y-1.5">
                    <strong className="text-emerald-400 block font-bold">
                      Método 1: Zebra Setup Utilities (Oficial e 100% Gratuito da Zebra)
                    </strong>
                    <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px]">
                      <li>Baixe o arquivo <strong>.PRN</strong> acima.</li>
                      <li>Abra o aplicativo <strong>Zebra Setup Utilities</strong> no Windows.</li>
                      <li>Selecione sua impressora e clique no menu <em>"Action" &gt; "Send File"</em> (ou "Enviar Arquivo").</li>
                      <li>Selecione o arquivo baixado. A impressora imprimirá instantaneamente!</li>
                    </ol>
                  </div>

                  <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700 space-y-1.5">
                    <strong className="text-blue-400 block font-bold">
                      Método 2: BarTender ou ZebraDesigner 3 (Para quem já tem modelo)
                    </strong>
                    <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px]">
                      <li>Baixe o arquivo <strong>.CSV</strong> acima.</li>
                      <li>Abra o seu modelo no BarTender ou ZebraDesigner.</li>
                      <li>Conecte o arquivo CSV como fonte de dados (Database Connection).</li>
                      <li>Clique em Imprimir no Windows. Todas as bobinas sairão perfeitas!</li>
                    </ol>
                  </div>
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

          {tab === "guia" && (
            <div className="space-y-4 text-xs">
              {/* DIAGNÓSTICO DO QUE ESTÁ ACONTECENDO */}
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-amber-950">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <h4 className="font-bold text-sm text-amber-950">
                    Por que a etiqueta sai de lado ou cortando? (Diagnóstico da Foto 1)
                  </h4>
                </div>
                <p className="text-[12px] leading-relaxed text-amber-900">
                  O rolo físico da fábrica Forpack possui <strong>2 etiquetas lado a lado (88 mm de largura total)</strong> por <strong>24 mm de altura (avanço)</strong>. Como a largura (88mm) é maior que a altura (24mm), o Google Chrome e o Windows interpretam a página como <em>"Paisagem"</em>. Se o driver da Zebra esperar <em>"Retrato"</em>, ele rotaciona o conteúdo em 90°, imprimindo o texto na vertical através das etiquetas.
                </p>
              </div>

              {/* 3 SOLUÇÕES: CHROME, WINDOWS E DIRETO NO SISTEMA */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* SOLUÇÃO 1: NO NAVEGADOR CHROME */}
                <div className="p-3.5 bg-white border border-slate-300 rounded-xl shadow-xs space-y-2.5">
                  <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wide">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                      1
                    </span>
                    <span>Na Janela do Chrome</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Quando você clica em Imprimir e abre a janela do navegador (Ctrl + P):
                  </p>
                  <ul className="space-y-1.5 text-slate-800 text-[11px]">
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Margens:</strong> Mudar para <strong>NENHUMA</strong> (Se deixar "Padrão", o Chrome come 20mm da etiqueta).
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Escala:</strong> Selecionar <strong>Padrão</strong> ou <strong>100%</strong>.
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Layout:</strong> Se estiver em Retrato e sair virado, experimente mudar para <strong>Paisagem</strong>.
                      </span>
                    </li>
                  </ul>
                </div>

                {/* SOLUÇÃO 2: NO DRIVER WINDOWS DA ZEBRA */}
                <div className="p-3.5 bg-white border border-slate-300 rounded-xl shadow-xs space-y-2.5">
                  <div className="flex items-center gap-2 text-purple-700 font-bold text-xs uppercase tracking-wide">
                    <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                      2
                    </span>
                    <span>No Driver da Zebra (Windows)</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Em <em>Painel de Controle &gt; Dispositivos e Impressoras &gt; Preferências de Impressão</em>:
                  </p>
                  <ul className="space-y-1.5 text-slate-800 text-[11px]">
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Tamanho da Etiqueta:</strong> Criar papel personalizado com <strong>Largura: 88,0 mm</strong> e <strong>Altura: 24,0 mm</strong>.
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Tipo de Mídia:</strong> <strong>Etiquetas com Intervalo (Gap)</strong> de 2 mm.
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Orientação:</strong> <strong>Retrato (0°)</strong>.
                      </span>
                    </li>
                  </ul>
                </div>

                {/* SOLUÇÃO 3: DIRETO NO SISTEMA (SEM MEXER NO WINDOWS) */}
                <div className="p-3.5 bg-emerald-50/80 border border-emerald-300 rounded-xl shadow-xs space-y-2.5">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wide">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>Solução Direta no Sistema</span>
                  </div>
                  <p className="text-emerald-900 text-[11px]">
                    Você não precisa mexer no Windows! O próprio sistema compensa o giro:
                  </p>
                  <div className="space-y-2 text-[11px] text-emerald-950">
                    <div className="p-2 bg-white rounded-lg border border-emerald-200">
                      <strong>Passo 1:</strong> Vá na aba <strong>Visualização & Ajustes</strong> e clique no botão amarelo <strong>"2. Girar -90° (Compensar)"</strong>.
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-emerald-200">
                      <strong>Passo 2:</strong> Clique no botão verde <strong>"Testar 1 Par Agora"</strong> para ver sair perfeitamente alinhado na Zebra.
                    </div>
                  </div>
                </div>
              </div>

              {/* DICA EXTRA: ZPL NATIVO */}
              <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl flex items-start gap-2.5 text-slate-700">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong>Dica Profissional (Zebra ZPL):</strong> Se você utiliza o aplicativo <em>Zebra Setup Utilities</em>, PrintNode ou comunicação direta via cabo de rede/USB, a aba <strong>Código ZPL (Zebra)</strong> gera o código nativo da Zebra que imprime com qualidade de 203 DPI laser sem depender de margens de navegador.
                </div>
              </div>
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
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600">
            <span>
              Saída: <strong>{targetItens.length} bobina(s)</strong> ·{" "}
              <strong>{config.tamanhoEtiqueta === "43x24" ? "4,30 x 2,40 cm" : `${config.tamanhoEtiqueta} mm`}</strong>
              {config.formatoRolo === "2_colunas" ? " · Rolo 2 Colunas (88 mm)" : ""}
            </span>
            <span className="ml-2 inline-flex items-center gap-1 font-semibold text-slate-500">
              Modo:{" "}
              <span className="font-bold text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded text-[11px]">
                {(config.modoSaidaImpressao || "arquivo_prn") === "arquivo_prn"
                  ? "Arquivo .PRN Windows"
                  : config.modoSaidaImpressao === "arquivo_csv"
                  ? "Planilha .CSV"
                  : "Navegador Chrome"}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={() => handleEmitirTest()}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded-lg text-xs transition shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
              title={(config.modoSaidaImpressao || "arquivo_prn") === "arquivo_prn" ? "Gera arquivo .PRN de 1 par para validar no Windows" : "Imprime 1 par para testar alinhamento"}
            >
              {(config.modoSaidaImpressao || "arquivo_prn") === "arquivo_prn" ? (
                <>
                  <FileDown className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Gerar Teste .PRN</span>
                </>
              ) : (
                <>
                  <Printer className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Testar 1 Par</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleEmitir()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-lg text-xs transition shadow-xs flex items-center gap-2 cursor-pointer"
            >
              {(config.modoSaidaImpressao || "arquivo_prn") === "arquivo_prn" ? (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>Gerar Arquivo .PRN ({targetItens.length})</span>
                </>
              ) : config.modoSaidaImpressao === "arquivo_csv" ? (
                <>
                  <Table className="w-4 h-4" />
                  <span>Gerar Planilha .CSV ({targetItens.length})</span>
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Todas</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* NOTIFICAÇÃO TOAST DE DOWNLOAD DO ARQUIVO */}
        {downloadToast && (
          <div className="absolute bottom-16 right-5 z-60 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-emerald-400 flex items-start gap-3 max-w-sm animate-in fade-in slide-in-from-bottom-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-left">
              <strong className="text-xs font-bold text-white block">
                {downloadToast.title}
              </strong>
              <span className="text-[11px] text-slate-300 block leading-tight mt-0.5">
                {downloadToast.message}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDownloadToast(null)}
              className="text-slate-400 hover:text-white ml-auto cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
