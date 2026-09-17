import React from 'react';
import { ShieldCheck, Database, Cloud, GitBranch, ArrowUpRight } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="border-b border-stone-200 bg-white/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5" />
                Ambiente de Auditoria & Evolução
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight mt-1">
              Central de Diagnóstico Supabase + Vercel
            </h1>
            <p className="text-sm text-stone-600 max-w-2xl mt-0.5">
              Identificação de falhas de segurança (RLS), sessões nulas no Vercel, otimização de banco de dados e evolução da sua aplicação.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 border border-stone-200 text-xs font-medium text-stone-700">
              <GitBranch className="w-3.5 h-3.5 text-stone-500" />
              <span>GitHub</span>
            </div>
            <span className="text-stone-300 font-bold">→</span>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              <span>Supabase</span>
            </div>
            <span className="text-stone-300 font-bold">→</span>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs font-medium text-blue-800">
              <Cloud className="w-3.5 h-3.5 text-blue-600" />
              <span>Vercel</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
