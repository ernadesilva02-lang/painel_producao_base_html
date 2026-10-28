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
  Globe,
  QrCode,
  Barcode,
} from "lucide-react";
import { Order, ItemPaleteRomaneio, PaleteRomaneio } from "../types/forpack";

export interface EtiquetaZebraData {
  tipoFilme: string;      // Ex: "FILME PEBD IMP" ou "PET+PE"
  aplicacao: string;      // Ex: "FILME LAM PET+PE IMP ALHO ROXO 1KG 54X0,08" (Item / Produto da OP)
  itemDescricao?: string; // Descrição completa do Item da OP
  cliente?: string;       // Ex: "ALIMEMPRO PRODUTOS"
  medidas: string;        // Ex: "54X0,08"
  dataImpressao: string;  // Ex: "28/10/2026"
  tamanhoEtiqueta: "100x30" | "43x24" | "60x40" | "70x50" | "100x50" | "custom";
  larguraMm?: number;     // Ex: 100
  alturaMm?: number;      // Ex: 30
  orientacao: "horizontal" | "rotacionada_90" | "rotacionada_270" | "invertida_180" | "vertical"; // horizontal padrão
  formatoRolo: "1_coluna" | "2_colunas"; // 1_coluna para rolo 100x30x1, 2_colunas para 88mm
  duplicarPistas: boolean; // Imprime a mesma etiqueta nas 2 pistas lado a lado (Foto 2)
  imprimirPesos: boolean; // Se true imprime "PESO B: 30.9   L: 29.3", se false imprime "PESO B:        L:"
  incluirIdentificacaoOp?: boolean; // Padrão true para rastreabilidade e bipagem
  codigoOp?: string;
  numeroPalete?: string;
  tipoCodigoBipagem?: "qrcode" | "barcode" | "nenhum"; // Padrão: "qrcode" para bipagem rápida
  // Campos de ajuste avançado de direção e envio para impressoras térmicas
  modoEnvioCss?: "dimensoes_puras" | "auto" | "forcar_paisagem" | "forcar_retrato" | "tamanho_invertido";
  deslocamentoVerticalMm?: number; // Ajuste fino -5mm a +5mm
  deslocamentoHorizontalMm?: number; // Ajuste fino -5mm a +5mm
  espacamentoColunasMm?: number; // Gap entre as duas pistas, padrão 2mm
  // Modo de saída ao clicar em imprimir:
  modoSaidaImpressao?: "arquivo_html" | "arquivo_prn" | "arquivo_bat" | "arquivo_csv" | "navegador"; // Padrão: "arquivo_html" (Recomendado Windows) ou "arquivo_prn"
}

/**
 * Gerador de Matriz QR Code autônomo e nativo (puro TypeScript sem pacotes externos).
 * Suporta versões 1 a 4 com correção de erro nível M, ideal para bipagem industrial (OP, Bobina, Lote).
 */
function createPureQRMatrix(text: string): number[][] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 128) bytes.push(code);
    else if (code < 2048) { bytes.push(192 | (code >> 6)); bytes.push(128 | (code & 63)); }
    else { bytes.push(224 | (code >> 12)); bytes.push(128 | ((code >> 6) & 63)); bytes.push(128 | (code & 63)); }
  }

  const VERSIONS = [
    null,
    { size: 21, data: 14, ec: 10, align: [] as number[] },
    { size: 25, data: 26, ec: 16, align: [6, 18] },
    { size: 29, data: 42, ec: 26, align: [6, 22] },
    { size: 33, data: 62, ec: 36, align: [6, 26] },
  ];

  let ver = 1;
  while (ver <= 4 && bytes.length + 3 > (VERSIONS[ver]?.data ?? 0)) {
    ver++;
  }
  if (ver > 4) ver = 4;
  const vInfo = VERSIONS[ver]!;

  const bitBuf: number[] = [];
  const putBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bitBuf.push((val >> i) & 1);
    }
  };

  putBits(4, 4); // Byte mode
  putBits(bytes.length, 8); // Quantidade de bytes
  for (const b of bytes) putBits(b, 8);
  putBits(0, Math.min(4, vInfo.data * 8 - bitBuf.length)); // Terminador
  while (bitBuf.length % 8 !== 0) bitBuf.push(0);

  const dataBytes: number[] = [];
  for (let i = 0; i < bitBuf.length; i += 8) {
    let byteVal = 0;
    for (let j = 0; j < 8; j++) byteVal = (byteVal << 1) | bitBuf[i + j];
    dataBytes.push(byteVal);
  }

  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (dataBytes.length < vInfo.data) {
    dataBytes.push(padBytes[padIdx % 2]);
    padIdx++;
  }

  // Tabela Galois Field GF(256)
  const exp = new Uint8Array(512);
  const log = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    exp[i] = x;
    exp[i + 255] = x;
    log[x] = i;
    x <<= 1;
    if (x & 256) x ^= 0x11d;
  }
  const gfMul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : exp[log[a] + log[b]]);

  // Polinômio gerador Reed-Solomon
  let gen = [1];
  for (let i = 0; i < vInfo.ec; i++) {
    const next = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gfMul(gen[j], exp[i]);
      next[j + 1] ^= gen[j];
    }
    gen = next;
  }

  // Resto de divisão Reed-Solomon (bytes de correção de erro)
  const msg = new Array(dataBytes.length + vInfo.ec).fill(0);
  for (let i = 0; i < dataBytes.length; i++) msg[i] = dataBytes[i];
  for (let i = 0; i < dataBytes.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  const ecBytes = msg.slice(dataBytes.length);
  const allCodewords = dataBytes.concat(ecBytes);

  // Construção da matriz visual
  const size = vInfo.size;
  const matrix: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
  const reserved: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));

  const setFinder = (r: number, c: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          reserved[nr][nc] = true;
          const isBlack = (dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6) &&
            (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
          matrix[nr][nc] = isBlack ? 1 : 0;
        }
      }
    }
  };

  setFinder(0, 0);
  setFinder(0, size - 7);
  setFinder(size - 7, 0);

  // Linhas de sincronização (timing)
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) { matrix[6][i] = (i % 2 === 0 ? 1 : 0); reserved[6][i] = true; }
    if (!reserved[i][6]) { matrix[i][6] = (i % 2 === 0 ? 1 : 0); reserved[i][6] = true; }
  }

  // Padrão de alinhamento para versão >= 2
  if (vInfo.align.length > 0) {
    const coords = vInfo.align;
    for (const r of coords) {
      for (const c of coords) {
        if (reserved[r][c]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            reserved[r + dr][c + dc] = true;
            const isBlack = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
            matrix[r + dr][c + dc] = isBlack ? 1 : 0;
          }
        }
      }
    }
  }

  // Módulo escuro permanente
  matrix[size - 8][8] = 1;
  reserved[size - 8][8] = true;

  // Reserva de informação de formato
  for (let i = 0; i < 9; i++) {
    if (i !== 6) { reserved[8][i] = true; reserved[i][8] = true; }
  }
  for (let i = size - 8; i < size; i++) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }

  // Sequência de bits dos dados
  const totalBits: number[] = [];
  for (const b of allCodewords) {
    for (let i = 7; i >= 0; i--) totalBits.push((b >> i) & 1);
  }

  // Posicionamento em zigue-zague
  let bitIdx = 0;
  let dir = -1;
  let col = size - 1;
  while (col > 0) {
    if (col === 6) col--;
    const rStart = dir === -1 ? size - 1 : 0;
    const rEnd = dir === -1 ? -1 : size;
    for (let r = rStart; r !== rEnd; r += (dir === -1 ? -1 : 1)) {
      for (let c = col; c >= col - 1; c--) {
        if (!reserved[r][c]) {
          const bit = bitIdx < totalBits.length ? totalBits[bitIdx++] : 0;
          const mask = ((r + c) % 2 === 0) ? 1 : 0;
          matrix[r][c] = (bit ^ mask);
        }
      }
    }
    dir = -dir;
    col -= 2;
  }

  // Bits de formato para Nível M + Máscara 0 (BCH 15 bits com máscara XOR 0x5412)
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  const tlCoords = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
  ];
  for (let i = 0; i < 15; i++) {
    matrix[tlCoords[i][0]][tlCoords[i][1]] = formatBits[i];
  }
  for (let i = 0; i < 7; i++) {
    matrix[size - 1 - i][8] = formatBits[i];
  }
  for (let i = 0; i < 8; i++) {
    matrix[8][size - 8 + i] = formatBits[7 + i];
  }

  return matrix;
}

/**
 * Gera QR Code nativo vetorial em SVG de forma 100% síncrona e sem qualquer dependência externa
 */
export function generateQrCodeSvg(text: string, sizePx: number = 66): string {
  try {
    const clean = (text || "FORPACK").trim();
    const matrix = createPureQRMatrix(clean);
    const size = matrix.length;
    const pathSegments: string[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r][c] === 1) {
          pathSegments.push(`M${c + 1},${r + 1}h1v1h-1z`);
        }
      }
    }
    const totalSize = size + 2;
    return `<svg viewBox="0 0 ${totalSize} ${totalSize}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;"><path d="${pathSegments.join("")}" fill="#000"/></svg>`;
  } catch (err) {
    return `<div style="font-size:8px;color:#666;text-align:center;">QR CODE</div>`;
  }
}

/**
 * Tabela e gerador de Código de Barras Code 128 (padrão industrial B) vetorial síncrono
 */
const CODE128_PATTERNS: string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
];

export function generateBarcode128Svg(code: string, widthPx: number = 78, heightPx: number = 28): string {
  try {
    const cleanStr = (code || "OP").replace(/[^\x20-\x7E]/g, "");
    let checksum = 104;
    const chars = [104];
    for (let i = 0; i < cleanStr.length; i++) {
      const val = cleanStr.charCodeAt(i) - 32;
      chars.push(val);
      checksum += val * (i + 1);
    }
    chars.push(checksum % 103);
    chars.push(106);
    let modules = "";
    for (const c of chars) {
      const pat = CODE128_PATTERNS[c];
      let isBar = true;
      for (let i = 0; i < pat.length; i++) {
        modules += (isBar ? "1" : "0").repeat(parseInt(pat[i], 10));
        isBar = !isBar;
      }
    }
    const quiet = "0000000000";
    const full = quiet + modules + quiet;
    const rects: string[] = [];
    for (let i = 0; i < full.length; i++) {
      if (full[i] === "1") {
        rects.push(`<rect x="${i}" y="0" width="1" height="${heightPx}" fill="#000"/>`);
      }
    }
    return `<svg viewBox="0 0 ${full.length} ${heightPx}" width="${widthPx}" height="${heightPx}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;">${rects.join("")}</svg>`;
  } catch (err) {
    return `<div style="font-size:8px;color:#666;text-align:center;">BARCODE</div>`;
  }
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
      const parsed = JSON.parse(raw);
      // Remove campos voláteis específicos de OP para garantir que novas OPs sempre peguem dados reais
      delete parsed.cliente;
      delete parsed.aplicacao;
      delete parsed.itemDescricao;
      delete parsed.tipoFilme;
      delete parsed.medidas;
      delete parsed.codigoOp;
      delete parsed.numeroPalete;
      return parsed;
    }
  } catch (err) {
    console.warn("Erro ao carregar preferências da Zebra:", err);
  }
  return {};
}

/**
 * Salva permanentemente as preferências de sentido e formato de etiqueta para próximas impressões
 * Apenas parâmetros da impressora térmica (margens, dimensões, orientação, rolo, modo CSS, bipagem) são gravados.
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
      tipoCodigoBipagem: config.tipoCodigoBipagem ?? prev.tipoCodigoBipagem,
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
 * Mesclando com preferências mecânicas da impressora
 */
export function inferEtiquetaZebraData(
  order: Order | null | undefined,
  palete?: PaleteRomaneio | null
): EtiquetaZebraData {
  // 1. Extração estrita e prioritária do Cliente a partir da OP ou Palete ativa
  let clienteNome = "";
  if (order?.cliente && order.cliente.trim() && order.cliente !== "Cliente Forpack" && order.cliente !== "FORPACK CLIENTE") {
    clienteNome = order.cliente.replace(/^[pP]\/\s*/, "").trim().toUpperCase();
  } else if (palete?.cliente && palete.cliente.trim() && palete.cliente !== "Cliente Forpack" && palete.cliente !== "FORPACK CLIENTE") {
    clienteNome = palete.cliente.replace(/^[pP]\/\s*/, "").trim().toUpperCase();
  }
  if (!clienteNome) {
    clienteNome = "CLIENTE";
  }

  // 2. Extração fiel da Descrição do Item (sem distorcer ou apagar dados da OP)
  const rawItemDesc = (order?.descricaoItem || palete?.descricaoItem || "").trim();
  const itemDescricao = rawItemDesc || "PRODUTO ACABADO";

  // 3. Extração das medidas (ex: 54X0,08, 63X0,028, 69X0,028)
  const dimMatch = itemDescricao.match(/(\d+(?:[.,]\d+)?\s*[xX*]\s*\d+(?:[.,]\d+)?)/);
  const medidas = dimMatch ? dimMatch[1].replace(/\s+/g, "").toUpperCase() : "54X0,08";

  // 4. Identifica Tipo de Filme / Material
  const mat = (order?.material || "").trim();
  let tipoFilme = "";
  if (mat) {
    tipoFilme = mat.toUpperCase();
    if (!tipoFilme.includes("FILME") && !tipoFilme.includes("SACO")) tipoFilme = `FILME ${tipoFilme}`;
  } else {
    const descUpper = itemDescricao.toUpperCase();
    if (descUpper.startsWith("FILME PEBD IMP") || descUpper.includes("PEBD IMP")) {
      tipoFilme = "FILME PEBD IMP";
    } else if (descUpper.startsWith("FILME PEBD LISO") || (descUpper.includes("PEBD") && descUpper.includes("LISO"))) {
      tipoFilme = "FILME PEBD LISO";
    } else if (descUpper.startsWith("FILME PEAD IMP") || descUpper.includes("PEAD IMP")) {
      tipoFilme = "FILME PEAD IMP";
    } else if (descUpper.startsWith("FILME PP IMP") || descUpper.includes("PP IMP")) {
      tipoFilme = "FILME PP IMP";
    } else if (descUpper.includes("PET+PE") || descUpper.includes("PET/PE")) {
      tipoFilme = "FILME PET+PE";
    } else if (descUpper.includes("BOPP")) {
      tipoFilme = "FILME BOPP";
    } else {
      const words = itemDescricao.split(/\s+/);
      if (words.length >= 2 && /filme|saco|pebd|pead|pp/i.test(words[0])) {
        tipoFilme = words.slice(0, 3).join(" ").toUpperCase();
      }
    }
  }
  if (!tipoFilme) {
    tipoFilme = "FILME PET+PE";
  }

  // 5. Data formatada DD/MM/AAAA
  const rawDate = palete?.data || order?.data || new Date().toISOString().slice(0, 10);
  const [year, month, day] = rawDate.split("-");
  const dataFormatada = year && month && day ? `${day}/${month}/${year}` : new Date().toLocaleDateString("pt-BR");

  // Carrega apenas preferências mecânicas da impressora
  const saved = loadSavedEtiquetaZebraPreferences();
  const tamanho = (saved.tamanhoEtiqueta as any) || "100x30";
  const is100x30 = tamanho === "100x30";
  const is43x24 = tamanho === "43x24";

  return {
    tipoFilme: tipoFilme,
    aplicacao: itemDescricao,
    itemDescricao: itemDescricao,
    cliente: clienteNome,
    medidas: medidas,
    dataImpressao: dataFormatada,
    tamanhoEtiqueta: tamanho,
    larguraMm: saved.larguraMm || (is100x30 ? 100 : is43x24 ? 43 : 100),
    alturaMm: saved.alturaMm || (is100x30 ? 30 : is43x24 ? 24 : 30),
    orientacao: saved.orientacao || "horizontal",
    formatoRolo: saved.formatoRolo || (is100x30 ? "1_coluna" : is43x24 ? "2_colunas" : "1_coluna"),
    duplicarPistas: saved.duplicarPistas ?? (is100x30 ? false : is43x24 ? true : false),
    imprimirPesos: saved.imprimirPesos ?? true,
    incluirIdentificacaoOp: saved.incluirIdentificacaoOp ?? true,
    tipoCodigoBipagem: (saved.tipoCodigoBipagem as any) || "qrcode",
    modoEnvioCss: saved.modoEnvioCss || "dimensoes_puras",
    deslocamentoVerticalMm: saved.deslocamentoVerticalMm ?? 0,
    deslocamentoHorizontalMm: saved.deslocamentoHorizontalMm ?? 0,
    espacamentoColunasMm: saved.espacamentoColunasMm ?? (is100x30 ? 0 : 2),
    modoSaidaImpressao: (saved.modoSaidaImpressao as any) || "arquivo_html",
    codigoOp: order?.numeroOp || order?.numeroPedido || palete?.numeroOp || "",
    numeroPalete: palete?.numeroPalete || "",
  };
}

/**
 * Função de impressão direta da Etiqueta Térmica Zebra via janela/iframe do navegador
 * Calibrada fielmente para o formato 43x24mm (4,30 x 2,40 cm) em rolo de 2 colunas (88mm)
 * Layout 100% idêntico à etiqueta padrão Forpack (Foto 2)
 */
export function buildEtiquetasHtml(
  itens: EtiquetaBobinaItem[],
  config: EtiquetaZebraData,
  isStandalone: boolean = false
): string {
  // Dimensões em mm
  const is100x30Format = config.tamanhoEtiqueta === "100x30" || (config.larguraMm || 0) >= 85;
  const singleWidthMm = config.larguraMm || (is100x30Format ? 100 : config.tamanhoEtiqueta === "60x40" ? 60 : 43);
  const singleHeightMm = config.alturaMm || (is100x30Format ? 30 : config.tamanhoEtiqueta === "60x40" ? 40 : 24);
  const is2Col = config.formatoRolo === "2_colunas" && !is100x30Format;
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
      // Padrão Puro Milimétrico
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

  // Helper para renderizar 1 etiqueta individual
  const renderCardHtml = (item: EtiquetaBobinaItem | null) => {
    if (!item) {
      return `<div class="etiqueta-zebra-card vazio" style="width: ${singleWidthMm}mm; height: ${singleHeightMm}mm; visibility: hidden;"></div>`;
    }

    const hasWeights = config.imprimirPesos && item.pesoBruto > 0;
    const pesoBVal = hasWeights ? item.pesoBruto.toFixed(1) : "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
    const pesoLVal = hasWeights ? item.pesoLiquido.toFixed(1) : "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
    const bipCode = config.codigoOp
      ? `${config.codigoOp}-${item.posicao.toString().padStart(2, "0")}`
      : (item.codigoBobina || `BOB-${item.posicao.toString().padStart(2, "0")}`);
    const hasBipagem = config.tipoCodigoBipagem !== "nenhum";

    // Layout dedicado para rolo 100x30x1 (100mm largura x 30mm altura)
    if (is100x30Format) {
      const codeSvg = config.tipoCodigoBipagem === "barcode"
        ? generateBarcode128Svg(bipCode, 74, 24)
        : generateQrCodeSvg(bipCode, 58);

      return `
      <div class="etiqueta-zebra-card format-100x30" style="width: ${singleWidthMm}mm; height: ${singleHeightMm}mm;">
        <!-- COLUNA PRINCIPAL DE DADOS -->
        <div class="card-100x30-main-col">
          <!-- TOPO: LOGO FORPACK · OP · ITEM / SEQ · DATA -->
          <div class="card-header-100x30">
            <div class="header-brand">
              <span class="logo-badge-f">f</span>
              <span class="logo-text-bold">FORPACK</span>
            </div>
            <div class="header-op-bobina">
              ${config.codigoOp ? `<span class="badge-op">OP #${config.codigoOp}</span>` : ""}
              <span class="badge-item">ITEM #${item.posicao.toString().padStart(2, "0")}</span>
            </div>
            <div class="header-date">
              <span>DATA: <strong>${config.dataImpressao}</strong></span>
            </div>
          </div>

          <div class="divider-line"></div>

          <!-- CORPO: CLIENTE, ITEM, MATERIAL E MEDIDAS -->
          <div class="card-body-100x30">
            <div class="body-info-left">
              <div class="info-cliente">
                <span class="label-prefix">CLIENTE:</span>
                <span class="val-cliente">${config.cliente || "CLIENTE"}</span>
              </div>
              <div class="info-produto">
                <span class="label-prefix">ITEM:</span>
                <span class="val-produto">${config.aplicacao || config.itemDescricao || "PRODUTO"}</span>
              </div>
              <div class="info-material">
                <span class="label-prefix">FILME:</span>
                <span class="val-material">${config.tipoFilme || "FILME"}</span>
              </div>
            </div>
            <div class="body-medidas-right">
              <span class="medidas-label">MEDIDAS</span>
              <span class="medidas-val">${config.medidas}</span>
            </div>
          </div>

          <div class="divider-line"></div>

          <!-- RODAPÉ: METROLOGIA (SEM TARA - APENAS PESO BRUTO E LÍQUIDO) -->
          <div class="card-footer-100x30">
            <div class="footer-peso-box">
              <span class="peso-title">PESO BRUTO:</span>
              <span class="peso-number">${hasWeights ? `${item.pesoBruto.toFixed(1)} KG` : "________ KG"}</span>
            </div>
            <div class="footer-peso-box peso-destaque">
              <span class="peso-title">PESO LÍQUIDO:</span>
              <span class="peso-number">${hasWeights ? `${item.pesoLiquido.toFixed(1)} KG` : "________ KG"}</span>
            </div>
            ${item.codigoBobina ? `<span class="footer-bob-id">${item.codigoBobina}</span>` : ""}
          </div>
        </div>

        <!-- COLUNA DIREITA: BIPAGEM COM QR CODE OU CÓDIGO DE BARRAS -->
        ${
          hasBipagem
            ? `
        <div class="card-100x30-bipagem-col">
          <div class="bipagem-code-img">
            ${codeSvg}
          </div>
          <div class="bipagem-code-text">${bipCode}</div>
          <div class="bipagem-badge">BIPAGEM</div>
        </div>`
            : ""
        }
      </div>`;
    }

    // Layout padrão compacto para 43x24 mm (Foto 2)
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

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Etiquetas Bobina Forpack 43x24mm - OP ${config.codigoOp || ""}</title>
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
      .no-print {
        display: none !important;
      }
      .labels-container {
        padding: 0 !important;
        background: transparent !important;
        display: block !important;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: ${bodyWidthMm}mm !important;
        height: ${bodyHeightMm}mm !important;
        overflow: hidden !important;
        background: #fff !important;
      }
      .etiqueta-page-row {
        box-shadow: none !important;
        border: none !important;
        margin-bottom: 0 !important;
      }
    }
    @media screen {
      .etiqueta-page-row {
        box-shadow: 0 4px 14px rgba(0,0,0,0.12);
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        background: #fff;
        margin-bottom: 14px;
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
    /* ESTILOS DEDICADOS PARA O FORMATO 100x30 mm (1 CARREIRA / 100x30x1) */
    .etiqueta-zebra-card.format-100x30 {
      padding: 1.5mm 2.2mm 1.5mm 2.5mm;
      border-radius: 2mm;
      display: flex;
      flex-direction: row;
      align-items: stretch;
      justify-content: space-between;
      gap: 2mm;
      text-align: left;
      background: #fff;
      box-sizing: border-box;
      overflow: hidden;
    }
    .card-100x30-main-col {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .card-100x30-bipagem-col {
      width: 22mm;
      min-width: 22mm;
      border-left: 1px dashed #000;
      padding-left: 1.5mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .bipagem-code-img {
      display: flex;
      align-items: center;
      justify-content: center;
      max-height: 18mm;
      overflow: hidden;
    }
    .bipagem-code-img svg {
      max-width: 100%;
      height: auto;
      max-height: 17mm;
    }
    .bipagem-code-text {
      font-size: 7px;
      font-weight: 800;
      font-family: monospace;
      letter-spacing: -0.2px;
      color: #000;
      margin-top: 1px;
      white-space: nowrap;
    }
    .bipagem-badge {
      font-size: 6px;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #fff;
      background: #000;
      padding: 0.5px 3px;
      border-radius: 2px;
      margin-top: 1px;
    }
    .card-header-100x30 {
      display: flex;
      justify-content: space-between;
      align-items: center;
      line-height: 1;
      padding-bottom: 0.3mm;
      gap: 3px;
      white-space: nowrap;
      overflow: visible;
    }
    .header-brand {
      display: flex;
      align-items: center;
      gap: 3px;
      flex-shrink: 0;
    }
    .logo-badge-f {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 13px;
      height: 13px;
      background: #000;
      color: #fff;
      border-radius: 50%;
      font-size: 9px;
      font-weight: 900;
      font-family: Georgia, serif;
      line-height: 1;
      padding-bottom: 0.5px;
    }
    .logo-text-bold {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: -0.2px;
    }
    .logo-subtext {
      display: none;
    }
    .header-op-bobina {
      display: flex;
      align-items: center;
      gap: 5px;
      font-family: Arial, monospace;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .badge-op {
      font-size: 8.5px;
      font-weight: 800;
      color: #000;
      background: transparent;
      padding: 0;
      white-space: nowrap;
    }
    .badge-item {
      font-size: 8.5px;
      font-weight: 800;
      color: #000;
      background: transparent;
      padding: 0;
      white-space: nowrap;
    }
    .badge-bob {
      font-size: 8.5px;
      font-weight: 800;
      color: #0f172a;
    }
    .header-date {
      font-size: 8.5px;
      font-weight: 800;
      color: #000;
      letter-spacing: -0.1px;
      white-space: nowrap;
      flex-shrink: 0;
      margin-left: auto;
    }
    .divider-line {
      width: 100%;
      height: 1px;
      background: #000;
      margin: 0.3mm 0;
    }
    .card-body-100x30 {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 2mm;
      padding: 0.2mm 0;
      flex: 1;
    }
    .body-info-left {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .info-cliente {
      font-size: 10.5px;
      font-weight: 900;
      letter-spacing: 0.1px;
      text-transform: uppercase;
      line-height: 1.15;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .label-prefix {
      font-size: 7.5px;
      font-weight: 800;
      color: #64748b;
      margin-right: 2px;
    }
    .val-cliente {
      font-weight: 900;
      color: #000;
    }
    .info-material {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.2px;
      text-transform: uppercase;
      line-height: 1.15;
      margin-top: 1px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .val-material {
      font-weight: 900;
      color: #000;
    }
    .info-produto {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.1px;
      text-transform: uppercase;
      line-height: 1.15;
      margin-top: 1px;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .body-medidas-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: center;
      border-left: 1.2px solid #000;
      padding-left: 2mm;
      min-width: 22mm;
    }
    .medidas-label {
      font-size: 7px;
      font-weight: 900;
      color: #475569;
      letter-spacing: 0.5px;
    }
    .medidas-val {
      font-size: 13.5px;
      font-weight: 900;
      letter-spacing: 0.3px;
      line-height: 1.1;
      font-family: Arial, monospace;
    }
    .card-footer-100x30 {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 0.3mm;
    }
    .footer-peso-box {
      display: flex;
      align-items: baseline;
      gap: 3px;
    }
    .peso-title {
      font-size: 8px;
      font-weight: 900;
      color: #334155;
    }
    .peso-number {
      font-size: 11px;
      font-weight: 900;
      font-family: Arial, monospace;
    }
    .peso-destaque .peso-number {
      font-size: 12px;
      font-weight: 900;
    }
    .footer-bob-id {
      font-size: 8px;
      font-weight: 800;
      font-family: monospace;
      color: #64748b;
    }
  </style>
</head>
<body>
  ${
    isStandalone
      ? `
  <!-- BARRA DE CONTROLE NA TELA DO WINDOWS (NÃO APARECE NA IMPRESSÃO) -->
  <div class="no-print forpack-banner" style="background: #0f172a; color: #fff; padding: 14px 20px; border-bottom: 2px solid #3b82f6; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px;">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
        <div>
          <h1 style="margin: 0; font-size: 15px; font-weight: 900; color: #fff; letter-spacing: -0.3px;">
            🏭 FORPACK EMBALAGENS · IMPRESSÃO DE ETIQUETAS ZEBRA
          </h1>
          <p style="margin: 2px 0 0; font-size: 11.5px; color: #93c5fd;">
            OP: <strong>#${config.codigoOp || "—"}</strong> · ${baseItens.length} etiqueta(s) · Formato: <strong>${is2Col ? "88x24 mm (2 Pistas)" : "43x24 mm"}</strong>
          </p>
        </div>
        <button onclick="window.print()" style="padding: 10px 22px; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-size: 13.5px; font-weight: 900; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(37,99,235,0.4);">
          🖨️ IMPRIMIR NA ZEBRA AGORA (Ctrl + P)
        </button>
      </div>

      <!-- INSTRUÇÕES RÁPIDAS PARA O OPERADOR NO WINDOWS -->
      <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18); border-radius: 8px; padding: 9px 12px; font-size: 11px; line-height: 1.45; color: #f1f5f9;">
        <strong style="color: #fbbf24; display: block; margin-bottom: 2px;">⚙️ Como imprimir no Windows com precisão milimétrica:</strong>
        <span style="display: block;">1. No diálogo de impressão, escolha a sua <strong>impressora Zebra térmica</strong>.</span>
        <span style="display: block;">2. Em <strong>Tamanho do papel</strong>, selecione a etiqueta configurada no driver (ex: <em>88x24 mm</em> ou <em>43x24 mm</em>).</span>
        <span style="display: block;">3. Em <strong>Mais definições &gt; Margens</strong>, escolha <strong>Nenhuma</strong> (ou Mínima).</span>
        <span style="display: block;">4. Em <strong>Escala</strong>, mantenha em <strong>Padrão (100%)</strong>.</span>
      </div>
    </div>
  </div>

  <div class="labels-container" style="padding: 24px 12px; display: flex; flex-direction: column; align-items: center; min-height: 100vh; background: #e2e8f0;">
    ${bodyContent}
  </div>

  <script>
    // Dispara a impressão automaticamente ao abrir no Windows após 400ms
    window.addEventListener('load', function() {
      setTimeout(function() {
        try { window.print(); } catch(e) {}
      }, 400);
    });
  </script>`
      : bodyContent
  }
</body>
</html>`;
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
  printDoc.write(buildEtiquetasHtml(itens, config, false));
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
 * Gera arquivo HTML autônomo com as etiquetas prontas para abrir no Windows
 * Permite que o operador dê 1 duplo-clique no arquivo baixado e imprima diretamente sem erros
 */
export function generateHtmlStandalone(
  itens: EtiquetaBobinaItem[],
  config: EtiquetaZebraData
): string {
  return buildEtiquetasHtml(itens, config, true);
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

  // Orientação ZPL
  let zplOrientation = "^PON";
  if (config.orientacao === "rotacionada_90") zplOrientation = "^POR";
  else if (config.orientacao === "rotacionada_270") zplOrientation = "^POW";
  else if (config.orientacao === "invertida_180") zplOrientation = "^POI";

  const is100x30 = config.tamanhoEtiqueta === "100x30" || (config.larguraMm || 0) >= 85;
  const is2Col = config.formatoRolo === "2_colunas" && !is100x30;

  // Dimensões em dots para 203 DPI (8 dots por mm)
  // 100x30mm = 800 x 240 dots, 43x24mm = 344 x 192 dots
  const widthDots = is100x30 ? 800 : config.tamanhoEtiqueta === "60x40" ? 480 : 344;
  const heightDots = is100x30 ? 240 : config.tamanhoEtiqueta === "60x40" ? 320 : 192;
  const totalWidthDots = is2Col ? widthDots * 2 + 16 : widthDots;

  // Deslocamento milimétrico convertido para dots (203 DPI = 8 dots/mm)
  const offXdots = Math.round((config.deslocamentoHorizontalMm || 0) * 8);
  const offYdots = Math.round((config.deslocamentoVerticalMm || 0) * 8);
  const lhCommand = (offXdots !== 0 || offYdots !== 0)
    ? `^LH${Math.max(0, offXdots)},${Math.max(0, offYdots)}`
    : "^LH0,0";

  // Gerador ZPL para etiqueta 100x30mm (1 Carreira / 100x30x1)
  const buildSingleLabelZpl100x30 = (item: EtiquetaBobinaItem | null, xOffset: number) => {
    if (!item) return "";
    const hasWeights = config.imprimirPesos && item.pesoBruto > 0;
    const pesoBText = hasWeights ? `PESO BRUTO: ${item.pesoBruto.toFixed(1)} KG` : "PESO BRUTO: ________ KG";
    const pesoLText = hasWeights ? `PESO LÍQ: ${item.pesoLiquido.toFixed(1)} KG` : "PESO LÍQ: ________ KG";
    const bipCode = config.codigoOp
      ? `${config.codigoOp}-${item.posicao.toString().padStart(2, "0")}`
      : (item.codigoBobina || `BOB-${item.posicao.toString().padStart(2, "0")}`);
    const hasBipagem = config.tipoCodigoBipagem !== "nenhum";
    const clientName = (config.cliente || "CLIENTE").toUpperCase();
    const itemName = (config.aplicacao || config.itemDescricao || "PRODUTO").toUpperCase();
    const itemNumStr = `ITEM #${item.posicao.toString().padStart(2, "0")}`;

    // Largura da seção de dados técnicos
    const mainWidth = hasBipagem ? 585 : 755;

    // Código de bipagem ZPL (QR Code ou Code 128)
    let bipZpl = "";
    if (hasBipagem) {
      if (config.tipoCodigoBipagem === "barcode") {
        // Código de barras 1D Code 128 (largura módulo 2, altura 70 dots)
        bipZpl = `
^FO${xOffset + 610},12^GB2,216,2^FS
^FO${xOffset + 624},32^BY2,2.5,70^BCN,70,N,N,N^FD${bipCode}^FS
^A0N,16,16
^FO${xOffset + 616},120^FB168,1,0,C^FD${bipCode}^FS
^A0N,14,14
^FO${xOffset + 616},157^FB168,1,0,C^FDBIPAGEM^FS`;
      } else {
        // QR Code nativo Zebra (^BQ) - Modelo 2, fator de ampliação 4 (aprox 16mm x 16mm)
        bipZpl = `
^FO${xOffset + 610},12^GB2,216,2^FS
^FO${xOffset + 644},20^BQN,2,4^FDQA,${bipCode}^FS
^A0N,15,15
^FO${xOffset + 616},132^FB168,1,0,C^FD${bipCode}^FS
^A0N,14,14
^FO${xOffset + 616},163^FB168,1,0,C^FDBIPAGEM^FS`;
      }
    }

    return `^FO${xOffset + 20},14^GB22,22,22,B,0^FS
^A0N,18,18
^FR^FO${xOffset + 27},16^FDf^FS
^A0N,22,22
^FO${xOffset + 48},16^FDForpack^FS
${config.codigoOp ? `^A0N,18,18\n^FO${xOffset + 145},18^FDOP #${config.codigoOp}^FS` : ""}
^A0N,18,18
^FO${xOffset + (config.codigoOp ? 245 : 145)},18^FD${itemNumStr}^FS
^A0N,16,16
^FO${xOffset + (hasBipagem ? 350 : 500)},18^FB${hasBipagem ? 250 : 270},1,0,R^FDDATA: ${config.dataImpressao}^FS
^FO${xOffset + 20},42^GB${mainWidth},2,2^FS
^A0N,19,19
^FO${xOffset + 20},47^FB${mainWidth - 165},1,0,L^FDCLIENTE: ${clientName}^FS
^A0N,19,19
^FO${xOffset + 20},69^FB${mainWidth - 165},1,0,L^FDITEM: ${itemName}^FS
^A0N,17,17
^FO${xOffset + 20},91^FB${mainWidth - 165},1,0,L^FDFILME: ${config.tipoFilme}^FS
^A0N,14,14
^FO${xOffset + mainWidth - 150},47^FB150,1,0,R^FDMEDIDAS^FS
^A0N,32,32
^FO${xOffset + mainWidth - 150},66^FB150,1,0,R^FD${config.medidas}^FS
^FO${xOffset + 20},114^GB${mainWidth},2,2^FS
^A0N,22,22
^FO${xOffset + 20},125^FD${pesoBText}^FS
^A0N,24,24
^FO${xOffset + 280},124^FD${pesoLText}^FS${bipZpl}`;
  };

  // Gerador ZPL para etiqueta 43x24mm (2 Colunas / Foto 2)
  const buildSingleLabelZpl = (item: EtiquetaBobinaItem | null, xOffset: number) => {
    if (!item) return "";
    const hasWeights = config.imprimirPesos && item.pesoBruto > 0;
    const pesoText = hasWeights
      ? `PESO B: ${item.pesoBruto.toFixed(1)}   L: ${item.pesoLiquido.toFixed(1)}`
      : `PESO B:          L:`;

    const traceText = config.incluirIdentificacaoOp
      ? `OP #${config.codigoOp || ""} · ${item.codigoBobina || `BOB #${item.posicao}`}`
      : "";

    return `^A0N,24,24
^FO${xOffset + 6},8^FB332,1,0,C^FD${config.tipoFilme}^FS
^A0N,22,22
^FO${xOffset + 6},36^FB332,1,0,C^FD${config.aplicacao}^FS
^A0N,26,26
^FO${xOffset + 6},64^FB332,1,0,C^FD${config.medidas}^FS
^A0N,20,20
^FO${xOffset + 10},100^FD${pesoText}^FS
^A0N,18,18
^FO${xOffset + 10},138^FDDATA: ${config.dataImpressao}^FS
^FO${xOffset + 242},134^GB18,18,18,B,0^FS
^A0N,15,15
^FR^FO${xOffset + 248},136^FDf^FS
^A0N,18,18
^FO${xOffset + 264},136^FDForpack^FS
${traceText ? `^A0N,14,14\n^FO${xOffset + 6},168^FB332,1,0,C^FD${traceText}^FS` : ""}`;
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
^CI28
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
      const labelBody = is100x30
        ? buildSingleLabelZpl100x30(item, 0)
        : buildSingleLabelZpl(item, 6);

      return `^XA
^CI28
^PW${widthDots}
^LL${heightDots}
${zplOrientation}
${lhCommand}
${labelBody}
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

echo Localizando impressora Zebra no Windows e enviando diretamente (RAW Spooler)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$targetFile = Join-Path $PSScriptRoot '${prnFilename}'; if (-not (Test-Path $targetFile)) { $targetFile = '${prnFilename}' }; " ^
"$printer = Get-CimInstance Win32_Printer | Where-Object { $_.Name -match 'Zebra|ZD|GC|GK|TLP|GT|Argox|Elgin|Thermal' } | Select-Object -First 1; " ^
"if (-not $printer) { $printer = Get-CimInstance Win32_Printer | Where-Object { $_.Default -eq $true } | Select-Object -First 1 }; " ^
"if ($printer) { " ^
"  Write-Host ('[OK] Impressora detectada: ' + $printer.Name); " ^
"  $rawCode = @'
using System; using System.IO; using System.Runtime.InteropServices;
public class RawPrint {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)] public class DOCINFOA { [MarshalAs(UnmanagedType.LPStr)] public string pDocName; [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPStr)] public string pDataType; }
  [DllImport(\"winspool.Drv\", EntryPoint=\"OpenPrinterA\", SetLastError=true)] public static extern bool OpenPrinter(string p, out IntPtr h, IntPtr pd);
  [DllImport(\"winspool.Drv\")] public static extern bool ClosePrinter(IntPtr h);
  [DllImport(\"winspool.Drv\", EntryPoint=\"StartDocPrinterA\")] public static extern bool StartDocPrinter(IntPtr h, int l, DOCINFOA di);
  [DllImport(\"winspool.Drv\")] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport(\"winspool.Drv\")] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport(\"winspool.Drv\")] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport(\"winspool.Drv\")] public static extern bool WritePrinter(IntPtr h, IntPtr b, int c, out int w);
  public static bool Send(string pName, string fPath) {
    byte[] data = File.ReadAllBytes(fPath); IntPtr h;
    if (!OpenPrinter(pName, out h, IntPtr.Zero)) return false;
    DOCINFOA di = new DOCINFOA(); di.pDocName = \"Etiquetas_Forpack\"; di.pDataType = \"RAW\";
    if (StartDocPrinter(h, 1, di)) {
      if (StartPagePrinter(h)) {
        IntPtr pB = Marshal.AllocCoTaskMem(data.Length); Marshal.Copy(data, 0, pB, data.Length); int w;
        WritePrinter(h, pB, data.Length, out w); Marshal.FreeCoTaskMem(pB); EndPagePrinter(h);
      }
      EndDocPrinter(h);
    }
    ClosePrinter(h); return true;
  }
}
'@; " ^
"  Add-Type -TypeDefinition $rawCode; " ^
"  $success = [RawPrint]::Send($printer.Name, $targetFile); " ^
"  if ($success) { Write-Host '[SUCESSO] Etiquetas enviadas com sucesso a impressora Zebra!' -ForegroundColor Green } else { Write-Host '[AVISO] Nao foi possivel abrir a fila da impressora.' -ForegroundColor Yellow } " ^
"} else { Write-Host '[AVISO] Nenhuma impressora termica encontrada automaticamente.' -ForegroundColor Yellow }"

echo.
echo ===================================================================
echo DICA CASO A IMPRESSORA NAO TENHA IMPRESSO:
echo 1) Baixe a opcao "Arquivo HTML" no sistema: de 2 cliques nele no Windows e imprima direto!
echo 2) Zebra Setup Utilities (Oficial): Abra o programa ^> "Action" ^> "Send File" ^> selecione "${prnFilename}".
echo ===================================================================
echo.
pause
`;
}

/**
 * Função principal que executa a saída de etiquetas:
 * - Gera e baixa arquivo HTML Autônomo (1 duplo-clique no Windows)
 * - Gera e baixa arquivo .PRN / .ZPL (Recomendado para Windows - sem corte/rotação)
 * - Gera e baixa arquivo de dados .CSV
 * - Gera script Windows .BAT
 * - Ou abre diálogo direto do navegador
 */
export function emitirEtiquetasZebra(
  itens: EtiquetaBobinaItem[],
  config: EtiquetaZebraData,
  forceAction?: "arquivo_html" | "arquivo_prn" | "arquivo_csv" | "arquivo_bat" | "navegador"
): { type: "download" | "print"; filename?: string } {
  const action = forceAction || config.modoSaidaImpressao || "arquivo_html";

  if (action === "arquivo_html") {
    const html = generateHtmlStandalone(itens, config);
    const opPart = config.codigoOp ? `OP_${config.codigoOp}` : "Bobinas";
    const posPart =
      itens.length === 1
        ? `_bobina_${itens[0].posicao}`
        : `_${itens.length}_bobinas`;
    const filename = `etiquetas_bobinas_${opPart}${posPart}.html`;
    downloadEtiquetaFile(html, filename, "text/html;charset=utf-8");
    return { type: "download", filename };
  }

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

  // Bipagem identifier and preview SVG for the simulator
  const previewBipCode = useMemo(() => {
    return config.codigoOp
      ? `${config.codigoOp}-${previewBobina.posicao.toString().padStart(2, "0")}`
      : (previewBobina.codigoBobina || `BOB-${previewBobina.posicao.toString().padStart(2, "0")}`);
  }, [config.codigoOp, previewBobina]);

  const previewCodeSvg = useMemo(() => {
    if (config.tipoCodigoBipagem === "barcode") {
      return generateBarcode128Svg(previewBipCode, 70, 22);
    }
    if (config.tipoCodigoBipagem === "qrcode") {
      return generateQrCodeSvg(previewBipCode, 54);
    }
    return "";
  }, [config.tipoCodigoBipagem, previewBipCode]);

  // ZPL output string
  const zplString = useMemo(() => {
    return generateZplCode(targetItens, config);
  }, [targetItens, config]);

  const showToast = (title: string, message: string) => {
    setDownloadToast({ title, message });
    setTimeout(() => setDownloadToast(null), 5000);
  };

  const handleEmitir = (forceAction?: "arquivo_html" | "arquivo_prn" | "arquivo_csv" | "arquivo_bat" | "navegador") => {
    const res = emitirEtiquetasZebra(targetItens, config, forceAction);
    if (res.type === "download") {
      showToast(
        "Arquivo Gerado com Sucesso!",
        `O arquivo "${res.filename}" foi baixado. Pronto para impressão direta no Windows.`
      );
    }
  };

  const handleEmitirTest = (forceAction?: "arquivo_html" | "arquivo_prn" | "arquivo_csv" | "navegador") => {
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
                  {config.tamanhoEtiqueta === "100x30"
                    ? "⭐ 100 x 30 mm · 1 Carreira (100x30x1)"
                    : config.tamanhoEtiqueta === "43x24"
                    ? "4,30 x 2,40 cm (2 Carreiras / 88mm)"
                    : `${config.larguraMm || 100} x ${config.alturaMm || 30} mm`}
                </span>
                {config.formatoRolo === "2_colunas" && (
                  <span className="text-[9px] font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-400/30 font-bold">
                    2 Colunas (88 mm total)
                  </span>
                )}
                {config.formatoRolo === "1_coluna" && (
                  <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-400/30 font-bold">
                    Pista Única (100 mm)
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
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => updateConfig({ modoSaidaImpressao: "arquivo_html" })}
                    className={`p-2 rounded-lg text-left transition cursor-pointer border flex flex-col justify-between ${
                      (config.modoSaidaImpressao || "arquivo_html") === "arquivo_html"
                        ? "bg-blue-600/60 border-cyan-400 text-white shadow-2xs ring-1 ring-cyan-300"
                        : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold flex items-center gap-1.5 text-white">
                        <Globe className="w-3.5 h-3.5 text-cyan-300" />
                        Arquivo HTML (.html)
                      </span>
                      {(config.modoSaidaImpressao || "arquivo_html") === "arquivo_html" && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </div>
                    <span className="text-[9.5px] text-blue-200/80">
                      1 Duplo-clique no Windows: abre e imprime direto.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateConfig({ modoSaidaImpressao: "arquivo_prn" })}
                    className={`p-2 rounded-lg text-left transition cursor-pointer border flex flex-col justify-between ${
                      config.modoSaidaImpressao === "arquivo_prn"
                        ? "bg-blue-600/60 border-blue-400 text-white shadow-2xs ring-1 ring-blue-300"
                        : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold flex items-center gap-1.5">
                        <FileDown className="w-3.5 h-3.5 text-blue-300" />
                        Arquivo .PRN / .ZPL
                      </span>
                      {config.modoSaidaImpressao === "arquivo_prn" && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </div>
                    <span className="text-[9.5px] text-blue-200/70">
                      Código bruto. Usar no Zebra Setup Utilities.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateConfig({ modoSaidaImpressao: "arquivo_csv" })}
                    className={`p-2 rounded-lg text-left transition cursor-pointer border flex flex-col justify-between ${
                      config.modoSaidaImpressao === "arquivo_csv"
                        ? "bg-blue-600/60 border-blue-400 text-white shadow-2xs ring-1 ring-blue-300"
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
                        ? "bg-blue-600/60 border-blue-400 text-white shadow-2xs ring-1 ring-blue-300"
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

                {/* CAIXA DE AJUDA / DIAGNÓSTICO: BAIXOU O ARQUIVO E NÃO IMPRIMIU? */}
                <div className="bg-amber-400/15 border border-amber-400/30 rounded-lg p-2.5 text-[11px] text-amber-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Baixou o arquivo .PRN e não saiu a impressão? Veja o porquê:</span>
                  </div>
                  <p className="text-[10.5px] leading-relaxed text-amber-100/90 pl-5.5">
                    No Windows, arquivos <strong>.PRN</strong> contêm comandos brutos da impressora. Se você deu duplo-clique e abriu no Bloco de Notas ou clicou com o botão direito em "Imprimir", o Windows envia como texto comum e a impressora não responde.
                    <br />
                    👉 <strong>Para imprimir agora com 1 clique:</strong> Baixe a opção <strong>"Arquivo HTML"</strong> acima! Basta dar 2 cliques no arquivo baixado e clicar em Imprimir.
                  </p>
                </div>

                {/* BOTÕES RÁPIDOS DE DOWNLOAD IMEDIATO */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/10">
                  <span className="text-[10px] text-blue-200 font-semibold mr-1">Baixar agora:</span>
                  <button
                    type="button"
                    onClick={() => handleEmitir("arquivo_html")}
                    className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-[10.5px] flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                    title="Baixa arquivo HTML pronto para dar duplo-clique no Windows e imprimir"
                  >
                    <Globe className="w-3.5 h-3.5 text-cyan-200" />
                    <span>Baixar HTML ({targetItens.length})</span>
                  </button>
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
                    onClick={() => handleEmitir("arquivo_bat")}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[10.5px] flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                    title="Baixa o .prn acompanhado do script .bat do Windows para enviar com duplo-clique"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Script .BAT</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEmitir("arquivo_csv")}
                    className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white font-bold rounded-lg text-[10.5px] flex items-center gap-1.5 transition cursor-pointer border border-white/20 active:scale-95"
                    title="Baixa arquivo CSV formatado para BarTender ou ZebraDesigner"
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>Planilha .CSV</span>
                  </button>
                </div>
              </div>

              {/* SELETOR DE FORMATO DE ETIQUETA NO ROLO */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                    <Tag className="w-4 h-4 text-blue-600" />
                    <span>Formato da Etiqueta no Rolo</span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>{config.tamanhoEtiqueta === "100x30" ? "Formato Ativo: 100x30x1 (1 Coluna)" : `${config.larguraMm}x${config.alturaMm} mm`}</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
                  {/* PRESET 1: 100x30x1 (NOVO ROLO COMPRADO) */}
                  <button
                    type="button"
                    onClick={() =>
                      updateConfig({
                        tamanhoEtiqueta: "100x30",
                        larguraMm: 100,
                        alturaMm: 30,
                        formatoRolo: "1_coluna",
                        duplicarPistas: false,
                        espacamentoColunasMm: 0,
                      })
                    }
                    className={`p-2.5 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                      config.tamanhoEtiqueta === "100x30"
                        ? "bg-blue-600 text-white border-blue-700 shadow-xs ring-2 ring-blue-400/30"
                        : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <strong className="text-xs font-black">⭐ 100 x 30 mm (100x30x1)</strong>
                      <span
                        className={`text-[8.5px] px-1.5 py-0.2 rounded font-black uppercase ${
                          config.tamanhoEtiqueta === "100x30"
                            ? "bg-amber-300 text-slate-900"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        Novo / Rolo
                      </span>
                    </div>
                    <span
                      className={`text-[10px] leading-tight block ${
                        config.tamanhoEtiqueta === "100x30" ? "text-blue-100" : "text-slate-500"
                      }`}
                    >
                      1 Carreira (100 mm). Rolo novo comprado (2.270 etiquetas).
                    </span>
                  </button>

                  {/* PRESET 2: 43x24x2 (PADRÃO ANTERIOR) */}
                  <button
                    type="button"
                    onClick={() =>
                      updateConfig({
                        tamanhoEtiqueta: "43x24",
                        larguraMm: 43,
                        alturaMm: 24,
                        formatoRolo: "2_colunas",
                        duplicarPistas: true,
                        espacamentoColunasMm: 2,
                      })
                    }
                    className={`p-2.5 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                      config.tamanhoEtiqueta === "43x24"
                        ? "bg-blue-600 text-white border-blue-700 shadow-xs ring-2 ring-blue-400/30"
                        : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <strong className="text-xs font-black">43 x 24 mm (2 Colunas)</strong>
                      <span
                        className={`text-[8.5px] px-1.5 py-0.2 rounded font-semibold ${
                          config.tamanhoEtiqueta === "43x24"
                            ? "bg-blue-700 text-blue-200"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        88 mm total
                      </span>
                    </div>
                    <span
                      className={`text-[10px] leading-tight block ${
                        config.tamanhoEtiqueta === "43x24" ? "text-blue-100" : "text-slate-500"
                      }`}
                    >
                      2 Pistas lado a lado (formato compacto anterior).
                    </span>
                  </button>

                  {/* PRESET 3: 60x40 mm */}
                  <button
                    type="button"
                    onClick={() =>
                      updateConfig({
                        tamanhoEtiqueta: "60x40",
                        larguraMm: 60,
                        alturaMm: 40,
                        formatoRolo: "1_coluna",
                        duplicarPistas: false,
                        espacamentoColunasMm: 0,
                      })
                    }
                    className={`p-2.5 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                      config.tamanhoEtiqueta === "60x40"
                        ? "bg-blue-600 text-white border-blue-700 shadow-xs ring-2 ring-blue-400/30"
                        : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <strong className="text-xs font-black">60 x 40 mm (1 Coluna)</strong>
                    </div>
                    <span
                      className={`text-[10px] leading-tight block ${
                        config.tamanhoEtiqueta === "60x40" ? "text-blue-100" : "text-slate-500"
                      }`}
                    >
                      Etiqueta média para sacarias e caixas.
                    </span>
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
                      <span>Saída do Papel ({config.larguraMm || 100} mm)</span>
                      <ArrowDown className="w-3 h-3 text-amber-400 animate-bounce" />
                    </span>
                  </div>

                  {/* SIMULAÇÃO DO PAPEL SILICONE */}
                  <div className="bg-amber-100/90 rounded-md p-2.5 border border-amber-300 shadow-md w-full flex items-center justify-center gap-2 overflow-x-auto min-h-[145px]">
                    {/* FORMATO 100x30x1 (1 CARREIRA / PISTA ÚNICA) */}
                    {(config.tamanhoEtiqueta === "100x30" || (config.larguraMm || 0) >= 85) ? (
                      <div
                        className="bg-white text-slate-900 border border-slate-400 rounded-[6px] p-2 shadow-md flex flex-row items-stretch justify-between gap-2 text-left select-none shrink-0"
                        style={{
                          width: "330px",
                          height: "108px",
                          fontFamily: "Arial, Helvetica, sans-serif",
                          ...previewRotationStyle,
                        }}
                      >
                        {/* COLUNA ESQUERDA: DADOS TÉCNICOS DE PRODUÇÃO */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          {/* HEADER: LOGO · OP & ITEM Nº · DATA */}
                          <div className="flex items-center justify-between border-b border-slate-300 pb-0.5">
                            <div className="flex items-center gap-1">
                              <span className="w-3.5 h-3.5 bg-black text-white rounded-full flex items-center justify-center font-bold font-serif text-[7.5px] leading-none pb-0.5">
                                f
                              </span>
                              <span className="font-black text-[9.5px] tracking-tight text-slate-900">
                                FORPACK
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 font-mono text-[8px] whitespace-nowrap">
                              {config.codigoOp && (
                                <span className="font-extrabold text-slate-900">
                                  OP #{config.codigoOp}
                                </span>
                              )}
                              <span className="font-extrabold text-slate-900">
                                ITEM #{previewBobina.posicao.toString().padStart(2, "0")}
                              </span>
                            </div>
                            <div className="text-[8px] font-bold text-slate-800 whitespace-nowrap shrink-0 ml-auto">
                              DATA: {config.dataImpressao}
                            </div>
                          </div>

                          {/* CORPO: CLIENTE, ITEM, MATERIAL & MEDIDAS */}
                          <div className="flex items-center justify-between py-0.5 my-auto gap-1.5">
                            <div className="flex-1 min-w-0">
                              <div className="font-black text-[9px] tracking-tight uppercase leading-tight truncate text-slate-950 flex items-center gap-1">
                                <span className="text-[7.5px] font-bold text-slate-500 shrink-0">CLIENTE:</span>
                                <span className="truncate">{config.cliente || "CLIENTE"}</span>
                              </div>
                              <div className="font-extrabold text-[8.5px] tracking-tight uppercase leading-tight truncate text-slate-900 mt-0.5 flex items-center gap-1">
                                <span className="text-[7.5px] font-bold text-slate-500 shrink-0">ITEM:</span>
                                <span className="truncate">{config.aplicacao || config.itemDescricao || "PRODUTO"}</span>
                              </div>
                              <div className="font-bold text-[8px] tracking-wide uppercase leading-tight truncate text-slate-700 mt-0.5 flex items-center gap-1">
                                <span className="text-[7px] font-bold text-slate-500 shrink-0">FILME:</span>
                                <span className="truncate">{config.tipoFilme || "FILME PEBD IMP"}</span>
                              </div>
                            </div>
                            <div className="border-l border-slate-300 pl-1.5 text-right shrink-0">
                              <span className="text-[7px] font-black uppercase text-slate-500 block leading-none">
                                MEDIDAS
                              </span>
                              <span className="font-black text-xs text-slate-950 font-mono tracking-tight leading-tight block">
                                {config.medidas || "69X0,028"}
                              </span>
                            </div>
                          </div>

                          {/* RODAPÉ: METROLOGIA (SEM TARA - APENAS PESO BRUTO E LÍQUIDO) */}
                          <div className="flex items-center justify-between border-t border-slate-300 pt-0.5 text-[8px]">
                            <div className="flex items-center gap-1">
                              <span className="font-black text-slate-600">PESO BRUTO:</span>
                              <span className="font-bold font-mono text-[9px]">
                                {config.imprimirPesos && previewBobina.pesoBruto > 0
                                  ? `${previewBobina.pesoBruto.toFixed(1)} KG`
                                  : "________ KG"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="font-black text-slate-700">PESO LÍQUIDO:</span>
                              <span className="font-black font-mono text-[9.5px] text-slate-950">
                                {config.imprimirPesos && previewBobina.pesoLiquido > 0
                                  ? `${previewBobina.pesoLiquido.toFixed(1)} KG`
                                  : "________ KG"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* COLUNA DIREITA: BIPAGEM COM QR CODE OU CÓDIGO DE BARRAS */}
                        {config.tipoCodigoBipagem !== "nenhum" && (
                          <div className="w-[68px] border-l border-dashed border-slate-300 pl-1.5 flex flex-col items-center justify-center shrink-0">
                            <div
                              className="w-full flex items-center justify-center max-h-[56px] overflow-hidden [&>svg]:max-w-full [&>svg]:h-auto"
                              dangerouslySetInnerHTML={{ __html: previewCodeSvg }}
                            />
                            <span className="text-[7px] font-mono font-bold text-slate-800 leading-tight mt-0.5 truncate max-w-full">
                              {previewBipCode}
                            </span>
                            <span className="text-[6px] font-black tracking-wider uppercase bg-black text-white px-1.5 py-0.2 rounded-xs mt-0.5">
                              BIPAGEM
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>

                  {/* LEGENDA DO AVANÇO */}
                  <div className="w-full flex items-center justify-between text-[10px] text-slate-400 px-1 pt-0.5">
                    <span>
                      Largura do rolo:{" "}
                      <strong>
                        {config.tamanhoEtiqueta === "100x30" || (config.larguraMm || 0) >= 85
                          ? "100 mm (1 Carreira / 100x30x1)"
                          : "88 mm (Pistas duplas)"}
                      </strong>
                    </span>
                    <span>
                      Avanço:{" "}
                      <strong>
                        {config.tamanhoEtiqueta === "100x30" || (config.alturaMm || 0) >= 30
                          ? "30 mm"
                          : "24 mm"}
                      </strong>{" "}
                      por etiqueta
                    </span>
                  </div>
                </div>

                {/* BOTÃO RÁPIDO PARA TESTAR NA IMPRESSORA FÍSICA */}
                <div className="mt-3 w-full flex items-center justify-between gap-2 p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl">
                  <div className="text-left">
                    <span className="text-[11px] font-bold text-emerald-950 block">
                      Validação Imediata na Zebra:
                    </span>
                    <span className="text-[10px] text-emerald-800 block">
                      {config.tamanhoEtiqueta === "100x30"
                        ? "Imprime 1 etiqueta de 100x30 para confirmar alinhamento."
                        : "Imprime 1 avanço para confirmar o sentido físico."}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEmitirTest()}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer active:scale-95 shrink-0"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>
                      {config.tamanhoEtiqueta === "100x30" || (config.larguraMm || 0) >= 85
                        ? "Testar 1 Etiqueta (100x30)"
                        : "Testar 1 Par Agora"}
                    </span>
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
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 uppercase tracking-wide text-[10.5px]">
                      Dados Textuais & Identificação da Bobina
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfig(inferEtiquetaZebraData(order, palete))}
                      className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Atualizar da OP</span>
                    </button>
                  </div>

                  {/* CLIENTE E ITEM / PRODUTO */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                        Cliente (da OP)
                      </label>
                      <input
                        type="text"
                        value={config.cliente || ""}
                        onChange={(e) => updateConfig({ cliente: e.target.value.toUpperCase() })}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-900"
                        placeholder="Nome do cliente da OP"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                        Item / Produto (da OP)
                      </label>
                      <input
                        type="text"
                        value={config.aplicacao || config.itemDescricao || ""}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          updateConfig({ aplicacao: val, itemDescricao: val });
                        }}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-900"
                        placeholder="Descrição do item da OP"
                      />
                    </div>
                  </div>

                  {/* MATERIAL E MEDIDAS */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                        Tipo de Filme / Material
                      </label>
                      <input
                        type="text"
                        value={config.tipoFilme}
                        onChange={(e) => updateConfig({ tipoFilme: e.target.value.toUpperCase() })}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                        Medidas
                      </label>
                      <input
                        type="text"
                        value={config.medidas}
                        onChange={(e) => updateConfig({ medidas: e.target.value })}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                        Data de Emissão
                      </label>
                      <input
                        type="text"
                        value={config.dataImpressao}
                        onChange={(e) => updateConfig({ dataImpressao: e.target.value })}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                        Código para Bipagem / Leitor
                      </label>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          type="button"
                          onClick={() => updateConfig({ tipoCodigoBipagem: "qrcode" })}
                          className={`py-1 px-1.5 rounded text-[10px] font-bold border transition cursor-pointer text-center ${
                            (config.tipoCodigoBipagem || "qrcode") === "qrcode"
                              ? "bg-blue-600 text-white border-blue-700 shadow-2xs"
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                          }`}
                        >
                          QR Code
                        </button>
                        <button
                          type="button"
                          onClick={() => updateConfig({ tipoCodigoBipagem: "barcode" })}
                          className={`py-1 px-1.5 rounded text-[10px] font-bold border transition cursor-pointer text-center ${
                            config.tipoCodigoBipagem === "barcode"
                              ? "bg-blue-600 text-white border-blue-700 shadow-2xs"
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                          }`}
                        >
                          Cód. 128
                        </button>
                        <button
                          type="button"
                          onClick={() => updateConfig({ tipoCodigoBipagem: "nenhum" })}
                          className={`py-1 px-1.5 rounded text-[10px] font-bold border transition cursor-pointer text-center ${
                            config.tipoCodigoBipagem === "nenhum"
                              ? "bg-blue-600 text-white border-blue-700 shadow-2xs"
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                          }`}
                        >
                          Nenhum
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.imprimirPesos}
                        onChange={(e) => updateConfig({ imprimirPesos: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="text-[11px] font-semibold text-slate-800">
                        Imprimir pesos (Bruto e Líquido sem Tara)
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
                        Duplicar nas 2 pistas (rolo 43x24)
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. ARQUIVO HTML AUTÔNOMO */}
                <div className="bg-white border-2 border-cyan-400 rounded-xl p-3.5 shadow-xs flex flex-col justify-between space-y-3 relative overflow-hidden ring-1 ring-cyan-200">
                  <div className="absolute top-0 right-0 bg-cyan-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-bl-lg tracking-wider">
                    Mais Fácil (1 Clique)
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-cyan-700 font-bold text-xs uppercase mb-1">
                      <Globe className="w-4 h-4 text-cyan-600" />
                      <span>Arquivo HTML (.html)</span>
                    </div>
                    <strong className="text-xs font-bold text-slate-900 block">
                      Abre Direto no Windows
                    </strong>
                    <p className="text-[10.5px] text-slate-600 mt-1 leading-relaxed">
                      Dê 1 duplo-clique no Windows: abre no Edge/Chrome já no formato milimétrico correto com botão de impressão.
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleEmitir("arquivo_html")}
                      className="w-full py-2 px-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Baixar HTML ({targetItens.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEmitirTest("arquivo_html")}
                      className="w-full py-1.5 px-3 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 font-semibold rounded-lg text-[11px] flex items-center justify-center gap-1.5 border border-cyan-200 transition cursor-pointer"
                    >
                      <span>Baixar Teste HTML (1 Par)</span>
                    </button>
                  </div>
                </div>

                {/* 2. ARQUIVO .PRN / .ZPL */}
                <div className="bg-white border border-blue-300 rounded-xl p-3.5 shadow-xs flex flex-col justify-between space-y-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-blue-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-bl-lg tracking-wider">
                    Zebra Nativo
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-blue-700 font-bold text-xs uppercase mb-1">
                      <FileDown className="w-4 h-4" />
                      <span>Arquivo .PRN / .ZPL</span>
                    </div>
                    <strong className="text-xs font-bold text-slate-900 block">
                      Zebra Setup Utilities
                    </strong>
                    <p className="text-[10.5px] text-slate-600 mt-1 leading-relaxed">
                      Código térmico ZPL nativo (203 DPI). Envie pelo menu "Send File" do Zebra Setup Utilities.
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleEmitir("arquivo_prn")}
                      className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Baixar .PRN ({targetItens.length})</span>
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

                {/* 3. SCRIPT EXECUTÁVEL .BAT DO WINDOWS */}
                <div className="bg-white border border-emerald-300 rounded-xl p-3.5 shadow-xs flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs uppercase mb-1">
                      <Terminal className="w-4 h-4" />
                      <span>Script .BAT Windows</span>
                    </div>
                    <strong className="text-xs font-bold text-slate-900 block">
                      Envio Automático Spooler
                    </strong>
                    <p className="text-[10.5px] text-slate-600 mt-1 leading-relaxed">
                      Envia diretamente para a impressora Zebra conectada via Spooler do Windows (PowerShell RAW).
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleEmitir("arquivo_bat")}
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs active:scale-95"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span>Baixar Pacote .BAT</span>
                    </button>
                    <span className="text-[10px] text-slate-500 block text-center">
                      Executar na mesma pasta do .PRN.
                    </span>
                  </div>
                </div>

                {/* 4. PLANILHA DE DADOS .CSV */}
                <div className="bg-white border border-amber-300 rounded-xl p-3.5 shadow-xs flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-amber-700 font-bold text-xs uppercase mb-1">
                      <Table className="w-4 h-4" />
                      <span>Planilha .CSV de Dados</span>
                    </div>
                    <strong className="text-xs font-bold text-slate-900 block">
                      BarTender / ZebraDesigner
                    </strong>
                    <p className="text-[10.5px] text-slate-600 mt-1 leading-relaxed">
                      Todas as bobinas, pesos, OP, cliente e código em colunas para mesclagem de modelos existentes.
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleEmitir("arquivo_csv")}
                      className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs active:scale-95"
                    >
                      <Table className="w-3.5 h-3.5" />
                      <span>Baixar .CSV</span>
                    </button>
                    <span className="text-[10px] text-slate-500 block text-center">
                      Excel, BarTender e ZebraDesigner.
                    </span>
                  </div>
                </div>
              </div>

              {/* CARD DE DIAGNÓSTICO: BAIXOU O .PRN E NÃO IMPRIMIU? */}
              <div className="p-4 bg-amber-500/15 border-2 border-amber-400 rounded-xl space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <span>Baixou o arquivo .PRN e não saiu a impressão? Veja exatamente o porquê:</span>
                    </h4>
                    <div className="text-[11px] text-amber-900/95 mt-1.5 leading-relaxed space-y-2">
                      <p>
                        <strong>1. O que aconteceu no Windows:</strong> O arquivo <code>.PRN</code> contém comandos de máquina ZPL térmicos. O Windows por padrão não sabe o que fazer com ele ao dar duplo-clique. Se você abriu no <em>Bloco de Notas</em> e clicou em <em>Arquivo &gt; Imprimir</em>, ou clicou com o botão direito em <em>Imprimir</em>, o Windows tenta converter o arquivo como se fosse uma folha de texto comum A4 e manda para o driver gráfico, e a impressora térmica Zebra rejeita ou ejeta etiquetas em branco.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                        <div className="bg-white/70 p-2.5 rounded-lg border border-amber-300">
                          <strong className="text-cyan-800 block font-bold mb-0.5">
                            ✅ Solução 1: Arquivo HTML (Mais Fácil de Todas)
                          </strong>
                          <span className="text-[10.5px] text-slate-700 block">
                            Baixe o <strong>Arquivo HTML (.html)</strong> acima. Você pode dar <strong>2 cliques no arquivo</strong> no Windows que ele abre na hora no Chrome/Edge com a etiqueta 100% pronta e o botão de Imprimir.
                          </span>
                        </div>
                        <div className="bg-white/70 p-2.5 rounded-lg border border-amber-300">
                          <strong className="text-blue-800 block font-bold mb-0.5">
                            ✅ Solução 2: Zebra Setup Utilities (Oficial Zebra)
                          </strong>
                          <span className="text-[10.5px] text-slate-700 block">
                            Abra o programa <strong>Zebra Setup Utilities</strong> &gt; Selecione sua Zebra &gt; Clique em <em>"Open Printer Tools"</em> &gt; Aba <em>"Action"</em> &gt; <em>"Send File"</em> &gt; Selecione o <code>.prn</code>.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* GUIA PASSO A PASSO DETALHADO */}
              <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-400" />
                  <span>Passo a Passo Completo dos Métodos de Impressão no Windows:</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700 space-y-1.5">
                    <strong className="text-cyan-400 block font-bold">
                      Método A: Arquivo HTML (Sem Instalar Nada)
                    </strong>
                    <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px]">
                      <li>Baixe o <strong>Arquivo HTML</strong> acima.</li>
                      <li>Dê <strong>duplo-clique</strong> no arquivo baixado.</li>
                      <li>Ele abre no seu navegador padrão.</li>
                      <li>Clique em <strong>"Imprimir na Zebra"</strong>.</li>
                      <li>Nas opções: Margens = Nenhuma. Imprime perfeito!</li>
                    </ol>
                  </div>

                  <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700 space-y-1.5">
                    <strong className="text-emerald-400 block font-bold">
                      Método B: Zebra Setup Utilities (Oficial Zebra)
                    </strong>
                    <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px]">
                      <li>Baixe o arquivo <strong>.PRN</strong> acima.</li>
                      <li>Abra o <strong>Zebra Setup Utilities</strong> no Windows.</li>
                      <li>Clique na sua impressora e vá em <em>"Action" &gt; "Send File"</em>.</li>
                      <li>Selecione o arquivo baixado. Sai na hora!</li>
                    </ol>
                  </div>

                  <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700 space-y-1.5">
                    <strong className="text-blue-400 block font-bold">
                      Método C: BarTender / ZebraDesigner 3
                    </strong>
                    <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px]">
                      <li>Baixe o arquivo <strong>.CSV</strong> acima.</li>
                      <li>Abra o seu modelo no BarTender ou ZebraDesigner.</li>
                      <li>Conecte o CSV como fonte de dados da etiqueta.</li>
                      <li>Clique em Imprimir no Windows.</li>
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
              <strong>
                {config.tamanhoEtiqueta === "100x30"
                  ? "100 x 30 mm (100x30x1)"
                  : config.tamanhoEtiqueta === "43x24"
                  ? "4,30 x 2,40 cm (2 Carreiras)"
                  : `${config.larguraMm || 100} x ${config.alturaMm || 30} mm`}
              </strong>
              {config.formatoRolo === "2_colunas" ? " · Rolo 2 Colunas (88 mm)" : " · Rolo 1 Coluna (100 mm)"}
            </span>
            <span className="ml-2 inline-flex items-center gap-1 font-semibold text-slate-500">
              Modo:{" "}
              <span className="font-bold text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded text-[11px]">
                {(config.modoSaidaImpressao || "arquivo_html") === "arquivo_html"
                  ? "Arquivo HTML (1 Duplo-Clique)"
                  : config.modoSaidaImpressao === "arquivo_prn"
                  ? "Arquivo .PRN Zebra"
                  : config.modoSaidaImpressao === "arquivo_bat"
                  ? "Script .BAT Windows"
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
              title="Testar 1 avanço ou etiqueta"
            >
              {(config.modoSaidaImpressao || "arquivo_html") === "arquivo_html" ? (
                <>
                  <Globe className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{config.formatoRolo === "2_colunas" ? "Testar HTML (1 Par)" : "Testar HTML (1 Etiqueta)"}</span>
                </>
              ) : config.modoSaidaImpressao === "arquivo_prn" ? (
                <>
                  <FileDown className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Gerar Teste .PRN</span>
                </>
              ) : config.modoSaidaImpressao === "arquivo_bat" ? (
                <>
                  <Terminal className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Testar .BAT</span>
                </>
              ) : config.modoSaidaImpressao === "arquivo_csv" ? (
                <>
                  <Table className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Testar .CSV</span>
                </>
              ) : (
                <>
                  <Printer className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{config.formatoRolo === "2_colunas" ? "Testar 1 Par" : "Testar 1 Etiqueta"}</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleEmitir()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-lg text-xs transition shadow-xs flex items-center gap-2 cursor-pointer"
            >
              {(config.modoSaidaImpressao || "arquivo_html") === "arquivo_html" ? (
                <>
                  <Globe className="w-4 h-4 text-cyan-200" />
                  <span>Gerar Arquivo HTML ({targetItens.length})</span>
                </>
              ) : config.modoSaidaImpressao === "arquivo_prn" ? (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>Gerar Arquivo .PRN ({targetItens.length})</span>
                </>
              ) : config.modoSaidaImpressao === "arquivo_bat" ? (
                <>
                  <Terminal className="w-4 h-4" />
                  <span>Baixar Pacote .BAT ({targetItens.length})</span>
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
