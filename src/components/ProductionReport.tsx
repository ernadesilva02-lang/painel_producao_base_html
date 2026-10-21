import React, { useMemo } from "react";
import { Pencil, Trash2, AlertTriangle } from "lucide-react";
import { Production, Order, Machine } from "../types/forpack";
import { date, kg, number } from "../utils/formatters";

export function ProductionReport({
  records,
  orders,
  machines,
  onEdit,
  onDelete,
}: {
  records: Production[];
  orders: Order[];
  machines: Machine[];
  onEdit: (record: Production) => void;
  onDelete?: (record: Production) => void;
}) {
  const orderOf = (record: Production) => orders.find(order => order.id === record.idPedido || order.numeroOp === record.idPedido);
  const machineOf = (record: Production) => machines.find(machine => machine.id === record.maquinaId);

  // Mapeia apontamentos com a mesma OP, mesma data, mesma máquina e mesmo peso para alertar duplicidade
  const duplicateCounts = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach(r => {
      const key = `${r.idPedido || ""}|${r.dataProducao || ""}|${r.maquinaId || ""}|${Number(r.qtdProduzido).toFixed(1)}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [records]);

  const hasDuplicates = useMemo(() => {
    return Array.from(duplicateCounts.values()).some((count: number) => count > 1);
  }, [duplicateCounts]);

  return (
    <div className="table-wrap">
      {hasDuplicates && (
        <div style={{
          backgroundColor: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: "8px",
          padding: "10px 14px",
          marginBottom: "12px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          color: "#92400e",
          fontSize: "12px"
        }}>
          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
          <span>
            <strong>Atenção:</strong> Foram detectados apontamentos com OP, máquina, data e peso idênticos (duplicidades). Você pode utilizar o botão <strong>Excluir</strong> na linha duplicada para regularizar o histórico.
          </span>
        </div>
      )}

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
            const dupKey = `${record.idPedido || ""}|${record.dataProducao || ""}|${record.maquinaId || ""}|${Number(record.qtdProduzido).toFixed(1)}`;
            const isDuplicate = (duplicateCounts.get(dupKey) || 0) > 1;

            return (
              <tr key={record._key || record.id} style={isDuplicate ? { backgroundColor: "#fffdf5" } : undefined}>
                <td>
                  <strong>{date(record.dataProducao)}</strong>
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <strong>
                      {order?.numeroOp ? `OP ${order.numeroOp}` : order?.numeroPedido ? `Pedido ${order.numeroPedido}` : record.idPedido}
                    </strong>
                    {isDuplicate && (
                      <span
                        title="Este lançamento possui dados idênticos a outro no mesmo período"
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          color: "#b45309",
                          backgroundColor: "#fef3c7",
                          border: "1px solid #fde68a",
                          padding: "1px 6px",
                          borderRadius: "4px",
                        }}
                      >
                        Duplicado
                      </span>
                    )}
                  </div>
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
                <td className="action-col">
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <button type="button" className="secondary edit-record-action" onClick={() => onEdit(record)}>
                      <Pencil size={13} strokeWidth={2.4} />
                      <span>Editar</span>
                    </button>
                    {onDelete && (
                      <button
                        type="button"
                        className="secondary edit-record-action"
                        style={{ color: "#dc2626", borderColor: isDuplicate ? "#fca5a5" : "#fecaca", backgroundColor: isDuplicate ? "#fef2f2" : undefined }}
                        onClick={() => onDelete(record)}
                        title="Excluir este apontamento"
                      >
                        <Trash2 size={13} strokeWidth={2.4} />
                        <span>Excluir</span>
                      </button>
                    )}
                  </div>
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
