import {
  StorageRow,
  Order,
  Production,
  Machine,
  RegistryKind,
  Insumo,
  CustoSetorConfig,
  FichaTecnica,
  BobinaSemiAcabada,
  StatusBobina,
  MovimentacaoEstoque,
  PaleteRomaneio,
} from "../types/forpack";

// ============================================================================
// CONEXÃO
// ============================================================================
// Se existirem as variáveis VITE_SUPABASE_URL / VITE_SUPABASE_KEY (Vercel ou .env),
// elas têm prioridade. Caso contrário, usa os valores abaixo (iguais aos atuais).

const ENV =
  ((import.meta as unknown) as { env?: Record<string, string | undefined> }).env ?? {};

export const SUPABASE_URL = ENV.VITE_SUPABASE_URL || "https://gbgmvqbxozzcloynwdbo.supabase.co";
export const SUPABASE_KEY = ENV.VITE_SUPABASE_KEY || "sb_publishable_5W3m26faz-Jhr8j42B5_Lg_t4EV6rSy";

const REST = `${SUPABASE_URL}/rest/v1/`;
const TIMEOUT_MS = 30000;

// ----------------------------------------------------------------------------
// Preparação para o login (etapa seguinte): quando existir uma sessão, o app
// chama setAccessTokenProvider(() => token) e todas as chamadas passam a usar
// o token do usuário no lugar da chave pública. Hoje não muda nada.
// ----------------------------------------------------------------------------
let accessTokenProvider: (() => string | null) | null = null;

export function setAccessTokenProvider(fn: (() => string | null) | null): void {
  accessTokenProvider = fn;
}

// ============================================================================
// ERROS E AVISOS (para a tela poder mostrar um aviso em vez de "lista vazia")
// ============================================================================

export class ApiError extends Error {
  status: number;
  detalhe?: string;
  constructor(message: string, status = 0, detalhe?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detalhe = detalhe;
  }
}

export class ConflictError extends Error {
  constructor(message = "Este registro foi alterado por outra pessoa. Atualize a tela e tente de novo.") {
    super(message);
    this.name = "ConflictError";
  }
}

export interface ApiErrorInfo {
  contexto: string;
  mensagem: string;
  status?: number;
  quando: string;
}

const errorListeners = new Set<(info: ApiErrorInfo) => void>();

/** A tela se inscreve aqui para exibir um aviso quando uma leitura falhar. */
export function onApiError(cb: (info: ApiErrorInfo) => void): () => void {
  errorListeners.add(cb);
  return () => {
    errorListeners.delete(cb);
  };
}

function reportApiError(contexto: string, err: unknown): void {
  const mensagem = err instanceof Error ? err.message : String(err);
  const status = err instanceof ApiError ? err.status : undefined;
  console.error(`[supabaseApi] ${contexto}:`, err);
  const info: ApiErrorInfo = { contexto, mensagem, status, quando: new Date().toISOString() };
  errorListeners.forEach((cb) => {
    try {
      cb(info);
    } catch {
      /* um ouvinte com erro não pode derrubar os outros */
    }
  });
}

// Indica se os dados exibidos são os "padrão" do código (não vieram do banco).
const dataSourceFlags = { custosSetorPadrao: false, fichasTecnicasPadrao: false };

export function getDataSourceFlags(): { custosSetorPadrao: boolean; fichasTecnicasPadrao: boolean } {
  return { ...dataSourceFlags };
}

// ============================================================================
// CONFLITO DE EDIÇÃO
// ============================================================================
// "overwrite" = comportamento de hoje (se alguém alterou antes, grava por cima,
//               mas avisa pelo campo `conflict` do retorno).
// "strict"    = não grava por cima: lança ConflictError. Só ligar depois que as
//               telas atualizarem o updatedAt após cada salvamento.

export type ConflictMode = "overwrite" | "strict";
let conflictMode: ConflictMode = "overwrite";

export function setConflictMode(mode: ConflictMode): void {
  conflictMode = mode;
}

export interface WriteResult {
  updatedAt: string;
  conflict: boolean;
}

// ============================================================================
// NÚCLEO: UMA ÚNICA FORMA DE FALAR COM O BANCO
// ============================================================================

interface RestOptions {
  method?: string;
  body?: unknown;
  prefer?: string;
  headers?: Record<string, string>;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = accessTokenProvider?.() || SUPABASE_KEY;
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, ...extra };
}

async function rest(path: string, opts: RestOptions = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(REST + path, {
      method: opts.method ?? "GET",
      headers: authHeaders({
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(opts.prefer ? { Prefer: opts.prefer } : {}),
        ...(opts.headers ?? {}),
      }),
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    throw new ApiError(
      aborted ? "O servidor demorou demais para responder." : "Sem conexão com o servidor.",
      0
    );
  } finally {
    clearTimeout(timer);
  }
}

async function failure(res: Response, message: string): Promise<ApiError> {
  let detalhe = "";
  try {
    detalhe = (await res.text()).slice(0, 300);
  } catch {
    /* sem detalhe */
  }
  return new ApiError(message, res.status, detalhe);
}

async function rows<T>(res: Response): Promise<T[]> {
  const data = await res.json();
  return Array.isArray(data) ? (data as T[]) : [];
}

// ============================================================================
// app_storage (tabela chave/valor usada por pedidos, produção, cadastros etc.)
// ============================================================================

const STORAGE = "app_storage";
const STORAGE_COLS = "key,value,updated_at";
const keyEq = (key: string) => `key=eq.${encodeURIComponent(key)}`;

interface RawRow {
  key: string;
  value: string;
  updated_at?: string;
}

async function readStorageRow(key: string): Promise<RawRow | null> {
  const res = await rest(`${STORAGE}?${keyEq(key)}&select=${STORAGE_COLS}`);
  if (!res.ok) throw await failure(res, "Não foi possível ler o registro.");
  const found = await rows<RawRow>(res);
  return found[0] ?? null;
}

/** Lê e converte o JSON guardado numa chave. Retorna null se a chave não existe. */
export async function readStorageJson<T>(key: string): Promise<T | null> {
  const row = await readStorageRow(key);
  if (!row || !row.value) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    throw new ApiError("O dado salvo está corrompido.", 0, key);
  }
}

/**
 * Grava um valor numa chave de app_storage.
 *  1) se veio `expectedUpdatedAt`, tenta gravar só se ninguém mexeu desde então;
 *  2) senão (ou se falhou) altera pela chave;
 *  3) se a chave ainda não existe, cria.
 * Antes, o passo 2 podia "dar certo" sem gravar nada quando a chave não existia.
 */
async function writeStorage(
  key: string,
  payload: unknown,
  expectedUpdatedAt: string | undefined,
  failMessage: string
): Promise<WriteResult> {
  const now = new Date().toISOString();
  const body = { value: JSON.stringify(payload), updated_at: now };

  async function patch(extraFilter = ""): Promise<RawRow[]> {
    const res = await rest(`${STORAGE}?${keyEq(key)}${extraFilter}&select=${STORAGE_COLS}`, {
      method: "PATCH",
      body,
      prefer: "return=representation",
    });
    if (!res.ok) throw await failure(res, failMessage);
    return rows<RawRow>(res);
  }

  if (expectedUpdatedAt) {
    const guarded = await patch(`&updated_at=eq.${encodeURIComponent(expectedUpdatedAt)}`);
    if (guarded.length > 0) {
      return { updatedAt: guarded[0].updated_at ?? now, conflict: false };
    }
    if (conflictMode === "strict") {
      const current = await readStorageRow(key);
      if (current) throw new ConflictError();
    }
  }

  const direct = await patch();
  if (direct.length > 0) {
    const conflict = Boolean(expectedUpdatedAt);
    if (conflict) {
      console.warn(`[supabaseApi] "${key}" tinha sido alterado por outra pessoa; a versão atual foi gravada por cima.`);
    }
    return { updatedAt: direct[0].updated_at ?? now, conflict };
  }

  // A chave ainda não existe: cria.
  const res = await rest(`${STORAGE}?on_conflict=key&select=${STORAGE_COLS}`, {
    method: "POST",
    body: { key, ...body },
    prefer: "resolution=merge-duplicates,return=representation",
  });
  if (!res.ok) throw await failure(res, failMessage);
  const created = await rows<RawRow>(res);
  return { updatedAt: created[0]?.updated_at ?? now, conflict: false };
}

async function insertStorage(key: string, payload: unknown, failMessage: string): Promise<void> {
  const res = await rest(`${STORAGE}?select=${STORAGE_COLS}`, {
    method: "POST",
    body: { key, value: JSON.stringify(payload), updated_at: new Date().toISOString() },
    prefer: "return=representation",
  });
  if (!res.ok) throw await failure(res, failMessage);
}

async function deleteStorage(key: string, failMessage: string): Promise<void> {
  const res = await rest(`${STORAGE}?${keyEq(key)}`, { method: "DELETE" });
  if (!res.ok) throw await failure(res, failMessage);
}

// ============================================================================
// CARREGAMENTO
// ============================================================================

export interface LoadRowsOptions {
  /** Só chaves que começam com isto (ex.: "pedido:" ou "record:2026-10-"). */
  prefix?: string;
  /**
   * Traz tudo, exceto lançamentos de produção ("record:") anteriores a esta data
   * (formato AAAA-MM-DD). Serve para não baixar o histórico inteiro a cada abertura.
   */
  excludeRecordsBefore?: string;
}

/**
 * Carrega registros de app_storage com paginação automática (blocos de 1000).
 * Sem opções, o comportamento é idêntico ao anterior (carrega tudo).
 */
export async function loadRows(options: LoadRowsOptions = {}): Promise<StorageRow[]> {
  let filters = "";
  if (options.prefix) {
    filters += `&key=like.${encodeURIComponent(options.prefix)}*`;
  }
  if (options.excludeRecordsBefore) {
    filters += `&or=(key.not.like.record:*,key.gte.record:${options.excludeRecordsBefore})`;
  }

  const all: StorageRow[] = [];
  const pageSize = 1000;

  for (let page = 0; page < 500; page++) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const res = await rest(`${STORAGE}?select=${STORAGE_COLS}&order=key.asc${filters}`, {
      headers: { Range: `${from}-${to}`, "Range-Unit": "items" },
    });

    if (res.status === 416) break; // passou do fim
    if (!res.ok) throw await failure(res, "Não foi possível carregar os dados do painel do Supabase.");

    const batch = await rows<StorageRow>(res);
    all.push(...batch);
    if (batch.length < pageSize) break;
  }

  return all;
}

/** Tudo, exceto lançamentos de produção com mais de `meses` meses. */
export async function loadRowsRecentes(meses = 3): Promise<StorageRow[]> {
  const now = new Date();
  const corte = new Date(now.getFullYear(), now.getMonth() - meses, 1);
  const iso = `${corte.getFullYear()}-${String(corte.getMonth() + 1).padStart(2, "0")}-01`;
  return loadRows({ excludeRecordsBefore: iso });
}

/** Lançamentos de produção de um mês específico (formato "AAAA-MM"). */
export async function loadRecordsDoMes(mes: string): Promise<StorageRow[]> {
  return loadRows({ prefix: `record:${mes}-` });
}

// ============================================================================
// PEDIDOS, PRODUÇÃO E CADASTROS
// ============================================================================

export async function saveOrder(order: Order, updatedAt?: string): Promise<WriteResult> {
  return writeStorage(`pedido:${order.id}`, order, updatedAt, "Não foi possível salvar a programação.");
}

export async function createOrder(input: Omit<Order, "id">): Promise<Order> {
  const id = `PED-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const order: Order = {
    ...input,
    id,
    numeroOp: input.numeroOp?.trim() || "",
    numeroPedido: input.numeroPedido?.trim() || "",
    statusProducao: "AGUARDANDO PROGRAMAÇÃO",
    maquinaId: "",
    prioridade: 0,
  };

  const res = await rest(`${STORAGE}?select=${STORAGE_COLS}`, {
    method: "POST",
    body: { key: `pedido:${id}`, value: JSON.stringify(order), updated_at: new Date().toISOString() },
    prefer: "return=representation",
  });
  if (!res.ok) {
    throw await failure(
      res,
      res.status === 409
        ? "Já existe um pedido com este identificador. Tente novamente."
        : "Não foi possível cadastrar o pedido."
    );
  }
  return order;
}

export async function saveProduction(order: Order, machine: Machine, input: Production): Promise<void> {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const record = {
    id,
    idPedido: order.id,
    maquinaId: machine.id,
    dataPedido: order.data,
    dataProducao: input.dataProducao,
    turno: input.turno,
    operador: input.operador,
    qtdProduzido: input.qtdProduzido,
    aparas: input.aparas || "",
    picote: input.picote || "",
    cliente: order.cliente,
    descricaoItem: order.descricaoItem,
    quantidadePedido: order.quantidade,
    material: order.material || "",
  };

  await insertStorage(`record:${input.dataProducao}:${id}`, record, "Não foi possível registrar a produção.");
}

export async function updateProduction(record: Production): Promise<WriteResult> {
  if (!record._key) throw new Error("Não foi possível identificar este apontamento.");
  const { _key, _updatedAt, ...stored } = record;
  return writeStorage(_key, stored, _updatedAt, "Não foi possível atualizar o apontamento.");
}

export async function saveRegistry(kind: RegistryKind, values: string[], updatedAt?: string): Promise<WriteResult> {
  return writeStorage(`config:${kind}`, values, updatedAt, "Não foi possível salvar o cadastro.");
}

// ============================================================================
// GESTÃO DE INSUMOS (MATÉRIAS-PRIMAS E SUPRIMENTOS)
// ============================================================================

/**
 * Antes, se a tabela falhasse ou estivesse vazia, o sistema mostrava uma lista
 * de exemplo (com estoques inventados). Agora devolve lista vazia e avisa o erro.
 */
export async function loadInsumos(): Promise<Insumo[]> {
  try {
    const res = await rest("insumos?select=*&order=categoria.asc,nome.asc");
    if (!res.ok) throw await failure(res, "Não foi possível carregar os insumos.");
    return await rows<Insumo>(res);
  } catch (err) {
    reportApiError("loadInsumos", err);
    return [];
  }
}

export async function saveInsumo(insumo: Partial<Insumo>): Promise<Insumo> {
  const isNew = !insumo.id;
  const path = isNew
    ? "insumos?select=*"
    : `insumos?id=eq.${encodeURIComponent(insumo.id!)}&select=*`;

  const res = await rest(path, {
    method: isNew ? "POST" : "PATCH",
    body: { ...insumo, updated_at: new Date().toISOString() },
    prefer: "return=representation",
  });
  if (!res.ok) throw await failure(res, "Não foi possível salvar o insumo no banco de dados.");

  const result = await rows<Insumo>(res);
  if (!result[0]) throw new ApiError("O insumo não foi encontrado para atualização.", 404);
  return result[0];
}

export async function deleteInsumo(id: string): Promise<void> {
  const res = await rest(`insumos?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw await failure(res, "Não foi possível excluir o insumo.");
}

// ============================================================================
// CUSTOS POR SETOR
// ============================================================================
// ATENÇÃO: estes valores são apenas um PADRÃO do código. Se a tabela
// custos_setor_config estiver vazia ou der erro, o sistema usa estes números.
// Use getDataSourceFlags().custosSetorPadrao para avisar isso na tela.

export const DEFAULT_CUSTOS_SETORES: CustoSetorConfig[] = [
  { setor: "EXTRUSÃO", custo_hora_maquina: 120.0, custo_hora_homem: 35.0, perda_padrao_tolerada_pct: 3.5 },
  { setor: "IMPRESSÃO", custo_hora_maquina: 150.0, custo_hora_homem: 40.0, perda_padrao_tolerada_pct: 4.0 },
  { setor: "LAMINAÇÃO", custo_hora_maquina: 110.0, custo_hora_homem: 35.0, perda_padrao_tolerada_pct: 2.5 },
  { setor: "REBOBINADEIRA", custo_hora_maquina: 70.0, custo_hora_homem: 30.0, perda_padrao_tolerada_pct: 1.5 },
  { setor: "CORTE", custo_hora_maquina: 65.0, custo_hora_homem: 30.0, perda_padrao_tolerada_pct: 2.0 },
];

export async function loadCustosSetor(): Promise<CustoSetorConfig[]> {
  try {
    const res = await rest("custos_setor_config?select=*&order=setor.asc");
    if (!res.ok) throw await failure(res, "Não foi possível carregar os custos por setor.");
    const data = await rows<CustoSetorConfig>(res);
    if (data.length === 0) {
      dataSourceFlags.custosSetorPadrao = true;
      return DEFAULT_CUSTOS_SETORES;
    }
    dataSourceFlags.custosSetorPadrao = false;
    return data;
  } catch (err) {
    reportApiError("loadCustosSetor", err);
    dataSourceFlags.custosSetorPadrao = true;
    return DEFAULT_CUSTOS_SETORES;
  }
}

export async function saveCustoSetor(item: CustoSetorConfig): Promise<void> {
  const res = await rest("custos_setor_config?select=*", {
    method: "POST",
    body: {
      setor: item.setor,
      custo_hora_maquina: Number(item.custo_hora_maquina) || 0,
      custo_hora_homem: Number(item.custo_hora_homem) || 0,
      perda_padrao_tolerada_pct: Number(item.perda_padrao_tolerada_pct) || 0,
      updated_at: new Date().toISOString(),
    },
    prefer: "resolution=merge-duplicates,return=representation",
  });
  if (!res.ok) throw await failure(res, "Não foi possível atualizar o custo do setor.");
}

// ============================================================================
// FICHAS TÉCNICAS E ESTRUTURA DE PRODUTOS
// ============================================================================

export const DEFAULT_FICHAS_TECNICAS: FichaTecnica[] = [
  {
    id: "ft-saco-liso",
    categoriaProduto: "SACO_LISO",
    nomePadrao: "Saco PEBD Liso Standard",
    setoresProcesso: ["EXTRUSÃO", "CORTE"],
    composicao: [
      { insumo_nome: "Resina PEBD", proporcao_percentual: 97, custo_estimado_kg: 7.85 },
      { insumo_nome: "Masterbatch Branco", proporcao_percentual: 3, custo_estimado_kg: 14.5 },
    ],
    perdaEstimadaPct: 3.0,
    velocidadeMediaKgHora: 45,
    observacoes: "Processo direto de extrusão tubular seguido de corte mecânico/eletrônico.",
  },
  {
    id: "ft-saco-impresso",
    categoriaProduto: "SACO_IMPRESSO",
    nomePadrao: "Saco PEBD Impresso Flexo",
    setoresProcesso: ["EXTRUSÃO", "IMPRESSÃO", "CORTE"],
    composicao: [
      { insumo_nome: "Resina PEBD", proporcao_percentual: 95, custo_estimado_kg: 7.85 },
      { insumo_nome: "Masterbatch Branco", proporcao_percentual: 3, custo_estimado_kg: 14.5 },
      { insumo_nome: "Tintas & Solventes", proporcao_percentual: 2, custo_estimado_kg: 24.0 },
    ],
    perdaEstimadaPct: 5.5,
    velocidadeMediaKgHora: 38,
    observacoes: "Requer passagem por impressora flexográfica central/tambor e secagem controlada.",
  },
  {
    id: "ft-saco-laminado",
    categoriaProduto: "SACO_LAMINADO",
    nomePadrao: "Saco Laminado Barreira",
    setoresProcesso: ["EXTRUSÃO", "IMPRESSÃO", "LAMINAÇÃO", "CORTE"],
    composicao: [
      { insumo_nome: "Filme Extrusado PE", proporcao_percentual: 52, custo_estimado_kg: 7.95 },
      { insumo_nome: "Filme BOPP/Poliéster", proporcao_percentual: 42, custo_estimado_kg: 16.5 },
      { insumo_nome: "Adesivo Laminação", proporcao_percentual: 4, custo_estimado_kg: 22.0 },
      { insumo_nome: "Tintas Flexo", proporcao_percentual: 2, custo_estimado_kg: 28.5 },
    ],
    perdaEstimadaPct: 7.5,
    velocidadeMediaKgHora: 32,
    observacoes: "Estrutura duplex com cura de adesivo e controle rígido de tensão no corte.",
  },
  {
    id: "ft-filme-liso",
    categoriaProduto: "FILME_LISO",
    nomePadrao: "Bobina Técnica Filme Liso",
    setoresProcesso: ["EXTRUSÃO", "REBOBINADEIRA"],
    composicao: [
      { insumo_nome: "Resina PEBD / PELBD", proporcao_percentual: 98, custo_estimado_kg: 8.0 },
      { insumo_nome: "Aditivos Deslizantes", proporcao_percentual: 2, custo_estimado_kg: 18.0 },
    ],
    perdaEstimadaPct: 2.2,
    velocidadeMediaKgHora: 60,
    observacoes: "Alta produtividade com enrolamento e refilamento em rebobinadeira de precisão.",
  },
  {
    id: "ft-filme-impresso",
    categoriaProduto: "FILME_IMPRESSO",
    nomePadrao: "Bobina Filme Impresso para Envasadora Automática",
    setoresProcesso: ["EXTRUSÃO", "IMPRESSÃO", "REBOBINADEIRA"],
    composicao: [
      { insumo_nome: "Resina PEBD", proporcao_percentual: 97, custo_estimado_kg: 7.85 },
      { insumo_nome: "Tintas Flexo", proporcao_percentual: 3, custo_estimado_kg: 28.5 },
    ],
    perdaEstimadaPct: 4.2,
    velocidadeMediaKgHora: 50,
    observacoes: "Bobinas com fotocélula rigorosamente alinhada e coeficiente de atrito controlado.",
  },
];

const FICHAS_KEY = "config:fichas_tecnicas";

export async function loadFichasTecnicas(): Promise<FichaTecnica[]> {
  try {
    const saved = await readStorageJson<FichaTecnica[]>(FICHAS_KEY);
    if (saved && saved.length > 0) {
      dataSourceFlags.fichasTecnicasPadrao = false;
      return saved;
    }
    dataSourceFlags.fichasTecnicasPadrao = true;
    return DEFAULT_FICHAS_TECNICAS;
  } catch (err) {
    reportApiError("loadFichasTecnicas", err);
    dataSourceFlags.fichasTecnicasPadrao = true;
    return DEFAULT_FICHAS_TECNICAS;
  }
}

export async function saveFichasTecnicas(fichas: FichaTecnica[]): Promise<void> {
  await writeStorage(FICHAS_KEY, fichas, undefined, "Não foi possível salvar as fichas técnicas.");
  dataSourceFlags.fichasTecnicasPadrao = false;
}

// ============================================================================
// OPs ATIVAS (tabela pedidos_op)
// ============================================================================

export interface OpAtiva {
  id: string;
  cliente: string;
  descricao_item: string;
  quantidade_planejada_kg: number;
  material: string;
  status_producao?: string;
}

export async function loadActiveOps(limit = 300): Promise<OpAtiva[]> {
  try {
    const res = await rest(
      `pedidos_op?select=id,cliente,descricao_item,quantidade_planejada_kg,material,status_producao&order=id.desc&limit=${limit}`
    );
    if (!res.ok) throw await failure(res, "Não foi possível carregar as OPs ativas.");
    return await rows<OpAtiva>(res);
  } catch (err) {
    reportApiError("loadActiveOps", err);
    return [];
  }
}

// ============================================================================
// BOBINAS SEMIACABADAS (WIP)
// ============================================================================

export async function loadBobinasWIP(filters?: {
  op_id?: string;
  status?: string;
  setor?: string;
}): Promise<BobinaSemiAcabada[]> {
  try {
    let path = "estoque_semiacabados?select=*&order=created_at.desc";
    if (filters?.op_id) path += `&op_id=eq.${encodeURIComponent(filters.op_id)}`;
    if (filters?.status && filters.status !== "TODOS") path += `&status=eq.${encodeURIComponent(filters.status)}`;
    if (filters?.setor && filters.setor !== "TODOS") path += `&setor_origem=eq.${encodeURIComponent(filters.setor)}`;

    const res = await rest(path);
    if (!res.ok) throw await failure(res, "Não foi possível carregar as bobinas em processo.");
    return await rows<BobinaSemiAcabada>(res);
  } catch (err) {
    reportApiError("loadBobinasWIP", err);
    return [];
  }
}

export async function saveBobinaWIP(bobina: Partial<BobinaSemiAcabada>): Promise<BobinaSemiAcabada> {
  const isNew = !bobina.id;
  const path = isNew
    ? "estoque_semiacabados?select=*"
    : `estoque_semiacabados?id=eq.${encodeURIComponent(bobina.id!)}&select=*`;

  const res = await rest(path, {
    method: isNew ? "POST" : "PATCH",
    body: { ...bobina, updated_at: new Date().toISOString() },
    prefer: "return=representation",
  });
  if (!res.ok) throw await failure(res, "Não foi possível salvar a bobina WIP.");

  const result = await rows<BobinaSemiAcabada>(res);
  if (!result[0]) throw new ApiError("A bobina não foi encontrada para atualização.", 404);
  return result[0];
}

export async function updateStatusBobinaWIP(
  id: string,
  status: StatusBobina,
  setor_destino?: string | null
): Promise<void> {
  const body: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (setor_destino !== undefined) body.setor_destino = setor_destino;

  const res = await rest(`estoque_semiacabados?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body,
  });
  if (!res.ok) throw await failure(res, "Não foi possível atualizar o status da bobina.");
}

export async function deleteBobinaWIP(id: string): Promise<void> {
  const res = await rest(`estoque_semiacabados?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw await failure(res, "Não foi possível excluir a bobina WIP.");
}

// ============================================================================
// MOVIMENTAÇÕES DE ESTOQUE (RASTREABILIDADE AUDITÁVEL)
// ============================================================================

export async function loadMovimentacoesEstoque(limit: number = 100): Promise<MovimentacaoEstoque[]> {
  try {
    const res = await rest(`estoque_movimentacoes?select=*&order=created_at.desc&limit=${limit}`);
    if (!res.ok) throw await failure(res, "Não foi possível carregar as movimentações de estoque.");
    return await rows<MovimentacaoEstoque>(res);
  } catch (err) {
    reportApiError("loadMovimentacoesEstoque", err);
    return [];
  }
}

export async function saveMovimentacaoEstoque(mov: Partial<MovimentacaoEstoque>): Promise<MovimentacaoEstoque> {
  const res = await rest("estoque_movimentacoes?select=*", {
    method: "POST",
    body: {
      tipo_movimento: mov.tipo_movimento,
      tipo_item: mov.tipo_item || "INSUMO",
      item_id: mov.item_id || null,
      op_id: mov.op_id || null,
      setor: mov.setor || null,
      quantidade: Number(mov.quantidade) || 0,
      custo_unitario: Number(mov.custo_unitario) || 0,
      documento_referencia: mov.documento_referencia || null,
      observacao: mov.observacao || null,
    },
    prefer: "return=representation",
  });
  if (!res.ok) throw await failure(res, "Erro ao salvar movimentação de estoque.");

  const result = await rows<MovimentacaoEstoque>(res);
  if (!result[0]) throw new ApiError("A movimentação não foi confirmada pelo banco.", 500);
  return result[0];
}

// ============================================================================
// PALETES & ROMANEIO DE PRODUTO ACABADO
// ============================================================================

export async function savePalete(palete: PaleteRomaneio, updatedAt?: string): Promise<WriteResult> {
  const payload = { ...palete, updated_at: new Date().toISOString() };
  return writeStorage(`palete:${palete.id}`, payload, updatedAt, "Não foi possível salvar o palete no banco de dados.");
}

export async function deletePalete(paleteId: string): Promise<void> {
  await deleteStorage(`palete:${paleteId}`, "Não foi possível excluir o palete.");
}
