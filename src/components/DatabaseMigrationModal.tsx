import React, { useState } from "react";
import { ETAPA1_SQL_SCRIPT, ETAPA1_VALIDATION_SQL } from "../data/migrationScript";
import { Database, Copy, Check, ShieldCheck, ArrowRight, ExternalLink, X, AlertTriangle, Layers, Coins, Boxes } from "lucide-react";

export function DatabaseMigrationModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"migration" | "validation">("migration");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentCode = tab === "migration" ? ETAPA1_SQL_SCRIPT : ETAPA1_VALIDATION_SQL;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-600 text-white flex items-center justify-center font-bold">
              <Database size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Etapa 1 · Estruturação Relacional & Migração Segura de Dados
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck size={12} /> Não destrutivo
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Prepara o banco Supabase para custos por setor, estoque de matéria-prima e bobinas semi-acabadas.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Highlights Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-6 py-3 bg-slate-100/70 border-b border-slate-200 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Boxes size={16} className="text-orange-600 shrink-0" />
            <div>
              <strong className="block text-slate-900 font-semibold">Tabelas Relacionais</strong>
              <span>OPs, Máquinas, Apontamentos e Apoio</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <Layers size={16} className="text-blue-600 shrink-0" />
            <div>
              <strong className="block text-slate-900 font-semibold">Controle de Estoque & WIP</strong>
              <span>Insumos (MP) e Bobinas Semi-acabadas</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <Coins size={16} className="text-emerald-600 shrink-0" />
            <div>
              <strong className="block text-slate-900 font-semibold">Custo por Setor</strong>
              <span>Hora-máquina, Mão de obra e perdas</span>
            </div>
          </div>
        </div>

        {/* Instruction steps */}
        <div className="px-6 py-3 bg-amber-50/70 border-b border-amber-200 text-amber-900 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <span>
              <strong>Como aplicar:</strong> 1. Copie o script abaixo &rarr; 2. Abra o <strong>SQL Editor</strong> no painel do Supabase &rarr; 3. Cole e clique em <strong>Run</strong>.
            </span>
          </div>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded font-medium text-xs transition shrink-0"
          >
            Abrir painel do Supabase <ExternalLink size={13} />
          </a>
        </div>

        {/* Action Bar with Tabs */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTab("migration")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                tab === "migration"
                  ? "bg-orange-600 text-white font-semibold"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              1. Script Completo (Tabelas + Migração)
            </button>
            <button
              onClick={() => setTab("validation")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                tab === "validation"
                  ? "bg-orange-600 text-white font-semibold"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              2. Query de Auditoria & Validação Cruzada
            </button>
          </div>

          <button
            onClick={handleCopy}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
              copied
                ? "bg-emerald-600 text-white"
                : "bg-white text-slate-900 hover:bg-slate-100"
            }`}
          >
            {copied ? (
              <>
                <Check size={14} /> Copiado para a Área de Transferência!
              </>
            ) : (
              <>
                <Copy size={14} /> Copiar Script SQL
              </>
            )}
          </button>
        </div>

        {/* Code Viewer */}
        <div className="flex-1 p-4 bg-slate-950 overflow-y-auto font-mono text-xs text-slate-200 leading-relaxed select-all">
          <pre className="whitespace-pre">{currentCode}</pre>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
          <span>
            💡 <strong>Segurança garantida:</strong> Seus dados na tabela original <code>app_storage</code> continuam 100% intactos e preservados.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium rounded-md transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
