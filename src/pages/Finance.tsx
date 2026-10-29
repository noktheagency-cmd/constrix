import { DataTable } from '../components/DataTable'
import { Checkbox } from "../components/Checkbox"
import { DateField } from "../DateField"
import { Icon } from "../icons"
import { Button, Disclosure, Input, Metric, Panel, SectionHeader, StatGrid, TableContainer } from "../components/primitives"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ApiError, api, dec } from "../api"
import { financePosition, categories, periods } from "../domain/financeView"
import { dateAZ, hit, money, moneyShort, monthWord } from "../format"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Empty, FlowBars, Meter, Modal, PageHead, Select, Tabs, useTitle } from "../ui"

const colors = ["var(--copper)", "var(--pine)", "var(--gold)", "var(--ink)", "var(--faint)", "var(--rose)"]

export default function Finance() {
  const { t } = usePrefs()
  useTitle(t("page.finance.title"))
  const state = useStore()
  const [view, setView] = useState("overview")
  const [projectId, setProjectId] = useState("")
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
  const selectedProject = projects.find((item) => item.id === projectId) || projects[0]
  const latest = position.moves.filter((item) => hit(state.query, item.id, item.party, item.project, item.category))

  return (
    <div className="finance-workspace">
      <PageHead kicker={t("page.finance.kicker")} title={t("page.finance.title")} text={t("page.finance.text")} />
      <StatGrid>
        <Metric>
          <span>Pul</span>
          <strong>{moneyShort(position.cash)}</strong>
          <em>Kassa və bank</em>
        </Metric>
        <Metric>
          <span>Debitor</span>
          <strong>{moneyShort(position.receivable)}</strong>
          <em className={position.receivable ? "warn" : ""}>Satış qaiməsi</em>
        </Metric>
        <Metric>
          <span>Kreditor</span>
          <strong>{moneyShort(position.payable)}</strong>
          <em>Təchizat borcu</em>
        </Metric>
        <Metric>
          <span>Anbar</span>
          <strong>{moneyShort(position.stock)}</strong>
          <em>Qalıq dəyəri</em>
        </Metric>
      </StatGrid>

      <Tabs value={view} onChange={setView} options={[{id:"overview",label:"İcmal"},{id:"projects",label:"Layihə büdcələri"},{id:"tax",label:"Vergi qaydaları"}]} />
      {view === "overview" && <>
      <Panel className="pad">
        <SectionHeader>
          <h2>Pul axını</h2>
          <Link to="/dovrler">Dövrlər</Link>
        </SectionHeader>
        <FlowBars rows={flow} />
      </Panel>

      <div className="grid-2">
        <Panel className="pad">
          <SectionHeader>
            <h2>Son hərəkət</h2>
            <Link to="/emeliyyatlar">Hamısı</Link>
          </SectionHeader>
          <TableContainer className="flat">
            <DataTable>
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
            </DataTable>
          </TableContainer>
        </Panel>
        <Panel className="pad">
          <SectionHeader>
            <h2>Xərc payı</h2>
            <Link to="/kateqoriyalar">Kateqoriya</Link>
          </SectionHeader>
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
        </Panel>
      </div>

      </>}
      {view === "projects" && <div className="finance-budgets">
        {selectedProject && <Panel className="pad finance-project-summary">
          <SectionHeader><h2>Büdcənin istifadəsi</h2><Select ariaLabel="Büdcəsi göstərilən layihə" value={selectedProject.id} onValueChange={setProjectId} options={projects.map((item) => ({value:item.id,label:item.name}))} /></SectionHeader>
          <div className="finance-budget-values"><div><span>Büdcə</span><strong>{money(selectedProject.budget)}</strong></div><div><span>Xərclənib</span><strong>{money(selectedProject.spent)}</strong></div><div><span>Qalıq</span><strong>{money(selectedProject.budget-selectedProject.spent)}</strong></div></div>
          <Meter value={selectedProject.budget ? Math.round(selectedProject.spent / selectedProject.budget * 100) : 0} tone={selectedProject.budget && selectedProject.spent / selectedProject.budget * 100 > selectedProject.progress + 15 ? "rose" : "copper"} />
          <p className="muted">{selectedProject.budget ? Math.round(selectedProject.spent / selectedProject.budget * 100) : 0}% istifadə olunub · İşin irəliləyişi {selectedProject.progress}%</p>
        </Panel>}
        <TableContainer className="finance-project-table"><DataTable><thead><tr><th>Layihə</th><th>Büdcə</th><th>Xərclənib</th><th>Qalıq</th><th>İstifadə</th></tr></thead><tbody>{projects.map((project) => <tr key={project.id} tabIndex={0} className={project.id === selectedProject?.id ? "selected" : ""} onClick={() => setProjectId(project.id)} onKeyDown={(event) => {if(event.key === "Enter" || event.key === " "){event.preventDefault();setProjectId(project.id)}}}><td><strong>{project.name}</strong></td><td>{money(project.budget)}</td><td>{money(project.spent)}</td><td>{money(project.budget-project.spent)}</td><td>{project.budget ? Math.round(project.spent/project.budget*100) : 0}%</td></tr>)}</tbody></DataTable>{!projects.length && <p className="lede">Uyğun layihə yoxdur.</p>}</TableContainer>
      </div>}
      <div hidden={view !== "tax"}><TaxPanel /></div>
    </div>
  )
}

type TaxRule = { id: string; code: string; name: string; rate: unknown; effectiveOn: string; note: string }

function TaxPanel() {
  const [rows, setRows] = useState<TaxRule[]>([])
  const [form, setForm] = useState({ code: "", name: "", rate: "", effectiveOn: "", vatMode: "xaric", confirmed: false })
  const [base, setBase] = useState("")
  const [note, setNote] = useState("")
  const [explain, setExplain] = useState("")
  const [compose, setCompose] = useState(false)
  const [busy, setBusy] = useState(false)
  const [calc, setCalc] = useState({code:"",on:""})

  function reload() {
    return api<TaxRule[]>("/api/platform/tax-rules").then(setRows)
  }

  useEffect(() => {
    reload().catch(() => setRows([]))
  }, [])

  async function save() {
    if(busy) return
    setBusy(true)
    try {
      await api("/api/platform/tax-rules", { method: "POST", body: JSON.stringify(form) })
      setForm({ code: "", name: "", rate: "", effectiveOn: "", vatMode: "xaric", confirmed: false })
      await reload()
      setCompose(false)
      setNote(form.confirmed ? "Qayda təsdiqlə yazıldı. Bəyannamə orqana getmir." : "Qayda mühasib təsdiqinə qədər dayanır. Bəyannamə orqana getmir.")
    } catch (reason) {
      setNote(reason instanceof ApiError ? reason.message : "Vergi qaydası yazılmadı")
    } finally {setBusy(false)}
  }

  async function explainNow() {
    try {
      const result = await api<{ explanation: string; filed: boolean }>("/api/platform/tax-rules/explain", {
        method: "POST",
        body: JSON.stringify({ code: calc.code, on: calc.on, base }),
      })
      setExplain(`${result.explanation} Bəyannamə göndərilmədi.`)
    } catch (reason) {
      setExplain(reason instanceof ApiError ? reason.message : "İzah alınmadı")
    }
  }

  return <div className="tax-workspace">
    <SectionHeader><div><h2>Vergi qaydaları</h2><p className="muted">Dərəcələr və qüvvəyə minmə tarixçəsi.</p></div><Button onClick={() => {setNote("");setCompose(true)}}><Icon name="plus" />Yeni qayda</Button></SectionHeader>
    {note && !compose && <p className="lede" role="status">{note}</p>}
    <TableContainer className="tax-rules-table"><DataTable><thead><tr><th>Qayda</th><th>Kod</th><th>Dərəcə</th><th>Qüvvəyə minmə</th><th>Qeyd</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td><code>{row.code}</code></td><td><span className="badge copper">{dec(row.rate)}%</span></td><td>{dateAZ(row.effectiveOn.slice(0,10))}</td><td>{row.note || "—"}</td></tr>)}</tbody></DataTable>{!rows.length && <Empty title="Qayda yoxdur" text="Yeni qayda düyməsi ilə məlumat əlavə edin." />}</TableContainer>
    <Disclosure title="Hesablama və izah"><div className="tax-calc-fields"><label>Vergi qaydası<Select ariaLabel="Hesablanacaq vergi qaydası" value={calc.code} onValueChange={(code) => setCalc({...calc,code})} options={[{value:"",label:"Qayda seçin"},...Array.from(new Map(rows.map((row) => [row.code,row])).values()).map((row) => ({value:row.code,label:row.name}))]} /></label><label>Hesablama tarixi<DateField ariaLabel="Hesablama tarixi" value={calc.on} onChange={(on) => setCalc({...calc,on})} /></label><label>Baza, AZN<Input inputMode="decimal" value={base} onChange={(event) => setBase(event.target.value)} /></label><Button disabled={!calc.code} onClick={() => void explainNow()}>Hesabla</Button></div>{explain && <p className="tax-explanation" role="status">{explain}</p>}</Disclosure>
    {compose && <Modal title="Yeni vergi qaydası" className="finance-record-modal tax-rule-modal" onClose={() => {if(!busy)setCompose(false)}}><form onSubmit={(event) => {event.preventDefault();void save()}}><div className="finance-form-grid"><label>Kod<Input required value={form.code} onChange={(event) => setForm({...form,code:event.target.value})} placeholder="Məs. edv" /></label><label>Ad<Input required value={form.name} onChange={(event) => setForm({...form,name:event.target.value})} /></label><label>Dərəcə, %<Input required inputMode="decimal" value={form.rate} onChange={(event) => setForm({...form,rate:event.target.value})} /></label><label>Qüvvəyə minmə<DateField ariaLabel="Qüvvəyə minmə tarixi" value={form.effectiveOn} onChange={(effectiveOn) => setForm({...form,effectiveOn})} /></label><label className="full">ƏDV rejimi<Select value={form.vatMode} onValueChange={(vatMode) => setForm({...form,vatMode})} options={[{value:"xaric",label:"ƏDV xaric"},{value:"daxil",label:"ƏDV daxil"}]} /></label><Checkbox className="full" label="Mühasib qaydanı yoxlayıb təsdiqləyib" checked={form.confirmed} onChange={(event) => setForm({...form,confirmed:event.target.checked})} /></div><p className="tax-form-hint">Yeni qayda tarixçəyə əlavə olunur. Bəyannamə göndərilmir.</p>{note && <p className="form-error" role="alert">{note}</p>}<div className="form-actions"><Button className="ghost" disabled={busy} onClick={() => setCompose(false)}>Ləğv et</Button><Button type="submit" disabled={busy}>{busy ? "Saxlanılır…" : "Qaydanı saxla"}</Button></div></form></Modal>}
  </div>
}
