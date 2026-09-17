import React from "react";
import { Production, Machine, SECTORS } from "../types/forpack";
import { kg, number } from "../utils/formatters";
import { Metric } from "./DailyLaunches";

export function MonthlyDashboard({
  records,
  machines,
  month,
  onMonth,
}: {
  records: Production[];
  machines: Machine[];
  month: string;
  onMonth: (value: string) => void;
}) {
  const machineMap = new Map(machines.map(machine => [machine.id, machine]));
  const produced = records.reduce((sum, record) => sum + number(record.qtdProduzido), 0);
  const scraps = records.reduce((sum, record) => sum + number(record.aparas) + number(record.picote), 0);
  const totalInput = produced + scraps;
  const yieldRate = totalInput ? (produced / totalInput) * 100 : 0;
  const days = new Set(records.map(record => record.dataProducao).filter(Boolean)).size;

  const sectors = SECTORS.map(sector => {
    const items = records.filter(record => machineMap.get(String(record.maquinaId || ""))?.setor.toUpperCase() === sector);
    return {
      sector,
      produced: items.reduce((sum, record) => sum + number(record.qtdProduzido), 0),
      scraps: items.reduce((sum, record) => sum + number(record.aparas) + number(record.picote), 0),
      records: items.length,
    };
  });

  const maxSector = Math.max(...sectors.map(item => item.produced), 1);
  const machineRanking = machines
    .map(machine => {
      const items = records.filter(record => record.maquinaId === machine.id);
      return { machine, produced: items.reduce((sum, record) => sum + number(record.qtdProduzido), 0), records: items.length };
    })
    .filter(item => item.records)
    .sort((a, b) => b.produced - a.produced)
    .slice(0, 6);

  const monthLabel = month
    ? new Date(`${month}-02T12:00:00`)
        .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
        .replace(/(^|\s)\S/g, l => l.toUpperCase())
    : "Período";

  return (
    <section className="dashboard">
      <div className="dashboard-toolbar">
        <div>
          <strong>Resumo De {monthLabel}</strong>
          <small>Atualizado pelos apontamentos de produção</small>
        </div>
        <div className="dashboard-actions">
          <label>
            <span>MÊS DE REFERÊNCIA</span>
            <input type="month" value={month} onChange={event => onMonth(event.target.value)} />
          </label>
          <button className="secondary" onClick={() => window.print()}>
            Imprimir resumo
          </button>
        </div>
      </div>
      <div className="metrics dashboard-metrics">
        <Metric label="Produção do mês" value={Math.round(produced)} detail={`${records.length} apontamentos`} tone="blue" />
        <Metric label="Perdas registradas" value={Math.round(scraps)} detail="Aparas + picote (kg)" tone="red" />
        <Metric label="Aproveitamento" value={Number(yieldRate.toFixed(1))} detail="Produzido ÷ total processado (%)" tone="green" />
        <Metric label="Dias com produção" value={days} detail="Dias com apontamento" tone="orange" />
      </div>
      <div className="dashboard-grid">
        <article className="dashboard-card sector-card">
          <header>
            <div>
              <p className="eyebrow">VOLUME</p>
              <h2>Produção por setor</h2>
            </div>
            <span>{kg(produced)}</span>
          </header>
          <div className="sector-chart">
            {sectors.map(item => (
              <div className="bar-row" key={item.sector}>
                <div className="bar-label">
                  <strong>{item.sector}</strong>
                  <small>{item.records} lançamento(s)</small>
                </div>
                <div className="bar-track">
                  <span style={{ width: `${(item.produced / maxSector) * 100}%` }} />
                </div>
                <b>{kg(item.produced)}</b>
              </div>
            ))}
          </div>
        </article>
        <article className="dashboard-card">
          <header>
            <div>
              <p className="eyebrow">DESEMPENHO</p>
              <h2>Máquinas com maior produção</h2>
            </div>
          </header>
          <div className="ranking">
            {machineRanking.map((item, index) => (
              <div key={item.machine.id}>
                <span>{index + 1}</span>
                <p>
                  <strong>{item.machine.name}</strong>
                  <small>
                    {item.machine.setor} · {item.records} lançamento(s)
                  </small>
                </p>
                <b>{kg(item.produced)}</b>
              </div>
            ))}
            {!machineRanking.length && <div className="dashboard-empty">Sem apontamentos neste mês.</div>}
          </div>
        </article>
        <article className="dashboard-card loss-card">
          <header>
            <div>
              <p className="eyebrow">PERDAS</p>
              <h2>Aparas e picote por setor</h2>
            </div>
          </header>
          <div className="loss-grid">
            {sectors.map(item => (
              <div key={item.sector}>
                <small>{item.sector}</small>
                <strong>{kg(item.scraps)}</strong>
                <span>
                  {item.produced + item.scraps ? ((item.scraps / (item.produced + item.scraps)) * 100).toFixed(1) : "0,0"}% do
                  processado
                </span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
