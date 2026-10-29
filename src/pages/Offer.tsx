import { DataTable } from '../components/DataTable'
import { StageBadge } from "../components/StageBadge"
import { Button, Disclosure, Panel, SearchInput, TableContainer, Toolbar } from "../components/primitives"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { ApiError, api, dec } from "../api"
import { Icon } from "../icons"
import { PageHead, Tabs, useTitle } from "../ui"
import {
  OPENINGS,
  framePieces,
  kindLabel,
  showPath,
  windowMath,
  type Opening,
  type ProfileRule,
  type Stage,
  type WindowInput,
} from "../procure/engine"
import { useProcure } from "../procure/store"

function activeOf(state: ReturnType<typeof useProcure>) {
  return state.companies.find((item) => item.id === state.activeId)
}

function Guard({ children }: { children: ReactNode }) {
  const state = useProcure()
  const kind = activeOf(state)?.kind ?? ""
  if (showPath("/teklif", kind)) return children
  return <PageHead kicker="Kabinet" title="Bu bölmə bağlıdır" text={`${kind ? kindLabel(kind) : "Şirkət seçilməyib"}. Bu növün kabinetində həmin iş yoxdur.`} />
}

type OfferLine = { id: string; name: string; unit: string; qty: unknown; rate: unknown; amount: unknown; note: string }
type OfferProduct = {
  id: string
  name: string
  code: string
  unit: string
  price: unknown
  category: string
  organization: { name: string } | null
}
type OfferJob = {
  id: string
  title: string
  widthMm: unknown
  heightMm: unknown
  count: unknown
  sections: number
  opening: Opening
  color: string
  profileNote: string
  glassKind: string
  glassThickness: string
  hardware: string
  installKind: string
  address: string
  profileUnit: string
  profileRate: unknown
  glassRate: unknown
  hardwareRate: unknown
  laborRate: unknown
  installRate: unknown
  packRate: unknown
  transport: unknown
  extra: unknown
  vatPercent: unknown
  profitPercent: unknown
  profitMode: WindowInput["profitMode"]
  glassConfirmed: boolean
  ruleId: string | null
  lengthM: unknown
  weightKg: unknown
  cutArea: unknown
  cost: unknown
  profitAmount: unknown
  vatAmount: unknown
  sale: unknown
  gross: unknown
  createdAt: string
  rule: { id: string; system: string; confirmed: boolean; kgPerM: unknown; wastePercent: unknown; glassDeductMm: unknown; glassWastePercent: unknown } | null
  lines: OfferLine[]
  products: { productId: string; product: OfferProduct | null }[]
  schedule: { produceDays: number; haulDays: number; installDays: number; weatherDays: number; totalDays: number; startOn: string | null; endOn: string | null } | null
  flow: { stage: Stage; title: string } | null
  project: { name: string } | null
}
type ApiRule = {
  id: string
  trade: string
  system: string
  confirmed: boolean
  kgPerM: unknown
  wastePercent: unknown
  glassDeductMm: unknown
  glassWastePercent: unknown
}
type MarketProduct = { id: string; name: string; code: string; category: string; unit: string; price: unknown; supplier?: string; stale?: boolean }
type Alt = { id: string; name: string; supplier: string; price: number; unit: string }

const UNIT: Record<string, string> = { m: "m", kq: "kq", m2: "m²", dest: "dəst", eded: "ədəd", sifaris: "sifariş" }
const PROFILE_CATEGORIES = new Set(["Alüminium sistemləri", "Qapı və pəncərələr", "Fasad sistemləri"])
const OPENING_LABEL = Object.fromEntries(OPENINGS) as Record<string, string>

function num(value: unknown) {
  if (value == null || value === "") return null
  const parsed = Number(String(value).replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
}

function azn(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—"
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₼`
}

function qty(value: unknown) {
  const parsed = num(value)
  if (parsed == null) return "—"
  return parsed.toLocaleString("fr-FR", { maximumFractionDigits: 3 })
}

function when(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return [date.getDate(), date.getMonth() + 1, date.getFullYear()].map((part) => String(part).padStart(2, "0")).join(".")
}

function unitLabel(unit: string) {
  return UNIT[unit] || unit || "—"
}

function asRule(row: NonNullable<OfferJob["rule"]> | ApiRule | null | undefined): ProfileRule | undefined {
  if (!row) return undefined
  return {
    id: row.id,
    companyId: "",
    system: row.system,
    confirmed: row.confirmed,
    kgPerM: dec(row.kgPerM),
    wastePercent: dec(row.wastePercent),
    glassDeductMm: dec(row.glassDeductMm),
    glassWastePercent: dec(row.glassWastePercent),
  }
}

function asInput(job: OfferJob): WindowInput {
  return {
    title: job.title,
    width: dec(job.widthMm),
    height: dec(job.heightMm),
    count: dec(job.count) || "1",
    opening: job.opening || "doner",
    sections: String(job.sections || 1),
    systemId: job.ruleId || "",
    color: job.color || "",
    profileNote: job.profileNote || "",
    glassKind: job.glassKind || "",
    glassThickness: job.glassThickness || "",
    hardware: job.hardware || "",
    installKind: job.installKind || "",
    address: job.address || "",
    profileUnit: job.profileUnit === "kq" ? "kq" : "m",
    profileRate: dec(job.profileRate),
    glassRate: dec(job.glassRate),
    hardwareRate: dec(job.hardwareRate),
    laborRate: dec(job.laborRate),
    installRate: dec(job.installRate),
    packRate: dec(job.packRate),
    transport: dec(job.transport),
    extra: dec(job.extra),
    vat: dec(job.vatPercent) || "18",
    profit: dec(job.profitPercent) || "10",
    profitMode: job.profitMode === "marja" ? "marja" : "faiz",
    glassConfirmed: job.glassConfirmed,
  }
}

function csvCell(value: string | number | null) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }))
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

function sheet(job: OfferJob) {
  const lines = [
    ["Sənəd", "Dəyər"],
    ["İş", job.title],
    ["Layihə", job.project?.name || ""],
    ["Ünvan", job.address],
    ["Ölçü", `${dec(job.widthMm)} × ${dec(job.heightMm)} × ${dec(job.count)}`],
    ...job.lines.map((line) => [line.name, line.amount == null ? "" : String(line.amount)]),
    ["Maya", job.cost == null ? "" : String(job.cost)],
    ["Mənfəət", job.profitAmount == null ? "" : String(job.profitAmount)],
    ["ƏDV", job.vatAmount == null ? "" : String(job.vatAmount)],
    ["Satış", job.gross == null ? "" : String(job.gross)],
  ]
  return lines.map((line) => line.map(csvCell).join(",")).join("\n")
}

export function OfferPage() {
  useTitle("Təklif")
  const [jobs, setJobs] = useState<OfferJob[]>([])
  const [market, setMarket] = useState<MarketProduct[]>([])
  const [rules, setRules] = useState<ProfileRule[]>([])
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const jobId = params.get("offer") || ""
  const [query, setQuery] = useState("")
  const [tab, setTab] = useState("sened")
  const [loadError, setLoadError] = useState("")
  const [loading, setLoading] = useState(true)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [excel, setExcel] = useState(true)
  const [pdf, setPdf] = useState(true)
  const downloadRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDownloadOpen(false)
    setTab("sened")
    pageRef.current?.closest("main")?.scrollTo({ top: 0, behavior: "instant" })
  }, [jobId])

  useEffect(() => {
    let closed: HTMLDetailsElement[] = []
    const prepare = () => {
      closed = Array.from(sheetRef.current?.querySelectorAll<HTMLDetailsElement>("details:not([open])") ?? [])
      closed.forEach((element) => { element.open = true })
    }
    const restore = () => { closed.forEach((element) => { element.open = false }); closed = [] }
    window.addEventListener("beforeprint", prepare)
    window.addEventListener("afterprint", restore)
    return () => { window.removeEventListener("beforeprint", prepare); window.removeEventListener("afterprint", restore) }
  }, [])

  useEffect(() => {
    if (!downloadOpen) return
    function close(event: MouseEvent) {
      if (!downloadRef.current?.contains(event.target as Node)) setDownloadOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setDownloadOpen(false)
    }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", onKey)
    }
  }, [downloadOpen])

  useEffect(() => {
    let live = true
    Promise.allSettled([
      api<OfferJob[]>("/api/platform/jobs"),
      api<ApiRule[]>("/api/platform/rules"),
      api<MarketProduct[]>("/api/platform/market/products"),
    ]).then(([jobRows, ruleRows, marketRows]) => {
      if (!live) return
      if (jobRows.status === "fulfilled") {
        setJobs(jobRows.value)
        setLoadError("")
      } else {
        setLoadError(jobRows.reason instanceof ApiError ? jobRows.reason.message : "Təkliflər açılmadı")
      }
      if (ruleRows.status === "fulfilled") {
        setRules(ruleRows.value.filter((row) => row.kgPerM != null || row.confirmed).map((row) => asRule(row)!))
      }
      if (marketRows.status === "fulfilled") setMarket(marketRows.value)
      setLoading(false)
    })
    return () => {
      live = false
    }
  }, [])

  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("az")
    if (!needle) return jobs
    return jobs.filter((job) => `${job.title} ${job.address} ${job.color} ${job.project?.name ?? ""} ${job.rule?.system ?? ""}`.toLocaleLowerCase("az").includes(needle))
  }, [jobs, query])

  const job = jobs.find((item) => item.id === jobId) ?? null
  const rule = job ? rules.find((item) => item.id === job.ruleId) ?? asRule(job.rule) : undefined
  const input = job ? asInput(job) : null
  const math = input ? windowMath(input, rule) : null
  const width = job ? num(job.widthMm) : null
  const height = job ? num(job.heightMm) : null
  const count = job ? num(job.count) : null
  const pieces = width && height && count ? framePieces(width, height, job?.sections || 1, count).pieces : []

  const alternatives = useMemo(() => {
    if (!job || !input) return []
    const fromMarket: Alt[] = market
      .filter((item) => item.unit === "m" && PROFILE_CATEGORIES.has(item.category) && !item.stale && num(item.price) != null)
      .map((item) => ({ id: item.id, name: item.name, supplier: item.supplier || "", price: num(item.price) as number, unit: item.unit }))
    const source = fromMarket.length
      ? fromMarket
      : (job.products ?? []).flatMap((link) => {
          const product = link.product
          const price = product ? num(product.price) : null
          if (!product || product.unit !== "m" || !PROFILE_CATEGORIES.has(product.category) || price == null) return []
          return [{ id: product.id, name: product.name, supplier: product.organization?.name || "", price, unit: product.unit }]
        })
    return source.map((item) => ({
      ...item,
      math: windowMath({ ...input, profileRate: String(item.price), profileUnit: "m" }, rule),
    }))
  }, [job, input, market, rule])

  const related = market.filter((item) => item.unit !== "m" && !item.stale && num(item.price) != null && ["Şüşə", "Qapı və pəncərələr", "Fasad sistemləri"].includes(item.category))
  const readyGross = alternatives.map((item) => item.math.gross).filter((value): value is number => value != null)
  const best = readyGross.length ? Math.min(...readyGross) : null
  const currentRate = job ? num(job.profileRate) : null

  function runDownload() {
    if (!job || (!excel && !pdf)) return
    if (excel) download(`${job.title || "teklif"}.csv`, sheet(job))
    if (pdf) window.print()
    setDownloadOpen(false)
  }

  return (
    <Guard>
      <div className="offer-page" ref={pageRef}>
        {jobId && <Link className="offer-back no-print" to="/teklif"><Icon name="chevronLeft" />Təkliflərə qayıt</Link>}
        <PageHead title={jobId ? "Kommersiya təklifi" : "Kommersiya təklifləri"} text={jobId ? "Təklif sənədi, materiallar və iş məlumatları." : "Saxlanmış hesabları seçin və təklif sənədini açın."}>
          {!jobId && <Link to="/hesablama" className="btn">Yeni hesab</Link>}
          {job && <div className="offer-download no-print" ref={downloadRef}>
            <button type="button" className={downloadOpen ? "offer-dl on" : "offer-dl"} disabled={!job} aria-expanded={downloadOpen} onClick={() => setDownloadOpen((open) => !open)}>
              <Icon name="download" />
              Yüklə
            </button>
            {downloadOpen && (
              <div className="offer-download-pop" role="group" aria-label="Endirmə">
                <p>Format</p>
                <label className={excel ? "on" : ""}>
                  <input type="checkbox" checked={excel} onChange={(event) => setExcel(event.target.checked)} />
                  <span className="offer-check" aria-hidden="true" />
                  <span><b>CSV</b><small>Excel-də açılan cədvəl</small></span>
                </label>
                <label className={pdf ? "on" : ""}>
                  <input type="checkbox" checked={pdf} onChange={(event) => setPdf(event.target.checked)} />
                  <span className="offer-check" aria-hidden="true" />
                  <span><b>PDF</b><small>Çap sənədi</small></span>
                </label>
                <Button type="button" className="small" disabled={!excel && !pdf} onClick={runDownload}>Yüklə</Button>
              </div>
            )}
          </div>}
        </PageHead>

        {!jobId && <>
          <Toolbar className="offer-list-toolbar">
            <SearchInput aria-label="Təklif axtar" value={query} placeholder="Təklif axtar — ad, ünvan, layihə" onChange={(event) => setQuery(event.target.value)} />
            <span>{shown.length} təklif</span>
          </Toolbar>
          {loadError && <p className="calc-meta" role="alert">{loadError}</p>}
          {loading && <p className="calc-meta" role="status">Təkliflər açılır…</p>}
          {!loading && !loadError && shown.length === 0 && <Panel className="pad offer-empty"><h2>{jobs.length ? "Təklif tapılmadı" : "Hələ təklif yoxdur"}</h2><p>{jobs.length ? "Başqa ad və ya ünvanla axtarın." : "Hesablamada yeni iş saxlayın. Təklif burada görünəcək."}</p></Panel>}
          {shown.length > 0 && <TableContainer className="offer-library"><DataTable className="offer-table">
            <thead><tr><th>Təklif</th><th>Layihə və ünvan</th><th>Tarix</th><th>Mərhələ</th><th className="num">Məbləğ</th><th><span className="sr-only">Aç</span></th></tr></thead>
            <tbody>{shown.map((item) => <tr key={item.id} tabIndex={0} aria-label={item.title + " təklifini aç"} onClick={(event) => { if ((event.target as HTMLElement).closest("a")) return; setTab("sened"); navigate("?offer=" + encodeURIComponent(item.id)) }} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setTab("sened"); navigate("?offer=" + encodeURIComponent(item.id)) } }}>
              <td><Link to={"?offer=" + encodeURIComponent(item.id)} onClick={() => setTab("sened")}>{item.title}</Link></td>
              <td><strong>{item.project?.name || "—"}</strong><span>{item.address || "Ünvan yazılmayıb"}</span></td>
              <td>{when(item.createdAt)}</td><td>{item.flow ? <StageBadge stage={item.flow.stage} /> : "—"}</td><td className="num">{azn(num(item.gross))}</td>
              <td><Link className="offer-open" aria-label={item.title + " təklifini aç"} to={"?offer=" + encodeURIComponent(item.id)} onClick={() => setTab("sened")}><Icon name="chevron" /></Link></td>
            </tr>)}</tbody>
          </DataTable></TableContainer>}
          <p className="calc-meta">Hesablamada saxlanmış işlər burada görünür.</p>
        </>}
        <div className="offer-detail">
          {jobId && !job && (
            <Panel className="pad offer-empty">
              <h2>{loading ? "Təklif açılır…" : "Təklif tapılmadı"}</h2>
              <p>{loadError || "Təkliflər siyahısına qayıdıb sənədi yenidən seçin."}</p>
            </Panel>
          )}

          {job && (
            <Panel className="offer-sheet" ref={sheetRef}>
              <header className="doc-head">
                <div>
                  <p>Kommersiya təklifi · {when(job.createdAt)}</p>
                  <h2>{job.title}</h2>
                  <span>{[job.project?.name, job.address || "Ünvan yazılmayıb"].filter(Boolean).join(" · ")}</span>
                </div>
                <div className="doc-price">
                  {job.flow && <StageBadge stage={job.flow.stage} />}
                  <strong>{azn(num(job.gross))}</strong>
                  <span>ƏDV daxil satış</span>
                </div>
              </header>

              <Disclosure title="Ölçü və material məlumatları" className="offer-spec-details">              <dl className="doc-spec">
                <div><dt>Ölçü</dt><dd>{width && height ? `${qty(width)} × ${qty(height)} mm` : "—"}</dd></div>
                <div><dt>Say</dt><dd>{count == null ? "—" : `${qty(count)} ədəd · ${job.sections || 1} bölmə`}</dd></div>
                <div><dt>Açılış</dt><dd>{OPENING_LABEL[job.opening] || job.opening || "—"}</dd></div>
                <div><dt>Sistem</dt><dd>{job.rule?.system || job.profileNote || "—"}</dd></div>
                <div><dt>Rəng</dt><dd>{job.color || "—"}</dd></div>
                <div><dt>Şüşə</dt><dd>{[job.glassKind, job.glassThickness ? `${job.glassThickness} mm` : ""].filter(Boolean).join(" · ") || "—"}</dd></div>
                <div><dt>Furnitur</dt><dd>{job.hardware || "—"}</dd></div>
                <div><dt>Montaj</dt><dd>{job.installKind || "—"}</dd></div>
              </dl></Disclosure>


              <div className="offer-tabs no-print">
                <Tabs
                  value={tab}
                  onChange={setTab}
                  options={[
                    { id: "sened", label: "Təklif" },
                    { id: "material", label: "Material" },
                    { id: "boq", label: "BOQ" },
                    { id: "muqayise", label: "Müqayisə" },
                    { id: "is", label: "İş əmri" },
                  ]}
                />
              </div>

              <div className={tab === "sened" ? "offer-pane on" : "offer-pane"}>
                <p className="offer-letter">
                  {job.address || "Göstərilən ünvan"} üzrə {job.title.toLocaleLowerCase("az")} işinin kommersiya təklifi. Yekun məbləğ saxlanmış maya, mənfəət və ƏDV-dən yığılır.
                </p>
                <TableContainer><DataTable className="offer-table">
                  <tbody>
                    <tr><td>Maya dəyəri</td><td className="num">{azn(num(job.cost))}</td></tr>
                    <tr><td>Mənfəət {job.profitMode === "marja" ? "(marja)" : "(faiz)"}</td><td className="num">{azn(num(job.profitAmount))}</td></tr>
                    <tr><td>Satış, ƏDV-siz</td><td className="num">{azn(num(job.sale))}</td></tr>
                    <tr><td>ƏDV</td><td className="num">{azn(num(job.vatAmount))}</td></tr>
                    <tr className="offer-total"><td>Ödəniləcək məbləğ</td><td className="num">{azn(num(job.gross))}</td></tr>
                  </tbody>
                </DataTable></TableContainer>
                {math && !math.ready && <p className="offer-note">{math.blocked.join(" ")}</p>}
              </div>

              <div className={tab === "material" ? "offer-pane on" : "offer-pane"}>
                {pieces.length === 0 && <p className="offer-note">Ölçü yazılmayıb, kəsim siyahısı açılmır.</p>}
                {pieces.length > 0 && (
                  <TableContainer><DataTable className="offer-table">
                    <thead><tr><th>Parça</th><th className="num">Uzunluq</th><th className="num">Say</th></tr></thead>
                    <tbody>
                      {pieces.map((piece) => (
                        <tr key={piece.name}><td>{piece.name}</td><td className="num">{qty(piece.lengthMm)} mm</td><td className="num">{qty(piece.qty)}</td></tr>
                      ))}
                    </tbody>
                  </DataTable></TableContainer>
                )}
                <dl className="doc-spec">
                  <div><dt>Profil</dt><dd>{job.lengthM == null ? "—" : `${qty(job.lengthM)} m`}</dd></div>
                  <div><dt>Çəki</dt><dd>{job.weightKg == null ? "Təsdiqsiz" : `${qty(job.weightKg)} kq`}</dd></div>
                  <div><dt>Şüşə kəsimi</dt><dd>{job.cutArea == null ? "Təsdiqsiz" : `${qty(job.cutArea)} m²`}</dd></div>
                  <div><dt>Furnitur</dt><dd>{job.opening === "sabit" ? "0 dəst" : count == null ? "—" : `${qty(count)} dəst`}</dd></div>
                </dl>
              </div>

              <div className={tab === "boq" ? "offer-pane on" : "offer-pane"}>
                {job.lines.length === 0 && <p className="offer-note">Bu hesabın xərc sətirləri yazılmayıb.</p>}
                {job.lines.length > 0 && (
                  <TableContainer><DataTable className="offer-table">
                    <thead>
                      <tr><th>Ad</th><th>Vahid</th><th className="num">Miqdar</th><th className="num">Qiymət</th><th className="num">Məbləğ</th></tr>
                    </thead>
                    <tbody>
                      {job.lines.map((line) => (
                        <tr key={line.id}>
                          <td>{line.name}</td>
                          <td>{unitLabel(line.unit)}</td>
                          <td className="num">{qty(line.qty)}</td>
                          <td className="num">{azn(num(line.rate))}</td>
                          <td className="num">{azn(num(line.amount))}</td>
                        </tr>
                      ))}
                      <tr className="offer-total"><td colSpan={4}>Maya cəmi</td><td className="num">{azn(num(job.cost))}</td></tr>
                    </tbody>
                  </DataTable></TableContainer>
                )}
              </div>

              <div className={tab === "muqayise" ? "offer-pane on" : "offer-pane"}>
                {alternatives.length === 0 && <p className="offer-note">Müqayisə üçün metr qiymətli profil tapılmadı.</p>}
                <div className="offer-alts">
                  {alternatives.map((item) => {
                    const gross = item.math.gross
                    const base = num(job.gross)
                    const delta = gross != null && base != null ? gross - base : null
                    const same = currentRate != null && Math.abs(currentRate - item.price) < 0.02
                    const winner = gross != null && best != null && Math.abs(gross - best) < 0.02
                    return (
                      <article key={item.id} className={winner ? "offer-alt best" : "offer-alt"}>
                        <div>
                          <b>{item.name}</b>
                          <span>{[item.supplier, `${azn(item.price)} / m`].filter(Boolean).join(" · ")}</span>
                        </div>
                        <strong>{gross == null ? "Bağlanmır" : azn(gross)}</strong>
                        <em>
                          {same && "Bu təklif"}
                          {same && delta != null && delta !== 0 ? " · " : ""}
                          {delta == null ? "" : delta === 0 ? (same ? "" : "Eyni məbləğ") : `${delta > 0 ? "+" : "−"}${azn(Math.abs(delta)).replace(" ₼", "")} ₼`}
                          {winner && !same ? " · Ən sərfəli" : ""}
                        </em>
                      </article>
                    )
                  })}
                </div>
                {related.length > 0 && (
                  <>
                    <h3 className="offer-sub">Kataloqdan digər qiymətlər</h3>
                    <TableContainer><DataTable className="offer-table">
                      <thead><tr><th>Məhsul</th><th>Təchizatçı</th><th className="num">Qiymət</th></tr></thead>
                      <tbody>
                        {related.map((item) => (
                          <tr key={item.id}>
                            <td>{item.name}</td>
                            <td>{item.supplier || "—"}</td>
                            <td className="num">{azn(num(item.price))} / {unitLabel(item.unit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </DataTable></TableContainer>
                  </>
                )}
              </div>

              <div className={tab === "is" ? "offer-pane on" : "offer-pane"}>
                <div className="offer-work">
                  <article>
                    <h3>İstehsal</h3>
                    <p>{job.color || "Rəng yazılmayıb"} · {job.profileNote || job.rule?.system || "Profil qeydi yoxdur"}</p>
                    <b>{job.lengthM == null ? "Uzunluq təsdiqsiz" : `${qty(job.lengthM)} m`}</b>
                    <span>{job.schedule ? `${job.schedule.produceDays} gün istehsal` : "Müddət yazılmayıb"}</span>
                  </article>
                  <article>
                    <h3>Montaj</h3>
                    <p>{job.installKind || "Montaj növü yazılmayıb"} · {job.address || "Ünvan yoxdur"}</p>
                    <b>{count == null ? "—" : `${qty(count)} ədəd`}</b>
                    <span>{job.schedule ? `${job.schedule.installDays} gün montaj` : "Müddət yazılmayıb"}</span>
                  </article>
                  <article>
                    <h3>Daşınma</h3>
                    <p>{job.address || "Ünvan yoxdur"}</p>
                    <b>{azn(num(job.transport))}</b>
                    <span>{job.schedule ? `${job.schedule.haulDays} gün yol${job.schedule.weatherDays ? ` · ${job.schedule.weatherDays} gün hava` : ""}` : "Müddət yazılmayıb"}</span>
                  </article>
                </div>
                {job.schedule && (
                  <p className="offer-note">
                    Cəmi {job.schedule.totalDays} gün
                    {job.schedule.startOn ? ` · ${when(job.schedule.startOn)}` : ""}
                    {job.schedule.endOn ? ` – ${when(job.schedule.endOn)}` : ""}
                  </p>
                )}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </Guard>
  )
}
