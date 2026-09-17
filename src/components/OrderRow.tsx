import React from "react";
import { Order, Totals, SECTORS } from "../types/forpack";
import { date, kg, number, group } from "../utils/formatters";

export function OrderRow({ order, totals, onOpen }: { order: Order; totals: Totals; onOpen: () => void; key?: string }) {
  const g = group(order.statusProducao);
  return (
    <tr>
      <td>
        <button className="order-id" onClick={onOpen}>
          Pedido {order.id}
        </button>
        <small className="cell-sub">
          {order.numeroOp ? `OP ${order.numeroOp} · ` : ""}
          {date(order.data)}
        </small>
      </td>
      <td>
        <strong>{order.cliente}</strong>
        <small className="cell-sub product-name">{order.descricaoItem}</small>
      </td>
      <td>
        <strong>{kg(number(order.quantidade))}</strong>
      </td>
      <td>
        <span className={`status ${g.replace(" ", "-").toLowerCase()}`}>{g}</span>
        <small className="cell-sub">{order.statusProducao || "Sem status definido"}</small>
      </td>
      <td>
        <div className="sector-values">
          {SECTORS.map(sector => (
            <span
              key={sector}
              className={totals[sector] ? "done" : ""}
              title={`${sector}: ${totals[sector] ? kg(totals[sector]) : "sem produção"}`}
            >
              <b>{totals[sector] ? totals[sector].toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}</b>
              <small>{sector.slice(0, 3)}</small>
            </span>
          ))}
        </div>
      </td>
      <td>
        <button className="more" onClick={onOpen} aria-label={`Mais opções para o pedido ${order.numeroPedido || order.id}`}>
          •••
        </button>
      </td>
    </tr>
  );
}
