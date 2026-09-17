import React, { useState } from 'react';
import { AUDIT_CHECKLIST } from '../data/diagnosticData';
import { FailureCategory, AuditItem } from '../types';
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Shield,
  Key,
  Database,
  Cloud,
  Radio,
  Copy,
  Check
} from 'lucide-react';

export const AuditChecklist: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<FailureCategory | 'all'>('all');
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [expandedId, setExpandedId] = useState<string | null>('sec-rls');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleCheck = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const handleCopy = (snippet: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(snippet);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredList = AUDIT_CHECKLIST.filter(item => {
    if (selectedCategory === 'all') return true;
    return item.category === selectedCategory;
  });

  const totalCount = AUDIT_CHECKLIST.length;
  const resolvedCount = Object.values(checkedItems).filter(Boolean).length;

  const getCategoryIcon = (cat: FailureCategory) => {
    switch (cat) {
      case 'security':
        return <Shield className="w-4 h-4 text-rose-600" />;
      case 'auth':
        return <Key className="w-4 h-4 text-amber-600" />;
      case 'database':
        return <Database className="w-4 h-4 text-emerald-600" />;
      case 'vercel':
        return <Cloud className="w-4 h-4 text-blue-600" />;
      case 'realtime':
        return <Radio className="w-4 h-4 text-purple-600" />;
    }
  };

  const categories: { id: FailureCategory | 'all'; label: string }[] = [
    { id: 'all', label: 'Todas as Falhas' },
    { id: 'security', label: 'Segurança & RLS' },
    { id: 'auth', label: 'Autenticação & SSR' },
    { id: 'vercel', label: 'Vercel Deploy & Env' },
    { id: 'database', label: 'Banco & Pooler' },
    { id: 'realtime', label: 'Realtime' },
  ];

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-bold text-stone-900">
            Checklist de Auditoria: Falhas Críticas em Supabase + Vercel
          </h2>
          <p className="text-xs text-stone-600 mt-0.5">
            Marque os itens à medida que validamos no seu repositório do GitHub e painel do Supabase.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="text-right">
            <span className="text-xs text-stone-500 font-medium">Progresso da Auditoria</span>
            <div className="text-sm font-bold text-stone-900">
              {resolvedCount} de {totalCount} revisados
            </div>
          </div>
          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center relative">
            <span className="text-xs font-bold text-emerald-700">
              {Math.round((resolvedCount / totalCount) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-1.5 mb-5 pb-3 border-b border-stone-100">
        {categories.map(cat => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedCategory === cat.id
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Checklist items */}
      <div className="space-y-3">
        {filteredList.map(item => {
          const isChecked = !!checkedItems[item.id];
          const isExpanded = expandedId === item.id;

          return (
            <div
              key={item.id}
              className={`rounded-lg border transition-all ${
                isChecked
                  ? 'bg-stone-50/70 border-stone-200 opacity-80'
                  : isExpanded
                  ? 'bg-white border-stone-400 shadow-sm'
                  : 'bg-white border-stone-200 hover:border-stone-300'
              }`}
            >
              <div
                onClick={() => toggleExpand(item.id)}
                className="p-4 flex items-center justify-between cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={e => toggleCheck(item.id, e)}
                    className="text-stone-400 hover:text-emerald-600 transition"
                    title={isChecked ? 'Desmarcar' : 'Marcar como verificado'}
                  >
                    {isChecked ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-50" />
                    ) : (
                      <Circle className="w-5 h-5 text-stone-400" />
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    {getCategoryIcon(item.category)}
                    <span
                      className={`text-sm font-semibold ${
                        isChecked ? 'line-through text-stone-500' : 'text-stone-900'
                      }`}
                    >
                      {item.title}
                    </span>
                    {item.severity === 'high' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        Alta Gravidade
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-stone-400">
                  <span className="text-xs hidden sm:inline text-stone-500">
                    {isExpanded ? 'Ocultar detalhes' : 'Ver solução'}
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-stone-100 text-xs text-stone-700 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-rose-50/50 rounded-lg border border-rose-100">
                      <div className="font-semibold text-rose-900 mb-1 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        Sintoma Comum
                      </div>
                      <p className="text-rose-950 leading-relaxed">{item.symptom}</p>
                    </div>

                    <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-100">
                      <div className="font-semibold text-amber-900 mb-1 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-amber-600" />
                        Causa Raiz
                      </div>
                      <p className="text-amber-950 leading-relaxed">{item.cause}</p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-emerald-50/60 rounded-lg border border-emerald-200">
                    <div className="font-semibold text-emerald-900 mb-1">
                      🛠️ Como Corrigir:
                    </div>
                    <p className="text-emerald-950 leading-relaxed">{item.solution}</p>
                  </div>

                  {item.codeSnippet && (
                    <div className="relative mt-2">
                      <div className="flex items-center justify-between px-3 py-1.5 bg-stone-900 text-stone-300 text-[11px] font-mono rounded-t-lg">
                        <span>Código Recomendado</span>
                        <button
                          type="button"
                          onClick={e => handleCopy(item.codeSnippet!, item.id, e)}
                          className="flex items-center gap-1 text-stone-400 hover:text-white transition"
                        >
                          {copiedId === item.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="bg-stone-950 text-stone-100 p-3 rounded-b-lg font-mono text-[11px] overflow-x-auto whitespace-pre leading-relaxed border border-stone-800">
                        {item.codeSnippet}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
