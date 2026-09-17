import { AuditItem, PresetTemplate } from '../types';

export const AUDIT_CHECKLIST: AuditItem[] = [
  {
    id: 'sec-rls',
    category: 'security',
    title: 'Row Level Security (RLS) Desativado ou Aberto',
    severity: 'high',
    symptom: 'Qualquer usuário consegue ler, editar ou apagar dados de outros usuários inspecionando requisições REST da anon key.',
    cause: 'Tabelas criadas no Supabase têm RLS desabilitado por padrão ou possuem políticas com "USING (true)" sem checagem de auth.uid().',
    solution: 'Ative o RLS com "ALTER TABLE <tabela> ENABLE ROW LEVEL SECURITY;" e defina políticas restritivas por usuário.',
    codeSnippet: `-- Ativar RLS na tabela
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

-- Política de leitura: usuário só lê seu próprio perfil
CREATE POLICY "Usuários podem ver seu próprio perfil"
ON public.perfis FOR SELECT
TO authenticated
USING (auth.uid() = id);`,
  },
  {
    id: 'sec-service-role',
    category: 'security',
    title: 'Chave service_role Exposta no Frontend',
    severity: 'high',
    symptom: 'A chave SUPABASE_SERVICE_ROLE_KEY foi colocada em variáveis públicas (NEXT_PUBLIC_ ou VITE_) e vazou no bundle.',
    cause: 'Confusão entre a anon key (chave pública segura com RLS) e a service_role key (superusuário que ignora qualquer RLS).',
    solution: 'Nunca use service_role no cliente. Apenas NEXT_PUBLIC_SUPABASE_ANON_KEY no frontend. O service_role só deve existir em rotas de API protegidas no servidor.',
    codeSnippet: `// ❌ PERIGO NO FRONTEND:
// const supabase = createClient(URL, process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY);

// ✅ CORRETO NO FRONTEND:
// const supabase = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);`,
  },
  {
    id: 'auth-ssr-cookies',
    category: 'auth',
    title: 'Sessão desloga ao recarregar a página (SSR/Vercel)',
    severity: 'high',
    symptom: 'No Vercel, após dar F5 ou navegar entre páginas protegidas, a sessão cai ou retorna usuário nulo.',
    cause: 'Uso de localStorage em vez de cookies HTTP sincronizados via Middleware ou uso de biblioteca legada (auth-helpers em vez de @supabase/ssr).',
    solution: 'Implemente o Middleware com @supabase/ssr para renovar e salvar os tokens de autenticação nos cookies a cada requisição.',
    codeSnippet: `// middleware.ts (Next.js + @supabase/ssr)
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  await supabase.auth.getUser();
  return response;
}`,
  },
  {
    id: 'auth-redirect-urls',
    category: 'auth',
    title: 'Erro 400: Redirect URI mismatch no login (OAuth/Magic Link)',
    severity: 'medium',
    symptom: 'Ao fazer login com Google/GitHub ou Magic Link no Vercel, ocorre erro de redirecionamento inválido.',
    cause: 'O domínio de produção ou as URLs de preview do Vercel não foram cadastradas no Supabase Dashboard (Authentication > URL Configuration).',
    solution: 'Adicione a URL do Vercel e padrões curinga para previews nas "Redirect URLs" do Supabase.',
    codeSnippet: `// No Supabase Dashboard: Authentication -> URL Configuration
// Site URL:
https://seu-app.vercel.app

// Redirect URLs permitidas:
https://seu-app.vercel.app/**
https://seu-app-*-seu-usuario.vercel.app/**
http://localhost:3000/**`,
  },
  {
    id: 'db-pooler-exhaustion',
    category: 'database',
    title: 'Esgotamento de Conexões (Max connections reached)',
    severity: 'high',
    symptom: 'No Vercel ocorrem erros 500 intermitentes: "remaining connection slots are reserved" ou "timeout acquiring connection".',
    cause: 'Serverless Functions abrem uma conexão direta com o PostgreSQL (porta 5432) a cada invocação, estourando o limite da instância.',
    solution: 'Use a porta do Transaction Connection Pooler (porta 6543 ou modo Session 5432 com Supavisor) na DATABASE_URL.',
    codeSnippet: `// ❌ Conexão direta (esgota conexões em Serverless):
// postgresql://postgres:senha@db.exemplo.supabase.co:5432/postgres

// ✅ Conexão via Pooler (Supavisor / PgBouncer):
// postgresql://postgres.ref:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true`,
  },
  {
    id: 'vercel-env-missing',
    category: 'vercel',
    title: 'Variáveis de Ambiente Não Definidas no Vercel',
    severity: 'high',
    symptom: 'A aplicação funciona localmente no localhost, mas dá tela branca ou erro 500 imediatamente ao abrir no Vercel.',
    cause: 'As variáveis do .env.local não foram adicionadas no painel do Vercel (Project Settings > Environment Variables) para os ambientes Production e Preview.',
    solution: 'Verifique se NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY estão presentes em todos os ambientes no Vercel.',
  },
  {
    id: 'realtime-leaks',
    category: 'realtime',
    title: 'Vazamento de Conexões do Realtime WebSockets',
    severity: 'medium',
    symptom: 'Consumo elevado de conexões simultâneas no Supabase e atualizações duplicadas na tela.',
    cause: 'Canais do Supabase Realtime (.channel()) criados em useEffect sem a função de limpeza (cleanup).',
    solution: 'Sempre invoque supabase.removeChannel(canal) no retorno do useEffect.',
    codeSnippet: `useEffect(() => {
  const channel = supabase
    .channel('mensagens-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens' }, (payload) => {
      console.log('Nova mensagem:', payload.new);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);`,
  }
];

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'template-qtd-produzida',
    title: 'Qtd. Produzida Parcial (Ex: Mostra 31kg em vez do Total)',
    category: 'PCP / Soma de Apontamentos',
    sampleCodeOrError: `// Problema clássico no Frontend:
// O banco tem múltiplos apontamentos para o pedido 9441 (ex: 31kg no corte, 120kg na impressão...),
// mas o código pega apenas o primeiro registro ou não faz a soma:

// ❌ Código com falha:
const qtdProduzida = pedido.apontamentos?.[0]?.qtd_produzida || 0; // Exibe apenas 31 kg!
// ou
const { data } = await supabase.from('apontamentos').select('peso_produzido').eq('pedido_id', 9441).limit(1);`,
    analysis: {
      problem: 'Falta de agregação (SUM / .reduce) dos apontamentos da Ordem de Produção / Pedido. Cada apontamento (por turno, máquina ou setor) gera uma linha no banco de dados. O frontend está pegando apenas o primeiro registro [0], o último registro via limit(1), ou filtrando apenas o setor atual ("FILA DA CORTE / SANTORO") em vez de somar todos os quilos produzidos.',
      risk: 'Divergência entre o estoque/produção real e o painel de PCP. O operador ou gestor vê apenas 31kg e pensa que a produção não evoluiu.',
      fixTitle: 'Somar todos os apontamentos no Frontend ou via View/RPC no Supabase',
      fixedCode: `// ✅ Opção 1: Somar no Frontend com .reduce():
const qtdProduzidaTotal = (pedido.apontamentos || []).reduce(
  (total, ap) => total + (Number(ap.qtd_produzida || ap.peso || 0)),
  0
);
// Resultado correto: exibe a soma real de todos os apontamentos da OP!

// ✅ Opção 2: Query no Supabase trazendo a soma por pedido (SQL / View):
/*
CREATE OR REPLACE VIEW public.vw_pedidos_com_producao AS
SELECT 
  p.*,
  COALESCE(SUM(a.qtd_produzida), 0) AS qtd_produzida_total
FROM public.pedidos p
LEFT JOIN public.apontamentos a ON a.pedido_id = p.id
GROUP BY p.id;
*/`,
      recommendation: 'Verifique se o seu select no Supabase inclui apontamentos(*) e faça a soma de todos os itens do array, ou crie uma View/RPC no Supabase com SUM(qtd_produzida).'
    }
  },
  {
    id: 'template-rls',
    title: 'Erro de Permissão (RLS Policy Violation)',
    category: 'Segurança / Banco',
    sampleCodeOrError: `PostgresError: new row violates row-level security policy for table "pedidos" (SQLSTATE 42501)
at supabase.from('pedidos').insert({ user_id: authUserId, total: 150 })`,
    analysis: {
      problem: 'A política de INSERT configurada na tabela "pedidos" rejeita a inserção porque a condição WITH CHECK não foi satisfeita ou o usuário não está autenticado.',
      risk: 'A operação de escrita falha silenciosamente ou quebra a requisição do usuário final com erro 42501.',
      fixTitle: 'Criar ou ajustar a política de INSERT com WITH CHECK',
      fixedCode: `-- Permitir que usuários autenticados criem pedidos associados ao próprio id:
CREATE POLICY "Criar pedidos próprios"
ON public.pedidos
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);`,
      recommendation: 'Certifique-se de que o campo "user_id" enviado no insert seja exatamente o id do usuário logado (obtido via auth.getUser()).'
    }
  },
  {
    id: 'template-session',
    title: 'Sessão Nula no Vercel após Deploy (Auth SSR)',
    category: 'Autenticação / Vercel',
    sampleCodeOrError: `// Em Server Component ou Route Handler no Vercel:
const { data: { user } } = await supabase.auth.getUser();
// Retorna user = null mesmo após o usuário ter feito login na tela inicial`,
    analysis: {
      problem: 'O cliente Supabase no servidor está tentando ler a sessão, mas os cookies HTTP do navegador não estão sendo propagados ou o cliente foi inicializado sem os adaptadores de cookies do @supabase/ssr.',
      risk: 'Páginas protegidas e Server Actions falham ou redirecionam erroneamente para a página de login.',
      fixTitle: 'Implementar createServerClient com cookies nos Server Components',
      fixedCode: `import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Chamadas a partir de Server Components ignoram setAll
          }
        },
      },
    }
  );
}`,
      recommendation: 'Instale @supabase/ssr no projeto e garanta que exista o arquivo middleware.ts na raiz para manter os tokens atualizados.'
    }
  },
  {
    id: 'template-cors-env',
    title: 'Erro de Fetch / Invalid API Key no Vercel',
    category: 'Vercel / Deploy',
    sampleCodeOrError: `FetchError: TypeError: Failed to parse URL from undefined/rest/v1/...
AuthApiError: Invalid API key`,
    analysis: {
      problem: 'As variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY estão como undefined no build de produção do Vercel.',
      risk: 'A aplicação quebra completamente em produção com falha na inicialização do cliente Supabase.',
      fixTitle: 'Configuração correta no Vercel Dashboard',
      fixedCode: `# No painel do Vercel:
# Settings -> Environment Variables -> Adicionar:
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...

# Depois de salvar, realize um novo deploy (Redeploy sem cache).`,
      recommendation: 'Lembre-se que alterações em variáveis de ambiente no Vercel só entram em vigor após um novo Deploy do projeto.'
    }
  },
  {
    id: 'template-client-singleton',
    title: 'Múltiplas instâncias do Supabase Client (Memory Leak)',
    category: 'React / Performance',
    sampleCodeOrError: `// Dentro de um componente React:
function ListaProdutos() {
  const supabase = createClient(URL, KEY); // Criando nova instância a cada render!
  // ...
}`,
    analysis: {
      problem: 'O cliente Supabase está sendo instanciado dentro do corpo de um componente funcional React. Isso cria novas conexões WebSocket e descarta o cache de autenticação a cada renderização.',
      risk: 'Queda de performance, esgotamento de conexões e instabilidade no estado de autenticação.',
      fixTitle: 'Mover a instância para um módulo utilitário singleton',
      fixedCode: `// src/lib/supabaseClient.ts (Cliente Singleton para o Browser)
import { createBrowserClient } from '@supabase/ssr'; // ou createClient de @supabase/supabase-js

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// No componente:
// import { supabase } from '@/lib/supabaseClient';`,
      recommendation: 'Instancie o cliente uma única vez fora dos componentes ou use um contexto centralizado.'
    }
  }
];

export const SQL_GENERATOR_TEMPLATES = [
  {
    id: 'profiles',
    name: 'Tabela de Perfis de Usuários (Com vínculo auth.users e RLS)',
    code: `-- 1. Criar tabela de perfis vinculada ao auth.users
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  username TEXT UNIQUE,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de acesso
CREATE POLICY "Perfis são públicos para leitura"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Usuários podem atualizar apenas seu próprio perfil"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- 4. Gatilho automático ao cadastrar novo usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();`
  },
  {
    id: 'tasks',
    name: 'Tabela de Dados Privados (Tarefas / Pedidos / Notas com RLS total)',
    code: `-- Tabela de itens privados do usuário
CREATE TABLE public.user_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.user_items ENABLE ROW LEVEL SECURITY;

-- Políticas completas (CRUD isolado por usuário)
CREATE POLICY "Usuário pode visualizar apenas seus próprios itens"
ON public.user_items FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Usuário pode inserir itens para si mesmo"
ON public.user_items FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário pode atualizar apenas seus próprios itens"
ON public.user_items FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Usuário pode deletar apenas seus próprios itens"
ON public.user_items FOR DELETE
TO authenticated
USING (auth.uid() = user_id);`
  },
  {
    id: 'rbac',
    name: 'Tabela com Papéis / RBAC (Administrador vs Membro)',
    code: `-- Criação de tipo enumerado de cargos
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');

-- Tabela de permissões
CREATE TABLE public.user_roles (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'viewer',
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função auxiliar de verificação segura com SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Exemplo de política restrita a admins
-- CREATE POLICY "Apenas administradores podem deletar registros"
-- ON public.pedidos FOR DELETE
-- TO authenticated
-- USING (public.is_admin());`
  }
];
