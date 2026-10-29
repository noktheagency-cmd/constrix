import { StageBadge } from "../components/StageBadge"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Button, Disclosure, Input, Panel, SearchInput, TableContainer, Toolbar } from "../components/primitives"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ApiError, api } from "../api"
import { Icon } from "../icons"
import { STAGES, kindLabel, nextStage, showPath, stageLabel, type Stage } from "../procure/engine"
import { useProcure } from "../procure/store"
import { Meter, Modal, PageHead, Select, Tabs, useTitle } from "../ui"

function activeOf(state: ReturnType<typeof useProcure>) {
  return state.companies.find((item) => item.id === state.activeId)
}

function Guard({ children }: { children: ReactNode }) {
  const state = useProcure()
  const kind = activeOf(state)?.kind ?? ""
  if (showPath("/sifaris", kind)) return children
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
  return [date.getUTCDate(), date.getUTCMonth() + 1, date.getUTCFullYear()].map((part) => String(part).padStart(2, "0")).join(".")
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
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const picked = params.get("order")
  function setPicked(id: string) { navigate("?order=" + encodeURIComponent(id)) }
  const [creating, setCreating] = useState(false)
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
  const pageRef = useRef<HTMLDivElement>(null)

  const own = rows.filter((row) => row.mine)
  const shared = rows.filter((row) => !row.mine)
  const pool = scope === "terefdas" ? shared : own
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
      .catch((reason) => {
        setLoaded(true)
        setLoadError(reason instanceof ApiError ? reason.message : "Əvvəlki sifarişlər açılmadı")
      })
  }, [])

  useEffect(() => {
    pageRef.current?.closest("main")?.scrollTo({ top: 0, behavior: "instant" })
    setActionNote("")
  }, [picked])

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
      <div className="flow-page calc-page" ref={pageRef}>
        {picked && <Link className="offer-back" to="/sifaris"><Icon name="chevronLeft" />Sifarişlərə qayıt</Link>}
        <PageHead
          title={picked ? "Sifariş" : "Sifarişlər"}
          text={picked ? "Cari mərhələ və sifariş məlumatları." : "Sifarişləri izləyin və mərhələləri yeniləyin."}
        >
          <Button type="button" onClick={fresh}>Yeni sifariş</Button>
        </PageHead>

        {!picked && <>
          <Tabs value={scope} onChange={(value) => setScope(value as "oz" | "terefdas")} options={[{ id: "oz", label: "Öz sifarişlərim " + own.length }, { id: "terefdas", label: "Tərəfdaş sifarişləri " + shared.length }]} />
          <FlowFilters query={query} onQuery={setQuery} lens={lens} onLens={setLens} />
          <Panel className="flow-library"><FlowTable rows={shown} picked={picked} onOpen={setPicked} loaded={loaded} loadError={loadError} total={pool.length} /></Panel>
          <p className="calc-meta">{shown.length} sifariş</p>
        </>}
        {picked && <div className="flow-main">
          {open && <FlowSheet key={open.id} flow={open} person={person} date={date} note={note} docs={docs} saving={saving} actionNote={creating ? "" : actionNote} onPerson={setPerson} onDate={setDate} onNote={setNote} onDocs={setDocs} onAdvance={() => void advance(open)} />}
          {!open && <Panel className="pad flow-empty"><h2>{loaded ? "Sifariş tapılmadı" : "Sifariş açılır…"}</h2><p>{loadError || "Sifarişlər siyahısından işi seçin."}</p></Panel>}
        </div>}

        {creating && (
          <Modal wide className="flow-modal" title="Yeni sifariş" onClose={closeCreate}>
            <div className="calc-grid">
              <label className="calc-span-2"><span>Ad</span><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Port Baku fasad pəncərələri" /></label>
              <label><span>İstehsalçı</span><Select value={supplierId} onValueChange={setSupplierId} options={makerOptions} /></label>
              <label><span>Daşıyıcı</span><Select value={carrierId} onValueChange={setCarrierId} options={carrierOptions} /></label>
              <label><span>Montaj</span><Select value={installerId} onValueChange={setInstallerId} options={installerOptions} /></label>
              <label><span>Məsul</span><Input value={openPerson} onChange={(event) => setOpenPerson(event.target.value)} placeholder="Elvin Məmmədov" /></label>
              <label><span>Tarix</span><Input type="date" value={openDate} onChange={(event) => setOpenDate(event.target.value)} /></label>
              <label><span>Qeyd</span><Input value={openNote} onChange={(event) => setOpenNote(event.target.value)} /></label>
              <label><span>Sənəd</span><Input value={openDocs} onChange={(event) => setOpenDocs(event.target.value)} placeholder="sifaris.pdf" /></label>
            </div>
            <Button type="button" onClick={() => void createFlow()} disabled={!title.trim() || saving}>{saving ? "Yazılır…" : "Sifarişi aç"}</Button>
      {actionNote && <p className="calc-meta">{actionNote}</p>}
          </Modal>
        )}
      </div>
    </Guard>
  )
}

function FlowFilters({ query, onQuery, lens, onLens }: { query: string; onQuery: (value: string) => void; lens: Lens; onLens: (value: Lens) => void }) {
  return <Toolbar className="flow-toolbar">
    <SearchInput aria-label="Sifariş axtar" value={query} placeholder="Sifariş axtar — ad, layihə, məsul" onChange={(event) => onQuery(event.target.value)} />
    <Select ariaLabel="Mərhələ filtri" value={lens} onValueChange={(value) => onLens(value as Lens)} options={LENS.map((item) => ({ value: item.id, label: item.id === "hami" ? "Bütün mərhələlər" : item.label }))} />
  </Toolbar>
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
      {loadError && <p className="calc-meta" role="alert">{loadError}</p>}
      {!loaded && <p className="calc-meta" role="status">Sifarişlər açılır…</p>}
      {loaded && !loadError && total === 0 && <p className="calc-meta">Bazada saxlanmış sifariş yoxdur.</p>}
      {loaded && !loadError && total > 0 && rows.length === 0 && <p className="calc-meta">Bu axtarışa uyğun sifariş yoxdur.</p>}
      <TableContainer className="calc-table-wrap">
        <table className="calc-table flow-table">
          <thead>
            <tr>
              <th>Sifariş</th>
              <th>Layihə</th>
              <th>Mərhələ</th>
              <th>İstehsalçı</th>
              <th>Son yenilənmə</th>
              <th>Aç</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const event = lastEvent(row)
              return (
                <tr key={row.id} className={row.id === picked ? "on" : ""} tabIndex={0} onClick={() => onOpen(row.id)} onKeyDown={(eventKey) => { if (eventKey.key === "Enter" || eventKey.key === " ") { eventKey.preventDefault(); onOpen(row.id) } }}>
                  <td>{row.title}</td>
                  <td>{row.project?.name || "—"}</td>
                  <td><StageBadge stage={row.stage} /></td>
                  <td>{row.supplier?.name || "—"}</td>
                  <td>{event ? `${when(event.date)} · ${event.person}` : "—"}</td>
                  <td><Icon name="chevron" /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableContainer>
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
  const [tab, setTab] = useState("general")
  const here = stageAt(flow.stage)
  const upcoming = nextStage(flow.stage)
  const pct = Math.round(((here + 1) / STAGES.length) * 100)
  const event = lastEvent(flow)
  return (
    <Panel className="pad calc-card flow-sheet">
      <div className="calc-card-head">
        <h2>{flow.title}</h2>
        <StageBadge stage={flow.stage} />
      </div>
      <p className="calc-meta">{flow.project?.name || "Layihə bağlanmayıb"}{event ? ` · son keçid ${when(event.date)}` : ""}</p>
      <Meter value={pct} tone="pine" />
      <p className="calc-meta">Mərhələ {here + 1} / {STAGES.length}</p>
      <Tabs value={tab} onChange={setTab} options={[{ id: "general", label: "Ümumi məlumat" }, { id: "history", label: "Tarixçə " + flow.events.length }]} />
      {tab === "general" && <><div className="flow-parties">
        <div><span>İstehsalçı</span><b>{flow.supplier?.name || "Seçilməyib"}</b></div>
        <div><span>Daşıyıcı</span><b>{flow.carrier?.name || "Seçilməyib"}</b></div>
        <div><span>Montaj</span><b>{flow.installer?.name || "Seçilməyib"}</b></div>
      </div>
      {flow.mine && upcoming && (
        <div className="flow-advance">
          <h3>Növbəti: {stageLabel(upcoming)}</h3>
          <div className="flow-next">
            <label><span>Məsul</span><Input value={person} onChange={(event) => onPerson(event.target.value)} placeholder="Ad soyad" /></label>
            <label><span>Tarix</span><Input type="date" value={date} onChange={(event) => onDate(event.target.value)} /></label>
          </div>
          <Disclosure title="Qeyd və sənəd"><div className="flow-next">
            <label className="flow-next-wide"><span>Qeyd</span><Input value={note} onChange={(event) => onNote(event.target.value)} placeholder="Nə baş verdi" /></label>
            <label className="flow-next-wide"><span>Sənəd</span><Input value={docs} onChange={(event) => onDocs(event.target.value)} placeholder="akt.pdf" /></label>
          </div>
          </Disclosure>
          <Button type="button" onClick={onAdvance} disabled={!person.trim() || !date.trim() || saving}>{saving ? "Yazılır…" : "Mərhələni təsdiqlə"}</Button>
        </div>
      )}
      {flow.stage === "zemanet" && <p className="calc-meta">Sifariş zəmanət mərhələsindədir. Keçmiş qeydlər Tarixçə tabındadır.</p>}
            </>}
      {tab === "history" && <div className="flow-history">
        {flow.events.length === 0 && <p className="calc-meta">Hələ mərhələ qeydi yoxdur.</p>}
        <ol className="flow-rail">{[...flow.events].sort((a, b) => b.date.localeCompare(a.date)).map((item) => <li key={item.id} className="flow-step done">
          <div className="flow-mark" aria-hidden="true"><i /><span /></div><div><b>{stageLabel(item.stage)}</b><p>{item.person || "Məsul yazılmayıb"} · {when(item.date)}</p>{item.note && <p>{item.note}</p>}{item.docs && <em>{item.docs}</em>}</div>
        </li>)}</ol>
        <Disclosure title="Bütün mərhələlər"><ol className="flow-all-stages">{STAGES.map(([key, label], index) => <li key={key} aria-current={key === flow.stage ? "step" : undefined}>{label}{key === flow.stage ? " · Cari mərhələ" : index < here ? " · Keçilib" : ""}</li>)}</ol></Disclosure>
      </div>}
      {actionNote && <p className="calc-meta">{actionNote}</p>}
    </Panel>
  )
}
