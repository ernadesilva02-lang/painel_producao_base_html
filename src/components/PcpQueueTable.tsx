import React from "react";
import { Order, Machine, Production, ProductCategory, PRODUCT_CATEGORIES } from "../types/forpack";
import { date, kg, number, categoryLabel } from "../utils/formatters";

export function PcpCategorySummary({ items }: { items: { category: ProductCategory; label: string; orders: number; totalKg: number }[] }) {
  const totalKg = items.reduce((sum, item) => sum + item.totalKg, 0);
  const totalOrders = items.reduce((sum, item) => sum + item.orders, 0);
  if (!items.length) return null;
  return (
    <section className="pcp-category-summary" aria-label="Resumo da fila por categoria">
      <header>
        <div>
          <strong>Resumo por categoria</strong>
          <span>Quilos dos pedidos exibidos na fila</span>
        </div>
        <div className="pcp-category-total">
          <small>Total geral</small>
          <strong>{kg(totalKg)}</strong>
          <span>{totalOrders} pedido(s)</span>
        </div>
      </header>
      <div className="pcp-category-grid">
        {items.map(item => (
          <article key={item.category} className={`pcp-category-card category-${item.category.toLocaleLowerCase("pt-BR").replace(/_/g, "-")}`}>
            <span>{item.label}</span>
            <strong>{kg(item.totalKg)}</strong>
            <small>{item.orders} pedido(s)</small>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PcpQueueTable({
  orders,
  machines,
  records,
  selectedMachine,
  sortMode,
  saving,
  onMove,
  onOpen,
}: {
  orders: Order[];
  machines: Machine[];
  records: Production[];
  selectedMachine: string;
  sortMode: "Data" | "Manual";
  saving: boolean;
  onMove: (order: Order, direction: -1 | 1) => void;
  onOpen: (order: Order) => void;
}) {
  const machineOf = (order: Order) => machines.find(machine => machine.id === order.maquinaId);
  const machineSectorMap = new Map(machines.map(m => [m.id, m.setor.toUpperCase()]));

  // ✅ OPÇÃO B: Soma todos os apontamentos do pedido no SETOR da máquina atual
  const produced = (order: Order) => {
    const currentSector = machineOf(order)?.setor.toUpperCase();
    return records
      .filter(record => {
        const recSector = machineSectorMap.get(String(record.maquinaId || ""));
        const mesmoPedido =
          record.idPedido === order.id ||
          record.idPedido === order.numeroOp ||
          record.idPedido === order.numeroPedido;
        return mesmoPedido && (currentSector ? recSector === currentSector : record.maquinaId === order.maquinaId);
      })
      .reduce((sum, record) => sum + number(record.qtdProduzido), 0);
  };

  return (
    <div className="table-wrap pcp-queue-wrap">
      <table className="pcp-queue-table">
        <thead>
          <tr>
            <th>Ordem</th>
            <th>Data pedido</th>
            <th>OP / pedido</th>
            <th>Cliente</th>
            <th>Descrição</th>
            <th>Qtd.</th>
            <th className="queue-produced">Qtd. produzida</th>
            <th>Máquina / status</th>
            <th>Sequência</th>
            <th>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order, index) => {
            const machine = machineOf(order);
            const queue = orders.filter(item => item.maquinaId === order.maquinaId);
            const localIndex = queue.findIndex(item => item.id === order.id);
            return (
              <tr key={order.id}>
                <td>
                  <strong className="queue-position">
                    {selectedMachine === "Todas" ? "—" : `${index + 1}º`}
                  </strong>
                </td>
                <td>
                  <strong>{date(order.data)}</strong>
                </td>
                <td>
                  <button className="pcp-order-link" onClick={() => onOpen(order)}>
                    {order.numeroOp ? `OP ${order.numeroOp}` : "SEM OP"}
                  </button>
                  <small>{order.numeroPedido || order.id}</small>
                </td>
                <td>
                  <strong>{order.cliente || "—"}</strong>
                </td>
                <td title={order.descricaoItem || "Descrição não informada"}>
                  {order.descricaoItem || "—"}
                  <small className="category-pill">{categoryLabel(order)}</small>
                </td>
                <td>
                  <strong>{kg(number(order.quantidade))}</strong>
                </td>
                <td className="queue-produced">
                  <strong>{kg(produced(order))}</strong>
                </td>
                <td>
                  <strong>{machine?.name || order.maquinaId || "—"}</strong>
                  <small>{order.statusProducao || machine?.setor || "—"}</small>
                </td>
                <td>
                  <div className="queue-actions">
                    <button
                      title={sortMode === "Data" ? "Selecione Sequência manual para reordenar" : "Subir na fila"}
                      disabled={saving || sortMode === "Data" || selectedMachine === "Todas" || localIndex === 0}
                      onClick={() => onMove(order, -1)}
                    >
                      ▲
                    </button>
                    <button
                      title={sortMode === "Data" ? "Selecione Sequência manual para reordenar" : "Descer na fila"}
                      disabled={saving || sortMode === "Data" || selectedMachine === "Todas" || localIndex === queue.length - 1}
                      onClick={() => onMove(order, 1)}
                    >
                      ▼
                    </button>
                  </div>
                </td>
                <td className="queue-more-cell">
                  <button
                    className="more queue-more"
                    type="button"
                    title="Alterar máquina deste pedido"
                    aria-label={`Alterar máquina do pedido ${order.numeroPedido || order.numeroOp || order.id}`}
                    onClick={() => onOpen(order)}
                  >
                    •••
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!orders.length && <div className="empty">Nenhuma OP programada para os filtros selecionados.</div>}
    </div>
  );
}
