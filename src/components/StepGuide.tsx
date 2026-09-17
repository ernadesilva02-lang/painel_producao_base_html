import React from 'react';
import { GitPullRequest, AlertCircle, Sparkles, Terminal, Copy, Check } from 'lucide-react';

export const StepGuide: React.FC = () => {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  const copyText = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const steps = [
    {
      id: '1',
      title: '1. Forneça o Repositório ou Trechos-Chave',
      desc: 'Como seu app já está no GitHub, você pode me informar o link do repositório público ou colar aqui no chat os arquivos fundamentais (ex: package.json, supabaseClient.ts, middleware.ts, schema SQL).',
      tip: 'Se o repositório for privado, basta colar aqui o código dos componentes ou endpoints que apresentam erros.',
    },
    {
      id: '2',
      title: '2. Compartilhe o Erro ou Comportamento Inesperado',
      desc: 'Copie os logs do Vercel Runtime (em Deployments > Logs) ou a mensagem vermelha do console do navegador (F12) e envie no chat.',
      tip: 'Exemplo: "O login não mantém a sessão após o F5" ou "Erro 42501 new row violates RLS".',
    },
    {
      id: '3',
      title: '3. Correção e Blindagem de Segurança',
      desc: 'Aplicaremos juntos políticas RLS completas no Supabase, corrigiremos inicializações duplicadas de clientes e resolveremos o fluxo de cookies no Vercel.',
      tip: 'Garantimos que chaves sensíveis como a service_role nunca fiquem expostas no bundle do frontend.',
    },
    {
      id: '4',
      title: '4. Evolução da Aplicação',
      desc: 'Com as falhas corrigidas, você me diz quais novas telas, integrações (pagamentos, webhooks, IA, relatórios) ou rotas deseja criar.',
      tip: 'Escrevemos o código completo com padrões modernos e boas práticas prontas para subir no seu GitHub.',
    }
  ];

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-amber-500" />
        <h2 className="text-lg font-bold text-stone-900">Como vamos trabalhar juntos</h2>
      </div>
      <p className="text-sm text-stone-600 mb-6">
        Siga o roteiro abaixo para investigarmos o seu projeto do GitHub e banco Supabase agora mesmo:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className="p-4 rounded-lg bg-stone-50/80 border border-stone-200/80 flex flex-col justify-between"
          >
            <div>
              <h3 className="text-sm font-semibold text-stone-900 mb-1">
                {step.title}
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed mb-3">
                {step.desc}
              </p>
            </div>
            <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between text-xs text-emerald-800 bg-emerald-50/60 px-2.5 py-1.5 rounded">
              <span className="font-mono text-[11px] truncate mr-2">💡 {step.tip}</span>
              <button
                type="button"
                onClick={() => copyText(step.tip, idx)}
                className="text-stone-400 hover:text-stone-700 transition"
                title="Copiar sugestão"
              >
                {copiedIndex === idx ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
