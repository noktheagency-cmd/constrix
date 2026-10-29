import type { ReactNode } from "react"

/** Shared financial document totals, with one clear final amount. */
export function DocumentSummary({ rows, totalLabel, total }: { rows: { label: string; value: ReactNode }[]; totalLabel: string; total: ReactNode }) {
  return <section className="document-summary" aria-label="Məbləğlərin xülasəsi">
    <dl>{rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
    <div className="document-summary-total"><span>{totalLabel}</span><strong>{total}</strong></div>
  </section>
}
