import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ApiError, api } from "../api"
import { Icon } from "../icons"
import { STAGES, kindLabel, nextStage, showPath, stageLabel, type Stage } from "../procure/engine"
import { useProcure } from "../procure/store"
import { Meter, Modal, PageHead, Select, useTitle } from "../ui"

function activeOf(state: ReturnType<typeof useProcure>) {
  return state.companies.find((item) => item.id === state.activeId)
}

function Guard({ children }: { children: ReactNode }) {
  const state = useProcure()
  const kind = activeOf(state)?.kind ?? ""
  if (showPath("/sifaris-merhele", kind)) return children
  return <PageHead kicker="Kabinet" title="Bu bölmə bağlıdır" text={`${kind ? kindLabel(kind) : "Şirkət seçilməyib"}. Bu növün kabinetində həmin iş yoxdur.`} />
}

type Party = { id: string; name: string } | null
type Partner = { id: string; name: string; kind: string }
type FlowEvent = { id: string; stage: Stage; person: string; date: string; note: string; docs: string }
type SavedFlow = {
  id: string
  title: string
  stage: Stage
  mine: boolean
  createdAt: string
  supplier: Party
  carrier: Party
  installer: Party
  project: { id: string; name: string } | null
  events: FlowEvent[]
}
type FlowList = { partners: Partner[]; flows: SavedFlow[] }
type Lens = "hami" | "aciq" | "istehsal" | "sahe" | "bagli"

const MAKERS = new Set(["qapi", "suse", "pvc", "fasad", "material"])
const LENS: { id: Lens; label: string }[] = [
  { id: "hami", label: "Hamısı" },
  { id: "aciq", label: "Açıq" },
  { id: "istehsal", label: "İstehsal" },
  { id: "sahe", label: "Sahə" },
  { id: "bagli", label: "Bağlı" },
]

function when(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("az-AZ", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
}

function lastEvent(flow: SavedFlow) {
  return [...flow.events].sort((a, b) => a.date.localeCompare(b.date)).at(-1) ?? null
}

function sortFlows(rows: SavedFlow[]) {
  return rows.slice().sort((a, b) => (lastEvent(b)?.date ?? b.createdAt).localeCompare(lastEvent(a)?.date ?? a.createdAt))
}

function stageAt(stage: Stage) {
  const index = STAGES.findIndex((item) => item[0] === stage)
  return index < 0 ? 0 : index
}

function matches(flow: SavedFlow, lens: Lens) {
  if (lens === "aciq") return flow.stage !== "tehvil" && flow.stage !== "zemanet"
  if (lens === "istehsal") return flow.stage === "istehsal" || flow.stage === "yoxlama"
  if (lens === "sahe") return flow.stage === "dasima" || flow.stage === "montaj"
  if (lens === "bagli") return flow.stage === "tehvil" || flow.stage === "zemanet"
  return true
}

function partyLine(flow: SavedFlow) {
  return [flow.supplier?.name, flow.carrier?.name, flow.installer?.name].filter(Boolean).join(" · ")
}

export function FlowPage() {
  useTitle("Sifariş")
  const [rows, setRows] = useState<SavedFlow[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [query, setQuery] = useState("")
  const [lens, setLens] = useState<Lens>("hami")
  const [scope, setScope] = useState<"oz" | "terefdas">("oz")
  const [picked, setPicked] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [large, setLarge] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [title, setTitle] = useState("")
  const [supplierId, setSupplierId] = useState("")
  const [carrierId, setCarrierId] = useState("")
  const [installerId, setInstallerId] = useState("")
  const [openPerson, setOpenPerson] = useState("")
  const [openDate, setOpenDate] = useState("")
  const [openNote, setOpenNote] = useState("")
  const [openDocs, setOpenDocs] = useState("")
  const [person, setPerson] = useState("")
  const [date, setDate] = useState("")
  const [note, setNote] = useState("")
  const [docs, setDocs] = useState("")
  const [saving, setSaving] = useState(false)
  const [actionNote, setActionNote] = useState("")
  const historyRef = useRef<HTMLElement>(null)

  const own = rows.filter((row) => row.mine)
  const shared = rows.filter((row) => !row.mine)
  const pool = scope === "terefdas" ? shared : own.length ? own : rows
  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("az")
    return pool.filter((row) => {
      if (!matches(row, lens)) return false
      if (!needle) return true
      const blob = `${row.title} ${row.project?.name ?? ""} ${partyLine(row)} ${row.events.map((event) => `${event.person} ${event.note} ${event.docs}`).join(" ")}`
      return blob.toLocaleLowerCase("az").includes(needle)
    })
  }, [pool, query, lens])
  const open = rows.find((row) => row.id === picked) ?? null
  const closed = own.filter((row) => row.stage === "zemanet").length
  const active = own.filter((row) => row.stage !== "zemanet").length
  const latest = own[0] ? stageLabel(own[0].stage) : "—"

  function reload() {
    return api<FlowList>("/api/platform/flows").then((payload) => {
      const flows = sortFlows(payload.flows)
      setRows(flows)
      setPartners(payload.partners)
      setLoaded(true)
      setLoadError("")
      return flows
    })
  }

  useEffect(() => {
    reload()
      .then((flows) => {
        const mine = flows.filter((row) => row.mine)
        setPicked((mine[0] ?? flows[0])?.id ?? "")
      })
      .catch((reason) => {
        setLoaded(true)
        setLoadError(reason instanceof ApiError ? reason.message : "Əvvəlki sifarişlər açılmadı")
      })
  }, [])

  useEffect(() => {
    if (!large) return
    historyRef.current?.scrollIntoView({ block: "start" })
  }, [large])

  useEffect(() => {
    setPerson("")
    setDate(new Date().toISOString().slice(0, 10))
    setNote("")
    setDocs("")
  }, [picked])

  function fresh() {
    setCreating(true)
    setTitle("")
    setSupplierId("")
    setCarrierId("")
    setInstallerId("")
    setOpenPerson("")
    setOpenDate(new Date().toISOString().slice(0, 10))
    setOpenNote("")
    setOpenDocs("")
    setActionNote("")
  }

  function closeCreate() {
    setCreating(false)
    setActionNote("")
  }

  async function createFlow() {
    if (!title.trim()) return
    setSaving(true)
    setActionNote("")
    try {
      const saved = await api<{ id: string }>("/api/platform/flows", {
        method: "POST",
        body: JSON.stringify({
          title,
          supplierId,
          carrierId,
          installerId,
          person: openPerson,
          date: openDate,
          note: openNote,
          docs: openDocs,
        }),
      })
      await reload()
      setCreating(false)
      setPicked(saved.id)
      setTitle("")
      setOpenNote("")
      setOpenDocs("")
      setActionNote("Sifariş açıldı")
    } catch (reason) {
      setActionNote(reason instanceof ApiError ? reason.message : "Sifariş açılmadı")
    } finally {
      setSaving(false)
    }
  }

  async function advance(flow: SavedFlow) {
    const stage = nextStage(flow.stage)
    if (!stage || !person.trim() || !date.trim()) return
    setSaving(true)
    setActionNote("")
    try {
      await api(`/api/platform/flows/${flow.id}/advance`, {
        method: "POST",
        body: JSON.stringify({ person, date, note, docs }),
      })
      await reload()
      setPicked(flow.id)
      setNote("")
      setDocs("")
      setActionNote(`${stageLabel(stage)} yazıldı`)
    } catch (reason) {
      setActionNote(reason instanceof ApiError ? reason.message : "Mərhələ yazılmadı")
    } finally {
      setSaving(false)
    }
  }

  const makerOptions = [{ value: "", label: "Seçilməyib" }, ...partners.filter((item) => MAKERS.has(item.kind)).map((item) => ({ value: item.id, label: item.name }))]
  const carrierOptions = [{ value: "", label: "Seçilməyib" }, ...partners.filter((item) => item.kind === "logistika").map((item) => ({ value: item.id, label: item.name }))]
  const installerOptions = [{ value: "", label: "Seçilməyib" }, ...partners.filter((item) => item.kind === "montaj").map((item) => ({ value: item.id, label: item.name }))]

  return (
    <Guard>
      <div className="flow-page calc-page">
        <PageHead
          kicker="Sifariş"
          title="Sifariş mərhələləri"
          text="Keçmiş sifarişlər, məsul və sənəd bazada qalır. Hər mərhələ bir-bir irəliləyir."
        >
          <button type="button" className="btn" onClick={fresh}>Yeni sifariş</button>
        </PageHead>

        <div className="calc-stats">
          <article><span>Sifariş</span><strong>{own.length || rows.length}</strong></article>
          <article><span>Açıq</span><strong>{active}</strong></article>
          <article><span>Zəmanətdə</span><strong>{closed}</strong></article>
          <article><span>Son mərhələ</span><strong>{latest}</strong></article>
        </div>

        {large && (
          <section className="panel pad calc-card calc-history-wide" ref={historyRef}>
            <div className="calc-card-head">
              <h2>Keçmiş sifarişlər</h2>
              <div className="haul-history-tools">
                <button type="button" className="icon-btn" aria-label="Daralt" onClick={() => setLarge(false)}><Icon name="narrow" /></button>
                <span>{shown.length}</span>
              </div>
            </div>
            <FlowFilters query={query} onQuery={setQuery} lens={lens} onLens={setLens} scope={scope} onScope={setScope} shared={shared.length} />
            <FlowTable rows={shown} picked={picked} onOpen={setPicked} loaded={loaded} loadError={loadError} total={pool.length} />
          </section>
        )}

        <div className="flow-board">
          {!large && (
            <aside className="flow-aside">
              <div className="calc-card-head">
                <h2>Keçmiş sifarişlər</h2>
                <div className="haul-history-tools">
                  <button type="button" className="icon-btn" aria-label="Genişləndir" onClick={() => setLarge(true)}><Icon name="widen" /></button>
                  <span>{shown.length}</span>
                </div>
              </div>
              <FlowFilters query={query} onQuery={setQuery} lens={lens} onLens={setLens} scope={scope} onScope={setScope} shared={shared.length} />
              <FlowTable rows={shown} picked={picked} onOpen={setPicked} loaded={loaded} loadError={loadError} total={pool.length} />
            </aside>
          )}

          <div className="flow-main">
            {open && <FlowSheet flow={open} person={person} date={date} note={note} docs={docs} saving={saving} actionNote={creating ? "" : actionNote} onPerson={setPerson} onDate={setDate} onNote={setNote} onDocs={setDocs} onAdvance={() => void advance(open)} />}

            {!open && loaded && !loadError && (
              <section className="panel pad calc-card flow-empty">
                <h2>Sifariş seçin</h2>
                <p>Keçmiş sifariş cədvəldədir. Yeni iş «Yeni sifariş» düyməsindən açılır.</p>
              </section>
            )}
          </div>
        </div>

        {creating && (
          <Modal wide className="flow-modal" title="Yeni sifariş" onClose={closeCreate}>
            <div className="calc-grid">
              <label className="calc-span-2"><span>Ad</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Port Baku fasad pəncərələri" /></label>
              <label><span>İstehsalçı</span><Select value={supplierId} onValueChange={setSupplierId} options={makerOptions} /></label>
              <label><span>Daşıyıcı</span><Select value={carrierId} onValueChange={setCarrierId} options={carrierOptions} /></label>
              <label><span>Montaj</span><Select value={installerId} onValueChange={setInstallerId} options={installerOptions} /></label>
              <label><span>Məsul</span><input value={openPerson} onChange={(event) => setOpenPerson(event.target.value)} placeholder="Elvin Məmmədov" /></label>
              <label><span>Tarix</span><input type="date" value={openDate} onChange={(event) => setOpenDate(event.target.value)} /></label>
              <label><span>Qeyd</span><input value={openNote} onChange={(event) => setOpenNote(event.target.value)} /></label>
              <label><span>Sənəd</span><input value={openDocs} onChange={(event) => setOpenDocs(event.target.value)} placeholder="sifaris.pdf" /></label>
            </div>
            <button type="button" className="btn" onClick={() => void createFlow()} disabled={!title.trim() || saving}>{saving ? "Yazılır…" : "Sifarişi aç"}</button>
            {actionNote && <p className="calc-meta">{actionNote}</p>}
          </Modal>
        )}
      </div>
    </Guard>
  )
}

function FlowFilters({
  query,
  onQuery,
  lens,
  onLens,
  scope,
  onScope,
  shared,
}: {
  query: string
  onQuery: (value: string) => void
  lens: Lens
  onLens: (value: Lens) => void
  scope: "oz" | "terefdas"
  onScope: (value: "oz" | "terefdas") => void
  shared: number
}) {
  return (
    <>
      <input className="calc-search" value={query} placeholder="Ad, layihə, məsul və ya sənəd" onChange={(event) => onQuery(event.target.value)} />
      <div className="haul-filters">
        {LENS.map((item) => (
          <button key={item.id} type="button" className={lens === item.id ? "calc-chip on" : "calc-chip"} onClick={() => onLens(item.id)}>
            <b>{item.label}</b>
          </button>
        ))}
        {shared > 0 && (
          <button type="button" className={scope === "terefdas" ? "calc-chip on" : "calc-chip"} onClick={() => onScope(scope === "terefdas" ? "oz" : "terefdas")}>
            <b>Tərəfdaş</b>
            <span>{shared}</span>
          </button>
        )}
      </div>
    </>
  )
}

function FlowTable({
  rows,
  picked,
  onOpen,
  loaded,
  loadError,
  total,
}: {
  rows: SavedFlow[]
  picked: string | null
  onOpen: (id: string) => void
  loaded: boolean
  loadError: string
  total: number
}) {
  return (
    <>
      {loadError && <p className="calc-meta">{loadError}</p>}
      {loaded && !loadError && total === 0 && <p className="calc-meta">Bazada saxlanmış sifariş yoxdur.</p>}
      {loaded && !loadError && total > 0 && rows.length === 0 && <p className="calc-meta">Bu axtarışa uyğun sifariş yoxdur.</p>}
      <div className="calc-table-wrap">
        <table className="calc-table flow-table">
          <thead>
            <tr>
              <th>Sifariş</th>
              <th>Layihə</th>
              <th>Mərhələ</th>
              <th>İstehsalçı</th>
              <th>Son keçid</th>
              <th>İrəliləyiş</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const event = lastEvent(row)
              return (
                <tr key={row.id} className={row.id === picked ? "on" : ""} tabIndex={0} onClick={() => onOpen(row.id)} onKeyDown={(eventKey) => { if (eventKey.key === "Enter" || eventKey.key === " ") { eventKey.preventDefault(); onOpen(row.id) } }}>
                  <td>{row.title}</td>
                  <td>{row.project?.name || "—"}</td>
                  <td><span className={row.stage === "zemanet" ? "haul-fit uygun" : "haul-fit tutum"}>{stageLabel(row.stage)}</span></td>
                  <td>{row.supplier?.name || "—"}</td>
                  <td>{event ? `${when(event.date)} · ${event.person}` : "—"}</td>
                  <td>{stageAt(row.stage) + 1}/13</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function FlowSheet({
  flow,
  person,
  date,
  note,
  docs,
  saving,
  actionNote,
  onPerson,
  onDate,
  onNote,
  onDocs,
  onAdvance,
}: {
  flow: SavedFlow
  person: string
  date: string
  note: string
  docs: string
  saving: boolean
  actionNote: string
  onPerson: (value: string) => void
  onDate: (value: string) => void
  onNote: (value: string) => void
  onDocs: (value: string) => void
  onAdvance: () => void
}) {
  const here = stageAt(flow.stage)
  const upcoming = nextStage(flow.stage)
  const pct = Math.round(((here + 1) / STAGES.length) * 100)
  const event = lastEvent(flow)
  return (
    <section className="panel pad calc-card flow-sheet">
      <div className="calc-card-head">
        <h2>{flow.title}</h2>
        <span className={flow.stage === "zemanet" ? "haul-fit uygun" : "haul-fit tutum"}>{stageLabel(flow.stage)}</span>
      </div>
      <p className="calc-meta">{flow.project?.name || "Layihə bağlanmayıb"}{event ? ` · son keçid ${when(event.date)}` : ""}</p>
      <Meter value={pct} tone="pine" />
      <div className="flow-parties">
        <div><span>İstehsalçı</span><b>{flow.supplier?.name || "Seçilməyib"}</b></div>
        <div><span>Daşıyıcı</span><b>{flow.carrier?.name || "Seçilməyib"}</b></div>
        <div><span>Montaj</span><b>{flow.installer?.name || "Seçilməyib"}</b></div>
      </div>
      <ol className="flow-rail">
        {STAGES.map(([key, label], index) => {
          const hit = [...flow.events].reverse().find((item) => item.stage === key)
          const state = index < here ? "done" : index === here ? "here" : "wait"
          return (
            <li key={key} className={`flow-step ${state}`}>
              <div className="flow-mark" aria-hidden="true"><i /><span /></div>
              <div>
                <b>{index + 1}. {label}</b>
                {hit ? (
                  <>
                    <p>{hit.person} · {when(hit.date)}</p>
                    {hit.note && <p>{hit.note}</p>}
                    {hit.docs && <em>{hit.docs}</em>}
                  </>
                ) : (
                  <p>{state === "here" ? "Bu mərhələdədir" : "Gözləyir"}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {flow.mine && upcoming && (
        <div className="flow-advance">
          <h3>Növbəti: {stageLabel(upcoming)}</h3>
          <div className="flow-next">
            <label><span>Məsul</span><input value={person} onChange={(event) => onPerson(event.target.value)} placeholder="Ad soyad" /></label>
            <label><span>Tarix</span><input type="date" value={date} onChange={(event) => onDate(event.target.value)} /></label>
            <label className="flow-next-wide"><span>Qeyd</span><input value={note} onChange={(event) => onNote(event.target.value)} placeholder="Nə baş verdi" /></label>
            <label className="flow-next-wide"><span>Sənəd</span><input value={docs} onChange={(event) => onDocs(event.target.value)} placeholder="akt.pdf" /></label>
          </div>
          <button type="button" className="btn" onClick={onAdvance} disabled={!person.trim() || !date.trim() || saving}>{saving ? "Yazılır…" : "Mərhələni yaz"}</button>
        </div>
      )}
      {flow.stage === "zemanet" && <p className="calc-meta">Sifariş zəmanət mərhələsindədir. Keçmiş qeydlər yuxarıda qalır.</p>}
      {actionNote && <p className="calc-meta">{actionNote}</p>}
    </section>
  )
}
