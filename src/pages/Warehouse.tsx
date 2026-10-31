import { DataTable } from '../components/DataTable'
import { Button, Disclosure, Input, TableContainer, Toolbar } from "../components/primitives"
import { useEffect, useState, type FormEvent } from "react"
import { useSearchParams } from "react-router-dom"
import { ApiError, api } from "../api"
import { onHand } from "../domain/ops"
import type { LocationKind, Movement, Shipment } from "../domain/types"
import { dateAZ, hit, money, num } from "../format"
import { Icon } from "../icons"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Badge, Drawer, Empty, Field, Modal, PageHead, Select, StockBar, Tabs, useTitle } from "../ui"
import { patch, uid, useWorkspace } from "../workspace"
import { PassportPage } from "./platform"

type Tab = "qaliq" | "kritik" | "pasport" | "transfer" | "hereket" | "anbarlar" | "partiyalar" | "uzlasdirma" | "rezerv"
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

const WAREHOUSE_TABS: Tab[] = ["qaliq", "kritik", "pasport", "transfer", "hereket", "anbarlar", "partiyalar", "uzlasdirma", "rezerv"]

type ReconciliationReport = {
  generatedAt: string
  summary: { materialCount: number; stockRowCount: number; lotRowCount: number; movementRowCount: number; unsupportedMovementCount:number; mismatchCount: number; unlinkedStockQty: number; unlinkedLotQty: number; unlinkedMovementCount: number }
  items: {
    materialId: string; materialName: string; unit: string; materialQty: number; stockQty: number; lotQty: number;knownNetMovementQty:number;inferredOpeningResidualQty:number;unsupportedMovementCount:number
    stockDifference: number; lotDifference: number; hasDifference: boolean
    places: { locationId: string | null; locationName: string; stockQty: number; lotQty: number; difference: number; movementCount: number; lastMovement: string | null;knownNetMovementQty:number;inferredOpeningResidualQty:number;unsupportedMovementCount:number }[]
  }[]
}

export default function Warehouse() {
  const { t, session } = usePrefs()
  useTitle(t("page.warehouse.title"))
  const { query, materials, movements, projects, smetas, locations, stocks, reservations, requests, shipments, stockMove, createShipment, advanceShipment, cancelShipment, addLocation, editLocation, removeLocation, actor } = useStore()
  const receiverOnly = actor.role === "site" || actor.role === "pm"
  const visibleTabs: Tab[] = receiverOnly ? ["transfer"] : WAREHOUSE_TABS
  const [search, setSearch] = useSearchParams()
  const tabParam = search.get("tab")
  const [tab, setTab] = useState<Tab>(() => receiverOnly ? "transfer" : WAREHOUSE_TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "qaliq")
  const [reading, setReading] = useState<Read | null>(null)

  useEffect(() => {
    if (receiverOnly && tab !== "transfer") setTab("transfer")
    else if (WAREHOUSE_TABS.includes(tabParam as Tab) && (!receiverOnly || tabParam === "transfer") && tabParam !== tab) setTab(tabParam as Tab)
  }, [tabParam, tab, receiverOnly])

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
  const [cancelReason, setCancelReason] = useState("")
  const [house, setHouse] = useState<{ name: string; kind: LocationKind }>({ name: "", kind: "merkez" })
  const [error, setError] = useState("")
  const { lots } = useWorkspace()
  const [lot, setLot] = useState({ material: "", batch: "", expires: "", place: "" })
  const [method, setMethod] = useState("orta")
  const [act, setAct] = useState({ kind: "qebul", code: "", qty: "", unitCost: "", batch: "", place: "", toPlace: "", projectId: "", qr: "" })
  const [lotNote, setLotNote] = useState("")
  const [lotOpen, setLotOpen] = useState(false)
  const [lotBusy, setLotBusy] = useState(false)
  const [serverLots, setServerLots] = useState<{ id: string; code: string; qty: unknown; unitCost: unknown; qr: string; batch: string; locationId: string | null }[]>([])
  const [platformProjects, setPlatformProjects] = useState<{ id: string; name: string }[]>([])
  const [reconciliation, setReconciliation] = useState<ReconciliationReport | null>(null)
  const [reconciliationError, setReconciliationError] = useState("")
  const [reconciliationBusy, setReconciliationBusy] = useState(false)

  async function reloadReconciliation() {
    setReconciliationBusy(true)
    setReconciliationError("")
    try { setReconciliation(await api<ReconciliationReport>("/api/warehouse-reconciliation")) }
    catch (reason) { setReconciliationError(reason instanceof ApiError ? reason.message : "Uzlaşdırma hesabatı yüklənmədi") }
    finally { setReconciliationBusy(false) }
  }

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

  useEffect(() => { if (tab === "uzlasdirma") void reloadReconciliation() }, [tab])

  async function saveMethod(next: string) {
    setMethod(next)
    try {
      await api("/api/platform/warehouse/policy", { method: "POST", body: JSON.stringify({ method: next }) })
    } catch (reason) {
      setLotNote(reason instanceof ApiError ? reason.message : "Maya üsulu yazılmadı")
    }
  }

  async function runAct() {
    if (lotBusy) return
    setLotBusy(true)
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
      setLotOpen(false)
      setLotNote(act.kind === "buraxilis" ? `Layihə xərcinə ${result.projectCost ?? 0} düşdü.` : act.kind === "qebul" ? `Qəbul olundu. QR: ${result.qr || "verildi"}` : "Hərəkət yazıldı. Qalıq sıfırdan aşağı düşmür.")
    } catch (reason) {
      setLotNote(reason instanceof ApiError ? reason.message : "Anbar hərəkəti yazılmadı")
    } finally { setLotBusy(false) }
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

  function reservationBalance(materialId: string) {
    const shared = new Set(locations.filter((location) => !location.projectId).map((location) => location.id))
    const physical = stocks.filter((row) => row.materialId === materialId && shared.has(row.locationId)).reduce((sum, row) => sum + row.qty, 0)
    const reserved = reservations.filter((row) => row.materialId === materialId && shared.has(row.locationId) && row.status === "active").reduce((sum, row) => sum + row.qty, 0)
    return { physical, reserved, free: Math.max(0, physical - reserved) }
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
    setCancelReason("")
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
      stops: [origin, ...stops.slice(0, 1)],
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
  const canSignRoute = routeCard ? !session
    ? routeCard.step < routeCard.stops.length - 1
    : (routeCard.status === "waiting_sender" && routeCard.canDispatch === true) || (routeCard.status === "sent" && routeCard.canReceive === true)
    : false
  const placeCard = reading?.kind === "place" ? houses.find((item) => item.id === reading.id) : undefined
  const hint =
    tab === "partiyalar" ? `${serverLots.filter((item) => Number(item.qty) > 0).length} partiya` :
    tab === "transfer" ? `${routes.filter((item) => item.step < item.stops.length - 1).length} sənəd yoldadır` :
    tab === "anbarlar" ? `${houses.length} anbar` :
    tab === "hereket" ? `${moves.length} hərəkət` :
    tab === "uzlasdirma" ? (reconciliation ? `${reconciliation.summary.mismatchCount} uyğunsuz material` : "Uzlaşdırma hesabatı") :
    tab === "rezerv" ? `${reservations.length} aktiv rezerv` :
    `${short} material minimumdan aşağı`

  return (
    <>
      <PageHead kicker={t("page.warehouse.kicker")} title={t("page.warehouse.title")} text={receiverOnly ? "Layihələrə göndərilən transferləri qəbul imzası ilə təsdiqləyin." : t("page.warehouse.text", { value: money(value) })}>
        {tab === "transfer" && !receiverOnly ? (
          <Button type="button" onClick={openRoute}><Icon name="plus" /> Transfer</Button>
        ) : tab === "anbarlar" ? (
          <Button type="button" onClick={() => openHouse()}><Icon name="plus" /> Anbar</Button>
        ) : tab === "partiyalar" ? (
          <Button onClick={() => {setLotNote(""); setLotOpen(true)}}><Icon name="plus" />Partiya hərəkəti</Button>
        ) : tab === "pasport" || tab === "uzlasdirma" || tab === "rezerv" ? null : (
          <Button type="button" onClick={() => openIntake()}><Icon name="plus" /> Hərəkət</Button>
        )}
      </PageHead>
      <Toolbar>
        <Tabs
          value={tab}
          onChange={openTab}
          options={[
            { id: "qaliq", label: "Qalıq" },
            { id: "kritik", label: "Kritik" },
            { id: "partiyalar", label: "Partiyalar" },
            { id: "pasport", label: "Pasport" },
            { id: "transfer", label: "Transfer" },
            { id: "hereket", label: "Hərəkət" },
            { id: "anbarlar", label: "Anbarlar" },
            { id: "uzlasdirma", label: "Uzlaşdırma" },
            { id: "rezerv", label: "Rezerv" },
          ].filter((option) => visibleTabs.includes(option.id as Tab))}
        />
        <span className="muted">{hint}</span>
      </Toolbar>
      {tab === "pasport" && <PassportPage embedded materialFilter={materialCard?.name || ""} />}
      {tab === "uzlasdirma" && <>
        <Toolbar><span className="muted">Yalnız oxu · Material, Stock, lot və tanınan hərəkət cəmi müqayisə olunur.</span><Button type="button" className="ghost" disabled={reconciliationBusy} onClick={() => void reloadReconciliation()}>{reconciliationBusy ? "Yenilənir…" : "Yenilə"}</Button></Toolbar>
        {reconciliationError && <p className="form-error" role="alert">{reconciliationError}</p>}
        {reconciliation && <>
          <div className="summary-strip"><span>{reconciliation.summary.materialCount} material</span><span>{reconciliation.summary.stockRowCount} stok sətri</span><span>{reconciliation.summary.lotRowCount} partiya sətri</span><span>{reconciliation.summary.movementRowCount} hərəkət qeydi</span><strong>{reconciliation.summary.mismatchCount} Stock/lot uyğunsuzluğu</strong>{reconciliation.summary.unsupportedMovementCount>0&&<strong className="form-error">İstiqaməti tanınmayan hərəkət: {reconciliation.summary.unsupportedMovementCount}</strong>}{(reconciliation.summary.unlinkedStockQty || reconciliation.summary.unlinkedLotQty || reconciliation.summary.unlinkedMovementCount > 0) && <strong className="form-error">Material əlaqəsi olmayan: Stock {num(reconciliation.summary.unlinkedStockQty, 3)} · Lot {num(reconciliation.summary.unlinkedLotQty, 3)} · Hərəkət {reconciliation.summary.unlinkedMovementCount}</strong>}</div>
          <TableContainer className="wide"><DataTable><thead><tr><th>Material / anbar</th><th className="num">Stock</th><th className="num">Lot</th><th className="num">Stock − material</th><th className="num">Lot − stock</th><th className="num">Xalis tanınan hərəkət</th><th className="num">Təxmini açılış / qalıq</th><th>Son hərəkət / say</th></tr></thead><tbody>{reconciliation.items.flatMap((item) => item.places.length ? item.places.map((place) => <tr key={`${item.materialId}-${place.locationId || "none"}`}><td><b>{item.materialName}</b><div className="muted">{item.materialId} · {place.locationName}</div></td><td className="num">{num(place.stockQty, 3)} {item.unit}</td><td className="num">{num(place.lotQty, 3)}</td><td className="num">{num(item.stockDifference, 3)}</td><td className="num">{num(item.lotDifference, 3)}<div className="muted">anbar fərqi: {num(place.difference, 3)}</div></td><td className="num">{num(place.knownNetMovementQty, 3)}<div className="muted">{place.unsupportedMovementCount} naməlum</div></td><td className="num">{num(place.inferredOpeningResidualQty, 3)}</td><td>{place.lastMovement ? dateAZ(place.lastMovement) : "—"}<div className="muted">{place.movementCount} təsir</div></td></tr>) : [<tr key={item.materialId}><td><b>{item.materialName}</b><div className="muted">{item.materialId} · anbar sətri yoxdur</div></td><td className="num">{num(item.stockQty, 3)} {item.unit}</td><td className="num">{num(item.lotQty, 3)}</td><td className="num">{num(item.stockDifference, 3)}</td><td className="num">{num(item.lotDifference, 3)}</td><td className="num">{num(item.knownNetMovementQty, 3)}</td><td className="num">{num(item.inferredOpeningResidualQty, 3)}</td><td>—</td></tr>])}</tbody></DataTable>{reconciliation.summary.mismatchCount === 0 && reconciliation.summary.unsupportedMovementCount === 0 && reconciliation.summary.unlinkedStockQty === 0 && reconciliation.summary.unlinkedLotQty === 0 && reconciliation.summary.unlinkedMovementCount === 0 && <Empty title="Fərq aşkarlanmadı" text="Material, Stock və StockLot cəmləri uzlaşır." />}</TableContainer>
          <p className="muted">Hesabat {dateAZ(reconciliation.generatedAt.slice(0, 10))} tarixində yaradılıb. Tanınan xalis hərəkət mədaxil, məxaric və anbar transferlərinin cəmidir. “Təxmini açılış/qalıq” = Stock − tanınan hərəkət qalıq göstəricisidir; ilkin açılış balansı və legacy hərəkətlər təsdiqlənmədən bunu uçot açılışı kimi qəbul etmək olmaz.</p>
        </>}
      </>}
      {tab === "rezerv" && <TableContainer><DataTable><thead><tr><th>Tələb</th><th>Layihə</th><th>Material</th><th>Mənbə anbar</th><th>Rezerv</th><th>Kim yaradıb</th><th>Tarix</th></tr></thead><tbody>{reservations.filter((row) => row.status === "active").filter((row) => { const request = requests.find((item) => item.id === row.requestId); const material = materials.find((item) => item.id === row.materialId); return hit(query, row.requestId, request?.project, material?.name, nameOf(row.locationId), row.createdBy) }).map((row) => { const request = requests.find((item) => item.id === row.requestId); const material = materials.find((item) => item.id === row.materialId); return <tr key={row.id}><td><b>{row.requestId}</b></td><td>{request?.project || "—"}</td><td>{material?.name || row.materialId}</td><td>{nameOf(row.locationId) || row.locationId}</td><td>{num(row.qty, 3)} {material?.unit || ""}</td><td>{row.createdBy}</td><td>{dateAZ(row.createdAt.slice(0, 10))}</td></tr> })}</tbody></DataTable>{reservations.filter((row) => row.status === "active").length === 0 && <Empty title="Aktiv rezerv yoxdur" text="Təsdiqlənmiş tələblər üçün ayrılmış stok burada görünəcək." />}</TableContainer>}
      {tab !== "pasport" && (
      <>
      {tab === "partiyalar" && <>
        <Toolbar className="warehouse-lot-toolbar"><div><strong>Material partiyaları</strong><p className="muted">QR kodlar, qalıqlar və vahid maya dəyəri.</p></div><label>Maya üsulu<Select ariaLabel="Maya üsulu" value={method} onValueChange={(value) => void saveMethod(value)} options={[{value:"orta",label:"Orta çəkili"},{value:"fifo",label:"FIFO"}]} /></label></Toolbar>
        {lotNote && !lotOpen && <p className="lede" role="status">{lotNote}</p>}
        <TableContainer className="warehouse-lots"><DataTable><thead><tr><th>Material kodu</th><th>Partiya</th><th>Anbar</th><th>Qalıq</th><th>Vahid maya</th><th>QR kod</th></tr></thead><tbody>{serverLots.filter((item) => Number(item.qty) > 0).map((item) => <tr key={item.id}><td><strong>{item.code}</strong></td><td>{item.batch || "—"}</td><td>{nameOf(item.locationId || "") || item.locationId || "—"}</td><td>{num(Number(item.qty))}</td><td>{num(Number(item.unitCost), 2)} AZN</td><td><code>{item.qr || "—"}</code></td></tr>)}</tbody></DataTable>{!serverLots.some((item) => Number(item.qty) > 0) && <Empty title="Partiya yoxdur" text="Partiya hərəkəti düyməsi ilə ilk qəbulu daxil edin." />}</TableContainer>
      </>}
      {lotOpen && <Modal title="Partiya hərəkəti" className="warehouse-lot-modal" onClose={() => {if(!lotBusy) setLotOpen(false)}}>
        <form onSubmit={(event) => {event.preventDefault(); void runAct()}}>
          <div className="warehouse-lot-fields">
            <label className="full">Əməliyyat<Select value={act.kind} onValueChange={(kind) => setAct({...act,kind})} options={[{value:"qebul",label:"Qəbul"},{value:"kocurme",label:"Köçürmə"},{value:"buraxilis",label:"Layihəyə buraxılış"},{value:"qaytarma",label:"Geri qaytarma"},{value:"itki",label:"İtki"}]} /></label>
            <label>Material kodu<Input value={act.code} onChange={(event) => setAct({...act,code:event.target.value})} placeholder="Məs. MAT-ARMATUR" /></label>
            <label>Miqdar<Input required inputMode="decimal" value={act.qty} onChange={(event) => setAct({...act,qty:event.target.value})} /></label>
            {act.kind !== "qebul" && <label className="full">QR kod<Input value={act.qr} onChange={(event) => setAct({...act,qr:event.target.value})} placeholder="QR kodu oxudun və ya daxil edin" /></label>}
            {(act.kind === "qebul" || act.kind === "qaytarma") && <><label>Vahid maya, AZN<Input inputMode="decimal" value={act.unitCost} onChange={(event) => setAct({...act,unitCost:event.target.value})} /></label><label>Partiya<Input value={act.batch} onChange={(event) => setAct({...act,batch:event.target.value})} /></label></>}
            <label className="full">Anbar<Select value={act.place} onValueChange={(place) => setAct({...act,place})} options={[{value:"",label:"Anbar seçin"},...locations.map((item) => ({value:item.id,label:item.name}))]} /></label>
            {act.kind === "kocurme" && <label className="full">Hədəf anbar<Select value={act.toPlace} onValueChange={(toPlace) => setAct({...act,toPlace})} options={[{value:"",label:"Anbar seçin"},...locations.map((item) => ({value:item.id,label:item.name}))]} /></label>}
            {act.kind === "buraxilis" && <label className="full">Layihə<Select value={act.projectId} onValueChange={(projectId) => setAct({...act,projectId})} options={[{value:"",label:"Layihə seçin"},...(platformProjects.length ? platformProjects : projects).map((item) => ({value:item.id,label:item.name}))]} /></label>}
          </div>
          {lotNote && <p className="form-error" role="alert">{lotNote}</p>}
          <div className="form-actions"><Button className="ghost" disabled={lotBusy} onClick={() => setLotOpen(false)}>Ləğv et</Button><Button type="submit" disabled={lotBusy}>{lotBusy ? "Saxlanılır…" : "Hərəkəti saxla"}</Button></div>
        </form>
      </Modal>}

      {(tab === "qaliq" || tab === "kritik") && (
        <TableContainer>
          <DataTable>
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
                const balance = reservationBalance(item.id)
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
                      <div className="muted">Anbarlarda fiziki: {num(balance.physical, 3)} · rezerv: {num(balance.reserved, 3)} · sərbəst: {num(balance.free, 3)}</div>
                      <div className="muted">min {num(item.min)}</div>
                    </td>
                    <td style={{ minWidth: 120 }}><StockBar qty={item.qty} min={item.min} /></td>
                    <td className="num">{money(item.qty * item.price)}</td>
                  </tr>
                )
              })}
            </tbody>
          </DataTable>
          {stockRows.length === 0 && <Empty title="Material tapılmadı" text="Kritik filtrdə və ya axtarışda nəticə yoxdur." />}
        </TableContainer>
      )}

      {tab === "transfer" && (
        <Disclosure title="Əlavə partiya qeydləri">
          <p className="lede">Partiya, son istifadə və yer boşdur. Köçürmə aşağıdakı cədvəldə qalır.</p>
          <div className="form-row wide">
            <label>Material<Input value={lot.material} onChange={(event) => setLot({ ...lot, material: event.target.value })} /></label>
            <label>Partiya<Input value={lot.batch} onChange={(event) => setLot({ ...lot, batch: event.target.value })} placeholder="boş" /></label>
            <label>Son istifadə<Input value={lot.expires} onChange={(event) => setLot({ ...lot, expires: event.target.value })} placeholder="boş" /></label>
            <label>Yer<Input value={lot.place} onChange={(event) => setLot({ ...lot, place: event.target.value })} placeholder="boş" /></label>
            <Button type="button" onClick={() => { if (!lot.material.trim()) return; patch((state) => ({ ...state, lots: [...state.lots, { ...lot, id: uid() }] })); setLot({ material: "", batch: "", expires: "", place: "" }) }}>Yaz</Button>
          </div>
          {lots.length === 0 && <p className="lede">Partiya yoxdur.</p>}
          {lots.map((row) => <div className="step-row" key={row.id}><span>{row.material} · {row.batch.trim() || "partiya yoxdur"} · {row.place.trim() || "yer yoxdur"}</span><strong>{row.expires.trim() || "tarix yoxdur"}</strong></div>)}
        </Disclosure>
      )}

      {tab === "transfer" && (
        <TableContainer className="wide">
          <DataTable>
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
                      <Badge status={item.status || "legacy"} />
                    </div>
                  </td>
                  <td>
                    <button type="button" className="mat-open" onClick={(event) => { event.stopPropagation(); setError(""); setReading({ kind: "shipment", id: item.id }) }}>
                      <b>{item.lines.length} material</b>
                      <span className="clip">{item.lines.map((line) => line.material).join(", ")}</span>
                    </button>
                  </td>
                  <td className="num">{item.valuationVisible === false ? "—" : money(item.lines.reduce((sum, line) => sum + (line.amount || 0), 0))}</td>
                  <td className="track-cell">
                    <button type="button" className="track-btn" aria-label={`${item.id} marşrutu`} onClick={(event) => { event.stopPropagation(); setError(""); setReading({ kind: "shipment", id: item.id }) }}>
                      <RouteTrack shipment={item} nameOf={nameOf} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {routes.length === 0 && <Empty title="Transfer yoxdur" text="Marşrut yazılanda sənəd burada durur." />}
        </TableContainer>
      )}

      {tab === "hereket" && (
        <TableContainer>
          <DataTable>
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
          </DataTable>
          {moves.length === 0 && <Empty title="Hərəkət yoxdur" text="Axtarışa uyğun anbar hərəkəti tapılmadı." />}
        </TableContainer>
      )}

      {tab === "anbarlar" && (
        <TableContainer>
          <DataTable>
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
          </DataTable>
          {houses.length === 0 && <Empty title="Anbar tapılmadı" text="Axtarışa uyğun anbar yoxdur." />}
        </TableContainer>
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
              <Button type="button" className="ghost" onClick={() => { setReading(null); openTab("pasport") }}>Pasportlar</Button>
              <Button type="button" className="ghost" onClick={() => openIntake(materialCard.id, placesOf(materialCard.id)[0]?.locationId || "LOC-MERKEZ", "medaxil")}>Mədaxil</Button>
              <Button type="button" onClick={() => openIntake(materialCard.id, placesOf(materialCard.id)[0]?.locationId || "LOC-MERKEZ", "mexaric")}>Məxaric</Button>
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
            <p><Badge status={routeCard.status || "legacy"} /></p>
            {routeCard.createdBy && <p>Yaradıb: {routeCard.createdBy}</p>}
            {routeCard.dispatchedBy && <p>Göndərən imzası: {routeCard.dispatchedBy}{routeCard.dispatchedAt ? ` · ${dateAZ(routeCard.dispatchedAt.slice(0, 10))}` : ""}</p>}
            {routeCard.receivedBy && <p>Qəbul edən imzası: {routeCard.receivedBy}{routeCard.receivedAt ? ` · ${dateAZ(routeCard.receivedAt.slice(0, 10))}` : ""}</p>}
            {routeCard.cancelReason && <p>Ləğv səbəbi: {routeCard.cancelReason}</p>}
            {routeCard.note && <p>{routeCard.note}</p>}
            {routeCard.lines.map((line) => (
              <p key={line.materialId}><b>{line.material}</b> · {num(line.qty, 1)} {line.unit}{routeCard.valuationVisible === false ? "" : ` · ${money(line.price || 0)} · ${money(line.amount || 0)}`}</p>
            ))}
            {routeCard.valuationVisible !== false && <p><b>Cəmi {money(routeCard.lines.reduce((sum, line) => sum + (line.amount || 0), 0))}</b></p>}
            {error && <p className="form-error">{error}</p>}
            {canSignRoute && (
              <div className="form-actions">
                <Button type="button" onClick={() => setError(advanceShipment(routeCard.id))}>{!session ? "Növbəti dayanacağa" : routeCard.status === "waiting_sender" ? "Göndərən kimi imzala və göndər" : "Qəbul et və imzala"}</Button>
              </div>
            )}
            {session && routeCard.canCancel && routeCard.status === "waiting_sender" && <>
              <Field label="Ləğv səbəbi"><Input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></Field>
              <Button type="button" className="ghost" disabled={!cancelReason.trim()} onClick={() => setError(cancelShipment(routeCard.id, cancelReason))}>Transferi ləğv et</Button>
            </>}
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
              <Button type="button" className="ghost" onClick={() => openHouse(placeCard.id)}><Icon name="edit" /> Redaktə</Button>
              <Button type="button" className="ghost" onClick={() => { const message = removeLocation(placeCard.id); setError(message); if (!message) setReading(null) }}><Icon name="trash" /> Sil</Button>
              <Button type="button" onClick={() => openIntake(materials[0]?.id || "", placeCard.id)}>Hərəkət</Button>
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
              <Input value={house.name} onChange={(event) => setHouse({ ...house, name: event.target.value })} />
            </Field>
            <Field label="Növ">
              <Select value={house.kind} onValueChange={(kind) => setHouse({ ...house, kind: kind as LocationKind })} options={KINDS.map((kind) => ({ value: kind, label: KIND[kind] }))} />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <Button type="button" className="ghost" onClick={() => setReading(null)}>Ləğv et</Button>
              <Button  type="submit">Yaz</Button>
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
              <Input type="number" min="0" step="0.1" value={form.qty} onChange={(event) => setForm({ ...form, qty: event.target.value })} />
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
              <Input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Nə üçün çıxdı və ya qəbul olundu" />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <Button type="button" className="ghost" onClick={() => setReading(null)}>Ləğv et</Button>
              <Button  type="submit">Qeyd et</Button>
            </div>
          </form>
        </Drawer>
      )}

      {reading?.kind === "route" && (
        <Drawer title="Transfer" onClose={() => setReading(null)}>
          <div className="form">
            <Field label="Haradan">
              <Select value={origin} onValueChange={(value) => { setOrigin(value); if (stops[0] === value) setStops([]) }} options={locations.map((item) => ({ value: item.id, label: item.name }))} />
            </Field>
            <div className="stop-row">
              <span className="stop-chip">{nameOf(origin)}</span>
              {stops.slice(0, 1).map((id) => (
                <span className="stop-chip" key={id}>
                  {nameOf(id)}
                  <button type="button" aria-label="Dayanacağı sil" onClick={() => setStops(stops.filter((item) => item !== id))}>×</button>
                </span>
              ))}
            </div>
            {stops.length === 0 && <div className="pull-row">
              <Select ariaLabel="Hədəf anbar" value={pick} onValueChange={setPick} options={locations.filter((item) => item.id !== origin).map((item) => ({ value: item.id, label: item.name }))} />
              <Button type="button" className="ghost small" onClick={() => { if (pick && pick !== origin) setStops([pick]) }}>Hədəfi seç</Button>
            </div>}
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
                    <Input aria-label="Miqdar" type="number" min="0" step="0.1" value={line.qty} onChange={(event) => setLines(lines.map((row) => (row.key === line.key ? { ...row, qty: event.target.value } : row)))} />
                    <Input aria-label="Qiymət" type="number" min="0" step="1" value={line.price} disabled={Boolean(session)} onChange={(event) => setLines(lines.map((row) => (row.key === line.key ? { ...row, price: event.target.value } : row)))} />
                    <Button type="button" className="ghost small" onClick={() => setLines(lines.length === 1 ? lines : lines.filter((row) => row.key !== line.key))}><Icon name="trash" /> Sil</Button>
                  </div>
                  <p className="muted">{material ? `Anbarda ${num(onHand(stocks, material.id, origin), 1)} ${material.unit} · ` : ""}{money(amount)}</p>
                </div>
              )
            })}
            <div className="form-actions">
              <Button type="button" className="ghost small" onClick={() => { setLines([...lines, { key: lineKey, materialId: "", qty: "", price: "" }]); setLineKey(lineKey + 1) }}>Material əlavə et</Button>
              <strong>{money(lines.reduce((sum, line) => sum + (Number(line.qty) || 0) * (Number(line.price) || 0), 0))}</strong>
            </div>
            <Field label="Mahiyyət">
              <Input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="Material hara və nə üçün gedir" />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <Button type="button" className="ghost" onClick={() => setReading(null)}>Ləğv et</Button>
              <Button type="button" disabled={stops.length !== 1} onClick={submitRoute}>Transfer sənədi yarat</Button>
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
          <span>{index === 0 ? shipment.fromLocationName || nameOf(id) : index === shipment.stops.length - 1 ? shipment.toLocationName || nameOf(id) : nameOf(id)}</span>
        </li>
      ))}
    </ol>
  )
}
