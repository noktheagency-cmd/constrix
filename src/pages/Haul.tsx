import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ApiError, api, dec } from "../api"
import { kindLabel, logisticsMath, showPath, type LogisticsInput } from "../procure/engine"
import { Icon } from "../icons"
import { useProcure } from "../procure/store"
import { PageHead, Select, useTitle, type SelectGroup } from "../ui"

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
  return date.toLocaleDateString("az-AZ", { day: "numeric", month: "short", year: "numeric" })
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
      <input className="calc-search" value={query} placeholder="Haradan və ya hara" onChange={(event) => onQuery(event.target.value)} />
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
          <input value={value} placeholder="Ünvan yazın" autoFocus onChange={(event) => onType(event.target.value)} />
          <button type="button" className="btn ghost small" onClick={onList}>Siyahı</button>
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
  const historyRef = useRef<HTMLElement>(null)

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
    if (!large) return
    historyRef.current?.scrollIntoView({ block: "start" })
  }, [large])

  useEffect(() => {
    setFromNew((current) => form.from ? !knownPlace(form.from, groups) : current)
    setToNew((current) => form.to ? !knownPlace(form.to, groups) : current)
  }, [form.from, form.to, groups])

  function fresh() {
    setForm(emptyHaul)
    setOpenId("")
    setNote("")
    setFromNew(false)
    setToNew(false)
  }

  function openHaul(row: SavedHaul) {
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
          text="Marşrut, yük və maşın bir hesaba yığılır. Əvvəlki daşımalar bazada qalır və buradan açılır."
        />

        <div className="calc-stats">
          <article><span>Daşıma</span><strong>{rows.length}</strong></article>
          <article><span>Son xərc</span><strong>{rows[0] ? azn(num(rows[0].cost)) : "—"}</strong></article>
          <article><span>Xərc cəmi</span><strong>{costs.length ? azn(costSum) : "—"}</strong></article>
          <article><span>Orta məsafə</span><strong>{distances.length ? `${Math.round(distanceSum / distances.length)} km` : "—"}</strong></article>
        </div>

        {large && (
          <section className="panel pad calc-card calc-history-wide" ref={historyRef}>
            <div className="calc-card-head">
              <h2>Əvvəlki daşımalar</h2>
              <div className="haul-history-tools">
                <button type="button" className="icon-btn" aria-label="Daralt" onClick={() => setLarge(false)}><Icon name="narrow" /></button>
                <span>{shown.length}{blocked ? ` · ${blocked} sığmır` : ""}</span>
              </div>
            </div>
            <HaulHistoryFilters query={query} onQuery={setQuery} fit={fit} onFit={setFit} />
            {loadError && <p className="calc-meta">{loadError}</p>}
            {loaded && !loadError && rows.length === 0 && <p className="calc-meta">Bazada saxlanmış daşıma yoxdur.</p>}
            {loaded && !loadError && rows.length > 0 && shown.length === 0 && <p className="calc-meta">Bu axtarışa uyğun daşıma yoxdur.</p>}
            <div className="calc-table-wrap">
              <table className="calc-table">
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
              </table>
            </div>
          </section>
        )}

        <div className="calc-board">
          <div className="calc-form">
            <section className="panel pad calc-card">
              <div className="calc-card-head">
                <h2>Marşrut</h2>
                <button type="button" className="btn ghost small" onClick={fresh}>Yeni daşıma</button>
              </div>
              <div className="haul-route">
                <div className="haul-place">
                  <span>Haradan</span>
                  <b>{form.from.trim() || "Başlanğıc"}</b>
                </div>
                <div className="haul-leg">
                  <b>{preview.km == null ? "—" : `${preview.km} km`}</b>
                  <span>{form.roundTrip ? "gediş-gəliş" : "bir tərəf"}</span>
                </div>
                <div className="haul-place">
                  <span>Hara</span>
                  <b>{form.to.trim() || "Təyinat"}</b>
                </div>
              </div>
              <button type="button" className={form.roundTrip ? "calc-toggle haul-round on" : "calc-toggle haul-round"} aria-pressed={form.roundTrip} onClick={() => set("roundTrip", !form.roundTrip)}>
                <span className="calc-toggle-copy">
                  <b>Gediş-gəliş</b>
                  <small>{form.roundTrip ? "Açıqdır. Yazılan məsafə ikiqat sayılır." : "Bağlıdır. Yalnız bir tərəf hesablanır."}</small>
                </span>
                <span className="calc-toggle-ui" aria-hidden="true"><span /></span>
              </button>
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
                <Field label="Məsafə, km"><input value={form.km} inputMode="decimal" placeholder="42" onChange={(event) => set("km", event.target.value)} /></Field>
                <Field label="Tarif, ₼/km"><input value={form.tariff} inputMode="decimal" placeholder="1.85" onChange={(event) => set("tariff", event.target.value)} /></Field>
                <Field label="Günlük yol, km"><input value={form.speed} inputMode="decimal" placeholder="280" onChange={(event) => set("speed", event.target.value)} /></Field>
                <Field label="Müddət, gün"><input value={form.days} inputMode="decimal" placeholder="1" onChange={(event) => set("days", event.target.value)} /></Field>
              </div>
            </section>

            <section className="panel pad calc-card">
              <h2>Yük</h2>
              <div className="calc-grid">
                <Field label="Çəki, kq"><input value={form.weight} inputMode="decimal" placeholder="1860" onChange={(event) => set("weight", event.target.value)} /></Field>
                <Field label="Həcm, m³"><input value={form.volume} inputMode="decimal" placeholder="6.4" onChange={(event) => set("volume", event.target.value)} /></Field>
                <Field label="Şüşə eni, mm"><input value={form.glassWidth} inputMode="decimal" placeholder="2400" onChange={(event) => set("glassWidth", event.target.value)} /></Field>
                <Field label="Şüşə hündürlüyü, mm"><input value={form.glassHeight} inputMode="decimal" placeholder="1800" onChange={(event) => set("glassHeight", event.target.value)} /></Field>
              </div>
            </section>

            <section className="panel pad calc-card">
              <h2>Maşın və əlavələr</h2>
              <div className="calc-grid">
                <Field label="Maşın" wide>
                  <Select
                    value={form.vehicle}
                    onValueChange={(vehicle) => set("vehicle", vehicle as Vehicle)}
                    options={[{ value: "standart", label: "Standart yük" }, { value: "suse", label: "Şüşədaşıyan" }]}
                  />
                </Field>
                <Field label="Tutum, kq"><input value={form.capacityKg} inputMode="decimal" placeholder="3500" onChange={(event) => set("capacityKg", event.target.value)} /></Field>
                <Field label="Maksimum şüşə, mm"><input value={form.maxGlassMm} inputMode="decimal" placeholder="3200" onChange={(event) => set("maxGlassMm", event.target.value)} /></Field>
                <Field label="Yükləmə, ₼"><input value={form.loadCost} inputMode="decimal" placeholder="80" onChange={(event) => set("loadCost", event.target.value)} /></Field>
                <Field label="Dayanma, ₼"><input value={form.waitCost} inputMode="decimal" placeholder="45" onChange={(event) => set("waitCost", event.target.value)} /></Field>
                <Field label="Əlavə, ₼" wide><input value={form.extra} inputMode="decimal" placeholder="0" onChange={(event) => set("extra", event.target.value)} /></Field>
              </div>
            </section>
          </div>

          <aside className="calc-side">
            <section className="calc-quote">
              <p>Canlı xərc</p>
              <strong>{!started ? "Marşrut yazın" : preview.cost == null ? "Bağlanmayıb" : azn(preview.cost)}</strong>
              <div className="calc-metrics">
                <div><span>Yol</span><b>{preview.km == null ? "—" : `${preview.km} km`}</b></div>
                <div><span>Müddət</span><b>{preview.days == null ? "—" : `${preview.days} gün`}</b></div>
                <div><span>Uyğunluq</span><b>{FIT[preview.fit]}</b></div>
              </div>
              <div className="calc-kpis">
                <span>{vehicleLabel(form.vehicle)}</span>
                <span>{form.weight.trim() ? `${form.weight} kq` : "çəki yazılmayıb"}</span>
                {form.volume.trim() && <span>{form.volume} m³</span>}
              </div>
              {started && preview.notes.map((item) => <p className="calc-warn" key={item}>{item}</p>)}
              <button type="button" className="btn calc-save" onClick={() => void save()} disabled={!form.from.trim() || !form.to.trim() || saving}>
                {saving ? "Yazılır…" : "Daşımanı saxla"}
              </button>
              {note && <p className="calc-note">{note}</p>}
            </section>

            {open && (
              <section className="panel pad calc-card">
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
              </section>
            )}

            {!large && <section className="panel pad calc-card calc-history">
              <div className="calc-card-head">
                <h2>Əvvəlki daşımalar</h2>
                <div className="haul-history-tools">
                  <button type="button" className="icon-btn" aria-label="Genişləndir" onClick={() => setLarge(true)}><Icon name="widen" /></button>
                  <span>{shown.length}{blocked ? ` · ${blocked} sığmır` : ""}</span>
                </div>
              </div>
              <HaulHistoryFilters query={query} onQuery={setQuery} fit={fit} onFit={setFit} />
              {loadError && <p className="calc-meta">{loadError}</p>}
              {loaded && !loadError && rows.length === 0 && <p className="calc-meta">Bazada saxlanmış daşıma yoxdur.</p>}
              {loaded && !loadError && rows.length > 0 && shown.length === 0 && <p className="calc-meta">Bu axtarışa uyğun daşıma yoxdur.</p>}
              <div className="calc-list haul-list">
                {shown.map((row) => (
                  <button key={row.id} type="button" className={row.id === openId ? "calc-hit on" : row.fit === "uygun" ? "calc-hit" : "calc-hit haul-miss"} onClick={() => openHaul(row)}>
                    <b>{row.fromPlace || "—"} → {row.toPlace || "—"}</b>
                    <span>{vehicleLabel(row.vehicle)} · {plain(row.km) || "—"} km · {row.days == null ? "müddət yoxdur" : `${row.days} gün`}</span>
                    <span>{when(row.createdAt)} · {FIT[row.fit]}</span>
                    <em>{azn(num(row.cost))}</em>
                  </button>
                ))}
              </div>
            </section>}
          </aside>
        </div>
      </div>
    </Guard>
  )
}
