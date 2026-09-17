import { StorageRow, Order, Production, Machine, RegistryKind } from "../types/forpack";

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
