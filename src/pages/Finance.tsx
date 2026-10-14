import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ApiError, api, dec } from "../api"
import { financePosition, categories, periods } from "../domain/financeView"
import { dateAZ, hit, money, moneyShort, monthWord } from "../format"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { FlowBars, Meter, PageHead, Select, useTitle } from "../ui"

const colors = ["var(--copper)", "var(--pine)", "var(--gold)", "var(--ink)", "var(--faint)", "var(--rose)"]

export default function Finance() {
  const { t } = usePrefs()
  useTitle(t("page.finance.title"))
  const state = useStore()
  const position = financePosition(state)
  const parts = categories(position.moves)
    .filter((item) => item.direction === "out")
    .map((item, index) => ({ ...item, color: colors[index % colors.length] }))
  const expenseTotal = parts.reduce((sum, part) => sum + part.amount, 0) || 1
  let cursor = 0
  const stops = parts.map((part) => {
    const start = (cursor / expenseTotal) * 100
    cursor += part.amount
    return `${part.color} ${start}% ${(cursor / expenseTotal) * 100}%`
  })
  const flow = periods(position.moves, state.closedPeriods).slice().reverse().map((row) => ({ label: monthWord(row.id), inn: row.inflow, out: row.outflow }))
  const projects = state.projects.filter((item) => hit(state.query, item.name, item.client))
  const latest = position.moves.filter((item) => hit(state.query, item.id, item.party, item.project, item.category)).slice(0, 6)

  return (
    <>
      <PageHead kicker={t("page.finance.kicker")} title={t("page.finance.title")} text={t("page.finance.text")} />
      <section className="statstrip">
        <article>
          <span>Pul</span>
          <strong>{moneyShort(position.cash)}</strong>
          <em>Kassa və bank</em>
        </article>
        <article>
          <span>Debitor</span>
          <strong>{moneyShort(position.receivable)}</strong>
          <em className={position.receivable ? "warn" : ""}>Satış qaiməsi</em>
        </article>
        <article>
          <span>Kreditor</span>
          <strong>{moneyShort(position.payable)}</strong>
          <em>Təchizat borcu</em>
        </article>
        <article>
          <span>Anbar</span>
          <strong>{moneyShort(position.stock)}</strong>
          <em>Qalıq dəyəri</em>
        </article>
      </section>

      <section className="panel pad">
        <div className="panel-head">
          <h2>Pul axını</h2>
          <Link to="/dovrler">Dövrlər</Link>
        </div>
        <FlowBars rows={flow} />
      </section>

      <div className="grid-2">
        <section className="panel pad">
          <div className="panel-head">
            <h2>Son hərəkət</h2>
            <Link to="/emeliyyatlar">Hamısı</Link>
          </div>
          <div className="table-wrap flat">
            <table>
              <thead>
                <tr>
                  <th>Tərəf</th>
                  <th>Hesab</th>
                  <th className="num">Məbləğ</th>
                </tr>
              </thead>
              <tbody>
                {latest.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="name-cell">
                        <b>{item.party}</b>
                        <span className="muted">{item.category} · {dateAZ(item.date)}</span>
                      </div>
                    </td>
                    <td>{item.account}</td>
                    <td className={item.direction === "in" ? "num in" : "num out"}>{item.direction === "in" ? "" : "−"}{money(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel pad">
          <div className="panel-head">
            <h2>Xərc payı</h2>
            <Link to="/kateqoriyalar">Kateqoriya</Link>
          </div>
          {parts.length > 0 && (
            <div className="donut-wrap stack">
              <div className="donut" style={{ background: `conic-gradient(${stops.join(",")})` }} />
              <div className="legend">
                {parts.map((part) => (
                  <div key={part.name}>
                    <span>
                      <i className="swatch" style={{ background: part.color }} />
                      {part.name}
                    </span>
                    <b>{moneyShort(part.amount)}</b>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="stack" style={{ marginTop: 14 }}>
        {projects.map((project) => {
          const burn = project.budget ? Math.round((project.spent / project.budget) * 100) : 0
          return (
            <section key={project.id} className="panel pad">
              <div className="panel-head">
                <h2>{project.name}</h2>
                <span className="muted">{money(project.budget - project.spent)} qalıb</span>
              </div>
              <p className="muted">
                {money(project.spent)} / {money(project.budget)}
              </p>
              <div style={{ marginTop: 10 }}>
                <Meter value={burn} tone={burn > project.progress + 15 ? "rose" : "copper"} />
              </div>
            </section>
          )
        })}
      </div>
      <TaxPanel />
    </>
  )
}

type TaxRule = { id: string; code: string; name: string; rate: unknown; effectiveOn: string; note: string }

function TaxPanel() {
  const [rows, setRows] = useState<TaxRule[]>([])
  const [form, setForm] = useState({ code: "", name: "", rate: "", effectiveOn: "", vatMode: "xaric", confirmed: false })
  const [base, setBase] = useState("")
  const [note, setNote] = useState("")
  const [explain, setExplain] = useState("")

  function reload() {
    return api<TaxRule[]>("/api/platform/tax-rules").then(setRows)
  }

  useEffect(() => {
    reload().catch(() => setRows([]))
  }, [])

  async function save() {
    try {
      await api("/api/platform/tax-rules", { method: "POST", body: JSON.stringify(form) })
      setForm({ code: "", name: "", rate: "", effectiveOn: "", vatMode: "xaric", confirmed: false })
      await reload()
      setNote(form.confirmed ? "Qayda təsdiqlə yazıldı. Bəyannamə orqana getmir." : "Qayda mühasib təsdiqinə qədər dayanır. Bəyannamə orqana getmir.")
    } catch (reason) {
      setNote(reason instanceof ApiError ? reason.message : "Vergi qaydası yazılmadı")
    }
  }

  async function explainNow() {
    try {
      const result = await api<{ explanation: string; filed: boolean }>("/api/platform/tax-rules/explain", {
        method: "POST",
        body: JSON.stringify({ code: form.code, on: form.effectiveOn, base }),
      })
      setExplain(`${result.explanation} Bəyannamə göndərilmədi.`)
    } catch (reason) {
      setExplain(reason instanceof ApiError ? reason.message : "İzah alınmadı")
    }
  }

  return (
    <section className="panel pad" style={{ marginTop: 14 }}>
      <h2 className="block-title">Vergi qaydası</h2>
      <p className="lede">Növ, dərəcə və qüvvəyə minmə tarixi saxlanır. ƏDV daxil və xaric ayrılır. Düzəliş yeni sətir kimi tarixçədə qalır. Orqana bəyannamə getmir.</p>
      <div className="form-row wide">
        <label>Kod<input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label>
        <label>Ad<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label>Dərəcə, %<input value={form.rate} onChange={(event) => setForm({ ...form, rate: event.target.value })} /></label>
        <label>Qüvvəyə minmə<input type="date" value={form.effectiveOn} onChange={(event) => setForm({ ...form, effectiveOn: event.target.value })} /></label>
        <label>ƏDV<Select value={form.vatMode} onValueChange={(vatMode) => setForm({ ...form, vatMode })} options={[{ value: "xaric", label: "Xaric" }, { value: "daxil", label: "Daxil" }]} /></label>
        <label>Mühasib təsdiqi<input type="checkbox" checked={form.confirmed} onChange={(event) => setForm({ ...form, confirmed: event.target.checked })} /></label>
        <label>Baza, AZN<input value={base} onChange={(event) => setBase(event.target.value)} /></label>
        <button type="button" className="btn" onClick={() => void save()}>Qaydanı yaz</button>
        <button type="button" className="btn" onClick={() => void explainNow()}>İzah et</button>
      </div>
      {rows.map((row) => (
        <div className="step-row" key={row.id}>
          <span>{row.code} · {row.name} · {String(row.effectiveOn).slice(0, 10)} · {row.note}</span>
          <strong>{dec(row.rate)}%</strong>
        </div>
      ))}
      {explain && <p className="lede">{explain}</p>}
      {note && <p className="lede">{note}</p>}
    </section>
  )
}
