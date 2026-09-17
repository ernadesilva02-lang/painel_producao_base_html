import React from "react";
import { Printer, Download, Pencil } from "lucide-react";
import { Production, Order, Machine, SECTORS } from "../types/forpack";
import { date, number } from "../utils/formatters";

export function OrderWeightBalance({
  records,
  orders,
  machines,
  selectedOrder,
}: {
  records: Production[];
  orders: Order[];
  machines: Machine[];
  selectedOrder: string;
}) {
  const machineMap = new Map(machines.map(item => [item.id, item]));
  const orderAliases = new Map<string, Order>();
  orders.forEach(order => {
    orderAliases.set(order.id, order);
    if (order.numeroOp) orderAliases.set(order.numeroOp, order);
    if (order.numeroPedido) orderAliases.set(order.numeroPedido, order);
  });
  const grouped = new Map<string, Production[]>();
  records.forEach(record => {
    const rawId = String(record.idPedido || "");
    if (!rawId) return;
    const order = orderAliases.get(rawId);
    const key = order?.id || rawId;
    grouped.set(key, [...(grouped.get(key) || []), record]);
  });
  const balances = [...grouped.entries()]
    .map(([id, items]) => {
      const order = orderAliases.get(id) || orderAliases.get(String(items[0]?.idPedido || ""));
      const steps = SECTORS.map(sector => {
        const stageRecords = items.filter(record => machineMap.get(String(record.maquinaId || ""))?.setor.toUpperCase() === sector);
        const produced = stageRecords.reduce((sum, record) => sum + number(record.qtdProduzido), 0);
        const loss = stageRecords.reduce((sum, record) => sum + number(record.aparas) + number(record.picote), 0);
        return { sector, produced, loss, count: stageRecords.length };
      }).filter(step => step.count > 0 || step.produced > 0 || step.loss > 0);
      const first = steps[0];
      const last = steps[steps.length - 1];
      const detailed = steps.map((step, index) => {
        const previous = index ? steps[index - 1].produced : null;
        const difference = previous === null ? null : previous - step.produced - step.loss;
        return { ...step, input: previous ?? step.produced, difference };
      });
      const initial = first?.produced || 0;
      const final = last?.produced || 0;
      const realLoss = Math.max(0, initial - final);
      const declaredLoss = detailed.slice(1).reduce((sum, step) => sum + step.loss, 0);
      const divergence = detailed.slice(1).reduce((sum, step) => sum + Math.abs(step.difference || 0), 0);
      return { id, order, steps: detailed, initial, final, realLoss, declaredLoss, divergence, yieldRate: initial ? (final / initial) * 100 : 0 };
    })
    .filter(item => item.steps.length)
    .sort((a, b) => (a.order?.numeroOp || a.id).localeCompare(b.order?.numeroOp || b.id, "pt-BR", { numeric: true }));

  const format = (value: number) => value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const tolerance = 0.05;
  const focus = selectedOrder !== "Todas" && balances.length === 1 ? balances[0] : null;
  const totalInitial = balances.reduce((sum, item) => sum + item.initial, 0);
  const totalFinal = balances.reduce((sum, item) => sum + item.final, 0);
  const totalLoss = balances.reduce((sum, item) => sum + item.realLoss, 0);
  const divergent = balances.filter(item => item.divergence > tolerance).length;

  return (
    <section className="weight-balance">
      <div className="monthly-section-title balance-title">
        <div>
          <p className="eyebrow">RASTREABILIDADE DE PESO</p>
          <h2>Balanço do pedido por setor</h2>
        </div>
        <span>{selectedOrder === "Todas" ? `${balances.length} OP(s) analisada(s) no período` : "Ciclo completo da OP selecionada"}</span>
      </div>
      {!balances.length ? (
        <div className="balance-empty">Não há etapas suficientes para calcular o balanço de peso.</div>
      ) : (
        <>
          <div className="balance-kpis">
            <div>
              <small>PESO INICIAL EXTRUSADO</small>
              <strong>
                {format(totalInitial)} <em>kg</em>
              </strong>
            </div>
            <div>
              <small>PRODUÇÃO FINAL</small>
              <strong className="positive">
                {format(totalFinal)} <em>kg</em>
              </strong>
            </div>
            <div>
              <small>PERDA REAL NO PROCESSO</small>
              <strong className="loss">
                {format(totalLoss)} <em>kg</em>
              </strong>
              <span>
                {totalInitial ? ((totalLoss / totalInitial) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0,00"}%
                do peso inicial
              </span>
            </div>
            <div>
              <small>CONFERÊNCIA DE SALDO</small>
              <strong className={divergent ? "loss" : "positive"}>{divergent ? `${divergent} divergente(s)` : "Pesos conferidos"}</strong>
              <span>Tolerância de 0,05 kg por passagem</span>
            </div>
          </div>
          {focus ? (
            <article className="balance-flow-card">
              <header>
                <div>
                  <small>OP</small>
                  <strong>{focus.order?.numeroOp || focus.order?.numeroPedido || focus.id}</strong>
                  <span>{focus.order?.descricaoItem || focus.steps[0]?.sector}</span>
                </div>
                <div className={focus.divergence > tolerance ? "balance-status alert" : "balance-status ok"}>
                  {focus.divergence > tolerance ? "⚠ Verificar divergência" : "✓ Saldo conferido"}
                </div>
              </header>
              <div className="balance-flow">
                {focus.steps.map((step, index) => (
                  <div className="balance-stage-wrap" key={step.sector}>
                    {index > 0 && <span className="balance-arrow">→</span>}
                    <div className="balance-stage">
                      <small>{step.sector}</small>
                      <strong>{format(step.produced)} kg</strong>
                      <span>Perda: {format(step.loss)} kg</span>
                      {step.difference !== null && (
                        <b className={Math.abs(step.difference) <= tolerance ? "ok" : "alert"}>
                          {Math.abs(step.difference) <= tolerance ? "Saldo fechado" : `${step.difference > 0 ? "Falta" : "Excesso"}: ${format(Math.abs(step.difference))} kg`}
                        </b>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <footer>
                <span>
                  Inicial: <strong>{format(focus.initial)} kg</strong>
                </span>
                <span>
                  Final: <strong>{format(focus.final)} kg</strong>
                </span>
                <span>
                  Perda real: <strong>{format(focus.realLoss)} kg</strong>
                </span>
                <span>
                  Aproveitamento: <strong>{focus.yieldRate.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</strong>
                </span>
              </footer>
            </article>
          ) : (
            <article className="balance-list-card">
              <div className="monthly-table-wrap">
                <table className="balance-table">
                  <thead>
                    <tr>
                      <th>OP</th>
                      <th>PRODUTO</th>
                      <th>FLUXO REGISTRADO</th>
                      <th>PESO INICIAL</th>
                      <th>PRODUÇÃO FINAL</th>
                      <th>PERDA REAL</th>
                      <th>APROVEITAMENTO</th>
                      <th>CONFERÊNCIA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map(item => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.order?.numeroOp || item.order?.numeroPedido || item.id}</strong>
                        </td>
                        <td>{item.order?.descricaoItem || item.steps.map(step => step.sector).join(" → ")}</td>
                        <td>
                          <div className="mini-flow">
                            {item.steps.map(step => (
                              <span key={step.sector}>
                                {step.sector.slice(0, 3)} <b>{format(step.produced)}</b>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>{format(item.initial)} kg</td>
                        <td>{format(item.final)} kg</td>
                        <td className="loss-cell">{format(item.realLoss)} kg</td>
                        <td>{item.yieldRate.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>
                        <td>
                          <span className={item.divergence > tolerance ? "balance-pill alert" : "balance-pill ok"}>
                            {item.divergence > tolerance ? `Dif. ${format(item.divergence)} kg` : "Conferido"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer>
                Selecione uma OP no filtro acima para abrir o fluxo detalhado de todas as etapas, mesmo quando os lançamentos ocorreram em meses diferentes.
              </footer>
            </article>
          )}
        </>
      )}
    </section>
  );
}

export function MonthlyProductionReport({
  records,
  allRecords,
  orders,
  machines,
  operators,
  start,
  end,
  machine,
  operator,
  orderId,
  onEdit,
  onStart,
  onEnd,
  onMachine,
  onOperator,
  onOrder,
}: {
  records: Production[];
  allRecords: Production[];
  orders: Order[];
  machines: Machine[];
  operators: string[];
  start: string;
  end: string;
  machine: string;
  operator: string;
  orderId: string;
  onEdit?: (record: Production) => void;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
  onMachine: (value: string) => void;
  onOperator: (value: string) => void;
  onOrder: (value: string) => void;
}) {
  const machineMap = new Map(machines.map(item => [item.id, item]));
  const orderMap = new Map(orders.map(item => [item.id, item]));
  const format = (value: number) => value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const percent = (value: number, produced: number) => (produced ? (value / produced) * 100 : 0);

  const options = [...new Set(allRecords.map(record => record.idPedido).filter((value): value is string => Boolean(value)))]
    .map(id => {
      const order = orderMap.get(id);
      return { id, label: order?.numeroOp || order?.numeroPedido || id };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { numeric: true }));

  const sectors = SECTORS.map(sector => {
    const items = records.filter(record => machineMap.get(String(record.maquinaId || ""))?.setor.toUpperCase() === sector);
    return {
      sector,
      count: items.length,
      produced: items.reduce((sum, record) => sum + number(record.qtdProduzido), 0),
      scraps: items.reduce((sum, record) => sum + number(record.aparas), 0),
      cuttings: items.reduce((sum, record) => sum + number(record.picote), 0),
    };
  });

  const balanceRecords = orderId === "Todas" ? records : allRecords.filter(record => record.idPedido === orderId);

  const exportCsv = () => {
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines = [
      ["Data", "OP", "Produto", "Máquina", "Setor", "Operador", "Turno", "Produzido (kg)", "Aparas (kg)", "Picote / Refile (kg)", "Perdas (kg)"],
      ...records.map(record => {
        const order = orderMap.get(String(record.idPedido || ""));
        const machineInfo = machineMap.get(String(record.maquinaId || ""));
        return [
          date(record.dataProducao),
          order?.numeroOp || order?.numeroPedido || record.idPedido || "",
          record.descricaoItem || order?.descricaoItem || "",
          machineInfo?.name || record.maquinaId || "",
          machineInfo?.setor || "",
          record.operador || "",
          record.turno || "",
          format(number(record.qtdProduzido)),
          format(number(record.aparas)),
          format(number(record.picote)),
          format(number(record.aparas) + number(record.picote)),
        ];
      }),
    ];
    const csv = `\uFEFF${lines.map(line => line.map(value => escape(String(value))).join(";")).join("\r\n")}`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `relatorio-mensal-${start || "inicio"}-a-${end || "fim"}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <section className="monthly-report">
      <header className="monthly-print-heading">
        <div>
          <strong>FORPACK · GUAIÚBA</strong>
          <span>Relatório mensal de produção</span>
        </div>
        <div>
          <small>Período</small>
          <strong>
            {date(start)} a {date(end)}
          </strong>
        </div>
      </header>
      <div className="monthly-filter-card">
        <div className="monthly-filter-grid">
          <label>
            <span>DATA INICIAL</span>
            <input type="date" value={start} max={end || undefined} onChange={event => onStart(event.target.value)} />
          </label>
          <label>
            <span>DATA FINAL</span>
            <input type="date" value={end} min={start || undefined} onChange={event => onEnd(event.target.value)} />
          </label>
          <label>
            <span>MÁQUINA</span>
            <select value={machine} onChange={event => onMachine(event.target.value)}>
              <option value="Todas">Todas</option>
              {machines.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.setor}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>OPERADOR</span>
            <select value={operator} onChange={event => onOperator(event.target.value)}>
              <option value="Todos">Todos</option>
              {operators.map(item => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            <span>OP</span>
            <select value={orderId} onChange={event => onOrder(event.target.value)}>
              <option value="Todas">Todas</option>
              {options.map(item => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="monthly-filter-actions">
          <span>{records.length} lançamento(s) conforme os filtros</span>
          <button className="secondary monthly-print" onClick={() => window.print()} disabled={!records.length}>
            <Printer size={15} strokeWidth={2.4} /> IMPRIMIR RELATÓRIO
          </button>
          <button className="secondary monthly-export" onClick={exportCsv} disabled={!records.length}>
            <Download size={15} strokeWidth={2.4} /> EXPORTAR CSV
          </button>
        </div>
      </div>
      <div className="monthly-section-title">
        <div>
          <p className="eyebrow">ANÁLISE OPERACIONAL</p>
          <h2>Resumo geral por setor</h2>
        </div>
        <span>{records.length} lançamento(s)</span>
      </div>
      <div className="monthly-sector-grid">
        {sectors.map(item => {
          const losses = item.scraps + item.cuttings;
          return (
            <article
              className={`monthly-sector-card sector-${item.sector.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}
              key={item.sector}
            >
              <header>
                <h3>
                  Produção - {item.sector[0]}
                  {item.sector.slice(1).toLowerCase()}
                </h3>
                <span>{item.count} lançamento(s)</span>
              </header>
              <div className={item.sector === "REBOBINADEIRA" ? "monthly-sector-values three" : "monthly-sector-values"}>
                <div>
                  <small>PRODUÇÃO</small>
                  <strong>
                    {format(item.produced)} <em>kg</em>
                  </strong>
                  <span>Total do setor</span>
                </div>
                <div>
                  <small>{item.sector === "REBOBINADEIRA" ? "APARAS" : "PERDAS TOTAIS"}</small>
                  <strong className="loss">
                    {format(item.sector === "REBOBINADEIRA" ? item.scraps : losses)} <em>kg</em>
                  </strong>
                  <span>{percent(item.sector === "REBOBINADEIRA" ? item.scraps : losses, item.produced).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% da produção</span>
                </div>
                {item.sector === "REBOBINADEIRA" && (
                  <div>
                    <small>PICOTE / REFILE</small>
                    <strong className="loss">
                      {format(item.cuttings)} <em>kg</em>
                    </strong>
                    <span>{percent(item.cuttings, item.produced).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% refilado</span>
                  </div>
                )}
              </div>
              {item.sector === "REBOBINADEIRA" && (
                <footer>
                  Perdas totais: {format(losses)} kg ·{" "}
                  {percent(losses, item.produced).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                </footer>
              )}
            </article>
          );
        })}
      </div>
      <OrderWeightBalance records={balanceRecords} orders={orders} machines={machines} selectedOrder={orderId} />
      <article className="monthly-detail-card">
        <header>
          <div>
            <p className="eyebrow">DETALHAMENTO</p>
            <h2>Apontamentos filtrados</h2>
          </div>
          <span>{records.length} registro(s)</span>
        </header>
        <div className="monthly-table-wrap">
          <table className="monthly-table">
            <thead>
              <tr>
                <th>DATA</th>
                <th>OP</th>
                <th>PRODUTO</th>
                <th>MÁQUINA</th>
                <th>OPERADOR</th>
                <th>TURNO</th>
                <th>PRODUZIDO</th>
                <th>APARAS</th>
                <th>PICOTE / REFILE</th>
                <th>PERDAS</th>
                {onEdit && <th>AÇÃO</th>}
              </tr>
            </thead>
            <tbody>
              {records.map(record => {
                const order = orderMap.get(String(record.idPedido || ""));
                const machineInfo = machineMap.get(String(record.maquinaId || ""));
                const scraps = number(record.aparas);
                const cuttings = number(record.picote);
                return (
                  <tr key={record._key || record.id}>
                    <td>{date(record.dataProducao)}</td>
                    <td>
                      <strong>{order?.numeroOp || order?.numeroPedido || record.idPedido || "—"}</strong>
                    </td>
                    <td>{record.descricaoItem || order?.descricaoItem || "—"}</td>
                    <td>{machineInfo?.name || record.maquinaId || "—"}</td>
                    <td>{record.operador || "—"}</td>
                    <td>{record.turno || "—"}</td>
                    <td>{format(number(record.qtdProduzido))}</td>
                    <td>{format(scraps)}</td>
                    <td>{format(cuttings)}</td>
                    <td>
                      <strong>{format(scraps + cuttings)}</strong>
                    </td>
                    {onEdit && (
                      <td>
                        <button
                          type="button"
                          className="secondary edit-record-action"
                          onClick={() => onEdit(record)}
                          title="Editar este apontamento"
                        >
                          <Pencil size={13} strokeWidth={2.4} />
                          <span>Editar</span>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!records.length && <div className="empty">Nenhum apontamento encontrado para os filtros informados.</div>}
        </div>
      </article>
      <footer className="monthly-report-footer">
        <span>FORPACK · GUAIÚBA — Painel de Produção</span>
        <strong>
          Período: {date(start)} a {date(end)} · {records.length} registro(s)
        </strong>
      </footer>
    </section>
  );
}
