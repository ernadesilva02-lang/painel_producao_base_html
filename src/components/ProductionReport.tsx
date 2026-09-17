import React from "react";
import { Pencil } from "lucide-react";
import { Production, Order, Machine } from "../types/forpack";
import { date, kg, number } from "../utils/formatters";

export function ProductionReport({
  records,
  orders,
  machines,
  onEdit,
}: {
  records: Production[];
  orders: Order[];
  machines: Machine[];
  onEdit: (record: Production) => void;
}) {
  const orderOf = (record: Production) => orders.find(order => order.id === record.idPedido || order.numeroOp === record.idPedido);
  const machineOf = (record: Production) => machines.find(machine => machine.id === record.maquinaId);

  return (
    <div className="table-wrap">
      <table className="report-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Pedido / OP</th>
            <th>Máquina / setor</th>
            <th>Operador / turno</th>
            <th>Produzido</th>
            <th>Perdas</th>
            <th className="action-col">Ações</th>
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
                  <small className="cell-sub">{record.turno || "Turno não informado"}</small>
                </td>
                <td>
                  <strong className="positive">{kg(number(record.qtdProduzido))}</strong>
                </td>
                <td>
                  <span>Aparas: {kg(number(record.aparas))}</span>
                  <small className="cell-sub">Picote: {kg(number(record.picote))}</small>
                </td>
                <td>
                  <button type="button" className="secondary edit-record-action" onClick={() => onEdit(record)}>
                    <Pencil size={13} strokeWidth={2.4} />
                    <span>Editar</span>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!records.length && <div className="empty">Nenhum apontamento encontrado para os filtros informados.</div>}
    </div>
  );
}
