// ============= SUPABASE: PREENCHA COM OS DADOS DO SEU PROJETO =============
const SUPABASE_URL = 'https://gbgmvqbxozzcloynwdbo.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_5W3m26faz-Jhr8j42B5_Lg_t4EV6rSy';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

// Camada de compatibilidade com o storage usado originalmente no Claude.
// Assim, toda a interface e as funções existentes continuam iguais.
window.storage = {
  async get(key) {
    const { data, error } = await supabaseClient
      .from('app_storage')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    return data ? { value: data.value } : null;
  },

  async set(key, value) {
    const { error } = await supabaseClient
      .from('app_storage')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
    return { key, value };
  },

  async delete(key) {
    const { error } = await supabaseClient
      .from('app_storage')
      .delete()
      .eq('key', key);
    if (error) throw error;
    return true;
  },

  async list(prefix = '') {
    let query = supabaseClient
      .from('app_storage')
      .select('key')
      .order('key', { ascending: true });
    if (prefix) query = query.like('key', `${prefix}%`);
    const { data, error } = await query;
    if (error) throw error;
    return { keys: (data || []).map(item => item.key) };
  }
};
