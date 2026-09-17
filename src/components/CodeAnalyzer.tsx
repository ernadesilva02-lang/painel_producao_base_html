import React, { useState } from 'react';
import { PRESET_TEMPLATES } from '../data/diagnosticData';
import { Terminal, Play, RotateCcw, AlertOctagon, CheckCircle2, ShieldAlert, Copy, Check } from 'lucide-react';

export const CodeAnalyzer: React.FC = () => {
  const [inputText, setInputText] = useState<string>(PRESET_TEMPLATES[0].sampleCodeOrError);
  const [activePresetId, setActivePresetId] = useState<string>(PRESET_TEMPLATES[0].id);
  const [analysisResult, setAnalysisResult] = useState<any>(PRESET_TEMPLATES[0].analysis);
  const [copiedFix, setCopiedFix] = useState(false);

  const selectPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setActivePresetId(preset.id);
    setInputText(preset.sampleCodeOrError);
    setAnalysisResult(preset.analysis);
  };

  const handleCustomAnalysis = () => {
    const text = inputText.toLowerCase();

    if (text.includes('31') || text.includes('produzid') || text.includes('apontamento') || text.includes('kg') || text.includes('pcp')) {
      setAnalysisResult({
        problem: 'Falta de agregação/soma dos apontamentos: O banco de dados do Supabase armazena múltiplos apontamentos por pedido (ex: vários lotes, turnos ou setores), mas o Frontend está exibindo apenas o primeiro valor (ex: 31kg) ou o valor de uma única linha/máquina sem somar o acumulado.',
        risk: 'Os operadores e o PCP veem apenas uma fração da produção real (31kg em vez do total já produzido do pedido).',
        fixTitle: 'Somar os apontamentos no Frontend com .reduce() ou no Supabase via SQL View/RPC',
        fixedCode: `// ✅ Opção A: Somar os apontamentos diretamente no Frontend:
const totalProduzido = (pedido.apontamentos || []).reduce(
  (acumulado, item) => acumulado + Number(item.qtd_produzida || item.peso || 0),
  0
);

// Na coluna da tabela:
// <td className="text-emerald-700 font-bold">{totalProduzido} kg</td>

// ✅ Opção B: Consulta no Supabase trazendo a soma agrupada:
const { data: pedidos } = await supabase
  .from('pedidos')
  .select(\`
    *,
    apontamentos ( qtd_produzida, setor, maquina, data_hora )
  \`);`,
        recommendation: 'Verifique no seu código se você está fazendo pedido.apontamento[0] ou limit(1), ou se o filtro de máquina (SANTORO) está ocultando os outros apontamentos.'
      });
    } else if (text.includes('violates row-level security') || text.includes('42501') || text.includes('rls')) {
      setAnalysisResult({
        problem: 'Violação de Política RLS (Row-Level Security): A tabela tem restrição de acesso e o usuário não possui permissão para executar o comando SQL atual.',
        risk: 'Requisições falham silenciosamente ou geram status 400/403/42501.',
        fixTitle: 'Corrigir ou Adicionar Política RLS no Supabase',
        fixedCode: `-- Permitir que usuários autenticados realizem a operação:
CREATE POLICY "Permitir acesso aos próprios dados"
ON public.sua_tabela
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);`,
        recommendation: 'Verifique se o usuário está logado e se o token Bearer é passado no header da requisição.'
      });
    } else if (text.includes('service_role') && (text.includes('next_public') || text.includes('vite_') || text.includes('frontend'))) {
      setAnalysisResult({
        problem: 'Vazamento Crítico da Chave service_role: A chave com privilégios totais de superadministrador está sendo usada no código visível pelo navegador.',
        risk: 'Qualquer usuário pode ler, alterar ou apagar todo o banco de dados via API REST, ignorando todas as regras RLS.',
        fixTitle: 'Substituir por anon key no cliente e guardar service_role em rotas do servidor',
        fixedCode: `// ❌ Remova do frontend qualquer uso de SUPABASE_SERVICE_ROLE_KEY!
// ✅ No frontend use apenas a chave anônima pública:
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);`,
        recommendation: 'Troque imediatamente a chave service_role no dashboard do Supabase (Project Settings > API > Reset service_role).'
      });
    } else if (text.includes('jwt expired') || text.includes('session null') || text.includes('user null') || text.includes('cookies')) {
      setAnalysisResult({
        problem: 'Perda de Sessão ou Expiração de Token JWT em SSR / Vercel: O navegador não repassa os cookies de autenticação para o servidor Vercel ou o middleware não está atualizando a sessão.',
        risk: 'Usuário é deslogado inesperadamente ao atualizar a página ou acessar rotas protegidas.',
        fixTitle: 'Sincronizar cookies com @supabase/ssr no Middleware',
        fixedCode: `// Use a biblioteca moderna @supabase/ssr em vez de @supabase/auth-helpers
import { createServerClient } from '@supabase/ssr';

// Garanta que o middleware.ts processe todas as rotas protegidas e chame supabase.auth.getUser()`,
        recommendation: 'Substitua chamadas depreciadas de getSession() por getUser() para garantir a validação criptográfica no servidor.'
      });
    } else if (text.includes('max client connections') || text.includes('remaining connection') || text.includes('pooler') || text.includes('5432')) {
      setAnalysisResult({
        problem: 'Esgotamento do Pool de Conexões do PostgreSQL no Vercel: Como as serverless functions são efêmeras e escalam horizontalmente, cada função abriu uma conexão direta (porta 5432) saturando o banco.',
        risk: 'Erro 500 para usuários durante picos de acesso ou deploys simultâneos.',
        fixTitle: 'Trocar para a porta 6543 (Supavisor / Transaction Pooler)',
        fixedCode: `// No arquivo de conexão (DATABASE_URL no Vercel):
// Utilize a string do Connection Pooler fornecida pelo Supabase:
DATABASE_URL="postgresql://postgres.[REF]:[SENHA]@aws-0-[REGIAO].pooler.supabase.com:6543/postgres?pgbouncer=true"`,
        recommendation: 'Nunca use a porta 5432 direta em ambientes Serverless como o Vercel.'
      });
    } else {
      setAnalysisResult({
        problem: 'Padrão ou Log analisado. Para investigar esse código detalhadamente no seu repositório:',
        risk: 'Necessita verificação cruzada com os arquivos do GitHub e a estrutura das tabelas no Supabase.',
        fixTitle: 'Ação Recomendada',
        fixedCode: `// Você pode colar o arquivo completo no chat para que eu:
// 1. Aponte exatamente a linha defeituosa
// 2. Escreva o código reestruturado e testado
// 3. Valide os tipos TypeScript e políticas SQL`,
        recommendation: 'Envie-me no chat o arquivo específico do seu projeto GitHub onde esse comportamento ocorre.'
      });
    }
  };

  const copyFixedCode = () => {
    if (!analysisResult?.fixedCode) return;
    navigator.clipboard.writeText(analysisResult.fixedCode);
    setCopiedFix(true);
    setTimeout(() => setCopiedFix(false), 2000);
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-stone-700" />
            Analisador Rápido de Erros e Código
          </h2>
          <p className="text-xs text-stone-600 mt-0.5">
            Cole logs de erro do Vercel, trechos do cliente Supabase ou selecione um caso comum:
          </p>
        </div>
      </div>

      {/* Preset Buttons */}
      <div className="mb-3">
        <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1.5">
          Exemplos Comuns de Falhas:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_TEMPLATES.map(preset => (
            <button
              key={preset.id}
              type="button"
              onClick={() => selectPreset(preset)}
              className={`px-2.5 py-1 rounded text-xs font-medium border transition ${
                activePresetId === preset.id
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
              }`}
            >
              {preset.title}
            </button>
          ))}
        </div>
      </div>

      {/* Text Area */}
      <div className="relative mb-3">
        <textarea
          value={inputText}
          onChange={e => {
            setInputText(e.target.value);
            setActivePresetId('');
          }}
          rows={5}
          placeholder="Cole aqui o erro do Vercel, trecho de código TypeScript ou consulta SQL..."
          className="w-full font-mono text-xs p-3 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent bg-stone-50/50 text-stone-900 leading-relaxed"
        />
        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={() => {
              setInputText('');
              setAnalysisResult(null);
              setActivePresetId('');
            }}
            className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs text-stone-600 hover:bg-stone-100 flex items-center gap-1 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Limpar
          </button>
          <button
            type="button"
            onClick={handleCustomAnalysis}
            className="px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            Analisar Código / Log
          </button>
        </div>
      </div>

      {/* Analysis Result Card */}
      {analysisResult && (
        <div className="p-4 rounded-lg bg-stone-50 border border-stone-200 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertOctagon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-stone-900">Diagnóstico Identificado</h4>
              <p className="text-xs text-stone-700 mt-0.5 leading-relaxed">
                {analysisResult.problem}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-white rounded border border-stone-200">
              <span className="font-semibold text-rose-800 block mb-1">Impacto / Risco</span>
              <p className="text-stone-600 leading-relaxed">{analysisResult.risk}</p>
            </div>
            <div className="p-3 bg-white rounded border border-stone-200">
              <span className="font-semibold text-emerald-800 block mb-1">Recomendação</span>
              <p className="text-stone-600 leading-relaxed">{analysisResult.recommendation}</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-stone-800 mb-1.5">
              <span>{analysisResult.fixTitle}</span>
              <button
                type="button"
                onClick={copyFixedCode}
                className="flex items-center gap-1 text-emerald-700 hover:text-emerald-900 transition font-mono text-[11px]"
              >
                {copiedFix ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Correção</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 bg-stone-950 text-emerald-400 font-mono text-xs rounded-lg overflow-x-auto whitespace-pre leading-relaxed border border-stone-800">
              {analysisResult.fixedCode}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
