import React from "react";
import { Printer, Download } from "lucide-react";
import { Production, Machine, SECTORS } from "../types/forpack";
import { date, kg, number } from "../utils/formatters";

export function LossTable({
  title,
  rows,
  format,
  percent,
  showCuttings = false,
}: {
  title: string;
  rows: { material: string; produced: number; scraps: number; cuttings: number }[];
  format: (value: number) => string;
  percent: (loss: number, produced: number) => number;
  showCuttings?: boolean;
}) {
  return (
    <article className="daily-loss-card">
      <header>
        <h2>{title}</h2>
      </header>
      <div className="daily-sector-table-wrap">
        <table className="daily-loss-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Produção</th>
              <th>Apara</th>
              <th>%</th>
              {showCuttings && (
                <>
                  <th>Ap. picote</th>
                  <th>%</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.material}>
                <td>
                  <strong>{row.material}</strong>
                </td>
                <td>{format(row.produced)}</td>
                <td>{row.scraps ? format(row.scraps) : "—"}</td>
                <td className={percent(row.scraps, row.produced) > 5 ? "loss-alert" : "loss-ok"}>
                  {row.scraps ? `${percent(row.scraps, row.produced).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : "—"}
                </td>
                {showCuttings && (
                  <>
                    <td>{row.cuttings ? format(row.cuttings) : "—"}</td>
                    <td className={percent(row.cuttings, row.produced) > 5 ? "loss-alert" : "loss-ok"}>
                      {row.cuttings ? `${percent(row.cuttings, row.produced).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : "—"}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <div className="daily-loss-empty">Sem perdas registradas neste setor.</div>}
    </article>
  );
}

export function DailySectorReport({
  records,
  machines,
  selectedDate,
  onDate,
}: {
  records: Production[];
  machines: Machine[];
  selectedDate: string;
  onDate: (value: string) => void;
}) {
  const shiftOf = (value = "") => {
    const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    if (normalized.includes("MANHA") || normalized === "1") return "MANHÃ";
    if (normalized.includes("TARDE") || normalized === "2") return "TARDE";
    if (normalized.includes("NOITE") || normalized === "3") return "NOITE";
    return "NÃO INFORMADO";
  };

  const activeMachineIds = new Set(records.map(record => String(record.maquinaId || "")).filter(Boolean));
  const sectors = SECTORS.map(sector => {
    const sectorMachines = machines.filter(machine => machine.setor.toUpperCase() === sector && activeMachineIds.has(machine.id));
    const rows = sectorMachines.map(machine => {
      const machineRecords = records.filter(record => record.maquinaId === machine.id);
      const morning = machineRecords.filter(record => shiftOf(record.turno) === "MANHÃ").reduce((sum, record) => sum + number(record.qtdProduzido), 0);
      const afternoon = machineRecords.filter(record => shiftOf(record.turno) === "TARDE").reduce((sum, record) => sum + number(record.qtdProduzido), 0);
      const night = machineRecords.filter(record => shiftOf(record.turno) === "NOITE").reduce((sum, record) => sum + number(record.qtdProduzido), 0);
      const unreported = machineRecords.filter(record => shiftOf(record.turno) === "NÃO INFORMADO").reduce((sum, record) => sum + number(record.qtdProduzido), 0);
      return { machine, morning, afternoon, night, unreported, total: morning + afternoon + night + unreported };
    });
    return { sector, rows, total: rows.reduce((sum, row) => sum + row.total, 0) };
  }).filter(section => section.rows.length);

  const grandTotal = sectors.reduce((sum, section) => sum + section.total, 0);
  const machineMap = new Map(machines.map(machine => [machine.id, machine]));
  const sectorRecords = (sector: string) => records.filter(record => machineMap.get(String(record.maquinaId || ""))?.setor.toUpperCase() === sector);
  const cutAndRewinderTotal = ["CORTE", "REBOBINADEIRA"].reduce(
    (sum, sector) => sum + sectorRecords(sector).reduce((subtotal, record) => subtotal + number(record.qtdProduzido), 0),
    0
  );

  const lossRows = (sectorNames: string[], rewinderLabel = false) => {
    const grouped = new Map<string, { produced: number; scraps: number; cuttings: number }>();
    sectorNames.flatMap(sectorRecords).forEach(record => {
      const sector = machineMap.get(String(record.maquinaId || ""))?.setor.toUpperCase() || "";
      const material = rewinderLabel && sector === "REBOBINADEIRA" ? "REBOBINADEIRA" : (record.material || "OUTRO").trim().toUpperCase() || "OUTRO";
      const current = grouped.get(material) || { produced: 0, scraps: 0, cuttings: 0 };
      current.produced += number(record.qtdProduzido);
      current.scraps += number(record.aparas);
      current.cuttings += number(record.picote);
      grouped.set(material, current);
    });
    return [...grouped.entries()]
      .map(([material, values]) => ({ material, ...values }))
      .filter(row => row.produced || row.scraps || row.cuttings)
      .sort((a, b) => b.produced - a.produced);
  };

  const extrusionLosses = lossRows(["EXTRUSÃO"]);
  const cuttingLosses = lossRows(["CORTE", "REBOBINADEIRA"], true);
  const format = (value: number) => value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const percent = (loss: number, produced: number) => (produced ? (loss / produced) * 100 : 0);

  const exportCsv = () => {
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines = [
      ["Data", "Setor", "Máquina", "Manhã (kg)", "Tarde (kg)", "Noite (kg)", "Turno não informado (kg)", "Total (kg)"],
      ...sectors.flatMap(section =>
        section.rows.map(row => [
          date(selectedDate),
          section.sector,
          row.machine.name,
          format(row.morning),
          format(row.afternoon),
          format(row.night),
          format(row.unreported),
          format(row.total),
        ])
      ),
    ];
    const csv = `\uFEFF${lines.map(line => line.map(value => escape(String(value))).join(";")).join("\r\n")}`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `relatorio-diario-${selectedDate}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <section className="daily-sector-report">
      <header className="daily-print-heading">
        <div>
          <strong>FORPACK · GUAIÚBA</strong>
          <span>Relatório diário de produção</span>
        </div>
        <div>
          <small>Data</small>
          <strong>{date(selectedDate)}</strong>
        </div>
      </header>
      <div className="daily-report-toolbar">
        <label>
          <span>DATA DO RELATÓRIO</span>
          <input type="date" value={selectedDate} onChange={event => onDate(event.target.value)} />
        </label>
        <div className="daily-report-summary">
          <small>TOTAL PRODUZIDO NO DIA</small>
          <strong>{kg(grandTotal)}</strong>
        </div>
        <div className="daily-report-actions">
          <button className="secondary daily-print" onClick={() => window.print()} disabled={!records.length}>
            <Printer size={15} strokeWidth={2.4} /> IMPRIMIR RELATÓRIO
          </button>
          <button className="secondary daily-export" onClick={exportCsv} disabled={!records.length}>
            <Download size={15} strokeWidth={2.4} /> EXPORTAR CSV DO DIA
          </button>
        </div>
      </div>
      {sectors.map(section => (
        <article className="daily-sector-card" key={section.sector}>
          <header>
            <h2>{section.sector}</h2>
            <strong>
              {format(section.total)} <small>kg</small>
            </strong>
          </header>
          <div className="hazard-line" />
          <div className="daily-sector-table-wrap">
            <table className="daily-sector-table">
              <thead>
                <tr>
                  <th>MÁQUINA</th>
                  <th>MANHÃ</th>
                  <th>TARDE</th>
                  <th>NOITE</th>
                  <th>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map(row => (
                  <tr key={row.machine.id}>
                    <td>
                      <strong>{row.machine.name}</strong>
                      {row.unreported > 0 && <small className="unreported">+ {format(row.unreported)} kg sem turno</small>}
                    </td>
                    <td>{format(row.morning)}</td>
                    <td>{format(row.afternoon)}</td>
                    <td>{format(row.night)}</td>
                    <td>
                      <strong>{format(row.total)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ))}
      {sectors.length > 0 && (
        <>
          <article className="daily-combined-total">
            <span>Total Corte + Rebobinadeira</span>
            <strong>
              {format(cutAndRewinderTotal)} <small>kg</small>
            </strong>
          </article>
          <section className="daily-loss-grid">
            <LossTable title="Perdas Extrusão" rows={extrusionLosses} format={format} percent={percent} />
            <LossTable title="Perdas Corte" rows={cuttingLosses} format={format} percent={percent} showCuttings />
          </section>
        </>
      )}
      {!sectors.length && (
        <section className="panel daily-empty">
          <span>▥</span>
          <strong>Nenhuma produção encontrada</strong>
          <p>Não existem apontamentos registrados para {date(selectedDate)}.</p>
        </section>
      )}
      {sectors.length > 0 && (
        <footer className="daily-report-footer">
          <span>FORPACK · GUAIÚBA — dados salvos automaticamente e compartilhados entre todos que usam este painel</span>
          <strong>
            {records.length} apontamento(s) · Total geral: {kg(grandTotal)}
          </strong>
        </footer>
      )}
    </section>
  );
}
