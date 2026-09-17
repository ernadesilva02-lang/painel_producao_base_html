import React, { useState, FormEvent, useRef, useEffect } from "react";
import { RegistryKind, RegistryData } from "../types/forpack";
import { Users, Building2, Package, Layers, Search, Plus, Pencil, Check, X, ShieldCheck, AlertCircle } from "lucide-react";

export const REGISTRY_LABELS: Record<RegistryKind, string> = {
  operadores: "Operadores",
  clientes: "Clientes",
  produtos: "Produtos",
  materiais: "Materiais",
};

export const SINGULAR_LABELS: Record<RegistryKind, string> = {
  operadores: "operador",
  clientes: "cliente",
  produtos: "produto",
  materiais: "material",
};

const KIND_ICONS: Record<RegistryKind, React.ComponentType<{ size?: number; className?: string }>> = {
  operadores: Users,
  clientes: Building2,
  produtos: Package,
  materiais: Layers,
};

export function RegistryPanel({
  kind,
  onKind,
  values,
  registries,
  query,
  onQuery,
  saving,
  onSave,
}: {
  kind: RegistryKind;
  onKind: (kind: RegistryKind) => void;
  values: string[];
  registries?: RegistryData;
  query: string;
  onQuery: (value: string) => void;
  saving: boolean;
  onSave: (kind: RegistryKind, previousValue: string | null, nextValue: string) => Promise<void>;
}) {
  const [newValue, setNewValue] = useState("");
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [localError, setLocalError] = useState("");

  const editInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingValue && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingValue]);

  const filtered = values.filter(value =>
    value.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"))
  );

  const selectKind = (next: RegistryKind) => {
    onKind(next);
    onQuery("");
    setNewValue("");
    setEditingValue(null);
    setLocalError("");
  };

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    const clean = newValue.trim();
    if (!clean || saving) return;

    if (values.some(v => v.toLocaleLowerCase("pt-BR") === clean.toLocaleLowerCase("pt-BR"))) {
      setLocalError(`O item "${clean}" já existe neste cadastro.`);
      return;
    }

    setLocalError("");
    await onSave(kind, null, clean);
    setNewValue("");
  };

  const handleStartEdit = (val: string) => {
    setEditingValue(val);
    setEditValue(val);
    setLocalError("");
  };

  const handleCancelEdit = () => {
    setEditingValue(null);
    setEditValue("");
    setLocalError("");
  };

  const handleSaveEdit = async (event?: FormEvent) => {
    if (event) event.preventDefault();
    const clean = editValue.trim();
    if (!editingValue || !clean || saving) return;

    if (clean === editingValue) {
      setEditingValue(null);
      return;
    }

    if (values.some(v => v !== editingValue && v.toLocaleLowerCase("pt-BR") === clean.toLocaleLowerCase("pt-BR"))) {
      setLocalError(`Já existe outro item com o nome "${clean}".`);
      return;
    }

    setLocalError("");
    await onSave(kind, editingValue, clean);
    setEditingValue(null);
  };

  const ActiveIcon = KIND_ICONS[kind];

  return (
    <section className="registry-layout">
      {/* Sidebar de tipos de cadastro */}
      <aside className="registry-nav">
        <div className="registry-nav-head">
          <p className="eyebrow">TIPOS DE CADASTRO</p>
          <span className="registry-nav-subtitle">Listas base do sistema</span>
        </div>

        <div className="registry-nav-list">
          {(Object.keys(REGISTRY_LABELS) as RegistryKind[]).map(item => {
            const IconComponent = KIND_ICONS[item];
            const count = registries ? registries[item]?.length ?? 0 : item === kind ? values.length : 0;
            const isActive = kind === item;

            return (
              <button
                key={item}
                type="button"
                className={`registry-nav-btn ${isActive ? "active" : ""}`}
                onClick={() => selectKind(item)}
              >
                <div className="registry-nav-btn-icon">
                  <IconComponent size={16} />
                </div>
                <div className="registry-nav-btn-text">
                  <strong>{REGISTRY_LABELS[item]}</strong>
                </div>
                <span className="registry-nav-btn-badge">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="registry-note">
          <div className="registry-note-title">
            <ShieldCheck size={16} className="text-emerald-600" />
            <strong>Alterações seguras</strong>
          </div>
          <p>
            A exclusão é bloqueada para proteger o histórico de ordens de produção e relatórios. Você pode editar os nomes livremente.
          </p>
        </div>
      </aside>

      {/* Painel Principal */}
      <div className="registry-main panel">
        {/* Cabeçalho */}
        <header className="registry-head">
          <div className="registry-head-info">
            <div className="registry-head-icon">
              <ActiveIcon size={20} />
            </div>
            <div>
              <p className="eyebrow">LISTA ATIVA</p>
              <h2>{REGISTRY_LABELS[kind]}</h2>
              <span className="registry-head-count">{values.length} item(ns) disponível(is) nos formulários</span>
            </div>
          </div>

          <div className="registry-search">
            <Search size={15} className="registry-search-icon" />
            <input
              type="text"
              value={query}
              onChange={event => onQuery(event.target.value)}
              placeholder={`Buscar em ${REGISTRY_LABELS[kind].toLowerCase()}...`}
            />
            {query && (
              <button
                type="button"
                className="registry-search-clear"
                onClick={() => onQuery("")}
                title="Limpar busca"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </header>

        {/* Formulário de adição */}
        <div className="registry-add-wrap">
          <form className="registry-add" onSubmit={handleAdd}>
            <div className="registry-add-input-wrap">
              <label htmlFor="registry-new-item" className="registry-add-label">
                Adicionar novo {SINGULAR_LABELS[kind]}
              </label>
              <input
                id="registry-new-item"
                type="text"
                value={newValue}
                onChange={event => {
                  setNewValue(event.target.value);
                  if (localError) setLocalError("");
                }}
                placeholder={`Digite o nome do novo ${SINGULAR_LABELS[kind]}...`}
                disabled={saving}
              />
            </div>
            <button
              type="submit"
              className="primary-action registry-add-btn"
              disabled={!newValue.trim() || saving}
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>{saving ? "Salvando..." : "Adicionar"}</span>
            </button>
          </form>

          {localError && (
            <div className="registry-error">
              <AlertCircle size={14} />
              <span>{localError}</span>
            </div>
          )}
        </div>

        {/* Lista de Registros */}
        <div className="registry-list">
          {filtered.map(value => {
            const isEditing = editingValue === value;
            const initials = value.trim().slice(0, 2).toUpperCase() || "FP";

            return (
              <div key={value} className={`registry-row ${isEditing ? "editing" : ""}`}>
                {isEditing ? (
                  <form className="registry-edit-form" onSubmit={handleSaveEdit}>
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editValue}
                      onChange={event => setEditValue(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === "Escape") handleCancelEdit();
                      }}
                      disabled={saving}
                      placeholder="Nome do item"
                    />
                    <div className="registry-edit-actions">
                      <button
                        type="submit"
                        className="save-inline"
                        disabled={!editValue.trim() || saving}
                        title="Salvar alteração (Enter)"
                      >
                        <Check size={14} strokeWidth={2.5} />
                        <span>Salvar</span>
                      </button>
                      <button
                        type="button"
                        className="cancel-inline"
                        onClick={handleCancelEdit}
                        disabled={saving}
                        title="Cancelar (Esc)"
                      >
                        <X size={14} strokeWidth={2.5} />
                        <span>Cancelar</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="registry-item-info">
                      <span className="registry-avatar">{initials}</span>
                      <strong className="registry-item-name">{value}</strong>
                    </div>
                    <button
                      type="button"
                      className="edit-inline"
                      onClick={() => handleStartEdit(value)}
                      title={`Editar ${value}`}
                    >
                      <Pencil size={13} strokeWidth={2.2} />
                      <span>Editar</span>
                    </button>
                  </>
                )}
              </div>
            );
          })}

          {!filtered.length && (
            <div className="registry-empty">
              <ActiveIcon size={32} className="registry-empty-icon" />
              <strong>Nenhum item encontrado</strong>
              {query ? (
                <p>
                  Nenhum registro corresponde a busca por &ldquo;{query}&rdquo;.{" "}
                  <button type="button" onClick={() => onQuery("")}>Limpar filtro</button>
                </p>
              ) : (
                <p>Cadastre o primeiro item utilizando o formulário acima.</p>
              )}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <footer className="panel-foot">
          <span>
            {filtered.length} de {values.length} item(ns) exibido(s)
          </span>
          <span>Inclusão e edição habilitadas · exclusão bloqueada</span>
        </footer>
      </div>
    </section>
  );
}
