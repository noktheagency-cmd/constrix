import { Panel } from "../components/primitives"
import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { api } from "../api"
import { dateAZ, num } from "../format"
import { useStore } from "../store"
import { Badge, Empty, useTitle } from "../ui"
import { PhaseTrack } from "./projectParts"

type Procedure = {
  id: string
  phase: string
  name: string
  detail: string
  unit: string
  qty: number
  doneQty: number
  doneOn: string
}

const RULES: { phase: string; test: RegExp }[] = [
  { phase: "Torpaq", test: /torpaq|geodeziya|qazıntı|hasar/i },
  { phase: "Bünövrə", test: /bünövrə|hidroizol|svay/i },
  { phase: "Fasad", test: /fasad|pəncərə|şüşə|alüminium/i },
  { phase: "Tamamlama", test: /tamamlama|suvaq|döşəmə|boya|santex|şəbəkə/i },
  { phase: "Təhvil", test: /təhvil|qəbul|açar|qüsur|zəmanət/i },
  { phase: "Karkas", test: /karkas|beton|armatur|plitə|sütun/i },
]

function phaseOf(text: string) {
  for (const rule of RULES) {
    if (rule.test.test(text)) return rule.phase
  }
  return ""
}

export default function PhaseDetail() {
  const { id, phase: phaseName } = useParams()
  const { projects, smetas, reports, acts, orders } = useStore()
  const project = projects.find((item) => item.id === id)
  const phase = project?.phases.find((item) => item.name === phaseName)
  const [rows, setRows] = useState<Procedure[] | null>(null)
  const [failed, setFailed] = useState(false)
  useTitle(phase ? `${phase.name} · ${project?.name}` : "Mərhələ")

  useEffect(() => {
    if (!id) return
    let live = true
    setRows(null)
    setFailed(false)
    api<Procedure[]>(`/api/projects/${id}/procedures`)
      .then((data) => {
        if (live) setRows(data)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [id])

  if (!project) {
    return (
      <>
        <Link to="/layiheler" className="back">Layihələrə qayıt</Link>
        <Empty title="Layihə tapılmadı" text="Bu kod üzrə sahə yoxdur." />
      </>
    )
  }

  if (!phase) {
    return (
      <>
        <Link to={`/layiheler/${project.id}`} className="back">Layihəyə qayıt</Link>
        <Empty title="Mərhələ tapılmadı" text="Bu addım layihənin cədvəlində yoxdur." />
      </>
    )
  }

  const done = Boolean(phase.done)
  const phaseRows = rows?.filter((item) => item.phase === phase.name) ?? null
  const smeta = smetas.find((item) => item.projectId === project.id || item.id === project.smetaId)
  const lines = (smeta?.lines ?? []).filter((line) => phaseOf(line.name) === phase.name)
  const lineIds = new Set(lines.map((line) => line.id))
  const phaseReports = reports.filter(
    (item) => item.projectId === project.id && item.lines.some((line) => lineIds.has(line.smetaLineId)),
  )
  const phaseActs = acts.filter(
    (item) =>
      item.projectId === project.id &&
      item.lines.some((line) => lineIds.has(line.smetaLineId) || phaseOf(line.name) === phase.name),
  )
  const phaseOrders = orders.filter(
    (item) => item.project === project.name && phaseOf(`${item.product} ${item.note ?? ""}`) === phase.name,
  )
  const notes = project.notes.filter((item) => item.text.toLocaleLowerCase("az").includes(phase.name.toLocaleLowerCase("az")))
  const hasEvidence = lines.length + phaseReports.length + phaseActs.length + phaseOrders.length + notes.length > 0
  const status = done ? "Tamamlanıb" : phase.current ? "Davam edir" : "Gözləyir"

  return (
    <>
      <Link to={`/layiheler/${project.id}`} className="back">Layihəyə qayıt</Link>
      <header className="page-head">
        <div>
          <p className="eyebrow">{project.id} · {project.name}</p>
          <h1>{phase.name}</h1>
          <p className="lede">
            {done
              ? "Bu mərhələ tamamlanıb. Aşağıda bazada yazılmış prosedurlar və onlara bağlı qeydlər var."
              : "Bu mərhələ hələ tamamlanmayıb. Aşağıda bu addımda görüləcək işlər var."}
          </p>
        </div>
        <span className="muted">{status}</span>
      </header>
      <Panel className="pad">
        <PhaseTrack projectId={project.id} phases={project.phases} active={phase.name} />
      </Panel>

      {failed && <Empty title="Prosedurlar açılmadı" text="Mərhələ siyahısı bazadan gəlmədi. Səhifəni yeniləyin." />}
      {!failed && phaseRows === null && <p className="muted">Prosedurlar açılır.</p>}
      {!failed && phaseRows && phaseRows.length === 0 && (
        <Empty title="Prosedur yoxdur" text="Bu mərhələ üçün bazada iş sətri yazılmayıb." />
      )}
      {!failed && phaseRows && phaseRows.length > 0 && (
        <Panel className="pad">
          <h2>{done ? "Görülən prosedurlar" : "Görüləcək işlər"}</h2>
          <div className="mini-list">
            {phaseRows.map((item) => {
              const left = Math.max(0, Math.round((item.qty - item.doneQty) * 10) / 10)
              return (
                <article key={item.id}>
                  <div className="split">
                    <b>{item.name}</b>
                    {done ? (
                      <span>{num(item.doneQty, 1)} {item.unit}</span>
                    ) : (
                      <span>qalıq {num(left, 1)} {item.unit}</span>
                    )}
                  </div>
                  <p>{item.detail}</p>
                  <p className="muted">
                    {done
                      ? `Plan ${num(item.qty, 1)} ${item.unit}${item.doneOn ? ` · ${dateAZ(item.doneOn)}` : ""}`
                      : `Plan ${num(item.qty, 1)} ${item.unit}${item.doneQty > 0 ? ` · yazılıb ${num(item.doneQty, 1)} ${item.unit}` : ""}`}
                  </p>
                </article>
              )
            })}
          </div>
        </Panel>
      )}

      {hasEvidence && (
        <Panel className="pad">
          <h2>{done ? "Bu mərhələyə bağlı qeydlər" : "Artıq qeydə alınan həcm"}</h2>
          {lines.length > 0 && (
            <>
              <p className="block-title">Smeta</p>
              <div className="mini-list">
                {lines.map((line) => (
                  <article key={line.id} className="split">
                    <span>{line.code} {line.name}</span>
                    <span>{num(line.doneQty, 1)} / {num(line.qty, 1)} {line.unit}</span>
                  </article>
                ))}
              </div>
            </>
          )}
          {phaseReports.length > 0 && (
            <>
              <p className="block-title">Gündəlik</p>
              <div className="mini-list">
                {phaseReports.map((item) => (
                  <article key={item.id}>
                    <span className="mono">{dateAZ(item.date)}</span> {item.author}
                    <p>{item.note}</p>
                    {item.lines.filter((line) => lineIds.has(line.smetaLineId)).map((line) => {
                      const source = lines.find((row) => row.id === line.smetaLineId)
                      return (
                        <p key={line.smetaLineId} className="muted">
                          {source ? source.name : "Smeta sətri"} · {num(line.qty, 1)}
                        </p>
                      )
                    })}
                  </article>
                ))}
              </div>
            </>
          )}
          {phaseActs.length > 0 && (
            <>
              <p className="block-title">Akt</p>
              <div className="mini-list">
                {phaseActs.map((item) => (
                  <article key={item.id}>
                    <div className="split">
                      <b>{item.number}</b>
                      <span className="muted">{dateAZ(item.date)}</span>
                    </div>
                    {item.lines
                      .filter((line) => lineIds.has(line.smetaLineId) || phaseOf(line.name) === phase.name)
                      .map((line) => (
                        <p key={`${item.id}-${line.name}`} className="muted">
                          {line.code} {line.name} · {num(line.qty, 1)} {line.unit}
                        </p>
                      ))}
                  </article>
                ))}
              </div>
            </>
          )}
          {phaseOrders.length > 0 && (
            <>
              <p className="block-title">İş əmri</p>
              <div className="mini-list">
                {phaseOrders.map((item) => (
                  <article key={item.id} className="split">
                    <span>
                      {item.product}
                      <span className="muted"> · {num(item.qty, 1)} {item.unit}{item.note ? ` · ${item.note}` : ""}</span>
                    </span>
                    <Badge status={item.status} />
                  </article>
                ))}
              </div>
            </>
          )}
          {notes.length > 0 && (
            <>
              <p className="block-title">Sahə qeydi</p>
              <div className="mini-list">
                {notes.map((item) => (
                  <article key={item.id}>
                    <span className="mono">{dateAZ(item.date)}</span>
                    <p>{item.text}</p>
                  </article>
                ))}
              </div>
            </>
          )}
        </Panel>
      )}
    </>
  )
}
