import React, { useState, useMemo } from "react";
import { History, Calendar, Clock, User, Pencil, Info, ChevronDown, ChevronUp } from "lucide-react";
import { Order, Machine, Production, SECTORS, PRODUCT_CATEGORIES } from "../types/forpack";
import { date, kg, number, inferredCategory, categoryLabel, orderBalance } from "../utils/formatters";

export function EditProductionForm({
  record,
  operators,
  machines = [],
  saving,
  onSave,
  onCancel,
}: {
  record: Production;
  operators: string[];
  machines?: Machine[];
  saving: boolean;
  onSave: (record: Production) => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState<Production>({ ...record });
  const update = (field: keyof Production, value: string) => setInput(current => ({ ...current, [field]: value }));
  const valid = Boolean(input.dataProducao && input.turno && input.operador && number(input.qtdProduzido) > 0);

  const groupedMachines = SECTORS.map(sector => ({
    sector,
    machines: (machines || []).filter(m => m.setor.toUpperCase() === sector),
  })).filter(g => g.machines.length > 0);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || saving) return;
    onSave(input);
  }

  return (
    <form className="new-order-form edit-order-form" onSubmit={submit}>
      <div className="production-grid">
        <label className="field">
          <span>Data da produção</span>
          <input type="date" value={input.dataProducao || ""} onChange={event => update("dataProducao", event.target.value)} />
        </label>
        <label className="field">
          <span>Turno</span>
          <select value={input.turno || ""} onChange={event => update("turno", event.target.value)}>
            <option value="">Selecione</option>
            <option>MANHÃ</option>
            <option>TARDE</option>
            <option>NOITE</option>
          </select>
        </label>
      </div>

      <label className="field">
        <span>Máquina / Setor</span>
        <select value={input.maquinaId || ""} onChange={event => update("maquinaId", event.target.value)}>
          <option value="">Selecione a máquina</option>
          {groupedMachines.map(group => (
            <optgroup key={group.sector} label={group.sector}>
              {group.machines.map(machine => (
                <option key={machine.id} value={machine.id}>
                  {machine.name} ({machine.setor})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Operador</span>
        <select value={input.operador || ""} onChange={event => update("operador", event.target.value)}>
          <option value="">Selecione</option>
          {operators.map(operator => (
            <option key={operator}>{operator}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Quantidade produzida (kg)</span>
        <input inputMode="decimal" value={input.qtdProduzido || ""} onChange={event => update("qtdProduzido", event.target.value)} />
      </label>
      <div className="production-grid">
        <label className="field">
          <span>Aparas (kg)</span>
          <input inputMode="decimal" value={input.aparas || ""} onChange={event => update("aparas", event.target.value)} />
        </label>
        <label className="field">
          <span>Picote (kg)</span>
          <input inputMode="decimal" value={input.picote || ""} onChange={event => update("picote", event.target.value)} />
        </label>
      </div>
      <div className="form-actions">
        <button type="button" className="cancel-action" disabled={saving} onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="primary-action" disabled={!valid || saving}>
          {saving ? "Salvando..." : "Salvar correção"}
        </button>
      </div>
    </form>
  );
}

export function ProgrammingForm({
  order,
  machines,
  saving,
  onSave,
  onReturnToWaiting,
}: {
  order: Order;
  machines: Machine[];
  saving: boolean;
  onSave: (order: Order, machineId: string, priority: boolean) => void;
  onReturnToWaiting: (order: Order) => void;
}) {
  const [machineId, setMachineId] = useState(order.maquinaId || "");
  const [priority, setPriority] = useState(Boolean((order as Order & { prioridade?: number }).prioridade));
  const currentMachine = machines.find(machine => machine.id === order.maquinaId);
  const isReprogramming = Boolean(order.maquinaId);
  const changedMachine = Boolean(isReprogramming && machineId && machineId !== order.maquinaId);
  const targetMachine = machines.find(machine => machine.id === machineId);
  const grouped = SECTORS.map(sector => ({ sector, machines: machines.filter(machine => machine.setor.toUpperCase() === sector) })).filter(
    group => group.machines.length
  );

  function confirmProgramming() {
    if (!machineId || saving) return;
    onSave(order, machineId, priority);
  }

  function confirmReturnToWaiting() {
    if (saving) return;
    onReturnToWaiting(order);
  }

  return (
    <section className="programming-card">
      <div className="programming-title">
        <div>
          <p className="eyebrow">{isReprogramming ? "REPROGRAMAÇÃO PCP" : "PROGRAMAÇÃO PCP"}</p>
          <h3>{isReprogramming ? "Transferir OP para outra máquina/setor" : "Definir próxima máquina"}</h3>
        </div>
        <span className="live-pill">Gravação real</span>
      </div>

      {isReprogramming && (
        <div className="programming-route">
          <div className="route-box source">
            <small>ATUAL</small>
            <strong>{currentMachine?.name || order.maquinaId || "Não definida"}</strong>
            <span>{currentMachine?.setor || "Sem setor"}</span>
          </div>
          <div className="route-arrow">→</div>
          <div className={`route-box destination ${changedMachine ? "selected" : ""}`}>
            <small>NOVO DESTINO</small>
            <strong>{targetMachine?.name || (machineId ? machineId : "Selecione")}</strong>
            <span>{targetMachine?.setor || "Máquina / setor"}</span>
          </div>
        </div>
      )}

      <label className="field">
        <span>{isReprogramming ? "Nova máquina / setor" : "Máquina / setor"}</span>
        <select value={machineId} onChange={event => setMachineId(event.target.value)}>
          <option value="">Selecione a máquina</option>
          {grouped.map(group => (
            <optgroup key={group.sector} label={group.sector}>
              {group.machines.map(machine => (
                <option key={machine.id} value={machine.id}>
                  {machine.name} ({machine.setor})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label className="priority-check">
        <input type="checkbox" checked={priority} onChange={event => setPriority(event.target.checked)} />
        <span className="priority-text">
          <strong>Marcar como prioridade</strong>
          <small>Destaca esta OP no topo da fila da máquina selecionada.</small>
        </span>
      </label>

      <button
        type="button"
        className="primary-action reprogram-confirm-btn"
        disabled={!machineId || saving}
        onClick={confirmProgramming}
      >
        {saving
          ? "Salvando..."
          : isReprogramming
          ? "Confirmar reprogramação"
          : "Confirmar programação"}
      </button>

      {isReprogramming && (
        <button
          type="button"
          className="return-waiting-action"
          disabled={saving}
          onClick={confirmReturnToWaiting}
        >
          ← Retornar para Aguardando Programação
        </button>
      )}

      <p className="save-warning">
        {isReprogramming
          ? "A OP sairá da fila atual e entrará na nova máquina. Todo o histórico produzido continuará vinculado à OP e ao setor onde foi realizado."
          : "Ao confirmar, o pedido sai de “Aguardando programação” e entra na fila da máquina selecionada."}
      </p>
    </section>
  );
}

export function ProductionForm({
  order,
  machine,
  records,
  operators,
  saving,
  onSave,
  onEditRecord,
}: {
  order: Order;
  machine?: Machine;
  records: Production[];
  operators: string[];
  saving: boolean;
  onSave: (order: Order, input: Production) => void;
  onEditRecord?: (record: Production) => void;
}) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });
  const [input, setInput] = useState<Production>({
    dataProducao: today,
    turno: "",
    operador: "",
    qtdProduzido: "",
    aparas: "",
    picote: "",
  });
  const [showAllRecords, setShowAllRecords] = useState(false);

  const valid = Boolean(machine && input.dataProducao && input.turno && input.operador?.trim() && number(input.qtdProduzido) > 0);
  const update = (field: keyof Production, value: string) => setInput(current => ({ ...current, [field]: value }));

  const totalProduced = records.reduce((sum, r) => sum + number(r.qtdProduzido), 0);
  const sortedRecords = [...records].sort((a, b) => (b.dataProducao || "").localeCompare(a.dataProducao || "") || (b.id || "").localeCompare(a.id || ""));
  const displayedRecords = showAllRecords ? sortedRecords : sortedRecords.slice(0, 4);

  return (
    <section className="programming-card">
      <div className="programming-title">
        <div>
          <p className="eyebrow">APONTAMENTO DE PRODUÇÃO</p>
          <h3>{machine?.name || "Máquina não definida"}</h3>
        </div>
        <span>Gravação real</span>
      </div>
      <div className="production-grid">
        <label className="field">
          <span>Data da produção</span>
          <input type="date" value={input.dataProducao} onChange={event => update("dataProducao", event.target.value)} />
        </label>
        <label className="field">
          <span>Turno</span>
          <select value={input.turno} onChange={event => update("turno", event.target.value)}>
            <option value="">Selecione</option>
            <option>MANHÃ</option>
            <option>TARDE</option>
            <option>NOITE</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>Operador</span>
        <select value={input.operador} onChange={event => update("operador", event.target.value)}>
          <option value="">Selecione o operador</option>
          {operators.map(operator => (
            <option key={operator} value={operator}>
              {operator}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Quantidade produzida (kg)</span>
        <input inputMode="decimal" value={input.qtdProduzido} onChange={event => update("qtdProduzido", event.target.value)} placeholder="Ex.: 350,5" />
      </label>
      <div className="production-grid">
        <label className="field">
          <span>Aparas (kg)</span>
          <input inputMode="decimal" value={input.aparas} onChange={event => update("aparas", event.target.value)} placeholder="Opcional" />
        </label>
        <label className="field">
          <span>Picote (kg)</span>
          <input inputMode="decimal" value={input.picote} onChange={event => update("picote", event.target.value)} placeholder="Opcional" />
        </label>
      </div>
      <button className="primary-action" disabled={!valid || saving} onClick={() => onSave(order, input)}>
        {saving ? "Registrando..." : "Registrar produção"}
      </button>

      <div className="production-note-banner">
        <Info size={16} className="production-note-icon" />
        <p>
          O lançamento será somado ao produzido desta OP em <strong>{machine?.setor || "seu setor"}</strong>. A programação da máquina não é alterada automaticamente.
        </p>
      </div>

      <div className="recent-records-card">
        <div className="recent-records-head">
          <div className="recent-records-title">
            <div className="recent-records-icon-box">
              <History size={16} />
            </div>
            <div>
              <strong>Últimos apontamentos nesta máquina</strong>
              <span className="recent-records-sub">
                {records.length} {records.length === 1 ? "apontamento registrado" : "apontamentos registrados"}
                {records.length > 0 && (
                  <> · Total na OP: <b>{kg(totalProduced)}</b></>
                )}
              </span>
            </div>
          </div>
          {records.length > 4 && (
            <button
              type="button"
              className="recent-records-toggle-btn"
              onClick={() => setShowAllRecords(prev => !prev)}
            >
              {showAllRecords ? (
                <>
                  <span>Mostrar menos</span>
                  <ChevronUp size={13} />
                </>
              ) : (
                <>
                  <span>Ver todos ({records.length})</span>
                  <ChevronDown size={13} />
                </>
              )}
            </button>
          )}
        </div>

        {records.length > 0 ? (
          <div className="recent-records-list">
            {displayedRecords.map((record, index) => {
              const producedKg = number(record.qtdProduzido);
              const scrapsKg = number(record.aparas);
              const cuttingsKg = number(record.picote);
              const hasLosses = scrapsKg > 0 || cuttingsKg > 0;
              const shiftClass = record.turno ? `shift-${record.turno.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}` : "";

              return (
                <div key={record.id || record._key || index} className="recent-record-item">
                  <div className="recent-record-info">
                    <div className="recent-record-row-top">
                      <span className="recent-record-date">
                        <Calendar size={13} />
                        <span>{date(record.dataProducao)}</span>
                      </span>
                      {record.turno && (
                        <span className={`recent-record-badge ${shiftClass}`}>
                          <Clock size={11} />
                          <span>{record.turno}</span>
                        </span>
                      )}
                      {record.operador && (
                        <span className="recent-record-operator">
                          <User size={12} />
                          <span>{record.operador}</span>
                        </span>
                      )}
                    </div>

                    {hasLosses && (
                      <div className="recent-record-losses">
                        <span>Perdas: </span>
                        {scrapsKg > 0 && <span>Aparas {kg(scrapsKg)}</span>}
                        {scrapsKg > 0 && cuttingsKg > 0 && <span className="dot-sep">·</span>}
                        {cuttingsKg > 0 && <span>Picote {kg(cuttingsKg)}</span>}
                      </div>
                    )}
                  </div>

                  <div className="recent-record-actions">
                    <span className="recent-record-weight">
                      +{kg(producedKg)}
                    </span>
                    {onEditRecord && (
                      <button
                        type="button"
                        className="recent-record-edit-action"
                        onClick={() => onEditRecord(record)}
                        title="Editar este apontamento"
                      >
                        <Pencil size={12} strokeWidth={2.4} />
                        <span>Editar</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="recent-records-empty">
            <p>Nenhum apontamento nesta máquina registrado ainda para esta OP.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export function OrderManagement({
  order,
  records,
  machines,
  saving,
  onEdit,
  onFinish,
  onReopen,
  onOpenTechnicalClosure,
}: {
  order: Order;
  records: Production[];
  machines: Machine[];
  saving: boolean;
  onEdit: () => void;
  onFinish: (closure: { responsavel: string; observacao?: string }) => void;
  onReopen: (closure: { responsavel: string; observacao?: string }) => void;
  onOpenTechnicalClosure?: (order: Order) => void;
}) {
  const finished = order.statusProducao?.toUpperCase() === "FINALIZADO";
  const [closing, setClosing] = useState(false);
  const [responsible, setResponsible] = useState(order.fechamento?.responsavel || "Ernade Silva");
  const [observation, setObservation] = useState("");
  const balance = orderBalance(order, records, machines);
  const snapshot = order.fechamento || {
    responsavel: responsible,
    observacao: "",
    data: order.dataConclusao || "",
    pesoInicial: balance.initial,
    pesoFinal: balance.final,
    perdaReal: balance.realLoss,
    perdaDeclarada: balance.declaredLoss,
    divergencia: balance.divergence,
    aproveitamento: balance.yieldRate,
  };

  function confirmReopen() {
    onReopen({ responsavel: "Ernade Silva", observacao: "Correção ou complemento de produção" });
  }

  function printClosure() {
    const source = document.querySelector<HTMLElement>("[data-closure-print]");
    if (!source) return window.alert("Não foi possível preparar o relatório para impressão.");
    const frame = document.createElement("iframe");
    frame.title = "Impressão do fechamento da OP";
    Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "1px", height: "1px", border: "0", opacity: "0" });
    document.body.appendChild(frame);
    const printWindow = frame.contentWindow;
    const printDocument = frame.contentDocument;
    if (!printWindow || !printDocument) {
      frame.remove();
      return window.alert("O navegador bloqueou a preparação da impressão.");
    }
    printDocument.open();
    printDocument.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Fechamento da OP</title><style>
      @page{size:A4 landscape;margin:12mm}*{box-sizing:border-box;-webkit-print-color-adjust:economy;print-color-adjust:economy}html,body{margin:0;background:#fff;color:#182334;font-family:Arial,sans-serif}
      .print-title{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:9px;margin-bottom:10px;border-bottom:2px solid #f47b20}.print-title strong,.print-title span,.print-title small{display:block}.print-title strong{font-size:16px}.print-title span{margin-top:3px;color:#667085;font-size:9px;letter-spacing:.08em}.print-title>div:last-child{text-align:right}.print-title small{font-size:8px;color:#778191}.print-title>div:last-child strong{font-size:11px;margin-top:3px}
      .closure-report{border:1px solid #8e99a8;background:#fff;overflow:hidden}.closure-report>header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:#f5f6f8;border-bottom:1px solid #aeb7c3}.closure-report>header small,.closure-report>header strong{display:block}.closure-report>header small{font-size:7px;color:#667085;font-weight:700;letter-spacing:.08em}.closure-report>header strong{font-size:14px;margin-top:3px}.closure-ok,.closure-alert{padding:5px 8px;border:1px solid #8e99a8;border-radius:12px;font-size:8px;font-weight:700}.closure-ok{color:#11764e}.closure-alert{color:#b73535}
      .closure-order{display:grid;grid-template-columns:1fr 1.6fr .8fr;gap:8px;padding:10px 12px;border-bottom:1px solid #d7dce3}.closure-order small,.closure-order strong{display:block}.closure-order small,.closure-kpis small{font-size:7px;color:#667085}.closure-order strong{font-size:9px;margin-top:3px}.closure-kpis{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #d7dce3}.closure-kpis>div{padding:10px 12px;border-right:1px solid #d7dce3}.closure-kpis>div:last-child{border-right:0}.closure-kpis small,.closure-kpis strong{display:block}.closure-kpis strong{font-size:13px;color:#174ea6;margin-top:4px}
      .closure-flow{display:flex;align-items:stretch;padding:12px}.closure-step{display:flex;align-items:center;flex:1}.closure-step>b{margin:0 5px;color:#7d8796}.closure-step>span{display:block;min-width:0;flex:1;padding:9px;background:#fafbfc;border:1px solid #cbd2dc;border-radius:4px}.closure-step small,.closure-step strong,.closure-step em,.closure-step i{display:block}.closure-step small{font-size:7px;font-weight:700;color:#536174}.closure-step strong{font-size:11px;color:#174ea6;margin:5px 0}.closure-step em{font-size:7px;color:#b73535;font-style:normal}.closure-step i{font-size:7px;font-style:normal;font-weight:700;margin-top:6px;padding-top:5px;border-top:1px solid #dfe4eb}.closure-step i.good{color:#11764e}.closure-step i.bad{color:#b73535}
      .closure-report>footer{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px 12px;background:#fafafa;border-top:1px solid #aeb7c3}.closure-report>footer span:last-child{grid-column:1/-1}.closure-report>footer small,.closure-report>footer strong{display:block}.closure-report>footer small{font-size:7px;color:#667085}.closure-report>footer strong{font-size:8px;margin-top:3px}.print-footer{display:flex;justify-content:space-between;margin-top:10px;padding-top:7px;border-top:1px solid #d7dce3;color:#667085;font-size:7px}
    </style></head><body></body></html>`);
    printDocument.close();
    const opLabel = order.numeroOp || order.numeroPedido || order.id;
    const heading = printDocument.createElement("header");
    heading.className = "print-title";
    const identity = printDocument.createElement("div");
    identity.innerHTML = "<strong>FORPACK · GUAIÚBA</strong><span>RELATÓRIO DE FECHAMENTO DE ORDEM DE PRODUÇÃO</span>";
    const op = printDocument.createElement("div");
    const opSmall = printDocument.createElement("small");
    opSmall.textContent = "OP";
    const opStrong = printDocument.createElement("strong");
    opStrong.textContent = opLabel;
    op.append(opSmall, opStrong);
    heading.append(identity, op);
    const footer = printDocument.createElement("footer");
    footer.className = "print-footer";
    const note = printDocument.createElement("span");
    note.textContent = "Painel de Produção · Documento para conferência";
    const issued = printDocument.createElement("span");
    issued.textContent = `Emitido em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}`;
    footer.append(note, issued);
    printDocument.body.append(heading, printDocument.importNode(source, true), footer);
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      window.setTimeout(() => frame.remove(), 1000);
    }, 250);
  }

  return (
    <section className="management-card">
      <div className="programming-title">
        <div>
          <p className="eyebrow">GERENCIAMENTO DA OP</p>
          <h3>{finished ? "Pedido finalizado" : "Ações disponíveis"}</h3>
        </div>
        <span>{finished ? "Histórico" : "Gravação real"}</span>
      </div>
      {finished && (
        <div className="completion-info">
          <span>✓</span>
          <div>
            <strong>Conclusão registrada por {snapshot.responsavel}</strong>
            <small>
              {snapshot.data ? new Date(snapshot.data).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" }) : "Data não informada"}
            </small>
          </div>
        </div>
      )}
      <article className="closure-report" data-closure-print>
        <header>
          <div>
            <small>RELATÓRIO DE FECHAMENTO</small>
            <strong>OP {order.numeroOp || order.numeroPedido || order.id}</strong>
          </div>
          <span className={snapshot.divergencia > 0.05 ? "closure-alert" : "closure-ok"}>
            {snapshot.divergencia > 0.05 ? "⚠ Divergência" : "✓ Saldo conferido"}
          </span>
        </header>
        <div className="closure-order">
          <div>
            <small>Cliente</small>
            <strong>{order.cliente}</strong>
          </div>
          <div>
            <small>Produto</small>
            <strong>{order.descricaoItem}</strong>
          </div>
          <div>
            <small>Quantidade pedida</small>
            <strong>{kg(number(order.quantidade))}</strong>
          </div>
        </div>
        <div className="closure-kpis">
          <div>
            <small>Peso inicial</small>
            <strong>{kg(snapshot.pesoInicial)}</strong>
          </div>
          <div>
            <small>Produção final</small>
            <strong>{kg(snapshot.pesoFinal)}</strong>
          </div>
          <div>
            <small>Perda real</small>
            <strong>{kg(snapshot.perdaReal)}</strong>
          </div>
          <div>
            <small>Aproveitamento</small>
            <strong>{snapshot.aproveitamento.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</strong>
          </div>
        </div>
        <div className="closure-flow">
          {balance.steps.map((step, index) => (
            <div className="closure-step" key={step.sector}>
              {index > 0 && <b>→</b>}
              <span>
                <small>{step.sector}</small>
                <strong>{kg(step.produced)}</strong>
                <em>Perdas: {kg(step.loss)}</em>
                {index > 0 && (
                  <i className={Math.abs(step.difference) > 0.05 ? "bad" : "good"}>
                    {Math.abs(step.difference) > 0.05 ? `Diferença: ${kg(Math.abs(step.difference))}` : "Saldo fechado"}
                  </i>
                )}
              </span>
            </div>
          ))}
        </div>
        {finished && (
          <footer>
            <span>
              <small>Responsável pelo fechamento</small>
              <strong>{snapshot.responsavel}</strong>
            </span>
            <span>
              <small>Data e hora</small>
              <strong>{snapshot.data ? new Date(snapshot.data).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" }) : "—"}</strong>
            </span>
            {snapshot.observacao && (
              <span>
                <small>Observação</small>
                <strong>{snapshot.observacao}</strong>
              </span>
            )}
          </footer>
        )}
      </article>
      {!finished && !closing && (
        <button className="secondary-action" disabled={saving} onClick={onEdit}>
          Editar dados do pedido / OP
        </button>
      )}
      {finished ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            type="button"
            className="finish-action"
            style={{ background: "#4338ca", borderColor: "#3730a3", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
            onClick={() => onOpenTechnicalClosure?.(order)}
          >
            <span>🛡️ Ver Laudo Técnico & Certificado de Expedição</span>
          </button>
          <button className="secondary-action" onClick={printClosure}>
            Imprimir fechamento simples / PDF
          </button>
          <button className="reopen-action" disabled={saving} onClick={confirmReopen}>
            {saving ? "Salvando..." : "Reabrir OP"}
          </button>
        </div>
      ) : closing ? (
        <div className="closure-form">
          <label className="field">
            <span>Responsável pelo fechamento *</span>
            <input value={responsible} onChange={event => setResponsible(event.target.value)} />
          </label>
          <label className="field">
            <span>Observação do fechamento</span>
            <textarea
              rows={3}
              value={observation}
              onChange={event => setObservation(event.target.value)}
              placeholder="Opcional — registre justificativas ou ocorrências."
            />
          </label>
          {balance.divergence > 0.05 && (
            <p className="closure-warning">
              Existe divergência de {kg(balance.divergence)}. O fechamento será permitido, mas ficará sinalizado no relatório.
            </p>
          )}
          <div className="form-actions">
            <button className="cancel-action" disabled={saving} onClick={() => setClosing(false)}>
              Cancelar
            </button>
            <button
              className="finish-action compact"
              disabled={saving || !responsible.trim()}
              onClick={() => {
                onFinish({ responsavel: responsible, observacao: observation });
              }}
            >
              {saving ? "Concluindo..." : "Confirmar fechamento"}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            type="button"
            className="finish-action"
            style={{ background: "#4338ca", borderColor: "#3730a3" }}
            disabled={saving || !balance.steps.length}
            onClick={() => onOpenTechnicalClosure?.(order)}
          >
            {balance.steps.length
              ? "🛡️ Fechamento Técnico & Baixa Automática de Estoque"
              : "Sem produção para fechar"}
          </button>
          {balance.steps.length > 0 && (
            <button
              type="button"
              className="secondary-action"
              disabled={saving}
              onClick={() => setClosing(true)}
            >
              ✓ Fechamento Rápido (Sem Baixa)
            </button>
          )}
        </div>
      )}
      <p className="save-warning">
        {finished
          ? "Ao reabrir, a OP retorna para Aguardando Programação. A reabertura fica registrada no histórico."
          : "O fechamento preserva todos os apontamentos e grava uma fotografia do balanço para rastreabilidade."}
      </p>
    </section>
  );
}

export function EditOrderForm({
  order,
  clients,
  products,
  materials,
  saving,
  onSave,
  onCancel,
}: {
  order: Order;
  clients: string[];
  products: string[];
  materials: string[];
  saving: boolean;
  onSave: (order: Order) => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState<Order>({ ...order });
  const update = (field: keyof Order, value: string) => setInput(current => ({ ...current, [field]: value }));
  const valid = Boolean(input.data && input.cliente.trim() && input.descricaoItem.trim() && number(input.quantidade) > 0);

  const matchingClients = useMemo(() => {
    const q = (input.cliente || "").trim().toLowerCase();
    if (!q) return [];
    return clients.filter(c => c.toLowerCase().includes(q) && c.toLowerCase() !== q).slice(0, 5);
  }, [input.cliente, clients]);

  const matchingProducts = useMemo(() => {
    const q = (input.descricaoItem || "").trim().toLowerCase();
    if (!q) return [];
    return products.filter(p => p.toLowerCase().includes(q) && p.toLowerCase() !== q).slice(0, 5);
  }, [input.descricaoItem, products]);

  return (
    <form
      className="new-order-form edit-order-form"
      onSubmit={event => {
        event.preventDefault();
        if (valid && !saving) onSave(input);
      }}
    >
      <div className="programming-title">
        <div>
          <p className="eyebrow">EDIÇÃO</p>
          <h3>Dados do pedido / OP</h3>
        </div>
        <span>Gravação real</span>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Data do pedido *</span>
          <input type="date" value={input.data || ""} onChange={event => update("data", event.target.value)} required />
        </label>
        <label className="field">
          <span>Nº do pedido</span>
          <input value={input.numeroPedido || ""} onChange={event => update("numeroPedido", event.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Cliente *</span>
        <input list="clientes-edicao" value={input.cliente} onChange={event => update("cliente", event.target.value)} required />
        <datalist id="clientes-edicao">
          {clients.map(client => (
            <option key={client} value={client} />
          ))}
        </datalist>
        {matchingClients.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded-md text-xs">
            <span className="text-slate-500 font-medium">Sugestões:</span>
            {matchingClients.map(clientName => (
              <button
                key={clientName}
                type="button"
                className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded border border-blue-200 transition-colors text-left"
                onClick={() => update("cliente", clientName)}
              >
                {clientName}
              </button>
            ))}
          </div>
        )}
      </label>
      <label className="field">
        <span>Produto / descrição *</span>
        <input list="produtos-edicao" value={input.descricaoItem} onChange={event => update("descricaoItem", event.target.value)} required />
        <datalist id="produtos-edicao">
          {products.map(product => (
            <option key={product} value={product} />
          ))}
        </datalist>
        {matchingProducts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded-md text-xs">
            <span className="text-slate-500 font-medium">Sugestões:</span>
            {matchingProducts.map(prodName => (
              <button
                key={prodName}
                type="button"
                className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded border border-blue-200 transition-colors text-left"
                onClick={() => update("descricaoItem", prodName)}
              >
                {prodName}
              </button>
            ))}
          </div>
        )}
      </label>
      <label className="field">
        <span>Categoria do produto *</span>
        <select value={input.categoriaProduto || inferredCategory(input)} onChange={event => update("categoriaProduto", event.target.value)}>
          {PRODUCT_CATEGORIES.map(item => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <small className="field-help">Confirme a categoria sugerida automaticamente.</small>
      </label>
      <div className="form-grid">
        <label className="field">
          <span>Quantidade (kg) *</span>
          <input inputMode="decimal" value={input.quantidade} onChange={event => update("quantidade", event.target.value)} required />
        </label>
        <label className="field">
          <span>Número da OP</span>
          <input value={input.numeroOp || ""} onChange={event => update("numeroOp", event.target.value)} />
        </label>
      </div>
      <div className="deadline-form-block">
        <p className="eyebrow">REGRA DE PRAZO</p>
        <label className="field">
          <span>Tipo do item *</span>
          <select value={input.tipoPrazo || "IMPRESSO_REPETICAO"} onChange={event => update("tipoPrazo", event.target.value)}>
            <option value="LISO">Liso — 20 dias após o pedido</option>
            <option value="IMPRESSO_REPETICAO">Impresso repetição — 30 dias após o pedido</option>
            <option value="IMPRESSO_NOVO">Impresso novo — 30 dias após a chegada do clichê</option>
          </select>
        </label>
        {input.tipoPrazo === "IMPRESSO_NOVO" && (
          <label className="field">
            <span>Data de chegada do clichê</span>
            <input type="date" value={input.dataChegadaCliche || ""} onChange={event => update("dataChegadaCliche", event.target.value)} />
            <small className="field-help">Enquanto esta data não for informada, o pedido ficará como “Aguardando clichê”.</small>
          </label>
        )}
      </div>
      <label className="field">
        <span>Material / estrutura</span>
        <select value={input.material || ""} onChange={event => update("material", event.target.value)}>
          <option value="">Selecione o material</option>
          {materials.map(material => (
            <option key={material} value={material}>
              {material}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Observações</span>
        <textarea value={input.observacao || ""} onChange={event => update("observacao", event.target.value)} rows={3} />
      </label>
      <div className="form-actions">
        <button type="button" className="cancel-action" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" className="primary-action" disabled={!valid || saving}>
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}

export function NewOrderForm({
  clients,
  products,
  materials,
  saving,
  onSave,
  onCancel,
}: {
  clients: string[];
  products: string[];
  materials: string[];
  saving: boolean;
  onSave: (input: Omit<Order, "id">) => void;
  onCancel: () => void;
}) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });
  const [input, setInput] = useState<Omit<Order, "id">>({
    data: today,
    numeroPedido: "",
    numeroOp: "",
    cliente: "",
    descricaoItem: "",
    quantidade: "",
    categoriaProduto: "NAO_CLASSIFICADO",
    material: "",
    observacao: "",
    statusProducao: "AGUARDANDO PROGRAMAÇÃO",
    tipoPrazo: "IMPRESSO_REPETICAO",
    dataChegadaCliche: "",
  });
  const update = (field: keyof Omit<Order, "id">, value: string) => setInput(current => ({ ...current, [field]: value }));
  const valid = Boolean(input.data && input.cliente.trim() && input.descricaoItem.trim() && number(input.quantidade) > 0);

  const matchingClients = useMemo(() => {
    const q = input.cliente.trim().toLowerCase();
    if (!q) return [];
    return clients.filter(c => c.toLowerCase().includes(q) && c.toLowerCase() !== q).slice(0, 5);
  }, [input.cliente, clients]);

  const matchingProducts = useMemo(() => {
    const q = input.descricaoItem.trim().toLowerCase();
    if (!q) return [];
    return products.filter(p => p.toLowerCase().includes(q) && p.toLowerCase() !== q).slice(0, 5);
  }, [input.descricaoItem, products]);

  const isKnownClient = useMemo(() => {
    const q = input.cliente.trim().toLowerCase();
    return q && clients.some(c => c.toLowerCase() === q);
  }, [input.cliente, clients]);

  const isKnownProduct = useMemo(() => {
    const q = input.descricaoItem.trim().toLowerCase();
    return q && products.some(p => p.toLowerCase() === q);
  }, [input.descricaoItem, products]);

  return (
    <form
      className="new-order-form"
      onSubmit={event => {
        event.preventDefault();
        if (valid && !saving) onSave(input);
      }}
    >
      <div className="form-grid">
        <label className="field">
          <span>Data do pedido *</span>
          <input type="date" value={input.data} onChange={event => update("data", event.target.value)} required />
        </label>
        <label className="field">
          <span>Nº do pedido</span>
          <input value={input.numeroPedido} onChange={event => update("numeroPedido", event.target.value)} placeholder="Ex.: 9479" />
        </label>
      </div>
      <label className="field">
        <span>Cliente *</span>
        <input
          list="clientes-cadastrados"
          value={input.cliente}
          onChange={event => update("cliente", event.target.value)}
          placeholder="Digite para buscar um cliente"
          autoComplete="off"
          required
        />
        <datalist id="clientes-cadastrados">
          {clients.map(client => (
            <option key={client} value={client} />
          ))}
        </datalist>
        {matchingClients.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded-md text-xs">
            <span className="text-slate-500 font-medium">Sugestões:</span>
            {matchingClients.map(clientName => (
              <button
                key={clientName}
                type="button"
                className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded border border-blue-200 transition-colors text-left"
                onClick={() => update("cliente", clientName)}
              >
                {clientName}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between text-xs mt-1">
          <small className="field-help">{clients.length} clientes cadastrados disponíveis</small>
          {isKnownClient && (
            <span className="text-emerald-700 font-medium">✓ Cliente cadastrado</span>
          )}
          {!isKnownClient && input.cliente.trim().length >= 3 && (
            <span className="text-amber-700 font-medium">+ Novo cliente (será salvo automaticamente)</span>
          )}
        </div>
      </label>
      <label className="field">
        <span>Produto / descrição do item *</span>
        <input
          list="produtos-cadastrados"
          value={input.descricaoItem}
          onChange={event => update("descricaoItem", event.target.value)}
          placeholder="Digite para buscar um produto"
          autoComplete="off"
          required
        />
        <datalist id="produtos-cadastrados">
          {products.map(product => (
            <option key={product} value={product} />
          ))}
        </datalist>
        {matchingProducts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded-md text-xs">
            <span className="text-slate-500 font-medium">Sugestões:</span>
            {matchingProducts.map(prodName => (
              <button
                key={prodName}
                type="button"
                className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded border border-blue-200 transition-colors text-left"
                onClick={() => update("descricaoItem", prodName)}
              >
                {prodName}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between text-xs mt-1">
          <small className="field-help">{products.length} produtos cadastrados disponíveis</small>
          {isKnownProduct && (
            <span className="text-emerald-700 font-medium">✓ Produto cadastrado</span>
          )}
          {!isKnownProduct && input.descricaoItem.trim().length >= 3 && (
            <span className="text-amber-700 font-medium">+ Novo produto (será salvo automaticamente)</span>
          )}
        </div>
      </label>
      <label className="field">
        <span>Categoria do produto *</span>
        <select value={input.categoriaProduto || "NAO_CLASSIFICADO"} onChange={event => update("categoriaProduto", event.target.value)}>
          {PRODUCT_CATEGORIES.map(item => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <div className="form-grid">
        <label className="field">
          <span>Quantidade do pedido (kg) *</span>
          <input inputMode="decimal" value={input.quantidade} onChange={event => update("quantidade", event.target.value)} placeholder="Ex.: 1.500" required />
        </label>
        <label className="field">
          <span>Número da OP</span>
          <input value={input.numeroOp} onChange={event => update("numeroOp", event.target.value)} placeholder="Opcional" />
        </label>
      </div>
      <div className="deadline-form-block">
        <p className="eyebrow">REGRA DE PRAZO</p>
        <label className="field">
          <span>Tipo do item *</span>
          <select value={input.tipoPrazo || "IMPRESSO_REPETICAO"} onChange={event => update("tipoPrazo", event.target.value)}>
            <option value="LISO">Liso — 20 dias após o pedido</option>
            <option value="IMPRESSO_REPETICAO">Impresso repetição — 30 dias após o pedido</option>
            <option value="IMPRESSO_NOVO">Impresso novo — 30 dias após a chegada do clichê</option>
          </select>
        </label>
        {input.tipoPrazo === "IMPRESSO_NOVO" && (
          <label className="field">
            <span>Data de chegada do clichê</span>
            <input type="date" value={input.dataChegadaCliche || ""} onChange={event => update("dataChegadaCliche", event.target.value)} />
            <small className="field-help">O prazo começará automaticamente quando esta data for informada.</small>
          </label>
        )}
      </div>
      <label className="field">
        <span>Material / estrutura</span>
        <select value={input.material} onChange={event => update("material", event.target.value)}>
          <option value="">Selecione o material</option>
          {materials.map(material => (
            <option key={material} value={material}>
              {material}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Observações</span>
        <textarea value={input.observacao} onChange={event => update("observacao", event.target.value)} placeholder="Informações importantes para o PCP" rows={3} />
      </label>
      <div className="form-status">
        <span className="status aguardando">Aguardando</span>
        <p>O novo pedido entrará automaticamente na lista de Programação PCP.</p>
      </div>
      <div className="form-actions">
        <button type="button" className="cancel-action" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" className="primary-action" disabled={!valid || saving}>
          {saving ? "Cadastrando..." : "Cadastrar pedido"}
        </button>
      </div>
    </form>
  );
}
