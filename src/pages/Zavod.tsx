import { DataTable } from '../components/DataTable'
import { Button, Input, Metric, StatGrid, TableContainer, Toolbar } from "../components/primitives"
import { useEffect, useState } from "react"
import { DateField } from "../DateField"
import { onHand, TODAY } from "../domain/ops"
import type { AssetStatus, PlantKind, Shipment, WorkOrder } from "../domain/types"
import { dateAZ, hit, money, num } from "../format"
import { Icon } from "../icons"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Badge, Drawer, Empty, Field, PageHead, RowMenu, Select, Tabs, useTitle } from "../ui"

const STEPS = ["novbede", "gedir", "hazir", "gonderildi"] as const
const STEP_LABEL = { novbede: "Növbə", gedir: "İşdə", hazir: "Bağlandı", gonderildi: "Sahədə" }

function storyFor(status: string, kind: PlantKind) {
  const still = kind === "zavod" ? "zavoddadır" : "sexdədir"
  if (status === "gedir") {
    return kind === "zavod"
      ? "Məhsul zavodda tökülür. Bağlanış resepti anbardan silir."
      : "Məhsul sexdə hazırlanır. Bağlanış resepti anbardan silir."
  }
  if (status === "hazir") return `Məhsul bağlanıb və hələ ${still}. Növbəti addım sahəyə yazmaqdır.`
  if (status === "gonderildi") return "Məhsul layihə sahəsindədir."
  if (status === "legv") return "Əmr ləğv olunub. Anbar və layihə xərci dəyişməyib."
  return "Məhsul növbədədir. İşə salınanda resept yoxlanır."
}

export default function Zavod({ kind = "zavod" }: { kind?: PlantKind }) {
  const { t } = usePrefs()
  const page = kind === "zavod" ? "page.zavod" : "page.shops"
  useTitle(t(`${page}.title`))
  const store = useStore()
  const {
    query, orders, plants, recipes, projects, materials, stocks, locations, assets, requests, movements, people, journal, shipments,
    openOrder, startOrder, completeOrder, sendOrder, cancelOrder, returnOrder, writeWaste, setPlan, confirmPlan,
    addNote, advanceQueue, coverRequest, convertRequest, rejectRequest, createShipment, advanceShipment, stockMove, setAssetStatus,
    addShop, editShop, removeShop,
  } = store
  const sites = plants.filter((item) => item.kind === kind)
  const [plantId, setPlantId] = useState(sites[0]?.id || "")
  const plant = sites.find((item) => item.id === plantId) || sites[0]
  const [tab, setTab] = useState("emrler")
  const [planQty, setPlanQty] = useState(plant ? String(plant.plan) : "")
  const [planError, setPlanError] = useState("")
  const [draft, setDraft] = useState({ recipeId: "", project: "", qty: "", due: TODAY })
  const [orderError, setOrderError] = useState("")
  const [auto, setAuto] = useState(false)
  const [orderFor, setOrderFor] = useState("")
  const [requestError, setRequestError] = useState("")
  const [reading, setReading] = useState("")
  const [reason, setReason] = useState("")
  const [stops, setStops] = useState<string[]>(["LOC-MERKEZ"])
  const [stopPick, setStopPick] = useState("LOC-SEX")
  const [lines, setLines] = useState([{ key: 1, materialId: "", qty: "", price: "" }])
  const [lineKey, setLineKey] = useState(2)
  const [transferError, setTransferError] = useState("")
  const [shipmentFor, setShipmentFor] = useState("")
  const [waste, setWaste] = useState({ materialId: "", qty: "", project: "", reason: "" })
  const [wasteError, setWasteError] = useState("")
  const [receipt, setReceipt] = useState({ materialId: "", qty: "" })
  const [receiptError, setReceiptError] = useState("")
  const [note, setNote] = useState("")
  const [noteError, setNoteError] = useState("")
  const [shopMode, setShopMode] = useState<"" | "add" | "edit">("")
  const [shopForm, setShopForm] = useState({ name: "", place: "", shift: "Gündüz növbəsi", unit: "", plan: "" })
  const [shopError, setShopError] = useState("")
  const [pendingShop, setPendingShop] = useState("")

  useEffect(() => {
    if (!pendingShop) return
    const next = sites.find((item) => item.name === pendingShop)
    if (!next) return
    setPlantId(next.id)
    setPlanQty(String(next.plan))
    setPendingShop("")
  }, [pendingShop, sites])

  function openShopAdd() {
    setShopError("")
    setShopForm({ name: "", place: "", shift: "Gündüz növbəsi", unit: "", plan: "" })
    setShopMode("add")
  }

  function openShopEdit() {
    if (!plant) return
    setShopError("")
    setShopForm({ name: plant.name, place: plant.place, shift: plant.shift, unit: plant.unit, plan: String(plant.plan) })
    setShopMode("edit")
  }

  const shopDrawer = shopMode ? (
    <Drawer title={shopMode === "add" ? "Yeni sex" : "Sexi yaz"} onClose={() => setShopMode("")}>
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault()
          const message = shopMode === "edit" && plant ? editShop(plant.id, shopForm) : addShop(shopForm)
          setShopError(message)
          if (!message) {
            if (shopMode === "add") setPendingShop(shopForm.name.trim())
            setShopMode("")
          }
        }}
      >
        <Field label="Ad"><Input value={shopForm.name} onChange={(event) => setShopForm({ ...shopForm, name: event.target.value })} /></Field>
        <Field label="Yer"><Input value={shopForm.place} onChange={(event) => setShopForm({ ...shopForm, place: event.target.value })} /></Field>
        <Field label="Növbə"><Input value={shopForm.shift} onChange={(event) => setShopForm({ ...shopForm, shift: event.target.value })} /></Field>
        <Field label="Vahid"><Input value={shopForm.unit} onChange={(event) => setShopForm({ ...shopForm, unit: event.target.value })} /></Field>
        <Field label="Plan"><Input type="number" min="0" step="0.1" value={shopForm.plan} onChange={(event) => setShopForm({ ...shopForm, plan: event.target.value })} /></Field>
        {shopError && <p className="form-error">{shopError}</p>}
        <div className="form-actions">
          <Button type="button" className="ghost" onClick={() => setShopMode("")}>Ləğv et</Button>
          <Button  type="submit">Yaz</Button>
        </div>
      </form>
    </Drawer>
  ) : null

  if (!plant) {
    return (
      <>
        <PageHead kicker={t(`${page}.kicker`)} title={t(`${page}.title`)} text={t(`${page}.text`)}>
          {kind === "sex" && <Button type="button" onClick={openShopAdd}><Icon name="plus" /> Sex</Button>}
        </PageHead>
        <Empty title={kind === "zavod" ? "Zavod yoxdur" : "Sex yoxdur"} text={kind === "zavod" ? "Beton zavodu açılmayıb." : "Sex əlavə et düyməsi ilə yeni sex açılır."} />
        {shopDrawer}
      </>
    )
  }

  const mine = recipes.filter((item) => item.plantId === plant.id)
  const recipeIds = new Set(mine.flatMap((item) => item.items.map((row) => row.materialId)))
  const recipeId = mine.some((item) => item.id === draft.recipeId) ? draft.recipeId : mine[0]?.id || ""
  const project = projects.some((item) => item.name === draft.project) ? draft.project : projects[0]?.name || ""
  const mineOrders = orders.filter((item) => item.plant === plant.name && hit(query, item.product, item.project, item.id))
  const todayOrders = mineOrders.filter((item) => item.due === TODAY)
  const onHandRows = stocks.filter((row) => row.locationId === plant.locationId && row.qty > 0 && (kind === "zavod" || recipeIds.has(row.materialId)))
  const catalog = materials.filter((item) => onHandRows.some((row) => row.materialId === item.id))
  const receiptChoices = kind === "sex" ? materials.filter((item) => recipeIds.has(item.id)) : materials
  const wasteMaterial = catalog.some((item) => item.id === waste.materialId) ? waste.materialId : catalog[0]?.id || ""
  const receiptMaterial = receiptChoices.some((item) => item.id === receipt.materialId) ? receipt.materialId : receiptChoices[0]?.id || ""
  const destinations = locations.filter((item) => item.id !== plant.locationId && (item.kind === "merkez" || item.kind === "zavod" || item.kind === "sex" || item.kind === "sahe"))
  const pick = destinations.some((item) => item.id === stopPick) ? stopPick : destinations.find((item) => item.id !== stops[stops.length - 1])?.id || destinations[0]?.id || ""
  const plantRequests = requests.filter((item) => recipeIds.has(item.materialId))
  const openRequest = plantRequests.find((item) => item.id === reading)
  const plantShipments = shipments.filter((item) => item.stops[0] === plant.locationId && item.lines.some((line) => recipeIds.has(line.materialId)))
  const openShipment = plantShipments.find((item) => item.id === shipmentFor)
  const losses = movements.filter((item) => item.project === "İtki" && item.locationId === plant.locationId && (kind === "zavod" || recipeIds.has(item.materialId || "")))
  const crew = people.filter((item) => item.site === plant.name)
  const notes = journal.filter((item) => item.site === plant.name)
  const ownMachine = (item: { site: string; type: string }) => item.site === plant.name || (kind === "zavod" && (item.type === "Beton" || item.type === "Nəqliyyat"))
  const machines = assets.filter(ownMachine)
  const openQty = mineOrders.filter((item) => item.status === "novbede" || item.status === "gedir").reduce((sum, item) => sum + item.qty, 0)
  const gap = Math.round((openQty - plant.plan) * 10) / 10
  const fleet = assets
    .filter((item) => item.status !== "servis" && ownMachine(item))
    .sort((a, b) => Number(b.site === plant.name) - Number(a.site === plant.name))
  const place = (id?: string) => locations.find((item) => item.id === id)?.name || "—"
  const shortPlace = (id: string) => {
    const location = locations.find((item) => item.id === id)
    if (!location) return id
    if (location.kind === "zavod") return "Zavod"
    if (location.kind === "merkez") return "Anbar"
    if (location.kind === "sex") return "Sex"
    return location.name.replace(/ sahəsi$/, "")
  }
  const openOrderCard = mineOrders.find((item) => item.id === orderFor)

  function act(run: (id: string) => string, id: string) {
    setOrderError(run(id))
  }

  return (
    <>
      <PageHead kicker={t(`${page}.kicker`)} title={t(`${page}.title`)} text={t(`${page}.text`)}>
        {kind === "sex" && <Button type="button" onClick={openShopAdd}><Icon name="plus" /> Sex</Button>}
      </PageHead>
      {(kind === "sex" || sites.length > 1) && (
        <Toolbar>
          <Tabs
            value={plant.id}
            onChange={(id) => {
              const next = sites.find((item) => item.id === id)
              setPlantId(id)
              setPlanQty(next ? String(next.plan) : "")
              setOrderFor("")
              setReading("")
              setShipmentFor("")
              setOrderError("")
              setTransferError("")
              setShopError("")
              setStops(["LOC-MERKEZ"])
            }}
            options={sites.map((item) => ({ id: item.id, label: item.name }))}
          />
          {kind === "sex" && (
            <RowMenu
              items={[
                { id: "edit", label: "Redaktə", onClick: openShopEdit },
                { id: "delete", label: "Sil", onClick: () => setShopError(removeShop(plant.id)) },
              ]}
            />
          )}
        </Toolbar>
      )}
      {shopError && !shopMode && <p className="form-error">{shopError}</p>}
      <Toolbar>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { id: "novbe", label: "Növbə" },
            { id: "emrler", label: "İş əmrləri" },
            { id: "teleb", label: "Tələbnamələr" },
            { id: "anbar", label: "Anbar" },
            { id: "transfer", label: "Transfer" },
            { id: "texnika", label: "Texnika" },
            { id: "itki", label: "İtki" },
          ]}
        />
        {tab === "emrler" && (
          <button
            type="button"
            className={`switch${auto ? " on" : ""}`}
            role="switch"
            aria-checked={auto}
            onClick={() => {
              const next = !auto
              setAuto(next)
              if (next) setOrderError(advanceQueue(plant.id))
            }}
          >
            <i />
            Avtomatik keçid
          </button>
        )}
      </Toolbar>

      {tab === "novbe" && (
        <section className="plant">
          <div className="yard-head">
            <div>
              <h2>Növbə vərəqəsi</h2>
              <p className="muted">{plant.shift} · {dateAZ(TODAY)} · {plant.place}. {kind === "zavod" ? "Bu vərəqə növbənin heyətini, günün tökmə hədəfini və növbədə baş verəni saxlayır." : "Bu vərəqə sexin heyətini, günün istehsal hədəfini və sexdə baş verəni saxlayır."}</p>
            </div>
          </div>
          <h2 className="block-title">Heyət</h2>
          <TableContainer>
            <DataTable>
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Vəzifə</th>
                  <th>Yer</th>
                </tr>
              </thead>
              <tbody>
                {crew.map((item) => (
                  <tr key={item.id}>
                    <td><b>{item.name}</b></td>
                    <td>{item.role}</td>
                    <td>{item.site}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            {crew.length === 0 && <Empty title="Heyət yoxdur" text="Bu növbəyə usta yazılmayıb." />}
          </TableContainer>
          <h2 className="block-title">Günün hədəfi</h2>
          <p className="muted">{kind === "zavod" ? "Plan bu növbənin tökməli olduğu həcmdir." : "Plan bu növbənin çıxarmalı olduğu həcmdir."} Fakt bağlanmış partiyadır. Açıq əmrlər hələ növbədə və ya işdədir.</p>
          <StatGrid>
            <Metric>
              <span>Plan</span>
              <strong>{num(plant.plan, plant.plan % 1 ? 1 : 0)} {plant.unit}</strong>
              <em>{plant.planStatus === "tesdiq" ? `təsdiqləyən ${plant.planBy}` : "qaralama"}</em>
            </Metric>
            <Metric>
              <span>Fakt</span>
              <strong>{num(plant.fact, plant.fact % 1 ? 1 : 0)} {plant.unit}</strong>
              <em>bağlanmış partiyalar</em>
            </Metric>
            <Metric>
              <span>Açıq əmrlər</span>
              <strong>{num(openQty, openQty % 1 ? 1 : 0)} {plant.unit}</strong>
              {gap > 0 && <em className="warn">plandan {num(gap, gap % 1 ? 1 : 0)} {plant.unit} çoxdur</em>}
            </Metric>
          </StatGrid>
          <form
            className="pull-row"
            style={{ marginTop: 14 }}
            onSubmit={(event) => {
              event.preventDefault()
              setPlanError(setPlan(plant.id, planQty))
            }}
          >
            <Input type="number" min="0" step="0.1" aria-label="Növbə planı" value={planQty} onChange={(event) => setPlanQty(event.target.value)} />
            <Button className="small ghost" type="submit">Planı yaz</Button>
            {plant.planStatus !== "tesdiq" && (
              <Button className="small" type="button" onClick={() => setPlanError(confirmPlan(plant.id))}>Planı təsdiqlə</Button>
            )}
          </form>
          {planError && <p className="form-error">{planError}</p>}
          <h2 className="block-title">{kind === "zavod" ? "Bu günün tökmələri" : "Bu günün işi"}</h2>
          <TableContainer className="wide">
            <DataTable>
              <thead>
                <tr>
                  <th>Əmr</th>
                  <th>Məhsul</th>
                  <th>Layihə</th>
                  <th>Miqdar</th>
                  <th>Yer</th>
                </tr>
              </thead>
              <tbody>
                {todayOrders.map((order) => (
                  <tr key={order.id} className="click" onClick={() => setOrderFor(order.id)}>
                    <td className="mono">{order.id}</td>
                    <td><b>{order.product}</b></td>
                    <td>{order.project}</td>
                    <td>{num(order.qty, order.qty % 1 ? 1 : 0)} {order.unit}</td>
                    <td className="track-cell">
                      <button type="button" className="track-btn" onClick={() => setOrderFor(order.id)}>
                        <Where status={order.status} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            {todayOrders.length === 0 && <Empty title="Bu günə əmr yoxdur" text="Tarixi bu gün olan iş əmri yazılmayıb." />}
          </TableContainer>
          <h2 className="block-title">Hadisə jurnalı</h2>
          <p className="muted">Nasos dayanması, keyfiyyət və bu növbəyə aid hadisə buraya yazılır.</p>
          <form
            className="form-row note"
            style={{ margin: "12px 0" }}
            onSubmit={(event) => {
              event.preventDefault()
              const message = addNote(plant.name, note)
              setNoteError(message)
              if (!message) setNote("")
            }}
          >
            <Field label="Hadisə">
              <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nə baş verdi" />
            </Field>
            <Button  type="submit">Jurnala yaz</Button>
          </form>
          {noteError && <p className="form-error">{noteError}</p>}
          <TableContainer>
            <DataTable>
              <thead>
                <tr>
                  <th>Saat</th>
                  <th>Hadisə</th>
                </tr>
              </thead>
              <tbody>
                {notes.map((item) => (
                  <tr key={item.id}>
                    <td className="mono">{item.time}</td>
                    <td>{item.text}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableContainer>
        </section>
      )}

      {tab === "emrler" && (
        <section>
          <form
            className="form-row production-order-form"
            style={{ marginBottom: 12 }}
            onSubmit={(event) => {
              event.preventDefault()
              const message = openOrder({ plantId: plant.id, recipeId, project, qty: draft.qty, due: draft.due })
              setOrderError(message)
              if (!message) {
                setDraft({ ...draft, qty: "" })
                if (auto) setOrderError(advanceQueue(plant.id))
              }
            }}
          >
            <Field label="Məhsul">
              <Select value={recipeId} onValueChange={(value) => setDraft({ ...draft, recipeId: value })} options={mine.map((item) => ({ value: item.id, label: `${item.product} · ${item.unit}` }))} />
            </Field>
            <Field label="Layihə">
              <Select value={project} onValueChange={(value) => setDraft({ ...draft, project: value })} options={projects.map((item) => ({ value: item.name, label: item.name }))} />
            </Field>
            <Field label="Miqdar">
              <Input type="number" min="0" step="0.1" value={draft.qty} onChange={(event) => setDraft({ ...draft, qty: event.target.value })} />
            </Field>
            <Field label="Tarix">
              <DateField value={draft.due} onChange={(due) => setDraft({ ...draft, due })} />
            </Field>
            <Button  type="submit">Növbəyə yaz</Button>
          </form>
          {orderError && <p className="form-error">{orderError}</p>}
          <TableContainer className="wide">
            <DataTable>
              <thead>
                <tr>
                  <th>Əmr</th>
                  <th>Məhsul</th>
                  <th>Layihə</th>
                  <th>Miqdar</th>
                  <th>Yer</th>
                  <th>Prosedur</th>
                </tr>
              </thead>
              <tbody>
                {mineOrders.map((order) => (
                  <tr key={order.id} className="click" onClick={() => { setOrderFor(order.id); setOrderError("") }}>
                    <td className="mono">{order.id}</td>
                    <td>
                      <b>{order.product}</b>
                      <div className="muted">{dateAZ(order.due)} · {responsible(order) || "məsul yoxdur"}</div>
                    </td>
                    <td>{order.project}</td>
                    <td>{num(order.qty, order.qty % 1 ? 1 : 0)} {order.unit}</td>
                    <td className="track-cell">
                      <button type="button" className="track-btn" aria-label={`${order.id} yeri`} onClick={() => { setOrderFor(order.id); setOrderError("") }}>
                        <Where status={order.status} />
                      </button>
                    </td>
                    <td>
                      <div className="row-actions stay" onClick={(event) => event.stopPropagation()}>
                        {order.status === "novbede" && (
                          <>
                            <Button type="button" className="ghost small" onClick={() => act(cancelOrder, order.id)}>Ləğv et</Button>
                            <Button type="button" className="small" onClick={() => act(startOrder, order.id)}>İşə sal</Button>
                          </>
                        )}
                        {order.status === "gedir" && (
                          <>
                            <Button type="button" className="ghost small" onClick={() => act(returnOrder, order.id)}>Növbəyə qaytar</Button>
                            <Button type="button" className="small" onClick={() => act(completeOrder, order.id)}>Bağla</Button>
                          </>
                        )}
                        {order.status === "hazir" && (
                          <Button type="button" className="small" onClick={() => setOrderFor(order.id)}>Sahəyə göndər</Button>
                        )}
                        {order.status === "gonderildi" && <span className="muted">Sahəyə yazılıb</span>}
                        {order.status === "legv" && <span className="muted">Ləğv olunub</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableContainer>
        </section>
      )}

      {tab === "teleb" && (
        <section>
          <TableContainer className="wide">
            <DataTable>
              <thead>
                <tr>
                  <th>Tələb</th>
                  <th>Mətn</th>
                  <th>Material</th>
                  <th>Layihə</th>
                  <th>Tarix</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {plantRequests.map((item) => (
                  <tr key={item.id} className="click" onClick={() => { setReading(item.id); setReason(""); setRequestError("") }}>
                    <td className="mono">{item.id}</td>
                    <td><div className="clip" title={item.text || ""}>{item.text || "—"}</div></td>
                    <td><b>{item.material}</b><div className="muted">{num(item.qty, 1)} {item.unit}</div></td>
                    <td>{item.project}</td>
                    <td>{dateAZ(item.date)}<div className="muted">{item.author}</div></td>
                    <td><Badge status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableContainer>
        </section>
      )}

      {tab === "anbar" && (
        <section>
          <p className="muted" style={{ marginBottom: 12 }}>{kind === "zavod" ? "Zavod anbarında" : "Sex anbarında"} duran xammal. Qəbul materialı bura artırır.</p>
          <form
            className="form-row short"
            style={{ marginBottom: 12 }}
            onSubmit={(event) => {
              event.preventDefault()
              const message = stockMove({ materialId: receiptMaterial, type: "medaxil", qty: receipt.qty, locationId: plant.locationId, project: "" })
              setReceiptError(message)
              if (!message) setReceipt({ ...receipt, qty: "" })
            }}
          >
            <Field label="Material">
              <Select value={receiptMaterial} onValueChange={(value) => setReceipt({ ...receipt, materialId: value })} options={receiptChoices.map((item) => ({ value: item.id, label: item.name }))} />
            </Field>
            <Field label="Miqdar">
              <Input type="number" min="0" step="0.1" value={receipt.qty} onChange={(event) => setReceipt({ ...receipt, qty: event.target.value })} />
            </Field>
            <Button  type="submit">Qəbul et</Button>
          </form>
          {receiptError && <p className="form-error">{receiptError}</p>}
          <TableContainer>
            <DataTable>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Qalıq</th>
                  <th>Qiymət</th>
                  <th>Dəyər</th>
                </tr>
              </thead>
              <tbody>
                {onHandRows.map((row) => {
                  const material = materials.find((item) => item.id === row.materialId)
                  if (!material) return null
                  return (
                    <tr key={row.materialId}>
                      <td><b>{material.name}</b></td>
                      <td>{num(row.qty, row.qty % 1 ? 1 : 0)} {material.unit}<div className="muted">min {num(material.min)}</div></td>
                      <td>{money(material.price)}</td>
                      <td>{money(row.qty * material.price)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </DataTable>
          </TableContainer>
        </section>
      )}

      {tab === "transfer" && (
        <section>
          <p className="muted" style={{ marginBottom: 12 }}>Bir sənəd bir neçə materialı {kind === "zavod" ? "zavoddan" : "sex anbarından"} çıxarıb dayanacaq-dayanacaq aparır. Qiymət sətirin məbləğini verir.</p>
          <div className="stop-row">
            <span className="stop-chip">{shortPlace(plant.locationId)}</span>
            {stops.map((id) => (
              <span className="stop-chip" key={id}>
                {place(id)}
                <button type="button" aria-label="Dayanacağı sil" onClick={() => setStops(stops.filter((item) => item !== id))}>×</button>
              </span>
            ))}
          </div>
          <form
            className="pull-row"
            style={{ marginBottom: 12 }}
            onSubmit={(event) => {
              event.preventDefault()
              if (!pick || stops.includes(pick)) return
              setStops([...stops, pick])
            }}
          >
            <Select ariaLabel="Dayanacaq" value={pick} onValueChange={setStopPick} options={destinations.map((item) => ({ value: item.id, label: item.name }))} />
            <Button className="ghost small" type="submit">Dayanacaq əlavə et</Button>
          </form>
          <TableContainer  style={{ marginBottom: 12 }}>
            <DataTable>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Miqdar</th>
                  <th>Qiymət</th>
                  <th>Məbləğ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const material = catalog.find((item) => item.id === line.materialId)
                  const amount = (Number(line.qty) || 0) * (Number(line.price) || 0)
                  return (
                    <tr key={line.key}>
                      <td>
                        <Select
                          ariaLabel="Material"
                          value={line.materialId}
                          onValueChange={(value) => {
                            const next = catalog.find((item) => item.id === value)
                            setLines(lines.map((row) => (row.key === line.key ? { ...row, materialId: value, price: next ? String(next.price) : row.price } : row)))
                          }}
                          options={catalog.map((item) => ({ value: item.id, label: item.name }))}
                        />
                      </td>
                      <td>
                        <Input aria-label="Miqdar" type="number" min="0" step="0.1" value={line.qty} onChange={(event) => setLines(lines.map((row) => (row.key === line.key ? { ...row, qty: event.target.value } : row)))} />
                        {material && <div className="muted">anbarda {num(onHand(stocks, material.id, plant.locationId), 1)} {material.unit}</div>}
                      </td>
                      <td>
                        <Input aria-label="Qiymət" type="number" min="0" step="1" value={line.price} onChange={(event) => setLines(lines.map((row) => (row.key === line.key ? { ...row, price: event.target.value } : row)))} />
                      </td>
                      <td>{money(amount)}</td>
                      <td>
                        <Button type="button" className="ghost small" onClick={() => setLines(lines.length === 1 ? lines : lines.filter((row) => row.key !== line.key))}><Icon name="trash" /> Sil</Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </DataTable>
          </TableContainer>
          <div className="row-actions" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <Button type="button" className="ghost small" onClick={() => { setLines([...lines, { key: lineKey, materialId: "", qty: "", price: "" }]); setLineKey(lineKey + 1) }}>Material əlavə et</Button>
            <strong>{money(lines.reduce((sum, line) => sum + (Number(line.qty) || 0) * (Number(line.price) || 0), 0))}</strong>
          </div>
          {transferError && <p className="form-error">{transferError}</p>}
          <Button
            type="button"

            onClick={() => {
              const message = createShipment({
                stops: [plant.locationId, ...stops],
                lines: lines.filter((line) => line.materialId).map((line) => ({ materialId: line.materialId, qty: line.qty, price: line.price })),
              })
              setTransferError(message)
              if (!message) setLines([{ key: lineKey, materialId: "", qty: "", price: "" }])
            }}
          >
            Marşrutu yaz
          </Button>
          <h2 className="block-title">Yoldakı və çatan sənədlər</h2>
          <TableContainer className="wide">
            <DataTable>
              <thead>
                <tr>
                  <th>Sənəd</th>
                  <th>Material</th>
                  <th>Məbləğ</th>
                  <th>Marşrut</th>
                </tr>
              </thead>
              <tbody>
                {plantShipments.map((item) => (
                  <tr key={item.id} className="click" onClick={() => { setShipmentFor(item.id); setTransferError("") }}>
                    <td className="mono">{item.id}<div className="muted">{dateAZ(item.date)} · {item.by}</div></td>
                    <td>{item.lines.map((line) => line.material).join(", ")}</td>
                    <td>{item.valuationVisible === false ? "—" : money(item.lines.reduce((sum, line) => sum + (line.amount || 0), 0))}</td>
                    <td className="track-cell">
                      <button type="button" className="track-btn" aria-label={`${item.id} marşrutu`} onClick={() => { setShipmentFor(item.id); setTransferError("") }}>
                        <RouteTrack shipment={item} nameOf={shortPlace} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableContainer>
        </section>
      )}

      {tab === "texnika" && (
        <section>
          <p className="muted" style={{ marginBottom: 12 }}>{kind === "zavod" ? "Zavodun mikseri, nasosu və daşıyan texnikası." : "Bu sexin dəzgahı və maşını."} Status sətirin özündən dəyişir.</p>
          <TableContainer>
            <DataTable>
              <thead>
                <tr>
                  <th>Texnika</th>
                  <th>Tip</th>
                  <th>Saat</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {machines.map((item) => (
                  <tr key={item.id}>
                    <td><b>{item.name}</b><div className="muted">{item.site}</div></td>
                    <td>{item.type}</td>
                    <td>{num(item.hours)} saat<div className="muted">servis {dateAZ(item.nextService)}</div></td>
                    <td>
                      <Select
                        compact
                        ariaLabel={`${item.name} statusu`}
                        value={item.status}
                        onValueChange={(value) => setAssetStatus(item.id, value as AssetStatus)}
                        options={[
                          { value: "sahede", label: "Sahədə" },
                          { value: "bos", label: "Boş" },
                          { value: "servis", label: "Servisdə" },
                          { value: "icarede", label: "İcarədə" },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableContainer>
        </section>
      )}

      {tab === "itki" && (
        <section>
          <form
            className="form-row"
            style={{ marginBottom: 12 }}
            onSubmit={(event) => {
              event.preventDefault()
              const message = writeWaste({ locationId: plant.locationId, materialId: wasteMaterial, qty: waste.qty, project: waste.project, reason: waste.reason })
              setWasteError(message)
              if (!message) setWaste({ ...waste, qty: "", reason: "" })
            }}
          >
            <Field label="Material">
              <Select value={wasteMaterial} onValueChange={(value) => setWaste({ ...waste, materialId: value })} options={catalog.map((item) => ({ value: item.id, label: item.name }))} />
            </Field>
            <Field label="Layihə">
              <Select value={waste.project} onValueChange={(value) => setWaste({ ...waste, project: value })} options={[{ value: "", label: "Layihəsiz" }, ...projects.map((item) => ({ value: item.name, label: item.name }))]} />
            </Field>
            <Field label="Miqdar">
              <Input type="number" min="0" step="0.1" value={waste.qty} onChange={(event) => setWaste({ ...waste, qty: event.target.value })} />
            </Field>
            <Field label="Səbəb">
              <Input value={waste.reason} onChange={(event) => setWaste({ ...waste, reason: event.target.value })} />
            </Field>
            <Button className="ghost" type="submit">İtkini yaz</Button>
          </form>
          {wasteError && <p className="form-error">{wasteError}</p>}
          <TableContainer>
            <DataTable>
              <thead>
                <tr>
                  <th>Tarix</th>
                  <th>Material</th>
                  <th>Miqdar</th>
                  <th>Məbləğ</th>
                  <th>Səbəb</th>
                </tr>
              </thead>
              <tbody>
                {losses.map((item) => {
                  const material = materials.find((row) => row.id === item.materialId)
                  return (
                    <tr key={item.id}>
                      <td>{dateAZ(item.date)}<div className="muted">{item.by}</div></td>
                      <td>{item.material}</td>
                      <td>{num(item.qty, 1)} {item.unit}</td>
                      <td>{money(item.qty * (material?.price || 0))}</td>
                      <td>{item.note || "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </DataTable>
            {losses.length === 0 && <Empty title="İtki yoxdur" text="Bu növbədə silinmiş xammal yoxdur." />}
          </TableContainer>
        </section>
      )}

      {openOrderCard && (
        <Drawer title={`${openOrderCard.id} · ${openOrderCard.product}`} onClose={() => setOrderFor("")}>
          <OrderRead
            key={openOrderCard.id}
            order={openOrderCard}
            recipe={recipes.find((item) => item.product === openOrderCard.product)}
            materials={materials}
            stocks={stocks}
            locationId={plant.locationId}
            fleet={fleet.map((item) => ({ value: item.name, label: `${item.name} · ${item.type}` }))}
            error={orderError}
            story={storyFor(openOrderCard.status, kind)}
            onStart={() => act(startOrder, openOrderCard.id)}
            onClose={() => act(completeOrder, openOrderCard.id)}
            onCancel={() => act(cancelOrder, openOrderCard.id)}
            onReturn={() => act(returnOrder, openOrderCard.id)}
            onSend={(vehicle, ticketNote) => {
              const message = sendOrder(openOrderCard.id, { vehicle, note: ticketNote })
              setOrderError(message)
            }}
          />
        </Drawer>
      )}

      {openRequest && (
        <Drawer title={openRequest.id} onClose={() => setReading("")}>
          <div className="form">
            <p>{openRequest.text || "Mətn yazılmayıb."}</p>
            <p><b>{openRequest.material}</b> · {num(openRequest.qty, 1)} {openRequest.unit}</p>
            <p className="muted">{openRequest.project} · {openRequest.author} · {dateAZ(openRequest.date)}</p>
            <p>{kind === "zavod" ? "Zavod" : "Sex"} anbarında {num(onHand(stocks, openRequest.materialId, plant.locationId), 1)} {openRequest.unit}. Mərkəzdə {num(onHand(stocks, openRequest.materialId, "LOC-MERKEZ"), 1)} {openRequest.unit}.</p>
            <p><Badge status={openRequest.status} /></p>
            {openRequest.decision && <p>Rədd səbəbi: {openRequest.decision}{openRequest.decidedBy ? ` · ${openRequest.decidedBy}` : ""}</p>}
            {(openRequest.status === "gozleyir" || openRequest.status === "teklif") && (
              <>
                <Field label="Rədd səbəbi">
                  <Input value={reason} onChange={(event) => setReason(event.target.value)} />
                </Field>
                {requestError && <p className="form-error">{requestError}</p>}
                <div className="form-actions">
                  <Button type="button" className="ghost" onClick={() => setRequestError(rejectRequest(openRequest.id, reason))}>Rədd et</Button>
                  <Button type="button" className="ghost" onClick={() => setRequestError(convertRequest(openRequest.id))}>Təchizata yönəlt</Button>
                  <Button type="button" onClick={() => setRequestError(coverRequest(openRequest.id))}>Anbardan təsdiq</Button>
                </div>
              </>
            )}
          </div>
        </Drawer>
      )}

      {shopDrawer}
      {openShipment && (
        <Drawer title={openShipment.id} onClose={() => setShipmentFor("")}>
          <div className="form">
            <RouteTrack shipment={openShipment} nameOf={(id) => place(id)} />
            <p><Badge status={openShipment.status || "legacy"} /></p>
            {openShipment.dispatchedBy && <p>Göndərən imzası: {openShipment.dispatchedBy}</p>}
            {openShipment.receivedBy && <p>Qəbul edən imzası: {openShipment.receivedBy}</p>}
            <p className="muted">{openShipment.step >= openShipment.stops.length - 1 ? "Material son dayanacaqdadır." : `İndi ${place(openShipment.stops[openShipment.step])} dayanacağındadır. Növbəti: ${place(openShipment.stops[openShipment.step + 1])}.`}</p>
            {openShipment.note && <p>{openShipment.note}</p>}
            {openShipment.lines.map((line) => (
              <p key={line.materialId}><b>{line.material}</b> · {num(line.qty, 1)} {line.unit}{openShipment.valuationVisible === false ? "" : ` · ${money(line.price || 0)} · ${money(line.amount || 0)}`}</p>
            ))}
            {openShipment.valuationVisible !== false && <p><b>Cəmi {money(openShipment.lines.reduce((sum, line) => sum + (line.amount || 0), 0))}</b></p>}
            {transferError && <p className="form-error">{transferError}</p>}
            {((openShipment.status === "waiting_sender" && openShipment.canDispatch) || (openShipment.status === "sent" && openShipment.canReceive) || (!openShipment.status && openShipment.step < openShipment.stops.length - 1)) && (
              <div className="form-actions">
                <Button type="button" onClick={() => setTransferError(advanceShipment(openShipment.id))}>{openShipment.status === "waiting_sender" ? "Göndərən kimi imzala və göndər" : openShipment.status === "sent" ? "Qəbul et və imzala" : "Növbəti dayanacağa"}</Button>
              </div>
            )}
          </div>
        </Drawer>
      )}
    </>
  )
}

function Where({ status }: { status: string }) {
  if (status === "legv") return <Badge status="legv" />
  const index = STEPS.findIndex((item) => item === status)
  return (
    <ol className="phases track">
      {STEPS.map((item, stepIndex) => (
        <li key={item} className={stepIndex < index ? "done" : stepIndex === index ? "current" : ""}>
          <i />
          <span>{STEP_LABEL[item]}</span>
        </li>
      ))}
    </ol>
  )
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

function OrderRead({
  order, recipe, materials, stocks, locationId, fleet, error, story, onStart, onClose, onCancel, onReturn, onSend,
}: {
  order: WorkOrder
  recipe?: { items: { materialId: string; qty: number }[] }
  materials: { id: string; name: string; unit: string; price: number }[]
  stocks: { materialId: string; locationId: string; qty: number }[]
  locationId: string
  fleet: { value: string; label: string }[]
  error: string
  story: string
  onStart: () => void
  onClose: () => void
  onCancel: () => void
  onReturn: () => void
  onSend: (vehicle: string, note: string) => void
}) {
  const [vehicle, setVehicle] = useState(fleet[0]?.value || "")
  const [ticketNote, setTicketNote] = useState("")
  const preview = (recipe?.items || []).map((item) => {
    const material = materials.find((row) => row.id === item.materialId)
    const need = Math.round(item.qty * order.qty * 1000) / 1000
    return { id: item.materialId, name: material?.name || item.materialId, unit: material?.unit || "", need, have: onHand(stocks, item.materialId, locationId), amount: Math.round(need * (material?.price || 0)) }
  })
  return (
    <div className="form">
      <Where status={order.status} />
      <p>{story}</p>
      <p className="muted">{order.project} · {num(order.qty, order.qty % 1 ? 1 : 0)} {order.unit} · {dateAZ(order.due)}</p>
      {order.vehicle && <p className="muted">Texnika: {order.vehicle}{order.note ? ` · ${order.note}` : ""}</p>}
      {preview.length > 0 && (order.status === "novbede" || order.status === "gedir") && preview.map((item) => (
        <p key={item.id} className={item.have + 1e-9 < item.need ? "form-error" : "muted"}>
          {item.name}: lazım {num(item.need, 1)} {item.unit}, anbarda {num(item.have, 1)} · {money(item.amount)}
        </p>
      ))}
      {(order.issued || []).map((item) => (
        <p key={item.materialId} className="muted">{item.name}: silindi {num(item.qty, 1)} {item.unit} · {money(item.amount)}</p>
      ))}
      {order.cost ? <p>Bağlanış məbləği {money(order.cost)}</p> : null}
      {order.status === "hazir" && (
        <>
          <Field label="Texnika">
            <Select value={vehicle} onValueChange={setVehicle} options={fleet.length ? fleet : [{ value: "", label: "Texnikasız" }]} />
          </Field>
          <Field label="Yol qeydi">
            <Input value={ticketNote} onChange={(event) => setTicketNote(event.target.value)} placeholder="Mərtəbə, qəbul edən" />
          </Field>
        </>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        {order.status === "novbede" && (
          <>
            <Button type="button" className="ghost" onClick={onCancel}>Ləğv et</Button>
            <Button type="button" onClick={onStart}>İşə sal</Button>
          </>
        )}
        {order.status === "gedir" && (
          <>
            <Button type="button" className="ghost" onClick={onReturn}>Növbəyə qaytar</Button>
            <Button type="button" onClick={onClose}>Bağla</Button>
          </>
        )}
        {order.status === "hazir" && (
          <Button type="button" onClick={() => onSend(vehicle, ticketNote)}>Sahəyə yaz</Button>
        )}
      </div>
    </div>
  )
}

function responsible(order: { status: string; startedBy?: string; closedBy?: string; sentBy?: string; cancelledBy?: string }) {
  if (order.status === "legv") return order.cancelledBy
  if (order.status === "gonderildi") return order.sentBy
  if (order.status === "hazir") return order.closedBy
  return order.startedBy
}
