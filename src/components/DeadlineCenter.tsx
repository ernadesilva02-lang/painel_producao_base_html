import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { Order, Production, Machine, SECTORS } from "../types/forpack";
import { date, kg, number, deadlineOf, addCalendarDays, group } from "../utils/formatters";

export function DeadlineCenter({
  orders,
  records,
  machines,
  onOpen,
}: {
  orders: Order[];
  records: Production[];
  machines: Machine[];
  onOpen: (order: Order) => void;
}) {
  const [risk, setRisk] = useState("Todos");
  const [term, setTerm] = useState("");
  const [capacityMachine, setCapacityMachine] = useState("");
  const [dailyCapacity, setDailyCapacity] = useState(2500);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });
  const dayMs = 86400000;
  const diffDays = (value: string) => Math.round((Date.parse(`${value}T12:00:00`) - Date.parse(`${today}T12:00:00`)) / dayMs);
  const machineMap = new Map(machines.map(machine => [machine.id, machine]));
  const scheduledMachines = machines.filter(machine => orders.some(order => order.maquinaId === machine.id));

  useEffect(() => {
    if (capacityMachine && machines.some(machine => machine.id === capacityMachine)) return;
    const ef1 = machines.find(machine => machine.name.toLocaleUpperCase("pt-BR").includes("EF1"));
    setCapacityMachine(ef1?.id || scheduledMachines[0]?.id || "");
  }, [capacityMachine, machines, scheduledMachines]);

  const analysis = orders
    .map(order => {
      const orderRecords = records.filter(
        record => record.idPedido === order.id || record.idPedido === order.numeroOp || record.idPedido === order.numeroPedido
      );
      const sorted = [...orderRecords].sort((a, b) => (b.dataProducao || "").localeCompare(a.dataProducao || ""));
      const last = sorted[0];
      const deadline = deadlineOf(order);
      const remaining = deadline.due ? diffDays(deadline.due) : null;
      const idleDays = last?.dataProducao ? Math.max(0, -diffDays(last.dataProducao)) : null;
      const lastMachine = last ? machineMap.get(String(last.maquinaId || "")) : undefined;
      const currentMachine = machineMap.get(String(order.maquinaId || ""));
      const stage =
        lastMachine?.setor || currentMachine?.setor || (group(order.statusProducao) === "Aguardando" ? "AGUARDANDO PCP" : group(order.statusProducao).toUpperCase());
      const stageWeight = lastMachine
        ? orderRecords.filter(record => machineMap.get(String(record.maquinaId || ""))?.setor === lastMachine.setor).reduce((sum, record) => sum + number(record.qtdProduzido), 0)
        : 0;
      const category = deadline.waiting
        ? "Aguardando clichê"
        : remaining! < 0
        ? "Atrasados"
        : remaining === 0
        ? "Vence hoje"
        : remaining! <= 7
        ? "Próximos 7 dias"
        : idleDays === null || idleDays >= 3
        ? "Sem movimentação"
        : "No prazo";
      const urgency = deadline.waiting ? 3 : remaining! < 0 ? 0 : remaining === 0 ? 1 : remaining! <= 7 ? 2 : idleDays === null || idleDays >= 3 ? 4 : 5;
      const touchedSectors = SECTORS.filter(sector => orderRecords.some(record => machineMap.get(String(record.maquinaId || ""))?.setor.toUpperCase() === sector));
      const progress = Math.round((touchedSectors.length / SECTORS.length) * 100);
      const action = deadline.waiting
        ? { label: "Confirmar chegada do clichê", reason: "O prazo de 30 dias ainda não começou", tone: "waiting" }
        : !order.maquinaId && !orderRecords.length
        ? { label: "Programar pedido no PCP", reason: "Pedido ainda sem máquina e sem produção", tone: "late" }
        : !orderRecords.length
        ? { label: "Iniciar produção", reason: "Pedido programado, mas sem apontamento", tone: "today" }
        : idleDays !== null && idleDays >= 3
        ? { label: "Retomar etapa parada", reason: `Sem movimentação há ${idleDays} dia(s)`, tone: "late" }
        : remaining !== null && remaining < 0
        ? { label: "Priorizar conclusão", reason: `Prazo vencido há ${Math.abs(remaining)} dia(s)`, tone: "late" }
        : remaining !== null && remaining <= 7
        ? { label: "Garantir próxima etapa", reason: remaining === 0 ? "Prazo vence hoje" : `Restam ${remaining} dia(s)`, tone: "today" }
        : { label: "Manter acompanhamento", reason: "Fluxo dentro do prazo calculado", tone: "normal" };
      return { order, deadline, remaining, idleDays, lastDate: last?.dataProducao || "", stage, stageWeight, category, urgency, touchedSectors, progress, action };
    })
    .sort((a, b) => a.urgency - b.urgency || (a.remaining ?? 99999) - (b.remaining ?? 99999) || (a.order.data || "").localeCompare(b.order.data || ""));

  const counts = {
    late: analysis.filter(item => item.remaining !== null && item.remaining < 0).length,
    today: analysis.filter(item => item.remaining === 0).length,
    soon: analysis.filter(item => item.remaining !== null && item.remaining > 0 && item.remaining <= 7).length,
    idle: analysis.filter(item => item.idleDays === null || item.idleDays >= 3).length,
    cliche: analysis.filter(item => item.deadline.waiting).length,
  };

  const clean = term.toLocaleLowerCase("pt-BR").trim();
  const visible = analysis.filter(
    item =>
      (risk === "Todos" || item.category === risk) &&
      (!clean || `${item.order.numeroPedido || ""} ${item.order.numeroOp || ""} ${item.order.cliente} ${item.order.descricaoItem}`.toLocaleLowerCase("pt-BR").includes(clean))
  );

  const priorityActions = analysis.filter(item => item.action.tone !== "normal").slice(0, 3);
  const selectedCapacityMachine = machineMap.get(capacityMachine);
  const machineQueue = orders
    .filter(order => order.maquinaId === capacityMachine)
    .sort((a, b) => (a.data || "").localeCompare(b.data || "") || (a.ordemFila ?? 999999) - (b.ordemFila ?? 999999));

  const queueWithBalance = machineQueue
    .map(order => {
      const produced = records
        .filter(record => record.maquinaId === capacityMachine && (record.idPedido === order.id || record.idPedido === order.numeroOp || record.idPedido === order.numeroPedido))
        .reduce((sum, record) => sum + number(record.qtdProduzido), 0);
      return { order, produced, balance: Math.max(0, number(order.quantidade) - produced) };
    })
    .filter(item => item.balance > 0);

  const totalQueueKg = queueWithBalance.reduce((sum, item) => sum + item.balance, 0);
  const capacity = Math.max(1, dailyCapacity || 0);
  const capacityDays: { date: string; planned: number; allocations: { order: Order; kg: number; balanceAfter: number }[] }[] = [];
  let planDate = today;
  let dayIndex = 0;

  for (const item of queueWithBalance) {
    let remaining = item.balance;
    while (remaining > 0 && dayIndex < 180) {
      if (!capacityDays[dayIndex]) capacityDays[dayIndex] = { date: planDate, planned: 0, allocations: [] };
      const currentDay = capacityDays[dayIndex];
      const available = Math.max(0, capacity - currentDay.planned);
      if (available <= 0) {
        dayIndex += 1;
        planDate = addCalendarDays(today, dayIndex);
        continue;
      }
      const allocated = Math.min(remaining, available);
      remaining -= allocated;
      currentDay.planned += allocated;
      currentDay.allocations.push({ order: item.order, kg: allocated, balanceAfter: remaining });
      if (currentDay.planned >= capacity) {
        dayIndex += 1;
        planDate = addCalendarDays(today, dayIndex);
      }
    }
  }

  return (
    <section className="deadline-center">
      <div className="deadline-kpis">
        <button className="deadline-kpi late" onClick={() => setRisk("Atrasados")}>
          <span>!</span>
          <div>
            <small>Pedidos atrasados</small>
            <strong>{counts.late}</strong>
            <em>Exigem ação imediata</em>
          </div>
        </button>
        <button className="deadline-kpi today" onClick={() => setRisk("Vence hoje")}>
          <span>
            <Clock size={18} strokeWidth={2.4} />
          </span>
          <div>
            <small>Vencem hoje</small>
            <strong>{counts.today}</strong>
            <em>Prazo no dia atual</em>
          </div>
        </button>
        <button className="deadline-kpi soon" onClick={() => setRisk("Próximos 7 dias")}>
          <span>7</span>
          <div>
            <small>Próximos 7 dias</small>
            <strong>{counts.soon}</strong>
            <em>Antecipar a programação</em>
          </div>
        </button>
        <button className="deadline-kpi idle" onClick={() => setRisk("Sem movimentação")}>
          <span>―</span>
          <div>
            <small>Sem movimentação</small>
            <strong>{counts.idle}</strong>
            <em>3 dias ou sem apontamento</em>
          </div>
        </button>
        <button className="deadline-kpi cliche" onClick={() => setRisk("Aguardando clichê")}>
          <span>C</span>
          <div>
            <small>Aguardando clichê</small>
            <strong>{counts.cliche}</strong>
            <em>Prazo ainda não iniciado</em>
          </div>
        </button>
      </div>

      <section className="capacity-planner">
        <header>
          <div>
            <p className="eyebrow">PLANEJAMENTO POR CAPACIDADE</p>
            <h2>Agenda diária da máquina</h2>
            <span>Distribuição automática da fila por volume disponível em 24 horas</span>
          </div>
          <div className="capacity-controls">
            <label>
              <span>Máquina</span>
              <select value={capacityMachine} onChange={event => setCapacityMachine(event.target.value)}>
                {scheduledMachines.map(machine => (
                  <option key={machine.id} value={machine.id}>
                    {machine.name} · {machine.setor}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Capacidade em 24h</span>
              <div>
                <input type="number" min="1" step="100" value={dailyCapacity} onChange={event => setDailyCapacity(Math.max(1, Number(event.target.value) || 1))} />
                <b>kg</b>
              </div>
            </label>
          </div>
        </header>
        <div className="capacity-summary">
          <article>
            <small>Máquina selecionada</small>
            <strong>{selectedCapacityMachine?.name || "Sem máquina"}</strong>
            <span>{selectedCapacityMachine?.setor || "Selecione uma máquina programada"}</span>
          </article>
          <article>
            <small>Pedidos na fila</small>
            <strong>{queueWithBalance.length}</strong>
            <span>Com saldo a produzir</span>
          </article>
          <article>
            <small>Carga programada</small>
            <strong>{kg(totalQueueKg)}</strong>
            <span>Saldo da fila selecionada</span>
          </article>
          <article>
            <small>Previsão de conclusão</small>
            <strong>{capacityDays.length ? date(capacityDays[capacityDays.length - 1].date) : "—"}</strong>
            <span>{capacityDays.length} dia(s) de produção</span>
          </article>
        </div>
        <div className="capacity-days">
          {capacityDays.map((day, index) => {
            const utilization = Math.min(100, (day.planned / capacity) * 100);
            const dayDate = new Date(`${day.date}T12:00:00`);
            return (
              <article className="capacity-day" key={day.date}>
                <header>
                  <div>
                    <small>Dia {index + 1}</small>
                    <strong>
                      {dayDate
                        .toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })
                        .replace(/(^|\s|-)\S/g, l => l.toUpperCase())}
                    </strong>
                  </div>
                  <span>{utilization.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% ocupado</span>
                </header>
                <div className="capacity-bar">
                  <i style={{ width: `${utilization}%`, backgroundColor: index % 2 === 0 ? "#0284c7" : "#059669" }} />
                </div>
                <div className="capacity-day-total">
                  <strong>{kg(day.planned)}</strong>
                  <span>de {kg(capacity)}</span>
                </div>
                <div className="capacity-orders">
                  {day.allocations.map((allocation, allocationIndex) => (
                    <button key={`${allocation.order.id}-${allocationIndex}`} onClick={() => onOpen(allocation.order)}>
                      <span>
                        <b>{allocation.order.numeroOp ? `OP ${allocation.order.numeroOp}` : allocation.order.numeroPedido || "Pedido"}</b>
                        <small>{allocation.order.cliente}</small>
                      </span>
                      <div className="allocation-val">
                        <strong>{kg(allocation.kg)}</strong>
                        {allocation.balanceAfter > 0 && <em>continua →</em>}
                      </div>
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
          {!capacityDays.length && <div className="capacity-empty">Não há saldo programado para a máquina selecionada.</div>}
        </div>
        <footer>
          <span>Início: hoje · operação contínua em dias corridos</span>
          <span>Ordem usada: pedido mais antigo primeiro</span>
        </footer>
      </section>

      {!!priorityActions.length && (
        <div className="deadline-action-board">
          <header>
            <div>
              <p className="eyebrow">PLANO DO DIA</p>
              <h2>Próximas ações recomendadas</h2>
            </div>
            <span>Gerado automaticamente pelos prazos e movimentações</span>
          </header>
          <div>
            {priorityActions.map((item, index) => (
              <button key={item.order.id} onClick={() => onOpen(item.order)}>
                <b>{index + 1}</b>
                <span>
                  <small>{item.order.numeroOp ? `OP ${item.order.numeroOp}` : item.order.numeroPedido || "Pedido"}</small>
                  <strong>{item.action.label}</strong>
                  <em>{item.action.reason}</em>
                </span>
                <i>Ver OP →</i>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="deadline-panel">
        <header>
          <div>
            <p className="eyebrow">FILA PRIORIZADA</p>
            <h2>Pedidos que precisam de atenção</h2>
          </div>
          <div className="deadline-controls">
            <div className="tabs">
              {["Todos", "Atrasados", "Vence hoje", "Próximos 7 dias", "Aguardando clichê", "Sem movimentação"].map(item => (
                <button key={item} className={risk === item ? "tab active" : "tab"} onClick={() => setRisk(item)}>
                  {item}
                </button>
              ))}
            </div>
            <label className="search">
              <span>⌕</span>
              <input value={term} onChange={event => setTerm(event.target.value)} placeholder="Buscar pedido, OP ou cliente" />
            </label>
          </div>
        </header>
        <div className="table-wrap">
          <table className="deadline-table">
            <thead>
              <tr>
                <th>Prioridade</th>
                <th>Pedido / OP</th>
                <th>Cliente e produto</th>
                <th>Prazo</th>
                <th>Etapa atual</th>
                <th>Avanço</th>
                <th>Última movimentação</th>
                <th>Produzido na etapa</th>
                <th>Ação recomendada</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(item => (
                <tr key={item.order.id} onClick={() => onOpen(item.order)} title="Clique para abrir detalhes do pedido / OP">
                  <td>
                    <span
                      className={`deadline-pill ${
                        item.deadline.waiting
                          ? "waiting"
                          : item.remaining! < 0
                          ? "late"
                          : item.remaining === 0
                          ? "today"
                          : item.remaining! <= 7
                          ? "soon"
                          : "normal"
                      }`}
                    >
                      {item.deadline.waiting
                        ? "Aguardando clichê"
                        : item.remaining! < 0
                        ? `${Math.abs(item.remaining!)} dia(s) atrasado`
                        : item.remaining === 0
                        ? "Vence hoje"
                        : `${item.remaining} dia(s)`}
                    </span>
                  </td>
                  <td>
                    <strong>{item.order.numeroPedido || item.order.id}</strong>
                    <small>{item.order.numeroOp ? `OP ${item.order.numeroOp}` : "OP não emitida"}</small>
                  </td>
                  <td>
                    <strong>{item.order.cliente}</strong>
                    <small>{item.order.descricaoItem}</small>
                  </td>
                  <td>
                    <strong>{item.deadline.due ? date(item.deadline.due) : "Prazo não iniciado"}</strong>
                    <small>{item.deadline.label}</small>
                    {item.deadline.legacy && <small className="deadline-confirm">Editar pedido para confirmar</small>}
                  </td>
                  <td>
                    <strong>{item.stage}</strong>
                    <small>{item.order.maquinaId ? machineMap.get(item.order.maquinaId)?.name || "Máquina não identificada" : "Sem máquina programada"}</small>
                  </td>
                  <td>
                    <div className="deadline-progress">
                      <span>
                        <i style={{ width: `${item.progress}%` }} />
                      </span>
                      <strong>{item.touchedSectors.length} setor(es) com registro</strong>
                    </div>
                  </td>
                  <td>
                    <strong>{item.lastDate ? date(item.lastDate) : "Sem apontamento"}</strong>
                    <small>{item.idleDays === null ? "Aguardando início" : item.idleDays === 0 ? "Movimentado hoje" : `Há ${item.idleDays} dia(s)`}</small>
                  </td>
                  <td>
                    <strong className="deadline-weight">{item.stageWeight ? kg(item.stageWeight) : "—"}</strong>
                    <small>Pedido: {kg(number(item.order.quantidade))}</small>
                  </td>
                  <td>
                    <span className={`deadline-action ${item.action.tone}`}>
                      <strong>{item.action.label}</strong>
                      <small>{item.action.reason}</small>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length && <div className="empty">Nenhum pedido encontrado neste filtro.</div>}
        </div>
        <footer>
          <span>{visible.length} pedido(s) nesta visualização</span>
          <span>Ordenação automática: atraso → vencimento → falta de movimentação</span>
        </footer>
      </div>
    </section>
  );
}
