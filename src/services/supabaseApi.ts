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

export const SUPABASE_URL = "https://gbgmvqbxozzcloynwdbo.supabase.co";
export const SUPABASE_KEY = "sb_publishable_5W3m26faz-Jhr8j42B5_Lg_t4EV6rSy";

/**
 * Carrega todos os registros de app_storage com paginação automática (chunks de 1000)
 * para nunca cortar dados acumulados (como ocorria no limite padrão de 1000).
 */
export async function loadRows(): Promise<StorageRow[]> {
  const allRows: StorageRow[] = [];
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const to = from + pageSize - 1;
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/app_storage?select=key,value,updated_at&order=key.asc`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Range: `${from}-${to}`,
          "Range-Unit": "items",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      // Se houver erro de Range não satisfatível (416), significa que chegamos ao fim
      if (response.status === 416) {
        break;
      }
      throw new Error("Não foi possível carregar os dados do painel do Supabase.");
    }

    const batch = (await response.json()) as StorageRow[];
    allRows.push(...batch);

    if (batch.length < pageSize) {
      hasMore = false;
    } else {
      from += pageSize;
    }
  }

  return allRows;
}

export async function saveOrder(order: Order, updatedAt?: string): Promise<void> {
  const key = `pedido:${order.id}`;
  if (updatedAt) {
    const endpoint = `${SUPABASE_URL}/rest/v1/app_storage?key=eq.${encodeURIComponent(key)}&updated_at=eq.${encodeURIComponent(updatedAt)}&select=key,value,updated_at`;
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ value: JSON.stringify(order), updated_at: new Date().toISOString() }),
    });
    if (response.ok) {
      const changed = (await response.json()) as StorageRow[];
      if (changed.length > 0) return;
    }
  }

  // Fallback direct patch by key to guarantee update even if updated_at timestamp drifted
  const fallbackEndpoint = `${SUPABASE_URL}/rest/v1/app_storage?key=eq.${encodeURIComponent(key)}&select=key,value,updated_at`;
  const fallbackResponse = await fetch(fallbackEndpoint, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ value: JSON.stringify(order), updated_at: new Date().toISOString() }),
  });
  if (!fallbackResponse.ok) throw new Error("Não foi possível salvar a programação.");
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
  const response = await fetch(`${SUPABASE_URL}/rest/v1/app_storage?select=key,value,updated_at`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ key: `pedido:${id}`, value: JSON.stringify(order), updated_at: new Date().toISOString() }),
  });
  if (!response.ok) {
    throw new Error(
      response.status === 409
        ? "Já existe um pedido com este identificador. Tente novamente."
        : "Não foi possível cadastrar o pedido."
    );
  }
  return order;
}

export async function saveProduction(order: Order, machine: Machine, input: Production): Promise<void> {
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
  const key = `record:${input.dataProducao}:${id}`;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/app_storage?select=key,value,updated_at`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ key, value: JSON.stringify(record), updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error("Não foi possível registrar a produção.");
}

export async function updateProduction(record: Production): Promise<void> {
  if (!record._key) throw new Error("Não foi possível identificar este apontamento.");
  const { _key, _updatedAt, ...stored } = record;
  if (_updatedAt) {
    const endpoint = `${SUPABASE_URL}/rest/v1/app_storage?key=eq.${encodeURIComponent(_key)}&updated_at=eq.${encodeURIComponent(_updatedAt)}&select=key,value,updated_at`;
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ value: JSON.stringify(stored), updated_at: new Date().toISOString() }),
    });
    if (response.ok) {
      const changed = (await response.json()) as StorageRow[];
      if (changed.length > 0) return;
    }
  }

  // Fallback by key
  const fallbackEndpoint = `${SUPABASE_URL}/rest/v1/app_storage?key=eq.${encodeURIComponent(_key)}&select=key,value,updated_at`;
  const fallbackResponse = await fetch(fallbackEndpoint, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ value: JSON.stringify(stored), updated_at: new Date().toISOString() }),
  });
  if (!fallbackResponse.ok) throw new Error("Não foi possível atualizar o apontamento.");
}

export async function saveRegistry(kind: RegistryKind, values: string[], updatedAt?: string): Promise<void> {
  const key = `config:${kind}`;
  if (updatedAt) {
    const endpoint = `${SUPABASE_URL}/rest/v1/app_storage?key=eq.${encodeURIComponent(key)}&updated_at=eq.${encodeURIComponent(updatedAt)}&select=key,value,updated_at`;
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ value: JSON.stringify(values), updated_at: new Date().toISOString() }),
    });
    if (response.ok) {
      const changed = (await response.json()) as StorageRow[];
      if (changed.length > 0) return;
    }
  }

  // Fallback PATCH by key
  const fallbackEndpoint = `${SUPABASE_URL}/rest/v1/app_storage?key=eq.${encodeURIComponent(key)}&select=key,value,updated_at`;
  const fallbackResponse = await fetch(fallbackEndpoint, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ value: JSON.stringify(values), updated_at: new Date().toISOString() }),
  });
  if (fallbackResponse.ok) {
    const changed = (await fallbackResponse.json()) as StorageRow[];
    if (changed.length > 0) return;
  }

  // If key does not exist yet, insert with upsert
  const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/app_storage?select=key,value,updated_at`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({ key, value: JSON.stringify(values), updated_at: new Date().toISOString() }),
  });
  if (!insertResponse.ok) throw new Error("Não foi possível salvar o cadastro.");
}

// ============================================================================
// ETAPA 2: GESTÃO DE INSUMOS (MATÉRIAS-PRIMAS E SUPRIMENTOS)
// ============================================================================

export async function loadInsumos(): Promise<Insumo[]> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/insumos?select=*&order=categoria.asc,nome.asc`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      // Fallback para storage caso tabela não esteja acessível
      return loadInsumosFromStorage();
    }

    const data = (await response.json()) as Insumo[];
    if (data.length === 0) {
      return loadInsumosFromStorage();
    }
    return data;
  } catch (err) {
    console.warn("Erro ao buscar insumos no banco, usando fallback local:", err);
    return loadInsumosFromStorage();
  }
}

export async function saveInsumo(insumo: Partial<Insumo>): Promise<Insumo> {
  const isNew = !insumo.id;
  const url = isNew
    ? `${SUPABASE_URL}/rest/v1/insumos?select=*`
    : `${SUPABASE_URL}/rest/v1/insumos?id=eq.${encodeURIComponent(insumo.id!)}&select=*`;

  const method = isNew ? "POST" : "PATCH";
  const body = {
    ...insumo,
    updated_at: new Date().toISOString(),
  };

  const response = await fetch(url, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error("Não foi possível salvar o insumo no banco de dados.");
  }

  const result = (await response.json()) as Insumo[];
  return result[0];
}

export async function deleteInsumo(id: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/insumos?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error("Não foi possível excluir o insumo.");
  }
}

// ============================================================================
// ETAPA 2: CONFIGURAÇÃO DE CUSTOS POR SETOR (FORPACK)
// ============================================================================

export const DEFAULT_CUSTOS_SETORES: CustoSetorConfig[] = [
  { setor: "EXTRUSÃO", custo_hora_maquina: 120.0, custo_hora_homem: 35.0, perda_padrao_tolerada_pct: 3.5 },
  { setor: "IMPRESSÃO", custo_hora_maquina: 150.0, custo_hora_homem: 40.0, perda_padrao_tolerada_pct: 4.0 },
  { setor: "LAMINAÇÃO", custo_hora_maquina: 110.0, custo_hora_homem: 35.0, perda_padrao_tolerada_pct: 2.5 },
  { setor: "REBOBINADEIRA", custo_hora_maquina: 70.0, custo_hora_homem: 30.0, perda_padrao_tolerada_pct: 1.5 },
  { setor: "CORTE", custo_hora_maquina: 65.0, custo_hora_homem: 30.0, perda_padrao_tolerada_pct: 2.0 },
];

export async function loadCustosSetor(): Promise<CustoSetorConfig[]> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/custos_setor_config?select=*&order=setor.asc`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return DEFAULT_CUSTOS_SETORES;
    }

    const data = (await response.json()) as CustoSetorConfig[];
    if (data.length === 0) {
      return DEFAULT_CUSTOS_SETORES;
    }
    return data;
  } catch (err) {
    console.warn("Erro ao buscar custos de setor, usando padrão:", err);
    return DEFAULT_CUSTOS_SETORES;
  }
}

export async function saveCustoSetor(item: CustoSetorConfig): Promise<void> {
  const url = `${SUPABASE_URL}/rest/v1/custos_setor_config?select=*`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      setor: item.setor,
      custo_hora_maquina: Number(item.custo_hora_maquina) || 0,
      custo_hora_homem: Number(item.custo_hora_homem) || 0,
      perda_padrao_tolerada_pct: Number(item.perda_padrao_tolerada_pct) || 0,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error("Não foi possível atualizar o custo do setor.");
  }
}

// ============================================================================
// ETAPA 2: FICHAS TÉCNICAS E ESTRUTURA DE PRODUTOS
// ============================================================================

export const DEFAULT_FICHAS_TECNICAS: FichaTecnica[] = [
  {
    id: "ft-saco-liso",
    categoriaProduto: "SACO_LISO",
    nomePadrao: "Saco PEBD Liso Standard",
    setoresProcesso: ["EXTRUSÃO", "CORTE"],
    composicao: [
      { insumo_nome: "Resina PEBD", proporcao_percentual: 97, custo_estimado_kg: 7.85 },
      { insumo_nome: "Masterbatch Branco", proporcao_percentual: 3, custo_estimado_kg: 14.50 },
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
      { insumo_nome: "Masterbatch Branco", proporcao_percentual: 3, custo_estimado_kg: 14.50 },
      { insumo_nome: "Tintas & Solventes", proporcao_percentual: 2, custo_estimado_kg: 24.00 },
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
      { insumo_nome: "Filme BOPP/Poliéster", proporcao_percentual: 42, custo_estimado_kg: 16.50 },
      { insumo_nome: "Adesivo Laminação", proporcao_percentual: 4, custo_estimado_kg: 22.00 },
      { insumo_nome: "Tintas Flexo", proporcao_percentual: 2, custo_estimado_kg: 28.50 },
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
      { insumo_nome: "Resina PEBD / PELBD", proporcao_percentual: 98, custo_estimado_kg: 8.00 },
      { insumo_nome: "Aditivos Deslizantes", proporcao_percentual: 2, custo_estimado_kg: 18.00 },
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
      { insumo_nome: "Tintas Flexo", proporcao_percentual: 3, custo_estimado_kg: 28.50 },
    ],
    perdaEstimadaPct: 4.2,
    velocidadeMediaKgHora: 50,
    observacoes: "Bobinas com fotocélula rigorosamente alinhada e coeficiente de atrito controlado.",
  },
];

export async function loadFichasTecnicas(): Promise<FichaTecnica[]> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/app_storage?key=eq.config:fichas_tecnicas&select=value`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        cache: "no-store",
      }
    );

    if (response.ok) {
      const rows = await response.json();
      if (rows && rows.length > 0 && rows[0].value) {
        return JSON.parse(rows[0].value) as FichaTecnica[];
      }
    }
    return DEFAULT_FICHAS_TECNICAS;
  } catch {
    return DEFAULT_FICHAS_TECNICAS;
  }
}

export async function saveFichasTecnicas(fichas: FichaTecnica[]): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/app_storage?select=key,value,updated_at`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      key: "config:fichas_tecnicas",
      value: JSON.stringify(fichas),
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error("Não foi possível salvar as fichas técnicas.");
  }
}

function loadInsumosFromStorage(): Insumo[] {
  return [
    {
      id: "mp-1",
      codigo: "MP-PEBD-01",
      nome: "Resina Polietileno Baixa Densidade (PEBD)",
      categoria: "RESINA",
      unidade_medida: "KG",
      estoque_atual: 12500,
      estoque_minimo: 3000,
      custo_unitario_medio: 7.85,
      ativo: true,
    },
    {
      id: "mp-2",
      codigo: "MP-PEAD-01",
      nome: "Resina Polietileno Alta Densidade (PEAD)",
      categoria: "RESINA",
      unidade_medida: "KG",
      estoque_atual: 8400,
      estoque_minimo: 2500,
      custo_unitario_medio: 7.95,
      ativo: true,
    },
    {
      id: "mp-3",
      codigo: "MP-PELBD-01",
      nome: "Resina Polietileno Linear (PELBD)",
      categoria: "RESINA",
      unidade_medida: "KG",
      estoque_atual: 6200,
      estoque_minimo: 2000,
      custo_unitario_medio: 8.1,
      ativo: true,
    },
    {
      id: "mb-1",
      codigo: "MB-BRANCO-01",
      nome: "Masterbatch Branco Especial",
      categoria: "MASTERBATCH",
      unidade_medida: "KG",
      estoque_atual: 650,
      estoque_minimo: 150,
      custo_unitario_medio: 14.5,
      ativo: true,
    },
    {
      id: "mb-2",
      codigo: "MB-PRETO-01",
      nome: "Masterbatch Preto Alta Cobertura",
      categoria: "MASTERBATCH",
      unidade_medida: "KG",
      estoque_atual: 420,
      estoque_minimo: 100,
      custo_unitario_medio: 12.8,
      ativo: true,
    },
    {
      id: "ti-1",
      codigo: "TI-AZUL-01",
      nome: "Tinta Flexográfica Azul Cyan",
      categoria: "TINTA",
      unidade_medida: "KG",
      estoque_atual: 180,
      estoque_minimo: 50,
      custo_unitario_medio: 28.5,
      ativo: true,
    },
    {
      id: "so-1",
      codigo: "SO-ETANOL-01",
      nome: "Solvente Etanol Anidro P.A.",
      categoria: "SOLVENTE",
      unidade_medida: "L",
      estoque_atual: 800,
      estoque_minimo: 200,
      custo_unitario_medio: 6.2,
      ativo: true,
    },
    {
      id: "ad-1",
      codigo: "AD-POLI-01",
      nome: "Adesivo Laminação Base Solvente",
      categoria: "ADESIVO",
      unidade_medida: "KG",
      estoque_atual: 350,
      estoque_minimo: 100,
      custo_unitario_medio: 22.0,
      ativo: true,
    },
  ];
}

export async function loadActiveOps(): Promise<
  {
    id: string;
    cliente: string;
    descricao_item: string;
    quantidade_planejada_kg: number;
    material: string;
    status_producao?: string;
  }[]
> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/pedidos_op?select=id,cliente,descricao_item,quantidade_planejada_kg,material,status_producao&order=id.desc&limit=300`,
      {
        headers: { apikey: SUPABASE_KEY },
      }
    );
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error("Erro em loadActiveOps:", e);
    return [];
  }
}


export async function loadBobinasWIP(filters?: {
  op_id?: string;
  status?: string;
  setor?: string;
}): Promise<BobinaSemiAcabada[]> {
  try {
    let url = `${SUPABASE_URL}/rest/v1/estoque_semiacabados?select=*&order=created_at.desc`;
    if (filters?.op_id) {
      url += `&op_id=eq.${encodeURIComponent(filters.op_id)}`;
    }
    if (filters?.status && filters.status !== "TODOS") {
      url += `&status=eq.${encodeURIComponent(filters.status)}`;
    }
    if (filters?.setor && filters.setor !== "TODOS") {
      url += `&setor_origem=eq.${encodeURIComponent(filters.setor)}`;
    }

    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("Falha ao buscar bobinas WIP no banco:", await response.text());
      return [];
    }

    const data = (await response.json()) as BobinaSemiAcabada[];
    return data;
  } catch (err) {
    console.error("Erro em loadBobinasWIP:", err);
    return [];
  }
}

export async function saveBobinaWIP(
  bobina: Partial<BobinaSemiAcabada>
): Promise<BobinaSemiAcabada> {
  const isNew = !bobina.id;
  const url = isNew
    ? `${SUPABASE_URL}/rest/v1/estoque_semiacabados?select=*`
    : `${SUPABASE_URL}/rest/v1/estoque_semiacabados?id=eq.${encodeURIComponent(bobina.id!)}&select=*`;

  const method = isNew ? "POST" : "PATCH";
  const body = {
    ...bobina,
    updated_at: new Date().toISOString(),
  };

  const response = await fetch(url, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Não foi possível salvar a bobina WIP: ${errText}`);
  }

  const result = (await response.json()) as BobinaSemiAcabada[];
  return result[0];
}

export async function updateStatusBobinaWIP(
  id: string,
  status: StatusBobina,
  setor_destino?: string | null
): Promise<void> {
  const body: any = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (setor_destino !== undefined) {
    body.setor_destino = setor_destino;
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/estoque_semiacabados?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    throw new Error("Não foi possível atualizar o status da bobina.");
  }
}

export async function deleteBobinaWIP(id: string): Promise<void> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/estoque_semiacabados?id=eq.${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Não foi possível excluir a bobina WIP.");
  }
}

// ============================================================================
// ETAPA 3: MOVIMENTAÇÕES DE ESTOQUE (RASTREABILIDADE AUDITÁVEL)
// ============================================================================

export async function loadMovimentacoesEstoque(
  limit: number = 100
): Promise<MovimentacaoEstoque[]> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/estoque_movimentacoes?select=*&order=created_at.desc&limit=${limit}`;
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as MovimentacaoEstoque[];
    return data;
  } catch (err) {
    console.error("Erro em loadMovimentacoesEstoque:", err);
    return [];
  }
}

export async function saveMovimentacaoEstoque(
  mov: Partial<MovimentacaoEstoque>
): Promise<MovimentacaoEstoque> {
  const url = `${SUPABASE_URL}/rest/v1/estoque_movimentacoes?select=*`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      tipo_movimento: mov.tipo_movimento,
      tipo_item: mov.tipo_item || "INSUMO",
      item_id: mov.item_id || null,
      op_id: mov.op_id || null,
      setor: mov.setor || null,
      quantidade: Number(mov.quantidade) || 0,
      custo_unitario: Number(mov.custo_unitario) || 0,
      documento_referencia: mov.documento_referencia || null,
      observacao: mov.observacao || null,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erro ao salvar movimentação de estoque: ${errText}`);
  }

  const result = (await response.json()) as MovimentacaoEstoque[];
  return result[0];
}

// ============================================================================
// ETAPA: PALETES & ROMANEIO DE PRODUTO ACABADO (REBOBINADEIRA / ACABAMENTO)
// ============================================================================

export async function savePalete(palete: PaleteRomaneio, updatedAt?: string): Promise<void> {
  const key = `palete:${palete.id}`;
  const now = new Date().toISOString();
  const payload = {
    ...palete,
    updated_at: now,
  };

  if (updatedAt) {
    const endpoint = `${SUPABASE_URL}/rest/v1/app_storage?key=eq.${encodeURIComponent(key)}&updated_at=eq.${encodeURIComponent(updatedAt)}&select=key,value,updated_at`;
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ value: JSON.stringify(payload), updated_at: now }),
    });
    if (response.ok) {
      const changed = (await response.json()) as StorageRow[];
      if (changed.length > 0) return;
    }
  }

  // Fallback direct patch by key
  const fallbackEndpoint = `${SUPABASE_URL}/rest/v1/app_storage?key=eq.${encodeURIComponent(key)}&select=key,value,updated_at`;
  const fallbackResponse = await fetch(fallbackEndpoint, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ value: JSON.stringify(payload), updated_at: now }),
  });
  if (fallbackResponse.ok) {
    const changed = (await fallbackResponse.json()) as StorageRow[];
    if (changed.length > 0) return;
  }

  // Insert if not exists
  const insertEndpoint = `${SUPABASE_URL}/rest/v1/app_storage?select=key,value,updated_at`;
  const insertResponse = await fetch(insertEndpoint, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({ key, value: JSON.stringify(payload), updated_at: now }),
  });

  if (!insertResponse.ok) {
    throw new Error("Não foi possível salvar o palete no banco de dados.");
  }
}

export async function deletePalete(paleteId: string): Promise<void> {
  const key = `palete:${paleteId}`;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/app_storage?key=eq.${encodeURIComponent(key)}`, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!response.ok) {
    throw new Error("Não foi possível excluir o palete.");
  }
}
