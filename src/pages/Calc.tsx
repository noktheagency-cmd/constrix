import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react"
import { ApiError, api, dec } from "../api"
import { PageHead, Select, Tabs, useTitle } from "../ui"
import {
  OPENINGS,
  blankWindow,
  kindLabel,
  pickPrice,
  showPath,
  windowMath,
  type Opening,
  type ProfileRule,
  type WindowInput,
} from "../procure/engine"
import { Icon } from "../icons"
import { patchProcure, stamp, useProcure } from "../procure/store"
import { REGIONS, laborQuote, regionMaterial } from "../procure/smeta"

function activeOf(state: ReturnType<typeof useProcure>) {
  return state.companies.find((item) => item.id === state.activeId)
}

function Guard({ children }: { children: ReactNode }) {
  const state = useProcure()
  const kind = activeOf(state)?.kind ?? ""
  if (showPath("/hesablama", kind)) return children
  return <PageHead kicker="Kabinet" title="Bu bölmə bağlıdır" text={`${kind ? kindLabel(kind) : "Şirkət seçilməyib"}. Bu növün kabinetində həmin iş yoxdur.`} />
}

type SavedLine = { id: string; name: string; unit: string; qty: unknown; amount: unknown; note: string }
type SavedJob = {
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
  glassArea: unknown
  cutArea: unknown
  cost: unknown
  profitAmount: unknown
  vatAmount: unknown
  gross: unknown
  createdAt: string
  rule: { id: string; system: string } | null
  lines: SavedLine[]
  products: { productId: string }[]
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
  unit: string
  labor: unknown
  rawPrice: unknown
  salePrice: unknown
}

const UNIT: Record<string, string> = { m: "m", kq: "kq", m2: "m²", dest: "dəst", eded: "ədəd", sifaris: "sifariş" }
const WINDOW_TRADES = new Set(["qapi", "pvc", "suse", "fasad"])

function num(value: unknown) {
  if (value == null || value === "") return null
  const parsed = Number(String(value).replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
}

function azn(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—"
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₼`
}

function gapText(diff: number) {
  if (diff === 0) return "Cari satışla eynidir"
  return `${diff > 0 ? "+" : "−"}${azn(Math.abs(diff))} cari satışdan`
}

function when(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("az-AZ", { day: "numeric", month: "short", year: "numeric" })
}

function asRule(row: ApiRule): ProfileRule {
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

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? "calc-span-2" : undefined}>
      <span>{label}</span>
      {children}
    </label>
  )
}

export function CalcPage() {
  useTitle("Hesablama")
  const state = useProcure()
  const active = activeOf(state)
  const maker = Boolean(active && (active.kind === "admin" || ["qapi", "suse", "pvc", "fasad", "material"].includes(active.kind)))
  const [mode, setMode] = useState("pencere")
  const [form, setForm] = useState<WindowInput>(blankWindow())
  const [rules, setRules] = useState<ProfileRule[]>([])
  const [jobs, setJobs] = useState<SavedJob[]>([])
  const [query, setQuery] = useState("")
  const [openId, setOpenId] = useState("")
  const [picked, setPicked] = useState<string[]>([])
  const [ruleOpen, setRuleOpen] = useState(false)
  const [ruleForm, setRuleForm] = useState({ system: "", kgPerM: "", wastePercent: "", glassDeductMm: "", glassWastePercent: "" })
  const [historyLarge, setHistoryLarge] = useState(false)
  const [region, setRegion] = useState<(typeof REGIONS)[number]>("Bakı və Abşeron")
  const historyRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!historyLarge) return
    historyRef.current?.scrollIntoView({ block: "start" })
  }, [historyLarge])
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState("")
  const [loadError, setLoadError] = useState("")

  const rule = rules.find((item) => item.id === form.systemId)
  const math = windowMath(form, rule)
  const open = jobs.find((item) => item.id === openId) ?? null
  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("az")
    if (!needle) return jobs
    return jobs.filter((job) => `${job.title} ${job.address} ${job.color} ${job.rule?.system ?? ""}`.toLocaleLowerCase("az").includes(needle))
  }, [jobs, query])
  const sales = jobs.map((job) => num(job.gross)).filter((value): value is number => value != null)
  const saleSum = sales.reduce((sum, value) => sum + value, 0)

  function set<K extends keyof WindowInput>(key: K, value: WindowInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function reload() {
    const [ruleRows, jobRows] = await Promise.all([
      api<ApiRule[]>("/api/platform/rules"),
      api<SavedJob[]>("/api/platform/jobs"),
    ])
    const nextRules = ruleRows.filter((row) => WINDOW_TRADES.has(row.trade) || row.kgPerM != null).map(asRule)
    const confirmed = nextRules.find((row) => row.confirmed)
    setRules(nextRules)
    setForm((current) => current.systemId || !confirmed ? current : { ...current, systemId: confirmed.id })
    setJobs(jobRows)
    setLoadError("")
    return jobRows
  }

  useEffect(() => {
    reload().catch((reason) => setLoadError(reason instanceof ApiError ? reason.message : "Əvvəlki hesablar açılmadı"))
  }, [])

  function fresh() {
    const systemId = rules.find((row) => row.confirmed)?.id ?? ""
    setForm({ ...blankWindow(), systemId })
    setPicked([])
    setOpenId("")
    setNote("")
  }

  function openJob(job: SavedJob) {
    setOpenId(job.id)
    setNote("")
    setPicked((job.products ?? []).map((item) => item.productId))
    setForm({
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
    })
  }

  async function saveRule() {
    if (!ruleForm.system.trim()) return
    try {
      const row = await api<ApiRule>("/api/platform/rules", {
        method: "POST",
        body: JSON.stringify({ trade: "qapi", confirmed: true, ...ruleForm }),
      })
      const next = asRule(row)
      setRules((current) => [next, ...current])
      set("systemId", next.id)
      setRuleForm({ system: "", kgPerM: "", wastePercent: "", glassDeductMm: "", glassWastePercent: "" })
      setRuleOpen(false)
      setNote("Profil qaydası bazaya yazıldı.")
      if (active) {
        patchProcure((current) => ({
          ...current,
          rules: [...current.rules, { ...next, companyId: active.id }],
          audit: [...current.audit, stamp(current, "Profil qaydası təsdiqləndi", next.system)],
        }))
      }
    } catch (reason) {
      setNote(reason instanceof ApiError ? reason.message : "Qayda yazılmadı")
    }
  }

  async function saveJob() {
    if (!form.title.trim() || saving) return
    setSaving(true)
    setNote("")
    try {
      const saved = await api<{ job: SavedJob }>("/api/platform/jobs", {
        method: "POST",
        body: JSON.stringify({
          trade: "qapi",
          title: form.title,
          width: form.width,
          height: form.height,
          count: form.count,
          sections: form.sections,
          opening: form.opening,
          ruleId: form.systemId,
          color: form.color,
          profileNote: form.profileNote,
          glassKind: form.glassKind,
          glassThickness: form.glassThickness,
          hardware: form.hardware,
          installKind: form.installKind,
          address: form.address,
          profileUnit: form.profileUnit,
          profileRate: form.profileRate,
          glassRate: form.glassRate,
          hardwareRate: form.hardwareRate,
          laborRate: form.laborRate,
          installRate: form.installRate,
          packRate: form.packRate,
          transport: form.transport,
          extra: form.extra,
          vat: form.vat,
          profit: form.profit,
          profitMode: form.profitMode,
          glassConfirmed: form.glassConfirmed,
          productIds: picked,
        }),
      })
      if (active) {
        patchProcure((current) => ({
          ...current,
          jobs: [...current.jobs, { id: saved.job.id, companyId: active.id, input: form, productIds: picked, logisticsId: "", at: new Date().toISOString() }],
          audit: [...current.audit, stamp(current, "Hesab saxlandı", form.title)],
        }))
      }
      await reload()
      setOpenId(saved.job.id)
      setNote("Hesab bazaya yazıldı. Əvvəlki siyahıda görünür.")
    } catch (reason) {
      setNote(reason instanceof ApiError ? reason.message : "Hesab yazılmadı")
    } finally {
      setSaving(false)
    }
  }

  const compare = state.products.filter((item) => item.category.toLocaleLowerCase("az").includes("profil") || item.unit === "m" || item.unit === "kq")
  const comparisons = compare.map((item) => {
    const rate = pickPrice(item, Number(form.count) || 1, `${form.width}x${form.height}`, form.profileNote, "")
    const alt = windowMath({
      ...form,
      profileRate: rate == null ? "" : String(rate),
      profileUnit: item.unit === "kq" ? "kq" : "m",
    }, rule)
    const diff = math.gross != null && alt.gross != null ? alt.gross - math.gross : null
    return { item, rate, gross: alt.ready ? alt.gross : null, diff }
  })
  const pickedCompare = comparisons.filter((row) => picked.includes(row.item.id))

  return (
    <Guard>
      <div className="calc-page">
        <PageHead kicker="İstehsal" title="Hesablama" text="Ölçüdən kəsim, maya və satış çıxır. Saxlanan hesablar bazada qalır və sonradan açıla bilir.">
          <div className="calc-head-actions">
            <Tabs
              value={mode}
              onChange={setMode}
              options={[
                { id: "pencere", label: "Pəncərə və qapı" },
                { id: "norma", label: "İstehsal norması" },
              ]}
            />
          </div>
        </PageHead>

        {mode === "norma" ? (
          <ProductNorms />
        ) : (
          <>
            <div className="calc-stats">
              <article><span>Saxlanmış hesab</span><strong>{jobs.length}</strong></article>
              <article><span>Son satış</span><strong>{jobs[0] ? azn(num(jobs[0].gross)) : "—"}</strong></article>
              <article><span>Satış cəmi</span><strong>{sales.length ? azn(saleSum) : "—"}</strong></article>
              <article><span>Orta satış</span><strong>{sales.length ? azn(saleSum / sales.length) : "—"}</strong></article>
            </div>

            {historyLarge && (
              <HistoryTable
                jobs={shown}
                openId={openId}
                query={query}
                onQuery={setQuery}
                onOpen={openJob}
                loadError={loadError}
                empty={jobs.length === 0}
                sectionRef={historyRef}
                onShrink={() => setHistoryLarge(false)}
              />
            )}

            <div className="calc-board">
              <div className="calc-form">
                <section className="panel pad calc-card">
                  <div className="calc-card-head">
                    <h2>Ölçü</h2>
                    <button type="button" className="btn ghost small" onClick={fresh}>Yeni hesab</button>
                  </div>
                  <div className="calc-grid">
                    <Field label="İşin adı" wide>
                      <input value={form.title} placeholder="Port Baku yaşayış pəncərəsi" onChange={(event) => set("title", event.target.value)} />
                    </Field>
                    <Field label="Ünvan" wide>
                      <input value={form.address} placeholder="Yasamal, Zərdabi" onChange={(event) => set("address", event.target.value)} />
                    </Field>
                    <Field label="En, mm"><input value={form.width} inputMode="decimal" placeholder="1400" onChange={(event) => set("width", event.target.value)} /></Field>
                    <Field label="Hündürlük, mm"><input value={form.height} inputMode="decimal" placeholder="1500" onChange={(event) => set("height", event.target.value)} /></Field>
                    <Field label="Say"><input value={form.count} inputMode="decimal" onChange={(event) => set("count", event.target.value)} /></Field>
                    <Field label="Bölmə"><input value={form.sections} inputMode="decimal" onChange={(event) => set("sections", event.target.value)} /></Field>
                    <Field label="Açılış" wide>
                      <Select value={form.opening} onValueChange={(opening) => set("opening", opening as Opening)} options={OPENINGS.map(([value, label]) => ({ value, label }))} />
                    </Field>
                  </div>
                </section>

                <section className="panel pad calc-card">
                  <div className="calc-card-head">
                    <h2>Sistem və şüşə</h2>
                    {maker && (
                      <button type="button" className="btn ghost small" onClick={() => setRuleOpen((current) => !current)}>
                        {ruleOpen ? "Qaydanı bağla" : "Profil qaydası"}
                      </button>
                    )}
                  </div>
                  <div className="calc-grid">
                    <Field label="Profil sistemi" wide>
                      <Select
                        value={form.systemId}
                        onValueChange={(systemId) => set("systemId", systemId)}
                        options={[{ value: "", label: "Təsdiqli qayda yoxdur" }, ...rules.filter((item) => item.confirmed).map((item) => ({ value: item.id, label: item.system }))]}
                      />
                    </Field>
                    <Field label="Rəng"><input value={form.color} placeholder="RAL 7016" onChange={(event) => set("color", event.target.value)} /></Field>
                    <Field label="Profil qeydi"><input value={form.profileNote} placeholder="Xəzər 60" onChange={(event) => set("profileNote", event.target.value)} /></Field>
                    <Field label="Şüşə növü"><input value={form.glassKind} placeholder="Paket" onChange={(event) => set("glassKind", event.target.value)} /></Field>
                    <Field label="Qalınlıq, mm"><input value={form.glassThickness} placeholder="24" onChange={(event) => set("glassThickness", event.target.value)} /></Field>
                    <Field label="Furnitur"><input value={form.hardware} placeholder="Dönər" onChange={(event) => set("hardware", event.target.value)} /></Field>
                    <Field label="Montaj"><input value={form.installKind} placeholder="Montaj" onChange={(event) => set("installKind", event.target.value)} /></Field>
                  </div>
                  {ruleOpen && (
                    <div className="calc-rule">
                      <p>Kiloqram və kəsim itkisi yalnız bu təsdiqli qaydadan gəlir.</p>
                      <div className="calc-grid">
                        <Field label="Sistem"><input value={ruleForm.system} onChange={(event) => setRuleForm({ ...ruleForm, system: event.target.value })} /></Field>
                        <Field label="Kq/metr"><input value={ruleForm.kgPerM} inputMode="decimal" onChange={(event) => setRuleForm({ ...ruleForm, kgPerM: event.target.value })} /></Field>
                        <Field label="Kəsim itkisi, %"><input value={ruleForm.wastePercent} inputMode="decimal" onChange={(event) => setRuleForm({ ...ruleForm, wastePercent: event.target.value })} /></Field>
                        <Field label="Şüşə payı, mm"><input value={ruleForm.glassDeductMm} inputMode="decimal" onChange={(event) => setRuleForm({ ...ruleForm, glassDeductMm: event.target.value })} /></Field>
                        <Field label="Şüşə itkisi, %" wide><input value={ruleForm.glassWastePercent} inputMode="decimal" onChange={(event) => setRuleForm({ ...ruleForm, glassWastePercent: event.target.value })} /></Field>
                      </div>
                      <button type="button" className="btn small" onClick={() => void saveRule()}>Qaydanı təsdiqlə</button>
                    </div>
                  )}
                </section>

                <section className="panel pad calc-card">
                  <h2>Vahid qiymətlər</h2>
                  <div className="calc-grid">
                    <Field label="Profil vahidi">
                      <Select value={form.profileUnit} onValueChange={(profileUnit) => set("profileUnit", profileUnit as WindowInput["profileUnit"])} options={[{ value: "m", label: "Metr" }, { value: "kq", label: "Kiloqram" }]} />
                    </Field>
                    <Field label="Profil qiyməti"><input value={form.profileRate} inputMode="decimal" placeholder="12.40" onChange={(event) => set("profileRate", event.target.value)} /></Field>
                    <Field label="Şüşə, ₼/m²"><input value={form.glassRate} inputMode="decimal" onChange={(event) => set("glassRate", event.target.value)} /></Field>
                    <Field label="Furnitur, ₼/dəst"><input value={form.hardwareRate} inputMode="decimal" onChange={(event) => set("hardwareRate", event.target.value)} /></Field>
                    <Field label="Əməkhaqqı, ₼/ədəd"><input value={form.laborRate} inputMode="decimal" onChange={(event) => set("laborRate", event.target.value)} /></Field>
                    <Field label="Rayon" wide>
                      <Select value={region} onValueChange={(value) => setRegion(value as (typeof REGIONS)[number])} options={REGIONS.map((item) => ({ value: item, label: item }))} />
                    </Field>
                    <button type="button" className="btn ghost small" onClick={() => {
                      const alum = regionMaterial("Alüminium", region)
                      const glass = regionMaterial("Şüşə", region)
                      const labor = laborQuote("Fasad ustası", region, "orta", "vahid")
                      if (alum) set("profileRate", String(alum.price))
                      if (glass) set("glassRate", String(glass.price))
                      if (labor) set("laborRate", String(labor.amount))
                      setNote(`${region} tarifi yazıldı. Alüminium kiloqramı, şüşə və fasad ustası ayrıdır.`)
                    }}>Rayon tarifini gətir</button>
                    <Field label="Qablaşdırma"><input value={form.packRate} inputMode="decimal" onChange={(event) => set("packRate", event.target.value)} /></Field>
                    <Field label="Montaj"><input value={form.installRate} inputMode="decimal" onChange={(event) => set("installRate", event.target.value)} /></Field>
                    <Field label="Daşınma"><input value={form.transport} inputMode="decimal" onChange={(event) => set("transport", event.target.value)} /></Field>
                    <Field label="Əlavə"><input value={form.extra} inputMode="decimal" onChange={(event) => set("extra", event.target.value)} /></Field>
                    <Field label="Vergi, %"><input value={form.vat} inputMode="decimal" onChange={(event) => set("vat", event.target.value)} /></Field>
                    <Field label="Mənfəət növü">
                      <Select value={form.profitMode} onValueChange={(profitMode) => set("profitMode", profitMode as WindowInput["profitMode"])} options={[{ value: "faiz", label: "Maya üzərinə faiz" }, { value: "marja", label: "Satışdakı marja" }]} />
                    </Field>
                    <Field label="Mənfəət, %"><input value={form.profit} inputMode="decimal" onChange={(event) => set("profit", event.target.value)} /></Field>
                  </div>
                  <button type="button" className={form.glassConfirmed ? "calc-toggle on" : "calc-toggle"} aria-pressed={form.glassConfirmed} onClick={() => set("glassConfirmed", !form.glassConfirmed)}>
                    <span className="calc-toggle-copy">
                      <b>Şüşə ölçüsünü təsdiq edirəm</b>
                      <small>{form.glassConfirmed ? "Təsdiqlənib. Şüşə sahəsi bu ölçüdən götürülür." : "Sönülüdür. Profil qaydası yoxdursa şüşə kəsimi hesaba düşmür."}</small>
                    </span>
                    <span className="calc-toggle-ui" aria-hidden="true"><span /></span>
                  </button>
                </section>

                {compare.length > 0 && (
                  <section className="panel pad calc-card">
                    <h2>Müqayisə üçün məhsullar</h2>
                    <p className="calc-meta">Karta klikləyin. Həmin məhsulun qiyməti profil qiymətinin yerinə qoyulur və satış cari hesabla müqayisə olunur. Forma dəyişmir.</p>
                    <div className="calc-compare">
                      {comparisons.map((row) => {
                        const on = picked.includes(row.item.id)
                        return (
                          <button key={row.item.id} type="button" className={on ? "calc-compare-card on" : "calc-compare-card"} aria-pressed={on} onClick={() => setPicked((current) => on ? current.filter((value) => value !== row.item.id) : [...current, row.item.id])}>
                            <span className="calc-compare-top">
                              <span className="calc-mark" aria-hidden="true" />
                              <b>{row.item.name}</b>
                            </span>
                            <span className="calc-compare-rate">{row.rate == null ? "Qiymət yoxdur" : `${azn(row.rate)} / ${row.item.unit}`}</span>
                            <span className="calc-compare-sale">{row.gross == null ? "Ölçü yazılandan sonra satış çıxır" : `Bu qiymətlə satış ${azn(row.gross)}`}</span>
                            <span className={row.diff == null ? "calc-compare-diff" : row.diff > 0 ? "calc-compare-diff up" : row.diff < 0 ? "calc-compare-diff down" : "calc-compare-diff"}>
                              {on ? (row.diff == null ? "Seçildi" : gapText(row.diff)) : "Müqayisəyə əlavə et"}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    {pickedCompare.length > 0 && (
                      <div className="calc-compare-result">
                        <b>Seçilən müqayisə</b>
                        {pickedCompare.map((row) => (
                          <div key={row.item.id}>
                            <span>{row.item.name}</span>
                            <strong>{row.gross == null ? "Satış bağlanmayıb" : azn(row.gross)}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </div>

              <aside className="calc-side">
                <section className="calc-quote">
                  <p>Canlı satış</p>
                  <strong>{math.ready && math.gross != null ? azn(math.gross) : "Ölçü yazın"}</strong>
                  <div className="calc-metrics">
                    <div><span>Maya</span><b>{math.ready ? azn(math.cost) : "—"}</b></div>
                    <div><span>Mənfəət</span><b>{math.ready ? azn(math.profit) : "—"}</b></div>
                    <div><span>Vergi</span><b>{math.ready ? azn(math.vat) : "—"}</b></div>
                  </div>
                  {math.ready && (
                    <>
                      <div className="calc-kpis">
                        <span>{math.lengthM.toFixed(3)} m</span>
                        <span>{math.weightKg == null ? "çəki təsdiqsiz" : `${math.weightKg.toFixed(3)} kq`}</span>
                        <span>{math.cutArea == null ? "şüşə təsdiqsiz" : `${math.cutArea.toFixed(3)} m²`}</span>
                      </div>
                      {math.pieces.map((piece) => (
                        <div className="calc-line" key={piece.name}>
                          <span>{piece.name}</span>
                          <b>{piece.qty} × {piece.lengthMm} mm</b>
                        </div>
                      ))}
                      {math.lines.map((line) => (
                        <div className="calc-line" key={line.name}>
                          <span>{line.name}{line.qty != null ? ` · ${line.qty.toFixed(2)} ${UNIT[line.unit] || line.unit}` : ""}</span>
                          <b>{line.amount == null ? "—" : azn(line.amount)}</b>
                        </div>
                      ))}
                    </>
                  )}
                  {math.blocked.length > 0 && <p className="calc-warn">{math.blocked.join(" ")}</p>}
                  <button type="button" className="btn calc-save" onClick={() => void saveJob()} disabled={!form.title.trim() || saving}>
                    {saving ? "Yazılır…" : "Hesabı saxla"}
                  </button>
                  {note && <p className="calc-note">{note}</p>}
                </section>

                {open && (
                  <section className="panel pad calc-card">
                    <h2>Saxlanmış nəticə</h2>
                    <p className="calc-meta">{when(open.createdAt)} · {open.rule?.system || "qaydasız"} · {dec(open.widthMm) || "—"}×{dec(open.heightMm) || "—"} mm</p>
                    <div className="calc-saved-total"><span>Satış</span><b>{azn(num(open.gross))}</b></div>
                    <div className="calc-saved-row"><span>Maya</span><b>{azn(num(open.cost))}</b></div>
                    <div className="calc-saved-row"><span>Mənfəət</span><b>{azn(num(open.profitAmount))}</b></div>
                    <div className="calc-saved-row"><span>Vergi</span><b>{azn(num(open.vatAmount))}</b></div>
                    {open.lines.map((line) => (
                      <div className="calc-saved-row" key={line.id}>
                        <span>{line.name}</span>
                        <b>{azn(num(line.amount))}</b>
                      </div>
                    ))}
                  </section>
                )}

                {!historyLarge && <section className="panel pad calc-card calc-history">
                  <div className="calc-card-head">
                    <h2>Əvvəlki hesablar</h2>
                    <div className="calc-history-tools">
                      <button type="button" className="icon-btn" aria-label="Genişləndir" onClick={() => setHistoryLarge(true)}><Icon name="widen" /></button>
                      <span>{shown.length}</span>
                    </div>
                  </div>
                  <input className="calc-search" value={query} placeholder="Ad, ünvan, rəng" onChange={(event) => setQuery(event.target.value)} />
                  {loadError && <p className="calc-meta">{loadError}</p>}
                  {!loadError && jobs.length === 0 && <p className="calc-meta">Bazada saxlanmış hesab yoxdur.</p>}
                  {!loadError && jobs.length > 0 && shown.length === 0 && <p className="calc-meta">Bu axtarışa uyğun hesab yoxdur.</p>}
                  <div className="calc-list">
                    {shown.map((job) => (
                      <button key={job.id} type="button" className={job.id === openId ? "calc-hit on" : "calc-hit"} onClick={() => openJob(job)}>
                        <b>{job.title || "Adsız hesab"}</b>
                        <span>{dec(job.widthMm) || "—"}×{dec(job.heightMm) || "—"} mm · {dec(job.count) || "—"} ədəd</span>
                        <span>{when(job.createdAt)}{job.address ? ` · ${job.address}` : ""}</span>
                        <em>{azn(num(job.gross))}</em>
                      </button>
                    ))}
                  </div>
                </section>}
              </aside>
            </div>
          </>
        )}
      </div>
    </Guard>
  )
}

function HistoryTable({
  jobs,
  openId,
  query,
  onQuery,
  onOpen,
  loadError,
  empty,
  sectionRef,
  onShrink,
}: {
  jobs: SavedJob[]
  openId: string
  query: string
  onQuery: (value: string) => void
  onOpen: (job: SavedJob) => void
  loadError: string
  empty: boolean
  sectionRef: RefObject<HTMLElement | null>
  onShrink: () => void
}) {
  return (
    <section className="panel pad calc-card calc-history-wide" ref={sectionRef}>
      <div className="calc-card-head">
        <h2>Əvvəlki hesablar</h2>
        <div className="calc-history-tools">
          <button type="button" className="icon-btn" aria-label="Daralt" onClick={onShrink}><Icon name="narrow" /></button>
          <span>{jobs.length}</span>
        </div>
      </div>
      <input className="calc-search" value={query} placeholder="Ad, ünvan, rəng" onChange={(event) => onQuery(event.target.value)} />
      {loadError && <p className="calc-meta">{loadError}</p>}
      {!loadError && empty && <p className="calc-meta">Bazada saxlanmış hesab yoxdur.</p>}
      {!loadError && !empty && jobs.length === 0 && <p className="calc-meta">Bu axtarışa uyğun hesab yoxdur.</p>}
      <div className="calc-table-wrap">
        <table className="calc-table">
          <thead>
            <tr>
              <th>İş</th>
              <th>Ölçü</th>
              <th>Say</th>
              <th>Tarix</th>
              <th>Ünvan</th>
              <th>Sistem</th>
              <th>Satış</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className={job.id === openId ? "on" : ""} tabIndex={0} onClick={() => onOpen(job)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(job) } }}>
                <td>{job.title || "Adsız hesab"}</td>
                <td>{dec(job.widthMm) || "—"}×{dec(job.heightMm) || "—"} mm</td>
                <td>{dec(job.count) || "—"}</td>
                <td>{when(job.createdAt)}</td>
                <td>{job.address || "—"}</td>
                <td>{job.rule?.system || "—"}</td>
                <td>{azn(num(job.gross))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

type Norm = { id: string; system: string; unit: string; wastePercent: unknown; labor: unknown; rawPrice: unknown; salePrice: unknown }

function ProductNorms() {
  const [rows, setRows] = useState<Norm[]>([])
  const [form, setForm] = useState({ system: "", unit: "kq", wastePercent: "", labor: "", rawPrice: "", salePrice: "", qty: "1" })
  const [note, setNote] = useState("")

  function reload() {
    return api<Norm[]>("/api/platform/rules").then((list) => setRows(list.filter((row) => row.unit || row.rawPrice != null || row.salePrice != null)))
  }

  useEffect(() => {
    reload().catch(() => setRows([]))
  }, [])

  const qty = Number(form.qty) || 0
  const waste = Number(form.wastePercent) || 0
  const rawQty = qty * (1 + waste / 100)
  const rawCost = rawQty * (Number(form.rawPrice) || 0)
  const laborCost = qty * (Number(form.labor) || 0)
  const cost = rawCost + laborCost
  const sale = qty * (Number(form.salePrice) || 0)

  async function save() {
    if (!form.system.trim()) return
    try {
      await api("/api/platform/rules", {
        method: "POST",
        body: JSON.stringify({
          trade: "material",
          system: form.system,
          confirmed: true,
          unit: form.unit,
          wastePercent: form.wastePercent,
          labor: form.labor,
          rawPrice: form.rawPrice,
          salePrice: form.salePrice,
        }),
      })
      setNote("Norma bazaya yazıldı.")
      await reload()
    } catch (reason) {
      setNote(reason instanceof ApiError ? reason.message : "Norma yazılmadı")
    }
  }

  return (
    <div className="calc-board">
      <section className="panel pad calc-card">
        <h2>İstehsal norması</h2>
        <p className="calc-meta">Boya, sement, armatur və ya başqa məhsul üçün istehsalçı öz normasını yazır. Satış qiyməti mayadan ayrıdır.</p>
        <div className="calc-grid">
          <Field label="Məhsul" wide><input value={form.system} placeholder="Boya, sement, armatur" onChange={(event) => setForm({ ...form, system: event.target.value })} /></Field>
          <Field label="Vahid"><input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} /></Field>
          <Field label="İtki, %"><input value={form.wastePercent} inputMode="decimal" onChange={(event) => setForm({ ...form, wastePercent: event.target.value })} /></Field>
          <Field label="İşçilik, ₼/vahid"><input value={form.labor} inputMode="decimal" onChange={(event) => setForm({ ...form, labor: event.target.value })} /></Field>
          <Field label="Xammal mayası"><input value={form.rawPrice} inputMode="decimal" onChange={(event) => setForm({ ...form, rawPrice: event.target.value })} /></Field>
          <Field label="Satış qiyməti"><input value={form.salePrice} inputMode="decimal" onChange={(event) => setForm({ ...form, salePrice: event.target.value })} /></Field>
          <Field label="Miqdar"><input value={form.qty} inputMode="decimal" onChange={(event) => setForm({ ...form, qty: event.target.value })} /></Field>
        </div>
        <button type="button" className="btn" onClick={() => void save()}>Normanı yaz</button>
        {note && <p className="calc-meta">{note}</p>}
      </section>
      <aside className="calc-side">
        <section className="calc-quote">
          <p>Bu miqdar üçün</p>
          <strong>{azn(sale)}</strong>
          <div className="calc-line"><span>Xammal · {rawQty.toFixed(3)} {form.unit}</span><b>{azn(rawCost)}</b></div>
          <div className="calc-line"><span>İşçilik</span><b>{azn(laborCost)}</b></div>
          <div className="calc-line"><span>Maya</span><b>{azn(cost)}</b></div>
        </section>
        <section className="panel pad calc-card">
          <h2>Yazılmış normalar</h2>
          {rows.length === 0 && <p className="calc-meta">Norma yoxdur.</p>}
          <div className="calc-list">
            {rows.map((row) => (
              <div key={row.id} className="calc-hit static">
                <b>{row.system}</b>
                <span>{row.unit || "vahid"} · itki {String(row.wastePercent ?? 0)}% · işçilik {String(row.labor ?? 0)}</span>
                <em>satış {String(row.salePrice ?? 0)}</em>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  )
}
