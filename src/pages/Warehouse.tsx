import { useEffect, useState, type FormEvent } from "react"
import { useSearchParams } from "react-router-dom"
import { ApiError, api } from "../api"
import { onHand } from "../domain/ops"
import type { LocationKind, Movement, Shipment } from "../domain/types"
import { dateAZ, hit, money, num } from "../format"
import { Icon } from "../icons"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Badge, Drawer, Empty, Field, PageHead, Select, StockBar, Tabs, useTitle } from "../ui"
import { patch, uid, useWorkspace } from "../workspace"
import { PassportPage } from "./platform"

type Tab = "qaliq" | "kritik" | "pasport" | "transfer" | "hereket" | "anbarlar"
type Read =
  | { kind: "material"; id: string }
  | { kind: "move"; id: string }
  | { kind: "shipment"; id: string }
  | { kind: "place"; id: string }
  | { kind: "intake" }
  | { kind: "route" }
  | { kind: "house"; id: string }

const KIND: Record<string, string> = { merkez: "Mərkəz", zavod: "Zavod", sex: "Sex", sahe: "Sahə" }
const KINDS = Object.keys(KIND) as LocationKind[]
const emptyMove = { materialId: "", type: "mexaric", qty: "", project: "", locationId: "LOC-MERKEZ", smetaLineId: "", note: "" }

const WAREHOUSE_TABS: Tab[] = ["qaliq", "kritik", "pasport", "transfer", "hereket", "anbarlar"]

export default function Warehouse() {
  const { t } = usePrefs()
  useTitle(t("page.warehouse.title"))
  const { query, materials, movements, projects, smetas, locations, stocks, shipments, stockMove, createShipment, advanceShipment, addLocation, editLocation, removeLocation } = useStore()
  const [search, setSearch] = useSearchParams()
  const tabParam = search.get("tab")
  const [tab, setTab] = useState<Tab>(() => (WAREHOUSE_TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "qaliq"))
  const [reading, setReading] = useState<Read | null>(null)

  useEffect(() => {
    if (WAREHOUSE_TABS.includes(tabParam as Tab) && tabParam !== tab) setTab(tabParam as Tab)
  }, [tabParam, tab])

  function openTab(next: string) {
    const value = next as Tab
    setTab(value)
    setReading(null)
    setError("")
    if (value === "pasport") setSearch({ tab: "pasport" })
    else if (search.get("tab")) setSearch({})
  }
  const [form, setForm] = useState(emptyMove)
  const [origin, setOrigin] = useState("LOC-MERKEZ")
  const [stops, setStops] = useState<string[]>([])
  const [pick, setPick] = useState("")
  const [lines, setLines] = useState([{ key: 1, materialId: "", qty: "", price: "" }])
  const [lineKey, setLineKey] = useState(2)
  const [purpose, setPurpose] = useState("")
  const [house, setHouse] = useState<{ name: string; kind: LocationKind }>({ name: "", kind: "merkez" })
  const [error, setError] = useState("")
  const { lots } = useWorkspace()
  const [lot, setLot] = useState({ material: "", batch: "", expires: "", place: "" })
  const [method, setMethod] = useState("orta")
  const [act, setAct] = useState({ kind: "qebul", code: "", qty: "", unitCost: "", batch: "", place: "", toPlace: "", projectId: "", qr: "" })
  const [lotNote, setLotNote] = useState("")
  const [serverLots, setServerLots] = useState<{ id: string; code: string; qty: unknown; unitCost: unknown; qr: string; batch: string; locationId: string | null }[]>([])
  const [platformProjects, setPlatformProjects] = useState<{ id: string; name: string }[]>([])

  function reloadLots() {
    return api<{ method: string; lots: typeof serverLots }>("/api/platform/lots").then((row) => {
      setMethod(row.method)
      setServerLots(row.lots)
    })
  }

  useEffect(() => {
    reloadLots().catch(() => undefined)
    api<{ id: string; name: string }[]>("/api/platform/projects").then(setPlatformProjects).catch(() => setPlatformProjects([]))
  }, [])

  async function saveMethod(next: string) {
    setMethod(next)
    try {
      await api("/api/platform/warehouse/policy", { method: "POST", body: JSON.stringify({ method: next }) })
    } catch (reason) {
      setLotNote(reason instanceof ApiError ? reason.message : "Maya üsulu yazılmadı")
    }
  }

  async function runAct() {
    try {
      let code = act.code
      if (act.qr && act.kind !== "qebul") {
        const found = await api<{ code: string }>(`/api/platform/lots/qr/${encodeURIComponent(act.qr)}`)
        code = found.code
      }
      const result = await api<{ unitCost?: number; projectCost?: number; qr?: string }>("/api/platform/lots/act", {
        method: "POST",
        body: JSON.stringify({
          kind: act.kind,
          code,
          qty: act.qty,
          unitCost: act.unitCost,
          batch: act.batch,
          locationId: act.place,
          toLocationId: act.toPlace,
          projectId: act.projectId,
        }),
      })
      await reloadLots()
      setLotNote(act.kind === "buraxilis" ? `Layihə xərcinə ${result.projectCost ?? 0} düşdü.` : act.kind === "qebul" ? `Qəbul olundu. QR: ${result.qr || "verildi"}` : "Hərəkət yazıldı. Qalıq sıfırdan aşağı düşmür.")
    } catch (reason) {
      setLotNote(reason instanceof ApiError ? reason.message : "Anbar hərəkəti yazılmadı")
    }
  }

  const value = materials.reduce((sum, item) => sum + item.qty * item.price, 0)
  const short = materials.filter((item) => item.qty < item.min).length
  const nameOf = (id?: string) => locations.find((item) => item.id === id)?.name || ""
  const stockRows = materials.filter((item) => (tab !== "kritik" || item.qty < item.min) && hit(query, item.name, item.id, nameOf(item.id)))
  const moves = movements.filter((item) => hit(query, item.material, item.project, item.by, item.id, item.note))
  const routes = shipments.filter((item) => hit(query, item.id, item.by, item.note, ...item.lines.map((line) => line.material)))
  const houses = locations
    .map((place) => {
      const rows = stocks.filter((row) => row.locationId === place.id && row.qty > 0)
      const worth = rows.reduce((sum, row) => sum + row.qty * (materials.find((item) => item.id === row.materialId)?.price || 0), 0)
      const critical = rows.filter((row) => {
        const material = materials.find((item) => item.id === row.materialId)
        return Boolean(material && material.qty < material.min)
      }).length
      return { ...place, count: rows.length, worth, critical }
    })
    .filter((place) => hit(query, place.name, KIND[place.kind]))

  function placesOf(materialId: string) {
    return stocks.filter((row) => row.materialId === materialId && row.qty > 0)
  }

  function openIntake(materialId = materials[0]?.id || "", locationId = "LOC-MERKEZ", type = "mexaric") {
    setError("")
    setForm({ ...emptyMove, materialId, locationId, type })
    setReading({ kind: "intake" })
  }

  function openHouse(id = "") {
    const current = locations.find((item) => item.id === id)
    setError("")
    setHouse(current ? { name: current.name, kind: current.kind } : { name: "", kind: "merkez" })
    setReading({ kind: "house", id })
  }

  function openRoute() {
    setError("")
    setOrigin("LOC-MERKEZ")
    setStops([])
    setPick(locations.find((item) => item.id !== "LOC-MERKEZ")?.id || "")
    setLines([{ key: lineKey, materialId: "", qty: "", price: "" }])
    setLineKey(lineKey + 1)
    setPurpose("")
    setReading({ kind: "route" })
  }

  function submitMove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = stockMove(form)
    setError(message)
    if (!message) setReading(null)
  }

  function submitRoute() {
    const message = createShipment({
      stops: [origin, ...stops],
      lines: lines.filter((line) => line.materialId).map((line) => ({ materialId: line.materialId, qty: line.qty, price: line.price })),
      note: purpose.trim(),
    })
    setError(message)
    if (!message) setReading(null)
  }

  const selected = materials.find((item) => item.id === form.materialId)
  const chosenProject = projects.find((item) => item.name === form.project)
  const smeta = smetas.find((item) => item.id === chosenProject?.smetaId)
  const materialCard = reading?.kind === "material" ? materials.find((item) => item.id === reading.id) : undefined
  const moveCard = reading?.kind === "move" ? movements.find((item) => item.id === reading.id) : undefined
  const routeCard = reading?.kind === "shipment" ? shipments.find((item) => item.id === reading.id) : undefined
  const placeCard = reading?.kind === "place" ? houses.find((item) => item.id === reading.id) : undefined
  const hint =
    tab === "transfer" ? `${routes.filter((item) => item.step < item.stops.length - 1).length} sənəd yoldadır` :
    tab === "anbarlar" ? `${houses.length} anbar` :
    tab === "hereket" ? `${moves.length} hərəkət` :
    `${short} material minimumdan aşağı`

  return (
    <>
      <PageHead kicker={t("page.warehouse.kicker")} title={t("page.warehouse.title")} text={t("page.warehouse.text", { value: money(value) })}>
        {tab === "transfer" ? (
          <button type="button" className="btn" onClick={openRoute}><Icon name="plus" /> Transfer</button>
        ) : tab === "anbarlar" ? (
          <button type="button" className="btn" onClick={() => openHouse()}><Icon name="plus" /> Anbar</button>
        ) : tab === "pasport" ? null : (
          <button type="button" className="btn" onClick={() => openIntake()}><Icon name="plus" /> Hərəkət</button>
        )}
      </PageHead>
      <div className="toolbar">
        <Tabs
          value={tab}
          onChange={openTab}
          options={[
            { id: "qaliq", label: "Qalıq" },
            { id: "kritik", label: "Kritik" },
            { id: "pasport", label: "Pasport" },
            { id: "transfer", label: "Transfer" },
            { id: "hereket", label: "Hərəkət" },
            { id: "anbarlar", label: "Anbarlar" },
          ]}
        />
        <span className="muted">{hint}</span>
      </div>
      {tab === "pasport" && <PassportPage embedded materialFilter={materialCard?.name || ""} />}
      {tab !== "pasport" && (
      <>
      <section className="panel pad">
        <h2 className="block-title">QR və maya</h2>
        <div className="form-row wide">
          <label>Maya<Select value={method} onValueChange={(value) => void saveMethod(value)} options={[{ value: "orta", label: "Orta çəkili" }, { value: "fifo", label: "FIFO" }]} /></label>
          <label>Hərəkət<Select value={act.kind} onValueChange={(kind) => setAct({ ...act, kind })} options={[{ value: "qebul", label: "Qəbul" }, { value: "kocurme", label: "Köçürmə" }, { value: "buraxilis", label: "Layihəyə buraxılış" }, { value: "qaytarma", label: "Geri qaytarma" }, { value: "itki", label: "İtki" }]} /></label>
          <label>Material kodu<input value={act.code} onChange={(event) => setAct({ ...act, code: event.target.value })} /></label>
          <label>QR<input value={act.qr} onChange={(event) => setAct({ ...act, qr: event.target.value })} placeholder="çıxışda oxu" /></label>
          <label>Miqdar<input value={act.qty} onChange={(event) => setAct({ ...act, qty: event.target.value })} /></label>
          <label>Vahid maya<input value={act.unitCost} onChange={(event) => setAct({ ...act, unitCost: event.target.value })} /></label>
          <label>Partiya<input value={act.batch} onChange={(event) => setAct({ ...act, batch: event.target.value })} /></label>
          <label>Anbar<input value={act.place} onChange={(event) => setAct({ ...act, place: event.target.value })} /></label>
          <label>Hədəf anbar<input value={act.toPlace} onChange={(event) => setAct({ ...act, toPlace: event.target.value })} /></label>
          <label>Layihə<Select value={act.projectId} onValueChange={(projectId) => setAct({ ...act, projectId })} options={[{ value: "", label: "Seçilməyib" }, ...(platformProjects.length ? platformProjects : projects).map((item) => ({ value: item.id, label: item.name }))]} /></label>
          <button type="button" className="btn" onClick={() => void runAct()}>Yaz</button>
        </div>
        {lotNote && <p className="lede">{lotNote}</p>}
        {serverLots.filter((item) => Number(item.qty) > 0).map((item) => (
          <div className="step-row" key={item.id}><span>{item.code} · {item.batch || "partiyasız"} · {item.locationId || "anbar"} · {item.qr}</span><strong>{String(item.qty)} × {String(item.unitCost)}</strong></div>
        ))}
      </section>

      {(tab === "qaliq" || tab === "kritik") && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>Yer</th>
                <th>Qalıq</th>
                <th>Səviyyə</th>
                <th className="num">Dəyər</th>
              </tr>
            </thead>
            <tbody>
              {stockRows.map((item) => {
                const places = placesOf(item.id)
                return (
                  <tr key={item.id} className="click" onClick={() => setReading({ kind: "material", id: item.id })}>
                    <td>
                      <div className="name-cell">
                        <b>{item.name}</b>
                        <span className="mono">{item.id}</span>
                      </div>
                    </td>
                    <td>
                      <button type="button" className="mat-open" onClick={(event) => { event.stopPropagation(); setReading({ kind: "material", id: item.id }) }}>
                        <b>{places.length ? `${places.length} anbar` : "Yer yoxdur"}</b>
                        <span className="clip">{places.map((row) => nameOf(row.locationId)).filter(Boolean).join(" · ") || item.location}</span>
                      </button>
                    </td>
                    <td>
                      {num(item.qty, item.qty % 1 ? 1 : 0)} {item.unit}
                      <div className="muted">min {num(item.min)}</div>
                    </td>
                    <td style={{ minWidth: 120 }}><StockBar qty={item.qty} min={item.min} /></td>
                    <td className="num">{money(item.qty * item.price)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {stockRows.length === 0 && <Empty title="Material tapılmadı" text="Kritik filtrdə və ya axtarışda nəticə yoxdur." />}
        </div>
      )}

      {tab === "transfer" && (
        <section className="panel pad" style={{ marginBottom: 16 }}>
          <h2 className="block-title">Partiya</h2>
          <p className="lede">Partiya, son istifadə və yer boşdur. Köçürmə aşağıdakı cədvəldə qalır.</p>
          <div className="form-row wide">
            <label>Material<input value={lot.material} onChange={(event) => setLot({ ...lot, material: event.target.value })} /></label>
            <label>Partiya<input value={lot.batch} onChange={(event) => setLot({ ...lot, batch: event.target.value })} placeholder="boş" /></label>
            <label>Son istifadə<input value={lot.expires} onChange={(event) => setLot({ ...lot, expires: event.target.value })} placeholder="boş" /></label>
            <label>Yer<input value={lot.place} onChange={(event) => setLot({ ...lot, place: event.target.value })} placeholder="boş" /></label>
            <button type="button" className="btn" onClick={() => { if (!lot.material.trim()) return; patch((state) => ({ ...state, lots: [...state.lots, { ...lot, id: uid() }] })); setLot({ material: "", batch: "", expires: "", place: "" }) }}>Yaz</button>
          </div>
          {lots.length === 0 && <p className="lede">Partiya yoxdur.</p>}
          {lots.map((row) => <div className="step-row" key={row.id}><span>{row.material} · {row.batch.trim() || "partiya yoxdur"} · {row.place.trim() || "yer yoxdur"}</span><strong>{row.expires.trim() || "tarix yoxdur"}</strong></div>)}
        </section>
      )}

      {tab === "transfer" && (
        <div className="table-wrap wide">
          <table>
            <thead>
              <tr>
                <th>Sənəd</th>
                <th>Material</th>
                <th className="num">Məbləğ</th>
                <th>Marşrut</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((item) => (
                <tr key={item.id} className="click" onClick={() => { setError(""); setReading({ kind: "shipment", id: item.id }) }}>
                  <td>
                    <div className="name-cell">
                      <b>{item.id}</b>
                      <span className="muted">{dateAZ(item.date)} · {item.by}</span>
                    </div>
                  </td>
                  <td>
                    <button type="button" className="mat-open" onClick={(event) => { event.stopPropagation(); setError(""); setReading({ kind: "shipment", id: item.id }) }}>
                      <b>{item.lines.length} material</b>
                      <span className="clip">{item.lines.map((line) => line.material).join(", ")}</span>
                    </button>
                  </td>
                  <td className="num">{money(item.lines.reduce((sum, line) => sum + line.amount, 0))}</td>
                  <td className="track-cell">
                    <button type="button" className="track-btn" aria-label={`${item.id} marşrutu`} onClick={(event) => { event.stopPropagation(); setError(""); setReading({ kind: "shipment", id: item.id }) }}>
                      <RouteTrack shipment={item} nameOf={nameOf} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {routes.length === 0 && <Empty title="Transfer yoxdur" text="Marşrut yazılanda sənəd burada durur." />}
        </div>
      )}

      {tab === "hereket" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sənəd</th>
                <th>Material</th>
                <th>Tip</th>
                <th>Mahiyyət</th>
                <th className="num">Miqdar</th>
              </tr>
            </thead>
            <tbody>
              {moves.map((item) => (
                <tr key={item.id} className="click" onClick={() => setReading({ kind: "move", id: item.id })}>
                  <td>
                    <div className="name-cell">
                      <b>{item.id}</b>
                      <span className="muted">{dateAZ(item.date)} · {item.by}</span>
                    </div>
                  </td>
                  <td>{item.material}</td>
                  <td><Badge status={item.type} /></td>
                  <td>
                    <button type="button" className="mat-open" onClick={(event) => { event.stopPropagation(); setReading({ kind: "move", id: item.id }) }}>
                      <span className="clip">{story(item, nameOf)}</span>
                    </button>
                  </td>
                  <td className="num">{num(item.qty, item.qty % 1 ? 1 : 0)} {item.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {moves.length === 0 && <Empty title="Hərəkət yoxdur" text="Axtarışa uyğun anbar hərəkəti tapılmadı." />}
        </div>
      )}

      {tab === "anbarlar" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Anbar</th>
                <th>Növ</th>
                <th>Material</th>
                <th className="num">Dəyər</th>
                <th>Kritik</th>
              </tr>
            </thead>
            <tbody>
              {houses.map((place) => (
                <tr key={place.id} className="click" onClick={() => { setError(""); setReading({ kind: "place", id: place.id }) }}>
                  <td><b>{place.name}</b></td>
                  <td>{KIND[place.kind] || place.kind}</td>
                  <td>{place.count}</td>
                  <td className="num">{money(place.worth)}</td>
                  <td>{place.critical ? <b>{place.critical}</b> : <span className="muted">Yoxdur</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {houses.length === 0 && <Empty title="Anbar tapılmadı" text="Axtarışa uyğun anbar yoxdur." />}
        </div>
      )}
      </>
      )}

      {materialCard && (
        <Drawer title={materialCard.name} onClose={() => setReading(null)}>
          <div className="form">
            <p className="muted">{materialCard.id} · min {num(materialCard.min)} {materialCard.unit} · {money(materialCard.price)}</p>
            <p>Cəmi {num(materialCard.qty, materialCard.qty % 1 ? 1 : 0)} {materialCard.unit} · {money(materialCard.qty * materialCard.price)}</p>
            {placesOf(materialCard.id).map((row) => (
              <p key={row.locationId}><b>{nameOf(row.locationId)}</b> · {num(row.qty, row.qty % 1 ? 1 : 0)} {materialCard.unit}</p>
            ))}
            {moves.filter((item) => item.materialId === materialCard.id || item.material === materialCard.name).slice(0, 4).map((item) => (
              <p key={item.id} className="muted">{item.id} · {story(item, nameOf)}</p>
            ))}
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => { setReading(null); openTab("pasport") }}>Pasportlar</button>
              <button type="button" className="btn ghost" onClick={() => openIntake(materialCard.id, placesOf(materialCard.id)[0]?.locationId || "LOC-MERKEZ", "medaxil")}>Mədaxil</button>
              <button type="button" className="btn" onClick={() => openIntake(materialCard.id, placesOf(materialCard.id)[0]?.locationId || "LOC-MERKEZ", "mexaric")}>Məxaric</button>
            </div>
          </div>
        </Drawer>
      )}

      {moveCard && (
        <Drawer title={moveCard.id} onClose={() => setReading(null)}>
          <div className="form">
            <p>{story(moveCard, nameOf)}</p>
            <p><b>{moveCard.material}</b> · {num(moveCard.qty, moveCard.qty % 1 ? 1 : 0)} {moveCard.unit}</p>
            <p className="muted">{dateAZ(moveCard.date)} · {moveCard.by}</p>
            <p><Badge status={moveCard.type} /></p>
            {moveCard.type === "transfer" && <p>{nameOf(moveCard.from) || "—"} → {nameOf(moveCard.locationId) || "—"}</p>}
            {moveCard.type !== "transfer" && nameOf(moveCard.locationId) && <p>Yer: {nameOf(moveCard.locationId)}</p>}
            {moveCard.project && moveCard.project !== "—" && <p>Layihə: {moveCard.project}</p>}
          </div>
        </Drawer>
      )}

      {routeCard && (
        <Drawer title={routeCard.id} onClose={() => setReading(null)}>
          <div className="form">
            <RouteTrack shipment={routeCard} nameOf={nameOf} />
            <p className="muted">{routeCard.step >= routeCard.stops.length - 1 ? "Material son dayanacaqdadır." : `İndi ${nameOf(routeCard.stops[routeCard.step])} dayanacağındadır. Növbəti: ${nameOf(routeCard.stops[routeCard.step + 1])}.`}</p>
            {routeCard.note && <p>{routeCard.note}</p>}
            {routeCard.lines.map((line) => (
              <p key={line.materialId}><b>{line.material}</b> · {num(line.qty, 1)} {line.unit} · {money(line.price)} · {money(line.amount)}</p>
            ))}
            <p><b>Cəmi {money(routeCard.lines.reduce((sum, line) => sum + line.amount, 0))}</b></p>
            {error && <p className="form-error">{error}</p>}
            {routeCard.step < routeCard.stops.length - 1 && (
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setError(advanceShipment(routeCard.id))}>Növbəti dayanacağa</button>
              </div>
            )}
          </div>
        </Drawer>
      )}

      {placeCard && (
        <Drawer title={placeCard.name} onClose={() => setReading(null)}>
          <div className="form">
            <p className="muted">{KIND[placeCard.kind] || placeCard.kind} · {money(placeCard.worth)}</p>
            {stocks.filter((row) => row.locationId === placeCard.id && row.qty > 0).map((row) => {
              const material = materials.find((item) => item.id === row.materialId)
              if (!material) return null
              return <p key={row.materialId}><b>{material.name}</b> · {num(row.qty, row.qty % 1 ? 1 : 0)} {material.unit} · {money(row.qty * material.price)}</p>
            })}
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => openHouse(placeCard.id)}><Icon name="edit" /> Redaktə</button>
              <button type="button" className="btn ghost" onClick={() => { const message = removeLocation(placeCard.id); setError(message); if (!message) setReading(null) }}><Icon name="trash" /> Sil</button>
              <button type="button" className="btn" onClick={() => openIntake(materials[0]?.id || "", placeCard.id)}>Hərəkət</button>
            </div>
          </div>
        </Drawer>
      )}

      {reading?.kind === "house" && (
        <Drawer title={reading.id ? "Anbarı yaz" : "Yeni anbar"} onClose={() => setReading(null)}>
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault()
              const message = reading.id ? editLocation(reading.id, house) : addLocation(house)
              setError(message)
              if (!message) setReading(null)
            }}
          >
            <Field label="Ad">
              <input value={house.name} onChange={(event) => setHouse({ ...house, name: event.target.value })} />
            </Field>
            <Field label="Növ">
              <Select value={house.kind} onValueChange={(kind) => setHouse({ ...house, kind: kind as LocationKind })} options={KINDS.map((kind) => ({ value: kind, label: KIND[kind] }))} />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setReading(null)}>Ləğv et</button>
              <button className="btn" type="submit">Yaz</button>
            </div>
          </form>
        </Drawer>
      )}

      {reading?.kind === "intake" && (
        <Drawer title="Anbar hərəkəti" onClose={() => setReading(null)}>
          <form className="form" onSubmit={submitMove}>
            <Field label="Material">
              <Select value={form.materialId} onValueChange={(materialId) => setForm({ ...form, materialId })} options={materials.map((item) => ({ value: item.id, label: item.name }))} />
            </Field>
            <Field label="Tip">
              <Select
                value={form.type}
                onValueChange={(type) => setForm({ ...form, type })}
                options={[
                  { value: "mexaric", label: t("status.mexaric") },
                  { value: "medaxil", label: t("status.medaxil") },
                ]}
              />
            </Field>
            <Field label={selected ? `Miqdar, ${selected.unit}` : "Miqdar"}>
              <input type="number" min="0" step="0.1" value={form.qty} onChange={(event) => setForm({ ...form, qty: event.target.value })} />
            </Field>
            {selected && <p className="muted">Bu anbarda {num(onHand(stocks, selected.id, form.locationId), selected.qty % 1 ? 1 : 0)} {selected.unit}</p>}
            <Field label="Anbar">
              <Select value={form.locationId} onValueChange={(locationId) => setForm({ ...form, locationId })} options={locations.map((item) => ({ value: item.id, label: item.name }))} />
            </Field>
            <Field label="Layihə">
              <Select
                value={form.project}
                onValueChange={(project) => setForm({ ...form, project, smetaLineId: "" })}
                options={[{ value: "", label: t("stock.general") }, ...projects.map((project) => ({ value: project.name, label: project.name }))]}
              />
            </Field>
            {smeta && form.type === "mexaric" && (
              <Field label="Smeta sətri">
                <Select value={form.smetaLineId} onValueChange={(smetaLineId) => setForm({ ...form, smetaLineId })} options={smeta.lines.map((line) => ({ value: line.id, label: `${line.code} ${line.name}` }))} />
              </Field>
            )}
            <Field label="Mahiyyət">
              <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Nə üçün çıxdı və ya qəbul olundu" />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setReading(null)}>Ləğv et</button>
              <button className="btn" type="submit">Qeyd et</button>
            </div>
          </form>
        </Drawer>
      )}

      {reading?.kind === "route" && (
        <Drawer title="Transfer" onClose={() => setReading(null)}>
          <div className="form">
            <Field label="Haradan">
              <Select value={origin} onValueChange={setOrigin} options={locations.map((item) => ({ value: item.id, label: item.name }))} />
            </Field>
            <div className="stop-row">
              <span className="stop-chip">{nameOf(origin)}</span>
              {stops.map((id) => (
                <span className="stop-chip" key={id}>
                  {nameOf(id)}
                  <button type="button" aria-label="Dayanacağı sil" onClick={() => setStops(stops.filter((item) => item !== id))}>×</button>
                </span>
              ))}
            </div>
            <div className="pull-row">
              <Select ariaLabel="Dayanacaq" value={pick} onValueChange={setPick} options={locations.filter((item) => item.id !== stops[stops.length - 1] && item.id !== (stops.length ? "" : origin)).map((item) => ({ value: item.id, label: item.name }))} />
              <button type="button" className="btn ghost small" onClick={() => { if (pick && pick !== stops[stops.length - 1] && !(stops.length === 0 && pick === origin)) setStops([...stops, pick]) }}>Əlavə et</button>
            </div>
            {lines.map((line) => {
              const material = materials.find((item) => item.id === line.materialId)
              const amount = (Number(line.qty) || 0) * (Number(line.price) || 0)
              return (
                <div className="recipe-line" key={line.key}>
                  <Select
                    ariaLabel="Material"
                    value={line.materialId}
                    onValueChange={(materialId) => {
                      const next = materials.find((item) => item.id === materialId)
                      setLines(lines.map((row) => (row.key === line.key ? { ...row, materialId, price: next ? String(next.price) : row.price } : row)))
                    }}
                    options={materials.map((item) => ({ value: item.id, label: item.name }))}
                  />
                  <div className="recipe-line-qty">
                    <input aria-label="Miqdar" type="number" min="0" step="0.1" value={line.qty} onChange={(event) => setLines(lines.map((row) => (row.key === line.key ? { ...row, qty: event.target.value } : row)))} />
                    <input aria-label="Qiymət" type="number" min="0" step="1" value={line.price} onChange={(event) => setLines(lines.map((row) => (row.key === line.key ? { ...row, price: event.target.value } : row)))} />
                    <button type="button" className="btn ghost small" onClick={() => setLines(lines.length === 1 ? lines : lines.filter((row) => row.key !== line.key))}><Icon name="trash" /> Sil</button>
                  </div>
                  <p className="muted">{material ? `Anbarda ${num(onHand(stocks, material.id, origin), 1)} ${material.unit} · ` : ""}{money(amount)}</p>
                </div>
              )
            })}
            <div className="form-actions">
              <button type="button" className="btn ghost small" onClick={() => { setLines([...lines, { key: lineKey, materialId: "", qty: "", price: "" }]); setLineKey(lineKey + 1) }}>Material əlavə et</button>
              <strong>{money(lines.reduce((sum, line) => sum + (Number(line.qty) || 0) * (Number(line.price) || 0), 0))}</strong>
            </div>
            <Field label="Mahiyyət">
              <input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="Material hara və nə üçün gedir" />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setReading(null)}>Ləğv et</button>
              <button type="button" className="btn" onClick={submitRoute}>Marşrutu yaz</button>
            </div>
          </div>
        </Drawer>
      )}
    </>
  )
}

function story(item: Movement, nameOf: (id?: string) => string) {
  if (item.note?.trim()) return item.note.trim()
  const to = nameOf(item.locationId)
  const from = nameOf(item.from)
  if (item.type === "transfer") return `${item.material}: ${from || "—"} → ${to || "—"}.`
  if (item.type === "medaxil") return `${to || "Anbar"}: ${item.material} qəbul olunub.`
  const job = item.project && item.project !== "—" ? `, ${item.project}` : ""
  return `${to || "Anbar"}: ${item.material} məxaric olunub${job}.`
}

function RouteTrack({ shipment, nameOf }: { shipment: Shipment; nameOf: (id: string) => string }) {
  return (
    <ol className="phases track">
      {shipment.stops.map((id, index) => (
        <li key={`${id}-${index}`} className={index < shipment.step ? "done" : index === shipment.step ? "current" : ""}>
          <i />
          <span>{nameOf(id)}</span>
        </li>
      ))}
    </ol>
  )
}
