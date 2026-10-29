import { DataTable } from '../components/DataTable'
import { Button, Disclosure, Input, Metric, Panel, StatGrid, TableContainer } from "../components/primitives"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ApiError, api, dec } from "../api"
import { kindLabel, logisticsMath, showPath, type LogisticsInput } from "../procure/engine"
import { StepNav } from "../components/StepNav"
import { Icon } from "../icons"
import { useProcure } from "../procure/store"
import { PageHead, Select, Tabs, useTitle, type SelectGroup } from "../ui"

function activeOf(state: ReturnType<typeof useProcure>) {
  return state.companies.find((item) => item.id === state.activeId)
}

function Guard({ children }: { children: ReactNode }) {
  const state = useProcure()
  const kind = activeOf(state)?.kind ?? ""
  if (showPath("/dasima", kind)) return children
  return <PageHead kicker="Kabinet" title="Bu bölmə bağlıdır" text={`${kind ? kindLabel(kind) : "Şirkət seçilməyib"}. Bu növün kabinetində həmin iş yoxdur.`} />
}

type Fit = "uygun" | "tutum" | "olcu"
type Vehicle = LogisticsInput["vehicle"]

type SavedHaul = {
  id: string
  fromPlace: string
  toPlace: string
  km: unknown
  weightKg: unknown
  volumeM3: unknown
  glassWidthMm: unknown
  glassHeightMm: unknown
  vehicle: Vehicle
  capacityKg: unknown
  maxGlassMm: unknown
  roundTrip: boolean
  loadCost: unknown
  waitCost: unknown
  extra: unknown
  tariffPerKm: unknown
  speedKmDay: unknown
  days: number | null
  fit: Fit
  cost: unknown
  createdAt: string
}

type HaulForm = {
  from: string
  to: string
  km: string
  weight: string
  volume: string
  glassWidth: string
  glassHeight: string
  vehicle: Vehicle
  capacityKg: string
  maxGlassMm: string
  roundTrip: boolean
  loadCost: string
  waitCost: string
  extra: string
  tariff: string
  speed: string
  days: string
}

const emptyHaul: HaulForm = {
  from: "",
  to: "",
  km: "",
  weight: "",
  volume: "",
  glassWidth: "",
  glassHeight: "",
  vehicle: "standart",
  capacityKg: "",
  maxGlassMm: "",
  roundTrip: false,
  loadCost: "",
  waitCost: "",
  extra: "",
  tariff: "",
  speed: "",
  days: "",
}

const FIT: Record<Fit, string> = {
  uygun: "Uyğundur",
  tutum: "Tutum aşılır",
  olcu: "Ölçü sığmır",
}

function num(value: unknown) {
  if (value == null || value === "") return null
  const parsed = Number(String(value).replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
}

function plain(value: unknown) {
  const raw = dec(value)
  if (!raw) return ""
  if (!raw.includes(".")) return raw
  return raw.replace(/\.?0+$/, "")
}

function azn(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—"
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₼`
}

function when(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`
}

function vehicleLabel(vehicle: Vehicle) {
  return vehicle === "suse" ? "Şüşədaşıyan" : "Standart yük"
}

function HaulHistoryFilters({
  query,
  onQuery,
  fit,
  onFit,
}: {
  query: string
  onQuery: (value: string) => void
  fit: "hami" | Fit
  onFit: (value: "hami" | Fit) => void
}) {
  return (
    <>
      <Input className="calc-search" value={query} placeholder="Haradan və ya hara" onChange={(event) => onQuery(event.target.value)} />
      <div className="haul-filters">
        {([
          ["hami", "Hamısı"],
          ["uygun", "Uyğun"],
          ["tutum", "Tutum"],
          ["olcu", "Ölçü"],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className={fit === id ? "calc-chip on" : "calc-chip"} onClick={() => onFit(id)}>
            <b>{label}</b>
          </button>
        ))}
      </div>
    </>
  )
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? "calc-span-2" : undefined}>
      <span>{label}</span>
      {children}
    </label>
  )
}

const NEW_PLACE = "__new__"

type NamedPlace = { value: string; label: string }
type PlaceLists = { addresses: NamedPlace[]; warehouses: string[]; shops: string[] }

function uniquePlaces(items: string[], seen: Set<string>) {
  const next: NamedPlace[] = []
  for (const item of items) {
    const value = item.trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    next.push({ value, label: value })
  }
  return next
}

function placeGroups(lists: PlaceLists): SelectGroup[] {
  const seen = new Set<string>()
  const addresses = lists.addresses.filter((item) => {
    const value = item.value.trim()
    if (!value || seen.has(value)) return false
    seen.add(value)
    return true
  })
  const pack = (label: string, items: string[]) => {
    const options = uniquePlaces(items, seen)
    return options.length ? { label, options } : null
  }
  return [
    addresses.length ? { label: "Ünvan", options: addresses } : null,
    pack("Anbarlar", lists.warehouses),
    pack("Sexlər", lists.shops),
  ].filter((group): group is SelectGroup => group != null)
}

function knownPlace(value: string, groups: SelectGroup[]) {
  return groups.some((group) => group.options.some((option) => option.value === value))
}

function PlacePick({
  label,
  value,
  custom,
  groups,
  onPick,
  onType,
  onNew,
  onList,
}: {
  label: string
  value: string
  custom: boolean
  groups: SelectGroup[]
  onPick: (value: string) => void
  onType: (value: string) => void
  onNew: () => void
  onList: () => void
}) {
  if (custom) {
    return (
      <Field label={label} wide>
        <div className="haul-custom">
          <Input value={value} placeholder="Ünvan yazın" onChange={(event) => onType(event.target.value)} />
          <Button type="button" className="ghost small" onClick={onList}>Siyahı</Button>
        </div>
      </Field>
    )
  }
  return (
    <Field label={label} wide>
      <Select
        value={value}
        placeholder="Seçin"
        ariaLabel={label}
        onValueChange={(next) => {
          if (next === NEW_PLACE) onNew()
          else onPick(next)
        }}
        options={[{ value: NEW_PLACE, label: "Yeni" }]}
        groups={groups}
      />
    </Field>
  )
}

function asForm(row: SavedHaul): HaulForm {
  const billed = num(row.km)
  const oneWay = billed == null ? "" : String(row.roundTrip ? billed / 2 : billed)
  return {
    from: row.fromPlace,
    to: row.toPlace,
    km: oneWay,
    weight: plain(row.weightKg),
    volume: plain(row.volumeM3),
    glassWidth: num(row.glassWidthMm) ? plain(row.glassWidthMm) : "",
    glassHeight: num(row.glassHeightMm) ? plain(row.glassHeightMm) : "",
    vehicle: row.vehicle === "suse" ? "suse" : "standart",
    capacityKg: plain(row.capacityKg),
    maxGlassMm: plain(row.maxGlassMm),
    roundTrip: row.roundTrip,
    loadCost: plain(row.loadCost),
    waitCost: plain(row.waitCost),
    extra: plain(row.extra),
    tariff: plain(row.tariffPerKm),
    speed: plain(row.speedKmDay),
    days: row.days == null ? "" : String(row.days),
  }
}

export function LogisticsPage() {
  useTitle("Daşınma")
  const [form, setForm] = useState<HaulForm>(emptyHaul)
  const [rows, setRows] = useState<SavedHaul[]>([])
  const [query, setQuery] = useState("")
  const [fit, setFit] = useState<"hami" | Fit>("hami")
  const [openId, setOpenId] = useState("")
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [note, setNote] = useState("")
  const [loadError, setLoadError] = useState("")
  const [places, setPlaces] = useState<PlaceLists>({ addresses: [], warehouses: [], shops: [] })
  const [fromNew, setFromNew] = useState(false)
  const [toNew, setToNew] = useState(false)
  const [large, setLarge] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState("route")
  const steps = [{ id: "route", label: "Marşrut" }, { id: "load", label: "Yük və maşın" }, { id: "price", label: "Qiymət" }]
  const stepIndex = steps.findIndex((item) => item.id === step)

  const preview = logisticsMath({ ...form, id: "", companyId: "", carrierId: "" })
  const started = Boolean(form.from.trim() || form.to.trim() || form.km.trim() || form.tariff.trim())
  const open = rows.find((item) => item.id === openId) ?? null
  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("az")
    return rows.filter((row) => {
      if (fit !== "hami" && row.fit !== fit) return false
      if (!needle) return true
      return `${row.fromPlace} ${row.toPlace}`.toLocaleLowerCase("az").includes(needle)
    })
  }, [rows, query, fit])

  const costs = rows.map((row) => num(row.cost)).filter((value): value is number => value != null)
  const costSum = costs.reduce((sum, value) => sum + value, 0)
  const distances = rows.map((row) => num(row.km)).filter((value): value is number => value != null)
  const distanceSum = distances.reduce((sum, value) => sum + value, 0)
  const blocked = rows.filter((row) => row.fit !== "uygun").length
  const groups = useMemo(() => placeGroups(places), [places])

  function set<K extends keyof HaulForm>(key: K, value: HaulForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setNote("")
  }

  function reload() {
    return api<SavedHaul[]>("/api/platform/haul").then((list) => {
      setRows(list)
      setLoaded(true)
      setLoadError("")
      return list
    })
  }

  useEffect(() => {
    reload().catch((reason) => {
      setLoaded(true)
      setLoadError(reason instanceof ApiError ? reason.message : "Əvvəlki daşımalar açılmadı")
    })
    Promise.all([
      api<{ org: { legalAddress: string; actualAddress: string } | null }>("/api/platform/me").catch(() => ({ org: null })),
      api<{ name: string }[]>("/api/locations").catch(() => []),
      api<{ name: string; place: string }[]>("/api/plants").catch(() => []),
    ]).then(([me, locations, plants]) => {
      const legal = me.org?.legalAddress?.trim() || ""
      const actual = me.org?.actualAddress?.trim() || ""
      const addresses = legal && actual && legal === actual
        ? [{ value: legal, label: `Hüquqi və faktiki ünvan · ${legal}` }]
        : [
            legal ? { value: legal, label: `Hüquqi ünvan · ${legal}` } : null,
            actual ? { value: actual, label: `Faktiki ünvan · ${actual}` } : null,
          ].filter((item): item is NamedPlace => item != null)
      setPlaces({
        addresses,
        warehouses: locations.map((item) => item.name).filter(Boolean),
        shops: plants.map((item) => item.place && !item.name.includes(item.place) ? `${item.name}, ${item.place}` : item.name).filter(Boolean),
      })
    }).catch(() => setPlaces({ addresses: [], warehouses: [], shops: [] }))
  }, [])

  useEffect(() => {
    const element = formRef.current
    const viewport = element?.closest("main")
    if (element && viewport && element.getBoundingClientRect().top < viewport.getBoundingClientRect().top) {
      element.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })
    }
  }, [step, large])

  useEffect(() => {
    setFromNew((current) => form.from ? !knownPlace(form.from, groups) : current)
    setToNew((current) => form.to ? !knownPlace(form.to, groups) : current)
  }, [form.from, form.to, groups])

  function fresh() {
    setStep("route")
    setLarge(false)
    setForm(emptyHaul)
    setOpenId("")
    setNote("")
    setFromNew(false)
    setToNew(false)
  }

  function openHaul(row: SavedHaul) {
    setStep("route")
    setLarge(false)
    const next = asForm(row)
    setOpenId(row.id)
    setForm(next)
    setFromNew(Boolean(next.from) && !knownPlace(next.from, groups))
    setToNew(Boolean(next.to) && !knownPlace(next.to, groups))
    setNote("")
  }

  async function save() {
    if (!form.from.trim() || !form.to.trim()) return
    setSaving(true)
    setNote("")
    try {
      const saved = await api<SavedHaul>("/api/platform/haul", {
        method: "POST",
        body: JSON.stringify({
          fromPlace: form.from,
          toPlace: form.to,
          km: form.km,
          weight: form.weight,
          volume: form.volume,
          glassWidth: form.glassWidth,
          glassHeight: form.glassHeight,
          vehicle: form.vehicle,
          capacityKg: form.capacityKg,
          maxGlassMm: form.maxGlassMm,
          roundTrip: form.roundTrip,
          loadCost: form.loadCost,
          waitCost: form.waitCost,
          extra: form.extra,
          tariff: form.tariff,
          speed: form.speed,
          days: form.days,
        }),
      })
      const list = await reload()
      setOpenId(saved.id)
      setForm(asForm(list.find((item) => item.id === saved.id) ?? saved))
      setNote("Daşıma bazaya yazıldı")
    } catch (reason) {
      setNote(reason instanceof ApiError ? reason.message : "Daşıma yazılmadı")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Guard>
      <div className="haul-page calc-page">
        <PageHead
          kicker="Logistika"
          title="Daşınma"
          text="Marşrutdan xərcə — üç sadə addım."
        />

        <Tabs value={large ? "history" : "new"} onChange={(value) => setLarge(value === "history")} options={[{ id: "new", label: "Yeni daşıma" }, { id: "history", label: `Əvvəlki daşımalar ${rows.length}` }]} />

        {large && <StatGrid className="calc-stats">
          <Metric><span>Daşıma</span><strong>{rows.length}</strong></Metric>
          <Metric><span>Son xərc</span><strong>{rows[0] ? azn(num(rows[0].cost)) : "—"}</strong></Metric>
          <Metric><span>Xərc cəmi</span><strong>{costs.length ? azn(costSum) : "—"}</strong></Metric>
          <Metric><span>Orta məsafə</span><strong>{distances.length ? `${Math.round(distanceSum / distances.length)} km` : "—"}</strong></Metric>
        </StatGrid>}

        {large && (
          <Panel className="pad calc-card calc-history-wide">
            <div className="calc-card-head">
              <h2>Əvvəlki daşımalar</h2>
              <div className="haul-history-tools">
                <Button className="ghost small" onClick={() => setLarge(false)}>Formaya qayıt</Button>
                <span>{shown.length}{blocked ? ` · ${blocked} sığmır` : ""}</span>
              </div>
            </div>
            <HaulHistoryFilters query={query} onQuery={setQuery} fit={fit} onFit={setFit} />
            {loadError && <p className="calc-meta">{loadError}</p>}
            {loaded && !loadError && rows.length === 0 && <p className="calc-meta">Bazada saxlanmış daşıma yoxdur.</p>}
            {loaded && !loadError && rows.length > 0 && shown.length === 0 && <p className="calc-meta">Bu axtarışa uyğun daşıma yoxdur.</p>}
            <TableContainer className="calc-table-wrap">
              <DataTable className="calc-table">
                <thead>
                  <tr>
                    <th>Marşrut</th>
                    <th>Məsafə</th>
                    <th>Maşın</th>
                    <th>Çəki</th>
                    <th>Tarix</th>
                    <th>Uyğunluq</th>
                    <th>Xərc</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => (
                    <tr key={row.id} className={row.id === openId ? "on" : ""} tabIndex={0} onClick={() => openHaul(row)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openHaul(row) } }}>
                      <td>{row.fromPlace || "—"} → {row.toPlace || "—"}</td>
                      <td>{plain(row.km) || "—"} km</td>
                      <td>{vehicleLabel(row.vehicle)}</td>
                      <td>{plain(row.weightKg) ? `${plain(row.weightKg)} kq` : "—"}</td>
                      <td>{when(row.createdAt)}</td>
                      <td><span className={`haul-fit ${row.fit}`}>{FIT[row.fit]}</span></td>
                      <td>{azn(num(row.cost))}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </TableContainer>
          </Panel>
        )}

        {!large && <div className="calc-board">
          <div className="calc-form" ref={formRef}>
            <StepNav value={step} onChange={setStep} steps={steps} label="Daşınma mərhələləri" />
            {step === "route" && (<Panel className="pad calc-card">
              <div className="calc-card-head">
                <h2>Marşrut məlumatları</h2>
              </div>
              <div className="calc-grid">
                <PlacePick
                  label="Haradan"
                  value={form.from}
                  custom={fromNew}
                  groups={groups}
                  onPick={(from) => set("from", from)}
                  onType={(from) => set("from", from)}
                  onNew={() => { setFromNew(true); set("from", "") }}
                  onList={() => { setFromNew(false); set("from", "") }}
                />
                <PlacePick
                  label="Hara"
                  value={form.to}
                  custom={toNew}
                  groups={groups}
                  onPick={(to) => set("to", to)}
                  onType={(to) => set("to", to)}
                  onNew={() => { setToNew(true); set("to", "") }}
                  onList={() => { setToNew(false); set("to", "") }}
                />
                <Field label="Məsafə, km"><Input value={form.km} inputMode="decimal" placeholder="42" onChange={(event) => set("km", event.target.value)} /></Field>
              </div>
              <button type="button" className={form.roundTrip ? "calc-toggle haul-round on" : "calc-toggle haul-round"} aria-pressed={form.roundTrip} onClick={() => set("roundTrip", !form.roundTrip)}>
                <span className="calc-toggle-copy">
                  <b>Gediş-gəliş</b>
                  <small>{form.roundTrip ? "Açıqdır. Yazılan məsafə ikiqat sayılır." : "Bağlıdır. Yalnız bir tərəf hesablanır."}</small>
                </span>
                <span className="calc-toggle-ui" aria-hidden="true"><span /></span>
              </button>
              <Disclosure title="Müddət parametrləri"><div className="calc-grid">
                <Field label="Günlük yol, km"><Input value={form.speed} inputMode="decimal" placeholder="280" onChange={(event) => set("speed", event.target.value)} /></Field>
                <Field label="Müddət, gün"><Input value={form.days} inputMode="decimal" placeholder="1" onChange={(event) => set("days", event.target.value)} /></Field>
              </div></Disclosure>
            </Panel>)}
            {step === "load" && (<Panel className="pad calc-card">
              <h2>Yük və maşın</h2>
              <div className="calc-grid">
                <Field label="Çəki, kq"><Input value={form.weight} inputMode="decimal" placeholder="1860" onChange={(event) => set("weight", event.target.value)} /></Field>
                <Field label="Həcm, m³"><Input value={form.volume} inputMode="decimal" placeholder="6.4" onChange={(event) => set("volume", event.target.value)} /></Field>
                <Field label="Şüşə eni, mm"><Input value={form.glassWidth} inputMode="decimal" placeholder="2400" onChange={(event) => set("glassWidth", event.target.value)} /></Field>
                <Field label="Şüşə hündürlüyü, mm"><Input value={form.glassHeight} inputMode="decimal" placeholder="1800" onChange={(event) => set("glassHeight", event.target.value)} /></Field>
                <Field label="Maşın" wide>
                  <Select
                    value={form.vehicle}
                    onValueChange={(vehicle) => set("vehicle", vehicle as Vehicle)}
                    options={[{ value: "standart", label: "Standart yük" }, { value: "suse", label: "Şüşədaşıyan" }]}
                  />
                </Field>
                <Field label="Tutum, kq"><Input value={form.capacityKg} inputMode="decimal" placeholder="3500" onChange={(event) => set("capacityKg", event.target.value)} /></Field>
                <Field label="Maksimum şüşə, mm"><Input value={form.maxGlassMm} inputMode="decimal" placeholder="3200" onChange={(event) => set("maxGlassMm", event.target.value)} /></Field>
              </div>
            </Panel>)}
            {step === "price" && (<Panel className="pad calc-card">
              <h2>Tarif və əlavə xərclər</h2>
              <div className="calc-grid">
                <Field label="Tarif, ₼/km"><Input value={form.tariff} inputMode="decimal" placeholder="1.85" onChange={(event) => set("tariff", event.target.value)} /></Field>
                <Field label="Yükləmə, ₼"><Input value={form.loadCost} inputMode="decimal" placeholder="80" onChange={(event) => set("loadCost", event.target.value)} /></Field>
                <Field label="Dayanma, ₼"><Input value={form.waitCost} inputMode="decimal" placeholder="45" onChange={(event) => set("waitCost", event.target.value)} /></Field>
                <Field label="Əlavə, ₼" wide><Input value={form.extra} inputMode="decimal" placeholder="0" onChange={(event) => set("extra", event.target.value)} /></Field>
              </div>
            </Panel>)}
            <div className="calc-step-footer"><span>{stepIndex + 1} / {steps.length}</span><div>{stepIndex > 0 && <Button className="ghost" onClick={() => setStep(steps[stepIndex - 1].id)}>Geri</Button>}{stepIndex < steps.length - 1 && <Button onClick={() => setStep(steps[stepIndex + 1].id)}>Davam et<Icon name="chevron" /></Button>}</div></div>
          </div>

          <aside className="calc-side">
            <Panel className="calc-quote overview-panel">
              <p>Daşınma xərci</p>
              <strong>{!started ? "Marşrut yazın" : preview.cost == null ? "Bağlanmayıb" : azn(preview.cost)}</strong>
              <div className="calc-metrics">
                <div><span>Məsafə</span><b>{!form.km.trim() || preview.km == null ? "—" : `${preview.km} km`}</b></div>
                <div><span>Müddət</span><b>{!started || preview.days == null ? "—" : `${preview.days} gün`}</b></div>
                <div><span>Uyğunluq</span><b>{form.weight.trim() || form.glassWidth.trim() || form.glassHeight.trim() ? FIT[preview.fit] : "Yük yazın"}</b></div>
              </div>
              <div className="calc-kpis">
                <span>{vehicleLabel(form.vehicle)}</span>
                <span>{form.weight.trim() ? `${form.weight} kq` : "çəki yazılmayıb"}</span>
                {form.volume.trim() && <span>{form.volume} m³</span>}
              </div>
              {started && preview.notes.map((item) => <p className="calc-warn" key={item}>{item}</p>)}
              <Button type="button" className="calc-save" onClick={() => void save()} disabled={!form.from.trim() || !form.to.trim() || saving}>
                {saving ? "Yazılır…" : "Daşımanı saxla"}
              </Button>
              <Button className="ghost calc-fresh" onClick={fresh}>Yeni daşıma</Button>
              {note && <p className="calc-note">{note}</p>}
            </Panel>

            {open && (
              <Disclosure title="Saxlanmış daşımanın məlumatları"><Panel className="pad calc-card">
                <div className="calc-card-head">
                  <h2>Saxlanmış daşıma</h2>
                  <span className={`haul-fit ${open.fit}`}>{FIT[open.fit]}</span>
                </div>
                <p className="calc-meta">{when(open.createdAt)} · {vehicleLabel(open.vehicle)} · {open.roundTrip ? "gediş-gəliş" : "bir tərəf"}</p>
                <div className="calc-saved-total"><span>{open.fromPlace || "—"} → {open.toPlace || "—"}</span><b>{azn(num(open.cost))}</b></div>
                <div className="calc-saved-row"><span>Məsafə</span><b>{plain(open.km) || "—"} km</b></div>
                <div className="calc-saved-row"><span>Çəki</span><b>{plain(open.weightKg) ? `${plain(open.weightKg)} kq` : "—"}</b></div>
                <div className="calc-saved-row"><span>Həcm</span><b>{plain(open.volumeM3) ? `${plain(open.volumeM3)} m³` : "—"}</b></div>
                <div className="calc-saved-row"><span>Şüşə</span><b>{num(open.glassWidthMm) || num(open.glassHeightMm) ? `${plain(open.glassWidthMm) || "—"}×${plain(open.glassHeightMm) || "—"} mm` : "—"}</b></div>
                <div className="calc-saved-row"><span>Müddət</span><b>{open.days == null ? "—" : `${open.days} gün`}</b></div>
              </Panel></Disclosure>
            )}


          </aside>
        </div>}
      </div>
    </Guard>
  )
}
