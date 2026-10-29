import { DataTable } from '../components/DataTable'
import { Button, Input, Metric, Panel, SectionHeader, StatGrid, TableContainer } from "../components/primitives"
import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { projectEconomics } from "../domain/ops"
import type { ChangeForm, Phase, Project } from "../domain/types"
import { money, num } from "../format"
import { useStore } from "../store"
import { Badge, Field, Meter } from "../ui"

const emptyChange: ChangeForm = { projectId: "", title: "", reason: "", name: "", unit: "m³", qty: "", unitPrice: "" }

export function PhaseTrack({ projectId, phases, active }: { projectId: string; phases: Phase[]; active?: string }) {
  return (
    <ol className="phases">
      {phases.map((phase) => {
        const state = [phase.current ? "current" : "", phase.done ? "done" : "", active === phase.name ? "picked" : ""].filter(Boolean).join(" ")
        return (
          <li key={phase.name} className={state}>
            <Link to={`/layiheler/${projectId}/merhele/${encodeURIComponent(phase.name)}`} className="phase-hit" title={`${phase.name} mərhələsini aç`}>
              <i />
              <span>{phase.name}</span>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

export function SmetaPanel({ project }: { project: Project }) {
  const { smetas, makeAct, allowed } = useStore()
  const smeta = smetas.find((item) => item.id === project.smetaId)
  if (!smeta) return <p className="muted">Bu layihənin smetası yoxdur.</p>
  const plan = smeta.lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0)
  const done = smeta.lines.reduce((sum, line) => sum + Math.min(line.doneQty, line.qty) * line.unitPrice, 0)
  const open = smeta.lines.reduce((sum, line) => sum + Math.max(0, line.doneQty - line.billedQty) * line.unitPrice, 0)
  return (
    <Panel className="pad">
      <SectionHeader>
        <h2>Smeta · versiya {smeta.version}</h2>
        <div className="deal-actions">
          <span className="muted">Bağlanmamış həcm {money(open)}</span>
          {allowed("acts") && (
            <Button type="button" className="small" onClick={() => makeAct(project.id)}>
              Forma-2
            </Button>
          )}
        </div>
      </SectionHeader>
      <p className="muted">
        Razılaşma {money(plan)} · yerinə yetirilib {money(done)}. Həcm yalnız təsdiqlənmiş gündəlikdən artır.
      </p>
      <TableContainer  style={{ marginTop: 12 }}>
        <DataTable>
          <thead>
            <tr>
              <th>İş</th>
              <th>Həcm</th>
              <th>İrəliləyiş</th>
              <th className="num">Qiymət</th>
              <th className="num">Məbləğ</th>
            </tr>
          </thead>
          <tbody>
            {smeta.lines.map((line) => (
              <tr key={line.id}>
                <td>
                  <div className="name-cell">
                    <b>
                      {line.code} {line.name}
                    </b>
                    <span className="muted">
                      {line.recipe ? `Resept ${line.recipe}` : "Material anbar məxarici ilə"} · {line.laborHours} saat / {line.unit}
                    </span>
                  </div>
                </td>
                <td>
                  {num(line.doneQty, 1)} / {num(line.qty)} {line.unit}
                  <div className="muted">akt {num(line.billedQty, 1)}</div>
                </td>
                <td style={{ minWidth: 110 }}>
                  <Meter value={(line.doneQty / line.qty) * 100} />
                </td>
                <td className="num">{money(line.unitPrice)}</td>
                <td className="num">{money(line.qty * line.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </TableContainer>
    </Panel>
  )
}

export function ContractPanel({ project }: { project: Project }) {
  const { contracts, invoices } = useStore()
  const contract = contracts.find((item) => item.projectId === project.id)
  const held = invoices.filter((item) => item.project === project.name && item.actId).reduce(
    (sum, item) => ({ advance: sum.advance + (item.advance ?? 0), retention: sum.retention + (item.retention ?? 0) }),
    { advance: 0, retention: 0 },
  )
  if (!contract) return <p className="muted">Müqavilə bağlanmayıb.</p>
  const advance = Math.round(contract.value * (contract.advancePct / 100))
  const retention = Math.round(contract.value * (contract.retentionPct / 100))
  return (
    <div className="grid-2">
      <Panel className="pad">
        <h2>{contract.number}</h2>
        <dl className="kv" style={{ marginTop: 12 }}>
          <dt>Sifarişçi</dt>
          <dd>{contract.client}</dd>
          <dt>Məbləğ, ƏDV-siz</dt>
          <dd>{money(contract.value)}</dd>
          <dt>ƏDV 18%</dt>
          <dd>{money(Math.round(contract.value * contract.vat))}</dd>
          <dt>Avans {contract.advancePct}%</dt>
          <dd>{money(advance)}</dd>
          <dt>Saxlanc {contract.retentionPct}%</dt>
          <dd>{money(retention)}</dd>
          <dt>İmza</dt>
          <dd>{contract.signed}</dd>
          <dt>Avans tutulub</dt>
          <dd>{money(held.advance)}</dd>
          <dt>Saxlanc</dt>
          <dd>{money(held.retention)}</dd>
        </dl>
      </Panel>
      <Panel className="pad">
        <h2>Ödəniş qrafiki</h2>
        <div className="mini-list">
          {contract.schedule.map((row) => (
            <article key={row.id} className="split">
              <span>
                <b>{row.title}</b>
                <span className="muted"> · {row.due}</span>
              </span>
              <span>
                {money(Math.round(contract.value * row.share))} <Badge status={row.status} />
              </span>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  )
}

export function DocsPanel({ project }: { project: Project }) {
  const { documents, decideDocument, actor } = useStore()
  const rows = documents.filter((item) => item.projectId === project.id)
  if (!rows.length) return <p className="muted">Sənəd yoxdur.</p>
  return (
    <Panel className="pad">
      <h2>Sənədlər və əlavə işlər</h2>
      <div className="mini-list">
        {rows.map((doc) => (
          <article key={doc.id} className="split">
            <span>
              <b>{doc.title}</b>
              <span className="muted"> · {doc.kind} · {doc.date}</span>
            </span>
            <span className="deal-actions">
              <Badge status={doc.status} />
              {doc.status === "gozleyir" && (actor.role === "director" || actor.role === "pm") && (
                <Button type="button" className="small" onClick={() => decideDocument(doc.id, "tesdiq")}>
                  Təsdiqlə
                </Button>
              )}
            </span>
          </article>
        ))}
      </div>
    </Panel>
  )
}

export function CostPanel({ project }: { project: Project }) {
  const store = useStore()
  const { changes, proposeChange, approveChange, actor } = store
  const cost = projectEconomics(store, project.id)
  const rows = changes.filter((item) => item.projectId === project.id)
  const [form, setForm] = useState<ChangeForm>({ ...emptyChange, projectId: project.id })
  const [error, setError] = useState("")
  const canEdit = actor.role === "director" || actor.role === "pm"

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = proposeChange({ ...form, projectId: project.id })
    setError(message)
    if (!message) setForm({ ...emptyChange, projectId: project.id })
  }

  return (
    <div className="stack">
      <StatGrid>
        <Metric>
          <span>Plan</span>
          <strong>{money(cost.planned)}</strong>
          <em>Smeta</em>
        </Metric>
        <Metric>
          <span>Qazanılmış</span>
          <strong>{money(cost.earned)}</strong>
          <em>Təsdiqlənmiş həcm</em>
        </Metric>
        <Metric>
          <span>Akt</span>
          <strong>{money(cost.billed)}</strong>
          <em>Bağlanmış həcm</em>
        </Metric>
        <Metric>
          <span>Xərc</span>
          <strong>{money(cost.spent)}</strong>
          <em className={cost.spent > cost.earned ? "warn" : ""}>Öhdəlik {money(cost.committed)}</em>
        </Metric>
      </StatGrid>
      <Panel className="pad">
        <h2>Əlavə işlər</h2>
        <p className="muted">Təsdiq yeni smeta sətri əlavə edir və müqavilə məbləğini artırır. Köhnə sətirlər olduğu kimi qalır.</p>
        <div className="mini-list">
          {rows.length === 0 && <p className="muted">Əlavə iş yoxdur.</p>}
          {rows.map((item) => (
            <article key={item.id} className="split">
              <span>
                <b>{item.title}</b>
                <span className="muted"> · {item.reason} · {money(item.lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0))}</span>
              </span>
              <span className="deal-actions">
                <Badge status={item.status} />
                {item.status === "qaralama" && canEdit && (
                  <Button type="button" className="small" onClick={() => approveChange(item.id)}>
                    Təsdiqlə
                  </Button>
                )}
              </span>
            </article>
          ))}
        </div>
        {canEdit && (
          <form className="form" onSubmit={submit} style={{ marginTop: 16 }}>
            <Field label="Başlıq">
              <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </Field>
            <Field label="Səbəb">
              <Input value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
            </Field>
            <Field label="İş">
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Field>
            <div className="split">
              <Field label="Vahid">
                <Input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} />
              </Field>
              <Field label="Həcm">
                <Input type="number" min="0" step="0.1" value={form.qty} onChange={(event) => setForm({ ...form, qty: event.target.value })} />
              </Field>
              <Field label="Qiymət, ₼">
                <Input type="number" min="1" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} />
              </Field>
            </div>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <Button  type="submit">Əlavə iş aç</Button>
            </div>
          </form>
        )}
      </Panel>
    </div>
  )
}
