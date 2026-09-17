import React, { useState } from 'react';
import { SQL_GENERATOR_TEMPLATES } from '../data/diagnosticData';
import { Database, Copy, Check, Code2 } from 'lucide-react';

export const SqlTemplateGenerator: React.FC = () => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(SQL_GENERATOR_TEMPLATES[0].id);
  const [copied, setCopied] = useState(false);

  const activeTemplate = SQL_GENERATOR_TEMPLATES.find(t => t.id === selectedTemplateId) || SQL_GENERATOR_TEMPLATES[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(activeTemplate.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <Code2 className="w-5 h-5 text-emerald-700" />
            Gerador de Scripts SQL com RLS Seguro para Supabase
          </h2>
          <p className="text-xs text-stone-600 mt-0.5">
            Modelos prontos e auditados para executar diretamente no SQL Editor do Supabase:
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto transition"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Copiado para o SQL Editor!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar Script SQL</span>
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {SQL_GENERATOR_TEMPLATES.map(tmpl => (
          <button
            key={tmpl.id}
            type="button"
            onClick={() => setSelectedTemplateId(tmpl.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              selectedTemplateId === tmpl.id
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-semibold'
                : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
            }`}
          >
            {tmpl.name}
          </button>
        ))}
      </div>

      {/* SQL Output Box */}
      <div className="relative">
        <pre className="p-4 bg-stone-950 text-stone-100 font-mono text-xs rounded-lg overflow-x-auto whitespace-pre leading-relaxed border border-stone-800 max-h-96">
          {activeTemplate.code}
        </pre>
      </div>
      <p className="text-[11px] text-stone-500 mt-2">
        💡 Cole no painel do <strong>Supabase &gt; SQL Editor &gt; New Query &gt; Run</strong>. Todas as políticas já incluem isolamento por <code>auth.uid()</code>.
      </p>
    </div>
  );
};
