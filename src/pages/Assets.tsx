import { useEffect, useState, type FormEvent } from "react"
import { DateField } from "../DateField"
import { onHand, TODAY } from "../domain/ops"
import type { Asset, AssignForm, DriverForm, FleetDocForm, FuelForm, ServiceForm, TripForm, VehicleForm } from "../domain/types"
import { addDays, dateAZ, hit, money, num } from "../format"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Badge, Drawer, Empty, Field, Meter, Modal, PageHead, RowMenu, Select, Tabs, useTitle } from "../ui"
import { patch, uid, useWorkspace } from "../workspace"

type Tab = "icmal" | "texnika" | "surucu" | "reys" | "yanacaq" | "sened" | "servis" | "icare"
type ModalKind = "" | "vehicle" | "assign" | "driver" | "trip" | "fuel" | "doc" | "service"

const TYPES = ["Kran", "Ekskavator", "Beton", "Nəqliyyat", "Anbar", "Dəzgah"]

function blankVehicle(site = ""): VehicleForm {
  return {
    name: "",
    type: "Nəqliyyat",
    plate: "",
    year: "2020",
    site,
    ownership: "oz",
    fuel: "dizel",
    meter: "km",
    odometer: "0",
    hours: "0",
    rate: "40",
    fuelPerHour: "8",
    nextService: TODAY,
    driverId: "",
  }
}

function vehicleOf(asset: Asset): VehicleForm {
  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    plate: asset.plate || "",
    year: asset.year ? String(asset.year) : "",
    site: asset.site,
    ownership: asset.ownership || "oz",
    fuel: asset.fuel || "dizel",
    meter: asset.meter || "saat",
    odometer: String(asset.odometer ?? 0),
    hours: String(asset.hours),
    rate: String(asset.rate ?? 0),
    fuelPerHour: String(asset.fuelPerHour ?? 0),
    nextService: asset.nextService,
    driverId: asset.driverId || "",
  }
}

export default function Assets() {
  const { t } = usePrefs()
  useTitle(t("page.assets.title"))
  const {
    query, assets, drivers, trips, fuels, fleetDocs, materials, services, projects, plants, stocks, reload,
    saveVehicle, assignVehicle, saveDriver, openTrip, departTrip, arriveTrip, cancelTrip, logFuel, saveFleetDoc, openService, closeService,
  } = useStore()
  const [tab, setTab] = useState<Tab>("icmal")
  const [filter, setFilter] = useState("hamisi")
  const [modal, setModal] = useState<ModalKind>("")
  const [focus, setFocus] = useState("")
  const [error, setError] = useState("")
  const [vehicle, setVehicle] = useState<VehicleForm>(blankVehicle())
  const [assign, setAssign] = useState<AssignForm>({ assetId: "", site: "", status: "sahede", driverId: "" })
  const [driver, setDriver] = useState<DriverForm>({ name: "", phone: "", license: "", category: "C", expires: TODAY, status: "aktiv" })
  const [trip, setTrip] = useState<TripForm>({ assetId: "", driverId: "", project: "", from: "", to: "", cargo: "", km: "", note: "" })
  const [fuel, setFuel] = useState<FuelForm>({ assetId: "", liters: "", reading: "", project: "", note: "" })
  const [doc, setDoc] = useState<FleetDocForm>({ assetId: "", kind: "sigorta", number: "", issuer: "", expires: TODAY })
  const [service, setService] = useState<ServiceForm>({ assetId: "", materialId: "", qty: "", note: "" })
  const { rentals } = useWorkspace()
  const [rental, setRental] = useState({ name: "", rate: "", unit: "gün", place: "", operator: "" })

  const driverOf = (id?: string) => drivers.find((item) => item.id === id)
  const assetOf = (id: string) => assets.find((item) => item.id === id)
  const places = [...new Set([...projects.map((item) => item.name), ...plants.map((item) => item.name), "Mərkəzi anbar", "Servis mərkəzi", ...assets.map((item) => item.site)])]
  const projectOptions = projects.map((item) => ({ value: item.name, label: item.name }))
  const assetOptions = assets.map((item) => ({ value: item.id, label: `${item.name}${item.plate ? ` · ${item.plate}` : ""}` }))
  const driverOptions = [{ value: "", label: "Təyin yoxdur" }, ...drivers.map((item) => ({ value: item.id, label: `${item.name} · ${item.category}` }))]
  const activeDrivers = drivers.filter((item) => item.status === "aktiv").map((item) => ({ value: item.id, label: `${item.name} · ${item.category}` }))

  const busy = assets.filter((item) => item.status === "sahede" || item.status === "icarede")
  const util = busy.length ? Math.round(busy.reduce((sum, item) => sum + item.utilization, 0) / busy.length) : 0
  const month = TODAY.slice(0, 7)
  const monthFuel = fuels.filter((item) => item.date.startsWith(month))
  const fuelSpend = monthFuel.reduce((sum, item) => sum + item.amount, 0)
  const liters = monthFuel.reduce((sum, item) => sum + item.liters, 0)
  const horizon = addDays(TODAY, 14)
  const dueDocs = fleetDocs.filter((item) => item.expires && item.expires.slice(0, 10) <= horizon)
  const dueService = assets.filter((item) => item.status !== "servis" && item.nextService && item.nextService.slice(0, 10) <= TODAY)
  const openJobs = services.filter((item) => item.status === "acik")
  const jobAssets = new Set(openJobs.map((item) => item.assetId))
  const inShop = assets.filter((item) => item.status === "servis" && !jobAssets.has(item.id))
  const attention = dueDocs.length + dueService.length + openJobs.length + inShop.length
  useEffect(() => { reload() }, [reload])
  const moving = trips.filter((item) => item.status === "yolda")
  const planned = trips.filter((item) => item.status === "plan")
  const diesel = onHand(stocks, "MAT-DSL")

  const machines = assets.filter((item) => (filter === "hamisi" || item.status === filter) && hit(query, item.name, item.type, item.site, item.id, item.plate, driverOf(item.driverId)?.name))
  const driverRows = drivers.filter((item) => hit(query, item.name, item.license, item.category, item.phone))
  const tripRows = trips.filter((item) => hit(query, item.id, item.cargo, item.from, item.to, item.project, assetOf(item.assetId)?.name, driverOf(item.driverId)?.name))
  const fuelRows = fuels.filter((item) => hit(query, assetOf(item.assetId)?.name, item.project, item.note, item.by))
  const docRows = fleetDocs.filter((item) => hit(query, assetOf(item.assetId)?.name, item.number, item.issuer, item.kind))
  const focused = assetOf(focus)

  function open(kind: ModalKind) {
    setError("")
    setModal(kind)
  }

  function startVehicle(asset?: Asset) {
    setVehicle(asset ? vehicleOf(asset) : blankVehicle(projects[0]?.name || ""))
    open("vehicle")
  }

  function startAssign(asset: Asset) {
    setAssign({ assetId: asset.id, site: asset.site, status: asset.status === "servis" ? "sahede" : asset.status, driverId: asset.driverId || "" })
    open("assign")
  }

  function startService(asset: Asset) {
    setService({ assetId: asset.id, materialId: "", qty: "", note: "" })
    open("service")
  }

  function startTrip(asset?: Asset) {
    setTrip({
      assetId: asset?.id || assets.find((item) => item.status !== "servis")?.id || "",
      driverId: asset?.driverId || "",
      project: projects.find((item) => item.name === asset?.site)?.name || projects[0]?.name || "",
      from: asset?.site || "",
      to: "",
      cargo: "",
      km: "",
      note: "",
    })
    open("trip")
  }

  function startFuel(asset?: Asset) {
    setFuel({
      assetId: asset?.id || assets[0]?.id || "",
      liters: "",
      reading: "",
      project: projects.find((item) => item.name === asset?.site)?.name || projects[0]?.name || "",
      note: "",
    })
    open("fuel")
  }

  function startDoc(asset?: Asset) {
    setDoc({ assetId: asset?.id || assets[0]?.id || "", kind: "sigorta", number: "", issuer: "", expires: TODAY })
    open("doc")
  }

  function startDriver(current?: DriverForm) {
    setDriver(current || { name: "", phone: "", license: "", category: "C", expires: TODAY, status: "aktiv" })
    open("driver")
  }

  const addLabel: Record<Tab, string> = {
    icmal: "Texnika əlavə et",
    texnika: "Texnika əlavə et",
    surucu: "Sürücü əlavə et",
    reys: "Reys aç",
    yanacaq: "Yanacaq yaz",
    sened: "Sənəd yaz",
    servis: "",
    icare: "",
  }

  function add() {
    if (tab === "surucu") startDriver()
    else if (tab === "reys") startTrip()
    else if (tab === "yanacaq") startFuel()
    else if (tab === "sened") startDoc()
    else if (tab !== "servis") startVehicle()
  }

  return (
    <>
      <PageHead kicker={t("page.assets.kicker")} title={t("page.assets.title")} text={t("page.assets.text", { util })}>
        {addLabel[tab] && <button type="button" className="btn" onClick={add}>{addLabel[tab]}</button>}
      </PageHead>
      <div className="toolbar">
        <Tabs
          value={tab}
          onChange={(id) => setTab(id as Tab)}
          options={[
            { id: "icmal", label: "İcmal" },
            { id: "texnika", label: "Texnika" },
            { id: "surucu", label: "Sürücülər" },
            { id: "reys", label: "Reyslər" },
            { id: "yanacaq", label: "Yanacaq" },
            { id: "sened", label: "Sənədlər" },
            { id: "servis", label: "Servis" },
            { id: "icare", label: "İcarə elanı" },
          ]}
        />
      </div>

      {tab === "icare" && (
        <section className="panel pad">
          <h2 className="block-title">İcarə elanı</h2>
          <p className="lede">Elan boşdur. Texnika, qiymət, yer və operator yazılanda siyahıya düşür.</p>
          <div className="form-row wide">
            <label>Texnika<input value={rental.name} onChange={(event) => setRental({ ...rental, name: event.target.value })} /></label>
            <label>Qiymət<input value={rental.rate} onChange={(event) => setRental({ ...rental, rate: event.target.value })} placeholder="boş" /></label>
            <label>Vahid<Select value={rental.unit} onValueChange={(unit) => setRental({ ...rental, unit })} options={[{ value: "gün", label: "Gün" }, { value: "saat", label: "Saat" }]} /></label>
            <label>Yer<input value={rental.place} onChange={(event) => setRental({ ...rental, place: event.target.value })} placeholder="boş" /></label>
            <label>Operator<input value={rental.operator} onChange={(event) => setRental({ ...rental, operator: event.target.value })} placeholder="boş" /></label>
            <button type="button" className="btn" onClick={() => { if (!rental.name.trim()) return; patch((state) => ({ ...state, rentals: [...state.rentals, { ...rental, id: uid() }] })); setRental({ name: "", rate: "", unit: "gün", place: "", operator: "" }) }}>Elan aç</button>
          </div>
          {rentals.length === 0 && <p className="lede">Elan yoxdur.</p>}
          {rentals.map((row) => <div className="step-row" key={row.id}><span>{row.name} · {row.place.trim() || "yer yoxdur"} · {row.operator.trim() || "operator yoxdur"}</span><strong>{row.rate.trim() ? `${row.rate} AZN/${row.unit}` : "Qiymət yoxdur"}</strong></div>)}
        </section>
      )}

      {tab === "icmal" && (
        <>
          <section className="statstrip">
            <article>
              <span>Aktivlər</span>
              <strong>{assets.length}</strong>
              <em>{busy.length} işlək vahid</em>
            </article>
            <article>
              <span>Reys</span>
              <strong>{moving.length}</strong>
              <em>{planned.length} plan gözləyir</em>
            </article>
            <article>
              <span>Yanacaq</span>
              <strong>{money(fuelSpend)}</strong>
              <em>{num(liters)} litr bu ay</em>
            </article>
            <article>
              <span>Sənəd</span>
              <strong>{dueDocs.length}</strong>
              <em className={dueDocs.length ? "warn" : ""}>14 günün içində</em>
            </article>
          </section>
          <div className="grid-2">
            <section className="panel pad">
              <div className="panel-head"><h2>Diqqət</h2></div>
              {attention === 0 && <p className="muted">Vaxtı çatan sənəd və servis yoxdur.</p>}
              <div className="mini-list">
                {dueDocs.map((item) => (
                  <article key={item.id}>
                    <b>{assetOf(item.assetId)?.name || item.assetId}</b>
                    <span className="muted">{t(`status.${item.kind}`)} · {item.number} · {dateAZ(item.expires)}</span>
                  </article>
                ))}
                {dueService.map((item) => (
                  <article key={item.id}>
                    <b>{item.name}</b>
                    <span className="muted">Servis vaxtıdır · {dateAZ(item.nextService)}</span>
                  </article>
                ))}
                {openJobs.map((item) => (
                  <article key={item.id}>
                    <b>{item.asset}</b>
                    <span className="muted">Servisdədir · {item.note || item.id} · {dateAZ(item.opened)}</span>
                  </article>
                ))}
                {inShop.map((item) => (
                  <article key={`${item.id}-shop`}>
                    <b>{item.name}</b>
                    <span className="muted">Servisdədir · {item.site}</span>
                  </article>
                ))}
              </div>
            </section>
            <section className="panel pad">
              <div className="panel-head"><h2>Açıq reys</h2><button type="button" className="btn small" onClick={() => startTrip()}>Reys aç</button></div>
              {moving.length + planned.length === 0 && <p className="muted">Yolda və ya planda reys yoxdur.</p>}
              <div className="mini-list">
                {[...moving, ...planned].map((item) => (
                  <article key={item.id}>
                    <div className="split">
                      <b>{assetOf(item.assetId)?.name}</b>
                      <Badge status={item.status} />
                    </div>
                    <span className="muted">{item.from} → {item.to} · {item.cargo}</span>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </>
      )}

      {tab === "texnika" && (
        <>
          <div className="toolbar">
            <Tabs
              value={filter}
              onChange={setFilter}
              options={[
                { id: "hamisi", label: "Hamısı" },
                { id: "sahede", label: "Sahədə" },
                { id: "servis", label: "Servis" },
                { id: "bos", label: "Boş" },
                { id: "icarede", label: "İcarə" },
              ]}
            />
            <span className="muted">{machines.length} vahid</span>
          </div>
          <div className="table-wrap wide">
            <table>
              <thead>
                <tr>
                  <th>Texnika</th>
                  <th>Sürücü</th>
                  <th>Yer</th>
                  <th className="num">Göstərici</th>
                  <th>Servis</th>
                  <th>Vəziyyət</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {machines.map((asset) => (
                  <tr key={asset.id} className="click" onClick={() => setFocus(asset.id)}>
                    <td>
                      <b>{asset.name}</b>
                      <div className="muted">{asset.plate || asset.type} · {asset.id}</div>
                    </td>
                    <td>{driverOf(asset.driverId)?.name || "—"}</td>
                    <td>{asset.site}</td>
                    <td className="num">{asset.meter === "km" ? `${num(asset.odometer || 0)} km` : `${num(asset.hours)} saat`}</td>
                    <td>{dateAZ(asset.nextService)}</td>
                    <td><Badge status={asset.status} /></td>
                    <td>
                      <RowMenu
                        items={[
                          { id: "edit", label: "Redaktə", onClick: () => startVehicle(asset) },
                          { id: "assign", label: "Təyin et", onClick: () => startAssign(asset) },
                          asset.status === "servis"
                            ? { id: "return", label: "Sahəyə qaytar", onClick: () => closeService(asset.id) }
                            : { id: "service", label: "Servisə al", onClick: () => startService(asset) },
                          ...(asset.status !== "bos" && asset.status !== "servis"
                            ? [{ id: "park", label: "Park et", onClick: () => assignVehicle({ assetId: asset.id, site: asset.site, status: "bos", driverId: asset.driverId || "" }) }]
                            : []),
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {machines.length === 0 && <Empty title="Texnika tapılmadı" text="Filtri və ya axtarışı dəyişin." />}
          </div>
        </>
      )}

      {tab === "surucu" && (
        <div className="table-wrap wide">
          <table>
            <thead>
              <tr>
                <th>Sürücü</th>
                <th>Vəsiqə</th>
                <th>Kateqoriya</th>
                <th>Bitmə</th>
                <th>Texnika</th>
                <th>Vəziyyət</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {driverRows.map((item) => {
                const machine = assets.find((asset) => asset.driverId === item.id)
                return (
                  <tr key={item.id}>
                    <td>
                      <b>{item.name}</b>
                      <div className="muted">{item.phone}</div>
                    </td>
                    <td className="mono">{item.license}</td>
                    <td>{item.category}</td>
                    <td>{dateAZ(item.expires)}</td>
                    <td>{machine?.name || "—"}</td>
                    <td><Badge status={item.status} /></td>
                    <td>
                      <RowMenu
                        items={[{
                          id: "edit",
                          label: "Redaktə",
                          onClick: () => startDriver({
                            id: item.id,
                            name: item.name,
                            phone: item.phone,
                            license: item.license,
                            category: item.category,
                            expires: item.expires,
                            status: item.status,
                          }),
                        }]}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {driverRows.length === 0 && <Empty title="Sürücü tapılmadı" text="Axtarışı dəyişin və ya yeni sürücü açın." />}
        </div>
      )}

      {tab === "reys" && (
        <div className="table-wrap wide">
          <table>
            <thead>
              <tr>
                <th>Reys</th>
                <th>Marşrut</th>
                <th>Yük</th>
                <th className="num">Yürüş</th>
                <th>Vəziyyət</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tripRows.map((item) => (
                <tr key={item.id}>
                  <td>
                    <b>{assetOf(item.assetId)?.name || item.assetId}</b>
                    <div className="muted">{driverOf(item.driverId)?.name} · {item.id} · {dateAZ(item.date)}</div>
                  </td>
                  <td>{item.from} → {item.to}<div className="muted">{item.project}</div></td>
                  <td>{item.cargo}</td>
                  <td className="num">{num(item.km)} km</td>
                  <td><Badge status={item.status} /></td>
                  <td>
                    <RowMenu
                      items={[
                        ...(item.status === "plan" ? [{ id: "go", label: "Yola sal", onClick: () => departTrip(item.id) }] : []),
                        ...(item.status === "yolda" ? [{ id: "done", label: "Çatdı", onClick: () => arriveTrip(item.id) }] : []),
                        ...(item.status === "plan" || item.status === "yolda" ? [{ id: "cancel", label: "Ləğv et", onClick: () => cancelTrip(item.id) }] : []),
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tripRows.length === 0 && <Empty title="Reys yoxdur" text="Yol vərəqəsi açanda marşrut burada durur." />}
        </div>
      )}

      {tab === "yanacaq" && (
        <>
          <p className="muted" style={{ marginBottom: 12 }}>Dizel anbarı {num(diesel)} litr. Yazılan dizel anbardan silinir və layihə xərcinə düşür.</p>
          <div className="table-wrap wide">
            <table>
              <thead>
                <tr>
                  <th>Tarix</th>
                  <th>Texnika</th>
                  <th className="num">Litr</th>
                  <th className="num">Məbləğ</th>
                  <th>Layihə</th>
                  <th>Qeyd</th>
                </tr>
              </thead>
              <tbody>
                {fuelRows.map((item) => (
                  <tr key={item.id}>
                    <td>{dateAZ(item.date)}</td>
                    <td><b>{assetOf(item.assetId)?.name}</b></td>
                    <td className="num">{num(item.liters)}</td>
                    <td className="num">{money(item.amount)}</td>
                    <td>{item.project}</td>
                    <td>{item.note || item.by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {fuelRows.length === 0 && <Empty title="Yanacaq yoxdur" text="Doldurma yazılanda burada və anbar hərəkətində görünür." />}
          </div>
        </>
      )}

      {tab === "sened" && (
        <div className="table-wrap wide">
          <table>
            <thead>
              <tr>
                <th>Texnika</th>
                <th>Növ</th>
                <th>Nömrə</th>
                <th>Verən</th>
                <th>Bitmə</th>
              </tr>
            </thead>
            <tbody>
              {docRows.map((item) => (
                <tr key={item.id}>
                  <td><b>{assetOf(item.assetId)?.name}</b></td>
                  <td><Badge status={item.kind} /></td>
                  <td className="mono">{item.number}</td>
                  <td>{item.issuer}</td>
                  <td>{dateAZ(item.expires)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {docRows.length === 0 && <Empty title="Sənəd yoxdur" text="Sığorta, texniki baxış və qeydiyyat buraya yazılır." />}
        </div>
      )}

      {tab === "servis" && (
        <div className="table-wrap wide">
          <table>
            <thead>
              <tr>
                <th>Servis</th>
                <th>Texnika</th>
                <th>Açılıb</th>
                <th className="num">Xərc</th>
                <th>Vəziyyət</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {services.map((item) => (
                <tr key={item.id}>
                  <td>
                    <b>{item.id}</b>
                    <div className="muted">{item.note}</div>
                  </td>
                  <td>{item.asset}</td>
                  <td>{dateAZ(item.opened)}{item.closed ? ` · ${dateAZ(item.closed)}` : ""}</td>
                  <td className="num">{money(item.cost)}</td>
                  <td><Badge status={item.status} /></td>
                  <td>
                    {item.status === "acik" && (
                      <button type="button" className="btn small" onClick={() => closeService(item.assetId)}>Bağla</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {services.length === 0 && <Empty title="Servis yoxdur" text="Texnika sətirindən servis açılır. Ehtiyat hissə anbardan silinir." />}
        </div>
      )}

      {focused && (
        <Drawer title={focused.name} onClose={() => setFocus("")}>
          <p className="muted">{focused.plate || "Nömrəsiz"} · {focused.type}{focused.year ? ` · ${focused.year}` : ""}</p>
          <div className="split" style={{ margin: "12px 0" }}>
            <Badge status={focused.status} />
            <Badge status={focused.ownership || "oz"} />
          </div>
          <p>{focused.site}</p>
          <p className="muted">Sürücü: {driverOf(focused.driverId)?.name || "təyin yoxdur"}</p>
          <div className="split" style={{ marginTop: 12 }}>
            <span className="muted">{focused.meter === "km" ? `${num(focused.odometer || 0)} km` : `${num(focused.hours)} moto-saat`}</span>
            <span className="mono">{focused.status === "servis" || focused.status === "bos" ? 0 : focused.utilization}%</span>
          </div>
          <Meter value={focused.status === "servis" || focused.status === "bos" ? 0 : focused.utilization} tone={focused.status === "servis" ? "rose" : "pine"} />
          <p className="muted">Növbəti servis {dateAZ(focused.nextService)} · {money(focused.rate || 0)} / saat</p>
          <div className="deal-actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn small" onClick={() => startVehicle(focused)}>Redaktə</button>
            <button type="button" className="btn ghost small" onClick={() => startAssign(focused)}>Təyin et</button>
            <button type="button" className="btn ghost small" onClick={() => startTrip(focused)}>Reys</button>
            <button type="button" className="btn ghost small" onClick={() => startFuel(focused)}>Yanacaq</button>
            <button type="button" className="btn ghost small" onClick={() => startDoc(focused)}>Sənəd</button>
            {focused.status === "servis" ? (
              <button type="button" className="btn ghost small" onClick={() => closeService(focused.id)}>Sahəyə qaytar</button>
            ) : (
              <button type="button" className="btn ghost small" onClick={() => startService(focused)}>Servisə al</button>
            )}
          </div>
          <div className="mini-list" style={{ marginTop: 16 }}>
            {fleetDocs.filter((item) => item.assetId === focused.id).map((item) => (
              <article key={item.id}>{t(`status.${item.kind}`)} · {item.number} · {dateAZ(item.expires)}</article>
            ))}
            {trips.filter((item) => item.assetId === focused.id).slice(0, 4).map((item) => (
              <article key={item.id}>{item.from} → {item.to} · {num(item.km)} km</article>
            ))}
          </div>
        </Drawer>
      )}

      {modal === "vehicle" && (
        <Modal className="sheet" title={vehicle.id ? "Texnikanı yaz" : "Texnika əlavə et"} onClose={() => setModal("")}>
          <form className="form" onSubmit={(event: FormEvent) => { event.preventDefault(); const message = saveVehicle(vehicle); setError(message); if (!message) setModal("") }}>
            <div className="split">
              <Field label="Ad"><input value={vehicle.name} onChange={(event) => setVehicle({ ...vehicle, name: event.target.value })} /></Field>
              <Field label="Dövlət nömrəsi"><input value={vehicle.plate} onChange={(event) => setVehicle({ ...vehicle, plate: event.target.value })} /></Field>
            </div>
            <div className="split">
              <Field label="Növ"><Select value={vehicle.type} onValueChange={(type) => setVehicle({ ...vehicle, type })} options={TYPES.map((item) => ({ value: item, label: item }))} /></Field>
              <Field label="İl"><input type="number" value={vehicle.year} onChange={(event) => setVehicle({ ...vehicle, year: event.target.value })} /></Field>
            </div>
            <Field label="Yer"><Select value={vehicle.site} onValueChange={(site) => setVehicle({ ...vehicle, site })} options={places.map((item) => ({ value: item, label: item }))} /></Field>
            <div className="split">
              <Field label="Mülkiyyət"><Select value={vehicle.ownership} onValueChange={(ownership) => setVehicle({ ...vehicle, ownership: ownership as VehicleForm["ownership"] })} options={[{ value: "oz", label: "Öz" }, { value: "icare", label: "İcarə" }]} /></Field>
              <Field label="Yanacaq"><Select value={vehicle.fuel} onValueChange={(fuelKind) => setVehicle({ ...vehicle, fuel: fuelKind as VehicleForm["fuel"] })} options={[{ value: "dizel", label: "Dizel" }, { value: "benzin", label: "Benzin" }]} /></Field>
            </div>
            <div className="split">
              <Field label="Sayğac"><Select value={vehicle.meter} onValueChange={(meter) => setVehicle({ ...vehicle, meter: meter as VehicleForm["meter"] })} options={[{ value: "saat", label: "Moto-saat" }, { value: "km", label: "Kilometr" }]} /></Field>
              <Field label="Sürücü"><Select value={vehicle.driverId} onValueChange={(driverId) => setVehicle({ ...vehicle, driverId })} options={driverOptions} /></Field>
            </div>
            <div className="split">
              <Field label="Yürüş, km"><input type="number" min="0" step="1" value={vehicle.odometer} onChange={(event) => setVehicle({ ...vehicle, odometer: event.target.value })} /></Field>
              <Field label="Moto-saat"><input type="number" min="0" step="1" value={vehicle.hours} onChange={(event) => setVehicle({ ...vehicle, hours: event.target.value })} /></Field>
            </div>
            <div className="split">
              <Field label="Saat haqqı"><input type="number" min="0" step="1" value={vehicle.rate} onChange={(event) => setVehicle({ ...vehicle, rate: event.target.value })} /></Field>
              <Field label="Litr / saat"><input type="number" min="0" step="0.1" value={vehicle.fuelPerHour} onChange={(event) => setVehicle({ ...vehicle, fuelPerHour: event.target.value })} /></Field>
            </div>
            <Field label="Növbəti servis"><DateField value={vehicle.nextService} onChange={(nextService) => setVehicle({ ...vehicle, nextService })} /></Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setModal("")}>Ləğv et</button>
              <button className="btn" type="submit">Saxla</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "assign" && (
        <Modal title="Təyin et" onClose={() => setModal("")}>
          <form className="form" onSubmit={(event: FormEvent) => { event.preventDefault(); const message = assignVehicle(assign); setError(message); if (!message) setModal("") }}>
            <Field label="Yer"><Select value={assign.site} onValueChange={(site) => setAssign({ ...assign, site })} options={places.map((item) => ({ value: item, label: item }))} /></Field>
            <Field label="Vəziyyət">
              <Select value={assign.status} onValueChange={(status) => setAssign({ ...assign, status: status as AssignForm["status"] })} options={[{ value: "sahede", label: "Sahədə" }, { value: "bos", label: "Boş" }, { value: "icarede", label: "İcarə" }]} />
            </Field>
            <Field label="Sürücü"><Select value={assign.driverId} onValueChange={(driverId) => setAssign({ ...assign, driverId })} options={driverOptions} /></Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setModal("")}>Ləğv et</button>
              <button className="btn" type="submit">Təyin et</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "driver" && (
        <Modal title={driver.id ? "Sürücünü yaz" : "Sürücü aç"} onClose={() => setModal("")}>
          <form className="form" onSubmit={(event: FormEvent) => { event.preventDefault(); const message = saveDriver(driver); setError(message); if (!message) setModal("") }}>
            <Field label="Ad"><input value={driver.name} onChange={(event) => setDriver({ ...driver, name: event.target.value })} /></Field>
            <Field label="Telefon"><input value={driver.phone} onChange={(event) => setDriver({ ...driver, phone: event.target.value })} /></Field>
            <div className="split">
              <Field label="Vəsiqə"><input value={driver.license} onChange={(event) => setDriver({ ...driver, license: event.target.value })} /></Field>
              <Field label="Kateqoriya">
                <Select value={driver.category} onValueChange={(category) => setDriver({ ...driver, category })} options={["B", "C", "CE", "D"].map((item) => ({ value: item, label: item }))} />
              </Field>
            </div>
            <div className="split">
              <Field label="Bitmə"><DateField value={driver.expires} onChange={(expires) => setDriver({ ...driver, expires })} /></Field>
              <Field label="Vəziyyət">
                <Select value={driver.status} onValueChange={(status) => setDriver({ ...driver, status: status as DriverForm["status"] })} options={[{ value: "aktiv", label: "Aktiv" }, { value: "mezuniyyet", label: "Məzuniyyət" }, { value: "dayandirilib", label: "Dayandırılıb" }]} />
              </Field>
            </div>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setModal("")}>Ləğv et</button>
              <button className="btn" type="submit">Saxla</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "trip" && (
        <Modal title="Reys aç" onClose={() => setModal("")}>
          <form className="form" onSubmit={(event: FormEvent) => { event.preventDefault(); const message = openTrip(trip); setError(message); if (!message) setModal("") }}>
            <Field label="Texnika"><Select value={trip.assetId} onValueChange={(assetId) => setTrip({ ...trip, assetId })} options={assetOptions} /></Field>
            <Field label="Sürücü"><Select value={trip.driverId} onValueChange={(driverId) => setTrip({ ...trip, driverId })} options={activeDrivers} /></Field>
            <Field label="Layihə"><Select value={trip.project} onValueChange={(project) => setTrip({ ...trip, project })} options={projectOptions} /></Field>
            <div className="split">
              <Field label="Haradan"><Select value={trip.from} onValueChange={(from) => setTrip({ ...trip, from })} options={places.map((item) => ({ value: item, label: item }))} /></Field>
              <Field label="Haraya"><Select value={trip.to} onValueChange={(to) => setTrip({ ...trip, to })} options={places.map((item) => ({ value: item, label: item }))} /></Field>
            </div>
            <div className="split">
              <Field label="Yük"><input value={trip.cargo} onChange={(event) => setTrip({ ...trip, cargo: event.target.value })} /></Field>
              <Field label="Yürüş, km"><input type="number" min="0" step="1" value={trip.km} onChange={(event) => setTrip({ ...trip, km: event.target.value })} /></Field>
            </div>
            <Field label="Qeyd"><input value={trip.note} onChange={(event) => setTrip({ ...trip, note: event.target.value })} /></Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setModal("")}>Ləğv et</button>
              <button className="btn" type="submit">Aç</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "fuel" && (
        <Modal title="Yanacaq yaz" onClose={() => setModal("")}>
          <form className="form" onSubmit={(event: FormEvent) => { event.preventDefault(); const message = logFuel(fuel); setError(message); if (!message) setModal("") }}>
            <Field label="Texnika"><Select value={fuel.assetId} onValueChange={(assetId) => setFuel({ ...fuel, assetId })} options={assetOptions} /></Field>
            <Field label="Layihə"><Select value={fuel.project} onValueChange={(project) => setFuel({ ...fuel, project })} options={projectOptions} /></Field>
            <div className="split">
              <Field label="Litr"><input type="number" min="0" step="0.1" value={fuel.liters} onChange={(event) => setFuel({ ...fuel, liters: event.target.value })} /></Field>
              <Field label="Sayğac"><input type="number" min="0" step="1" value={fuel.reading} onChange={(event) => setFuel({ ...fuel, reading: event.target.value })} /></Field>
            </div>
            <Field label="Qeyd"><input value={fuel.note} onChange={(event) => setFuel({ ...fuel, note: event.target.value })} /></Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setModal("")}>Ləğv et</button>
              <button className="btn" type="submit">Yaz</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "doc" && (
        <Modal title="Sənəd yaz" onClose={() => setModal("")}>
          <form className="form" onSubmit={(event: FormEvent) => { event.preventDefault(); const message = saveFleetDoc(doc); setError(message); if (!message) setModal("") }}>
            <Field label="Texnika"><Select value={doc.assetId} onValueChange={(assetId) => setDoc({ ...doc, assetId })} options={assetOptions} /></Field>
            <Field label="Növ">
              <Select value={doc.kind} onValueChange={(kind) => setDoc({ ...doc, kind: kind as FleetDocForm["kind"] })} options={[{ value: "sigorta", label: "Sığorta" }, { value: "baxis", label: "Texniki baxış" }, { value: "qeydiyyat", label: "Qeydiyyat" }, { value: "icaze", label: "İcazə" }]} />
            </Field>
            <Field label="Nömrə"><input value={doc.number} onChange={(event) => setDoc({ ...doc, number: event.target.value })} /></Field>
            <Field label="Verən"><input value={doc.issuer} onChange={(event) => setDoc({ ...doc, issuer: event.target.value })} /></Field>
            <Field label="Bitmə"><DateField value={doc.expires} onChange={(expires) => setDoc({ ...doc, expires })} /></Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setModal("")}>Ləğv et</button>
              <button className="btn" type="submit">Yaz</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "service" && (
        <Modal title="Servisə al" onClose={() => setModal("")}>
          <form className="form" onSubmit={(event: FormEvent) => { event.preventDefault(); const message = openService(service); setError(message); if (!message) setModal("") }}>
            <Field label="Qeyd"><input value={service.note} onChange={(event) => setService({ ...service, note: event.target.value })} /></Field>
            <Field label="Ehtiyat hissə">
              <Select value={service.materialId} onValueChange={(materialId) => setService({ ...service, materialId })} options={[{ value: "", label: t("none") }, ...materials.map((item) => ({ value: item.id, label: item.name }))]} />
            </Field>
            <Field label="Miqdar"><input type="number" min="0" step="0.1" value={service.qty} onChange={(event) => setService({ ...service, qty: event.target.value })} /></Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setModal("")}>Ləğv et</button>
              <button className="btn" type="submit">Aç</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
