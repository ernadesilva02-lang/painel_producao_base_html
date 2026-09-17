import React from "react";
import { Production, Order, Machine } from "../types/forpack";
import { date, kg, number, group } from "../utils/formatters";
import { FileText, ArrowUpRight, Zap, Check, Pencil } from "lucide-react";

export function Metric({ label, value, detail, tone }: { label: string; value: number | string; detail: string; tone: string }) {
  const Icon = tone === "blue" ? FileText : tone === "green" ? ArrowUpRight : tone === "orange" ? Zap : Check;
  return (
    <article className={`metric ${tone}`}>
      <span className="metric-icon">
        <Icon size={20} strokeWidth={2.2} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

export function DailyLaunches({
  records,
  orders,
  machines,
  selectedDate,
  selectedMachine,
  onDate,
  onMachine,
  onOpen,
  onEditRecord,
}: {
  records: Production[];
  orders: Order[];
  machines: Machine[];
  selectedDate: string;
  selectedMachine: string;
  onDate: (value: string) => void;
  onMachine: (value: string) => void;
  onOpen: (order: Order) => void;
  onEditRecord?: (record: Production) => void;
}) {
  const produced = records.reduce((sum, record) => sum + number(record.qtdProduzido), 0);
  const scraps = records.reduce((sum, record) => sum + number(record.aparas), 0);
  const cuttings = records.reduce((sum, record) => sum + number(record.picote), 0);
  const operators = new Set(records.map(record => record.operador).filter(Boolean)).size;
  const orderOf = (record: Production) => orders.find(order => order.id === record.idPedido || order.numeroOp === record.idPedido);
  const machineOf = (record: Production) => machines.find(machine => machine.id === record.maquinaId);

  return (
    <section className="launches">
      <div className="dashboard-toolbar launch-toolbar">
        <div>
          <strong>{date(selectedDate)}</strong>
          <small>Resumo dos apontamentos selecionados</small>
        </div>
        <div className="dashboard-actions">
          <label>
            <span>Data</span>
            <input type="date" value={selectedDate} onChange={event => onDate(event.target.value)} />
          </label>
          <label>
            <span>Máquina</span>
            <select value={selectedMachine} onChange={event => onMachine(event.target.value)}>
              <option value="Todas">Todas as máquinas</option>
              {machines.map(machine => (
                <option key={machine.id} value={machine.id}>
                  {machine.name} · {machine.setor}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <section className="metrics launch-metrics">
        <Metric label="Apontamentos" value={records.length} detail="Registros no período" tone="blue" />
        <Metric label="Produção (kg)" value={Math.round(produced)} detail="Total produzido" tone="green" />
        <Metric label="Perdas (kg)" value={Math.round(scraps + cuttings)} detail={`Aparas ${kg(scraps)} · picote ${kg(cuttings)}`} tone="orange" />
        <Metric label="Operadores" value={operators} detail="Operadores com lançamento" tone="red" />
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">MOVIMENTAÇÃO REAL</p>
            <strong className="launch-title">Apontamentos registrados</strong>
          </div>
          <span className="status em-produção">{records.length} registro(s)</span>
        </div>
        <div className="table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>Data / turno</th>
                <th>Pedido / OP</th>
                <th>Máquina / setor</th>
                <th>Operador</th>
                <th>Produzido</th>
                <th>Perdas</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {records.map(record => {
                const order = orderOf(record);
                const machine = machineOf(record);
                return (
                  <tr key={record._key || record.id}>
                    <td>
                      <strong>{date(record.dataProducao)}</strong>
                      <small className="cell-sub">{record.turno || "Turno não informado"}</small>
                    </td>
                    <td>
                      <strong>
                        {order?.numeroOp ? `OP ${order.numeroOp}` : order?.numeroPedido ? `Pedido ${order.numeroPedido}` : record.idPedido}
                      </strong>
                      <small className="cell-sub">{record.cliente || order?.cliente || "—"}</small>
                    </td>
                    <td>
                      <strong>{machine?.name || record.maquinaId || "—"}</strong>
                      <small className="cell-sub">{machine?.setor || "Setor não identificado"}</small>
                    </td>
                    <td>
                      <strong>{record.operador || "—"}</strong>
                    </td>
                    <td>
                      <strong className="positive">{kg(number(record.qtdProduzido))}</strong>
                    </td>
                    <td>
                      <span>Aparas: {kg(number(record.aparas))}</span>
                      <small className="cell-sub">Picote: {kg(number(record.picote))}</small>
                    </td>
                    <td>
                      <div className="table-actions-cluster">
                        {onEditRecord && (
                          <button
                            type="button"
                            className="secondary edit-record-action"
                            onClick={() => onEditRecord(record)}
                            title="Editar apontamento"
                          >
                            <Pencil size={13} strokeWidth={2.4} />
                            <span>Editar</span>
                          </button>
                        )}
                        {order && group(order.statusProducao) === "Em produção" ? (
                          <button className="secondary" onClick={() => onOpen(order)}>
                            Novo lançamento
                          </button>
                        ) : (
                          <span className="cell-sub">OP fora da fila</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!records.length && <div className="empty">Nenhum lançamento encontrado para esta data e máquina.</div>}
        </div>
        <footer className="panel-foot">
          <span>
            {kg(produced)} produzidos · {kg(scraps + cuttings)} de perdas informadas
          </span>
          <span>Para correções, utilize Relatórios</span>
        </footer>
      </section>
    </section>
  );
}
