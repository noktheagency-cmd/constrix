import { DirectorRequestPanel } from './DirectorRequestPanel'
import { DataTable } from '../components/DataTable'
import { Button, Input, TableContainer, Toolbar } from "../components/primitives"
import { useEffect, useState, type FormEvent } from "react"
import { DateField } from "../DateField"
import { TODAY } from "../domain/ops"
import type { Gear, GearCategory, GearEvent, GearForm, MaterialRequest, Payable, PurchaseOrder, Quote, QuoteForm } from "../domain/types"
import { dateAZ, hit, money, num } from "../format"
import { Icon } from "../icons"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Badge, Drawer, Empty, Field, Modal, PageHead, Select, Tabs, useTitle } from "../ui"

const emptyPo = { supplier: "", materialId: "", qty: "", amount: "", eta: "2026-10-02" }
const emptyGear: GearForm = { name: "", category: "alet", place: "", qty: "1", unit: "ədəd", nextCheck: "2026-12-23" }
type Tab = "director" | "teleb" | "teklif" | "sifaris" | "borc" | "techizatci" | "reyestr" | "yoxlama"
type Shelf = "hamisi" | GearCategory
type Reading = { kind: Tab | "gear"; id: string } | null
const SHELVES: { id: Shelf; label: string }[] = [
  { id: "hamisi", label: "Hamısı" },
  { id: "masin", label: "Maşın" },
  { id: "avadanliq", label: "Avadanlıq" },
  { id: "levazimat", label: "Ləvazimat" },
  { id: "geyim", label: "Geyim" },
  { id: "alet", label: "Alət" },
  { id: "sair", label: "Digər" },
]
const CATEGORY_LABEL: Record<GearCategory, string> = {
  masin: "Maşın",
  avadanliq: "Avadanlıq",
  levazimat: "Ləvazimat",
  geyim: "Geyim",
  alet: "Alət",
  sair: "Digər",
}
const EVENT_LABEL = {
  yoxlama: "Yoxlamaya göndərildi",
  baslama: "Yoxlama açıldı",
  tesdiq: "Təsdiqləndi",
  bitdi: "Yoxlama bitdi",
  qaytarma: "Yoxlamadan qaytarıldı",
  deyisme: "Dəyişməyə yazıldı",
  qebul: "Yeni təchizat qəbul edildi",
  kohnelme: "Köhnəlmiş",
  itki: "İtki",
  acilis: "Reyestrə yazıldı",
}

function inCheck(item: Gear) {
  return item.status === "gonderildi" || item.status === "yoxlamada" || item.status === "tesdiq" || ((item.status === "istifade" || item.status === "anbarda") && item.nextCheck <= TODAY)
}

function checkIndex(item: Gear) {
  if (item.status === "gonderildi") return 1
  if (item.status === "yoxlamada") return 2
  if (item.status === "tesdiq") return 3
  if ((item.status === "istifade" || item.status === "anbarda") && item.nextCheck <= TODAY) return 0
  return -1
}

export default function Supply() {
  const { t } = usePrefs()
  useTitle(t("page.supply.title"))
  const {
    query, purchaseOrders, materials, requests, stocks, reservations, locations, quotes, payables, projects, gear, gearEvents, suppliers,
    addPurchase, receivePo, convertRequest, coverRequest, addQuote, awardQuote, payPayable, rejectRequest, createRequest, decideRequests, resubmitReturnedRequest, actor, reload:reloadBooks,
    addGear, sendGearCheck, startGearCheck, confirmGearCheck, finishGearCheck, returnGearCheck, replaceGear, acceptGear, obsoleteGear, loseGear,
  } = useStore()
  const [tab, setTab] = useState<Tab>(actor.role === "director" ? "director" : "teleb")
  const [shelf, setShelf] = useState<Shelf>("hamisi")
  const [reading, setReading] = useState<Reading>(null)
  const [composer, setComposer] = useState<"" | "teleb" | "teklif" | "sifaris" | "gear">("")
  const [form, setForm] = useState(emptyPo)
  const [demand, setDemand] = useState({ projectId: "", materialId: "", qty: "" })
  const [gearForm, setGearForm] = useState(emptyGear)
  const [note, setNote] = useState("")
  const [quote, setQuote] = useState<QuoteForm>({ requestId: "", supplier: suppliers[0]?.name || "", amount: "", days: "7" })
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [selectedRequests, setSelectedRequests] = useState<string[]>([])
  const [bulkFeedback, setBulkFeedback] = useState<{ succeeded: number; failed: number; issues: string[] } | null>(null)

  const orders = purchaseOrders.filter((item) => hit(query, item.id, item.supplier, item.item, item.status))
  const requestRows = requests.filter((item) => hit(query, item.id, item.project, item.material, item.text || "", item.author))
  const quoteRows = quotes.filter((item) => hit(query, item.id, item.supplier, item.requestId, item.status))
  const payableRows = payables.filter((item) => hit(query, item.id, item.supplier, item.poId, item.status))
  const vendorRows = suppliers.filter((item) => hit(query, item.name, item.category, item.city, item.contact))
  const openRequests = requests.filter((item) => item.status === "gozleyir" || item.status === "teklif" || item.status === "tesdiq")
  const pendingRequests = requestRows.filter((item) => item.status === "gozleyir" || item.status === "teklif")

  function away(item: MaterialRequest) {
    const eligibleIds = new Set(locations.filter((location) => !location.projectId).map((location) => location.id))
    const physical = stocks.filter((row) => row.materialId === item.materialId && eligibleIds.has(row.locationId)).reduce((sum, row) => sum + row.qty, 0)
    const held = reservations.filter((row) => row.materialId === item.materialId && eligibleIds.has(row.locationId) && row.status === "active").reduce((sum, row) => sum + row.qty, 0)
    return Math.max(0, physical - held)
  }

  function openReading(next: Reading) {
    setError("")
    setReason("")
    setNote("")
    setReading(next)
  }

  function act(message: string) {
    setError(message)
    return message
  }

  return (
    <>
      <PageHead kicker={t("page.supply.kicker")} title={t("page.supply.title")} text={t("page.supply.text")}>
        {tab === "reyestr" && (
          <Button type="button" onClick={() => { setError(""); setGearForm({ ...emptyGear, category: shelf !== "hamisi" ? shelf : "alet" }); setComposer("gear") }}>
            <Icon name="plus" /> Təchizat
          </Button>
        )}
        {tab === "teleb" && (
          <Button type="button" onClick={() => { setError(""); setDemand({ projectId: projects[0]?.id || "", materialId: materials[0]?.id || "", qty: "" }); setComposer("teleb") }}>
            <Icon name="plus" /> Tələb
          </Button>
        )}
        {tab === "teleb" && actor.role === "director" && pendingRequests.length > 0 && (
          <Button type="button" className="ghost" disabled={!selectedRequests.some((id) => pendingRequests.some((item) => item.id === id))} onClick={() => { void decideRequests(selectedRequests.filter((id) => pendingRequests.some((item) => item.id === id)), "approve").then((result) => result && setBulkFeedback({ succeeded: result.succeeded, failed: result.failed, issues: result.results.filter((row) => !row.ok).map((row) => `${row.id}: ${row.message}`) })) }}>
            Təsdiqlə ({selectedRequests.length})
          </Button>
        )}
        {tab === "teklif" && (
          <Button type="button" onClick={() => { setError(""); setQuote({ requestId: openRequests[0]?.id || "", supplier: suppliers[0]?.name || "", amount: "", days: "7" }); setComposer("teklif") }}>
            <Icon name="plus" /> Təklif
          </Button>
        )}
        {tab === "sifaris" && (
          <Button type="button" onClick={() => { setError(""); setForm({ ...emptyPo, supplier: suppliers[0]?.name || "", materialId: materials[0]?.id || "" }); setComposer("sifaris") }}>
            <Icon name="plus" /> Sifariş
          </Button>
        )}
      </PageHead>
      <Toolbar>
        <Tabs
          value={tab}
          onChange={(id) => { if(tab === "director")reloadBooks(); setTab(id as Tab); setReading(null); setError(""); setSelectedRequests([]) }}
          options={[
            ...(actor.role === "director" ? [{id:"director",label:"Rəhbər paneli"}] : []),
            { id: "teleb", label: "Tələb" },
            { id: "teklif", label: "Təklif" },
            { id: "sifaris", label: "Sifariş" },
            { id: "borc", label: "Borc" },
            { id: "techizatci", label: "Təchizatçı" },
            { id: "reyestr", label: "Reyestr" },
            { id: "yoxlama", label: "Yoxlama" },
          ]}
        />
      </Toolbar>
      {tab === "director" && actor.role === "director" && <DirectorRequestPanel />}
      {bulkFeedback && tab === "teleb" && <p className={bulkFeedback.failed ? "form-error" : "muted"}>{bulkFeedback.succeeded} təsdiqləndi · {bulkFeedback.failed} uğursuz{bulkFeedback.issues.length ? ` — ${bulkFeedback.issues.join("; ")}` : ""}</p>}
      {tab === "reyestr" && (
        <>
          <Toolbar>
            <Tabs
              value={shelf}
              onChange={(id) => { setShelf(id as Shelf); setReading(null); setError("") }}
              options={SHELVES}
            />
          </Toolbar>
          <TableContainer>
            <DataTable>
              <thead>
                <tr>
                  <th>Təchizat</th>
                  <th>Kateqoriya</th>
                  <th>Yer</th>
                  <th>Say</th>
                  <th>Yoxlama</th>
                  <th>Vəziyyət</th>
                </tr>
              </thead>
              <tbody>
                {gear
                  .filter((item) => shelf === "hamisi" || item.category === shelf)
                  .filter((item) => hit(query, item.name, item.place, item.id, CATEGORY_LABEL[item.category]))
                  .map((item) => (
                    <tr key={item.id} className="click" onClick={() => openReading({ kind: "gear", id: item.id })}>
                      <td>
                        <div className="name-cell">
                          <b>{item.name}</b>
                          <span className="mono">{item.id}</span>
                        </div>
                      </td>
                      <td>{CATEGORY_LABEL[item.category]}</td>
                      <td>{item.place}</td>
                      <td>{num(item.qty)} {item.unit}</td>
                      <td>{dateAZ(item.nextCheck)}</td>
                      <td><Badge status={item.status} /></td>
                    </tr>
                  ))}
              </tbody>
            </DataTable>
            {gear.filter((item) => shelf === "hamisi" || item.category === shelf).length === 0 && (
              <Empty title="Təchizat yoxdur" text="Bu kateqoriyada kart tapılmadı." />
            )}
          </TableContainer>
        </>
      )}

      {tab === "yoxlama" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>Təchizat</th>
                <th>Yer</th>
                <th>Tarix</th>
                <th>Proses</th>
              </tr>
            </thead>
            <tbody>
              {gear.filter(inCheck).filter((item) => hit(query, item.name, item.place, item.id)).map((item) => (
                <tr key={item.id} className="click" onClick={() => openReading({ kind: "gear", id: item.id })}>
                  <td>
                    <div className="name-cell">
                      <b>{item.name}</b>
                      <span className="muted">{CATEGORY_LABEL[item.category]}</span>
                    </div>
                  </td>
                  <td>{item.place}</td>
                  <td>{dateAZ(item.nextCheck)}</td>
                  <td className="track-cell">
                    <button type="button" className="track-btn" onClick={(event) => { event.stopPropagation(); openReading({ kind: "gear", id: item.id }) }}>
                      <Track labels={["Gözləyir", "Göndərildi", "Yoxlamada", "Təsdiq", "Bitdi"]} index={checkIndex(item)} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {gear.filter(inCheck).length === 0 && <Empty title="Yoxlama yoxdur" text="Vaxtı çatan və ya prosesdə olan təchizat burada durur." />}
        </TableContainer>
      )}

      {tab === "teleb" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>{actor.role === "director" && <input aria-label="Bütün açıq sorğuları seç" type="checkbox" checked={pendingRequests.length > 0 && pendingRequests.every((item) => selectedRequests.includes(item.id))} onChange={(event) => setSelectedRequests(event.target.checked ? pendingRequests.map((item) => item.id) : [])} />}</th>
                <th>Tələb</th>
                <th>Layihə</th>
                <th>Material</th>
                <th>Mətn</th>
                <th>Zəncir</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requestRows.map((item) => {
                const stock = away(item)
                return (
                  <tr key={item.id} className="click" onClick={() => openReading({ kind: "teleb", id: item.id })}>
                    <td onClick={(event) => event.stopPropagation()}>{actor.role === "director" && (item.status === "gozleyir" || item.status === "teklif") && <input aria-label={`${item.id} seç`} type="checkbox" checked={selectedRequests.includes(item.id)} onChange={(event) => setSelectedRequests((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />}</td>
                    <td>
                      <div className="name-cell">
                        <b>{item.id}</b>
                        <span className="muted">{dateAZ(item.date)}</span>
                      </div>
                    </td>
                    <td>{item.project}</td>
                    <td>{item.material} · {num(item.qty)} {item.unit}</td>
                    <td><div className="clip" title={item.text}>{item.text || "—"}</div></td>
                    <td className="track-cell">
                      <button type="button" className="track-btn" onClick={(event) => { event.stopPropagation(); openReading({ kind: "teleb", id: item.id }) }}>
                        <Chain request={item} quotes={quotes} orders={purchaseOrders} payables={payables} />
                      </button>
                    </td>
                    <td>
                      <div className="row-actions stay" onClick={(event) => event.stopPropagation()}>
                        {item.status === "tesdiq" && stock + 1e-9 >= item.qty && (
                          <Button type="button" className="small" onClick={() => act(coverRequest(item.id))}>Anbardan</Button>
                        )}
                        {item.status === "tesdiq" && stock + 1e-9 < item.qty && (
                          <Button type="button" className="ghost small" onClick={() => act(convertRequest(item.id))}>Sifarişə</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </DataTable>
          {requestRows.length === 0 && <Empty title="Tələb yoxdur" text="Axtarışa uyğun tələbnamə tapılmadı." />}
        </TableContainer>
      )}

      {tab === "teklif" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>Təklif</th>
                <th>Tələb</th>
                <th>Müddət</th>
                <th>Status</th>
                <th className="num">Məbləğ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {quoteRows.map((item) => {
                const request = requests.find((row) => row.id === item.requestId)
                return (
                  <tr key={item.id} className="click" onClick={() => openReading({ kind: "teklif", id: item.id })}>
                    <td>
                      <div className="name-cell">
                        <b>{item.supplier}</b>
                        <span className="mono">{item.id}</span>
                      </div>
                    </td>
                    <td>{item.requestId}{request ? ` · ${request.material}` : ""}</td>
                    <td>{item.days} gün</td>
                    <td><Badge status={item.status} /></td>
                    <td className="num">{money(item.amount)}</td>
                    <td>
                      {item.status === "acik" && (
                        <Button type="button" className="small" onClick={(event) => { event.stopPropagation(); act(awardQuote(item.id)) }}>Seç</Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </DataTable>
          {quoteRows.length === 0 && <Empty title="Təklif yoxdur" text="Açıq tələbə təchizatçı təklifi yazın." />}
        </TableContainer>
      )}

      {tab === "sifaris" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>Sifariş</th>
                <th>Material</th>
                <th>Miqdar</th>
                <th>Gəliş</th>
                <th>Zəncir</th>
                <th className="num">Məbləğ</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="click" onClick={() => openReading({ kind: "sifaris", id: order.id })}>
                  <td>
                    <div className="name-cell">
                      <b>{order.id}</b>
                      <span className="muted">{order.supplier}</span>
                    </div>
                  </td>
                  <td>{order.item}</td>
                  <td>{num(order.receivedQty || 0)} / {num(order.qty)} {order.unit}</td>
                  <td>{dateAZ(order.eta)}</td>
                  <td className="track-cell">
                    <button type="button" className="track-btn" onClick={(event) => { event.stopPropagation(); openReading({ kind: "sifaris", id: order.id }) }}>
                      <OrderChain order={order} payables={payables} />
                    </button>
                  </td>
                  <td className="num">{money(order.amount)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {orders.length === 0 && <Empty title="Sifariş yoxdur" text="Axtarışa uyğun satınalma tapılmadı." />}
        </TableContainer>
      )}

      {tab === "borc" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>Borc</th>
                <th>Sifariş</th>
                <th>Tarix</th>
                <th>Status</th>
                <th className="num">Məbləğ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payableRows.map((item) => (
                <tr key={item.id} className="click" onClick={() => openReading({ kind: "borc", id: item.id })}>
                  <td>
                    <div className="name-cell">
                      <b>{item.supplier}</b>
                      <span className="mono">{item.id}</span>
                    </div>
                  </td>
                  <td>{item.poId}</td>
                  <td>{dateAZ(item.date)}</td>
                  <td><Badge status={item.status} /></td>
                  <td className="num">{money(item.amount)}</td>
                  <td>
                    {item.status === "acik" && (
                      <Button type="button" className="small" onClick={(event) => { event.stopPropagation(); act(payPayable(item.id)) }}>Ödə</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {payableRows.length === 0 && <Empty title="Borc yoxdur" text="Qəbul edilmiş sifariş borc açır." />}
        </TableContainer>
      )}

      {tab === "techizatci" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>Təchizatçı</th>
                <th>Kateqoriya</th>
                <th>Şəhər</th>
                <th>Şərt</th>
                <th>Əlaqə</th>
                <th className="num">Reytinq</th>
              </tr>
            </thead>
            <tbody>
              {vendorRows.map((vendor) => (
                <tr key={vendor.id} className="click" onClick={() => openReading({ kind: "techizatci", id: vendor.id })}>
                  <td><b>{vendor.name}</b></td>
                  <td>{vendor.category}</td>
                  <td>{vendor.city}</td>
                  <td>{vendor.terms}</td>
                  <td>{vendor.contact}</td>
                  <td className="num">{vendor.rating}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {vendorRows.length === 0 && <Empty title="Təchizatçı tapılmadı" text="Axtarışı dəyişin." />}
        </TableContainer>
      )}

      {reading?.kind === "gear" && (
        <GearRead
          gear={gear.find((item) => item.id === reading.id)}
          events={gearEvents.filter((item) => item.gearId === reading.id)}
          note={note}
          error={error}
          onNote={setNote}
          onClose={() => setReading(null)}
          onCheck={(id) => act(sendGearCheck(id, note))}
          onStart={(id) => act(startGearCheck(id, note))}
          onConfirm={(id) => act(confirmGearCheck(id, note))}
          onFinish={(id) => act(finishGearCheck(id, note))}
          onReturn={(id) => act(returnGearCheck(id, note))}
          onReplace={(id) => act(replaceGear(id, note))}
          onAccept={(id) => act(acceptGear(id, note))}
          onObsolete={(id) => act(obsoleteGear(id, note))}
          onLose={(id) => act(loseGear(id, note))}
        />
      )}
      {reading?.kind === "teleb" && (
        <RequestRead
          request={requests.find((item) => item.id === reading.id)}
          stock={requests.find((item) => item.id === reading.id) ? away(requests.find((item) => item.id === reading.id)!) : 0}
          quotes={quotes.filter((item) => item.requestId === reading.id)}
          orders={purchaseOrders}
          payables={payables}
          reason={reason}
          error={error}
          onReason={setReason}
          onClose={() => setReading(null)}
          onCover={(id) => act(coverRequest(id))}
          onApprove={(id, qty) => { void decideRequests([id], "approve", "", qty ? { [id]: qty } : undefined) }}
          canApprove={actor.role === "director"}
          onOrder={(id) => act(convertRequest(id))}
          onReject={(id) => act(rejectRequest(id, reason))}
          onReturn={(id) => { void decideRequests([id], "return", reason) }}
          onCancel={(id) => { void decideRequests([id], "cancel", reason) }}
          canEditReturned={actor.name === requests.find((item) => item.id === reading.id)?.author || actor.role === "director"}
          onResubmit={(id, qty, text) => act(resubmitReturnedRequest(id, qty, text))}
          onAward={(id) => act(awardQuote(id))}
          onOpen={openReading}
        />
      )}
      {reading?.kind === "teklif" && (
        <QuoteRead
          quote={quotes.find((item) => item.id === reading.id)}
          request={requests.find((item) => item.id === quotes.find((row) => row.id === reading.id)?.requestId)}
          siblings={quotes.filter((item) => item.requestId === quotes.find((row) => row.id === reading.id)?.requestId)}
          error={error}
          onClose={() => setReading(null)}
          onAward={(id) => act(awardQuote(id))}
          onOpen={openReading}
        />
      )}
      {reading?.kind === "sifaris" && (
        <OrderRead
          order={purchaseOrders.find((item) => item.id === reading.id)}
          request={requests.find((item) => item.poId === reading.id || item.id === purchaseOrders.find((row) => row.id === reading.id)?.requestId)}
          bills={payables.filter((item) => item.poId === reading.id)}
          error={error}
          onClose={() => setReading(null)}
          onReceive={(id) => act(receivePo({ poId: id }))}
          onOpen={openReading}
        />
      )}
      {reading?.kind === "borc" && (
        <BillRead
          bill={payables.find((item) => item.id === reading.id)}
          order={purchaseOrders.find((item) => item.id === payables.find((row) => row.id === reading.id)?.poId)}
          error={error}
          onClose={() => setReading(null)}
          onPay={(id) => act(payPayable(id))}
          onOpen={openReading}
        />
      )}
      {reading?.kind === "techizatci" && (
        <VendorRead
          vendor={suppliers.find((item) => item.id === reading.id)}
          orders={purchaseOrders.filter((item) => item.supplier === suppliers.find((row) => row.id === reading.id)?.name)}
          quotes={quotes.filter((item) => item.supplier === suppliers.find((row) => row.id === reading.id)?.name)}
          bills={payables.filter((item) => item.supplier === suppliers.find((row) => row.id === reading.id)?.name)}
          onClose={() => setReading(null)}
          onOpen={openReading}
        />
      )}

      {composer === "teleb" && (
        <Modal title="Yeni tələb" onClose={() => setComposer("")}>
          <form className="form" onSubmit={(event) => {
            event.preventDefault()
            const message = createRequest(demand)
            setError(message)
            if (!message) setComposer("")
          }}>
            <Field label="Layihə">
              <Select value={demand.projectId} onValueChange={(projectId) => setDemand({ ...demand, projectId })} options={projects.map((item) => ({ value: item.id, label: item.name }))} />
            </Field>
            <Field label="Material">
              <Select value={demand.materialId} onValueChange={(materialId) => setDemand({ ...demand, materialId })} options={materials.map((item) => ({ value: item.id, label: item.name }))} />
            </Field>
            <Field label="Miqdar">
              <Input type="number" min="0" step="0.1" value={demand.qty} onChange={(event) => setDemand({ ...demand, qty: event.target.value })} />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <Button type="button" className="ghost" onClick={() => setComposer("")}>Ləğv et</Button>
              <Button  type="submit">Yaz</Button>
            </div>
          </form>
        </Modal>
      )}

      {composer === "teklif" && (
        <Modal title="Yeni təklif" onClose={() => setComposer("")}>
          <form className="form" onSubmit={(event: FormEvent) => {
            event.preventDefault()
            const message = addQuote(quote)
            setError(message)
            if (!message) setComposer("")
          }}>
            <Field label="Tələb">
              <Select value={quote.requestId} onValueChange={(requestId) => setQuote({ ...quote, requestId })} options={openRequests.map((item) => ({ value: item.id, label: `${item.id} · ${item.material}` }))} />
            </Field>
            <Field label="Təchizatçı">
              <Select value={quote.supplier} onValueChange={(supplier) => setQuote({ ...quote, supplier })} options={suppliers.map((vendor) => ({ value: vendor.name, label: vendor.name }))} />
            </Field>
            <Field label="Məbləğ, ₼">
              <Input type="number" min="1" value={quote.amount} onChange={(event) => setQuote({ ...quote, amount: event.target.value })} />
            </Field>
            <Field label="Müddət, gün">
              <Input type="number" min="1" value={quote.days} onChange={(event) => setQuote({ ...quote, days: event.target.value })} />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <Button type="button" className="ghost" onClick={() => setComposer("")}>Ləğv et</Button>
              <Button  type="submit">Yaz</Button>
            </div>
          </form>
        </Modal>
      )}

      {composer === "sifaris" && (
        <Modal title="Yeni sifariş" onClose={() => setComposer("")}>
          <form className="form" onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            const message = addPurchase(form)
            setError(message)
            if (!message) setComposer("")
          }}>
            <Field label="Təchizatçı">
              <Select value={form.supplier} onValueChange={(supplier) => setForm({ ...form, supplier })} options={suppliers.map((vendor) => ({ value: vendor.name, label: vendor.name }))} />
            </Field>
            <Field label="Material">
              <Select value={form.materialId} onValueChange={(materialId) => setForm({ ...form, materialId })} options={materials.map((item) => ({ value: item.id, label: item.name }))} />
            </Field>
            <Field label="Miqdar">
              <Input type="number" min="0" step="0.1" value={form.qty} onChange={(event) => setForm({ ...form, qty: event.target.value })} />
            </Field>
            <Field label="Məbləğ, ₼">
              <Input type="number" min="1" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
            </Field>
            <Field label="Gəliş tarixi">
              <DateField value={form.eta} onChange={(eta) => setForm({ ...form, eta })} />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <Button type="button" className="ghost" onClick={() => setComposer("")}>Ləğv et</Button>
              <Button  type="submit">Aç</Button>
            </div>
          </form>
        </Modal>
      )}
      {composer === "gear" && (
        <Modal title="Yeni təchizat" onClose={() => setComposer("")}>
          <form className="form" onSubmit={(event) => {
            event.preventDefault()
            const message = addGear(gearForm)
            setError(message)
            if (!message) setComposer("")
          }}>
            <Field label="Ad">
              <Input value={gearForm.name} onChange={(event) => setGearForm({ ...gearForm, name: event.target.value })} />
            </Field>
            <Field label="Kateqoriya">
              <Select
                value={gearForm.category}
                onValueChange={(category) => setGearForm({ ...gearForm, category: category as GearCategory })}
                options={(Object.keys(CATEGORY_LABEL) as GearCategory[]).map((id) => ({ value: id, label: CATEGORY_LABEL[id] }))}
              />
            </Field>
            <Field label="Yer">
              <Input value={gearForm.place} onChange={(event) => setGearForm({ ...gearForm, place: event.target.value })} />
            </Field>
            <Field label="Say">
              <Input type="number" min="0" step="1" value={gearForm.qty} onChange={(event) => setGearForm({ ...gearForm, qty: event.target.value })} />
            </Field>
            <Field label="Vahid">
              <Input value={gearForm.unit} onChange={(event) => setGearForm({ ...gearForm, unit: event.target.value })} />
            </Field>
            <Field label="Növbəti yoxlama">
              <DateField value={gearForm.nextCheck} onChange={(nextCheck) => setGearForm({ ...gearForm, nextCheck })} />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <Button type="button" className="ghost" onClick={() => setComposer("")}>Ləğv et</Button>
              <Button  type="submit">Yaz</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

function requestIndex(request: MaterialRequest, order?: PurchaseOrder, payable?: Payable) {
  if (request.status === "anbar") return { labels: ["Tələb", "Anbar"], index: 1 }
  if (request.status === "tesdiq") return { labels: ["Tələb", "Təsdiq", "Anbar"], index: 1 }
  if (payable?.status === "odenilib") return { labels: ["Tələb", "Təklif", "Sifariş", "Qəbul", "Ödəniş"], index: 4 }
  if (order?.status === "qebul") return { labels: ["Tələb", "Təklif", "Sifariş", "Qəbul", "Ödəniş"], index: 3 }
  if (request.status === "sifaris") return { labels: ["Tələb", "Təklif", "Sifariş", "Qəbul", "Ödəniş"], index: 2 }
  if (request.status === "teklif") return { labels: ["Tələb", "Təklif", "Sifariş", "Qəbul", "Ödəniş"], index: 1 }
  return { labels: ["Tələb", "Təklif", "Sifariş", "Qəbul", "Ödəniş"], index: 0 }
}

function Chain({ request, quotes, orders, payables }: { request: MaterialRequest; quotes: Quote[]; orders: PurchaseOrder[]; payables: Payable[] }) {
  if (request.status === "redd") return <Badge status="redd" />
  if (request.status === "qaytarildi") return <Badge status="qaytarildi" />
  const order = orders.find((item) => item.id === request.poId || item.requestId === request.id)
  const payable = payables.find((item) => item.poId === order?.id && item.status === "odenilib") || payables.find((item) => item.poId === order?.id)
  const awarded = quotes.some((item) => item.requestId === request.id && item.status === "secildi")
  const chain = requestIndex(request, order, payable)
  if (!awarded && request.status === "sifaris") {
    const labels = ["Tələb", "Sifariş", "Qəbul", "Ödəniş"]
    const index = payable?.status === "odenilib" ? 3 : order?.status === "qebul" ? 2 : 1
    return <Track labels={labels} index={index} />
  }
  return <Track labels={chain.labels} index={chain.index} />
}

function OrderChain({ order, payables }: { order: PurchaseOrder; payables: Payable[] }) {
  const payable = payables.find((item) => item.poId === order.id && item.status === "odenilib") || payables.find((item) => item.poId === order.id)
  const index = payable?.status === "odenilib" ? 3 : order.status === "qebul" ? 2 : order.status === "yoldadir" ? 1 : 0
  return <Track labels={["Təsdiq", "Yolda", "Qəbul", "Ödəniş"]} index={index} />
}

function Track({ labels, index }: { labels: string[]; index: number }) {
  return (
    <ol className="phases track">
      {labels.map((label, step) => (
        <li key={label} className={step < index ? "done" : step === index ? "current" : ""}>
          <i />
          <span>{label}</span>
        </li>
      ))}
    </ol>
  )
}

function RequestRead({
  request, stock, quotes, orders, payables, reason, error, onReason, onClose, onCover, onOrder, onReject, onReturn, onCancel, onApprove, canApprove, canEditReturned, onResubmit, onAward, onOpen,
}: {
  request?: MaterialRequest
  stock: number
  quotes: Quote[]
  orders: PurchaseOrder[]
  payables: Payable[]
  reason: string
  error: string
  onReason: (value: string) => void
  onClose: () => void
  onCover: (id: string) => void
  onOrder: (id: string) => void
  onReject: (id: string) => void
  onReturn: (id: string) => void
  onCancel: (id: string) => void
  onApprove: (id: string, qty?: string) => void
  canApprove: boolean
  canEditReturned: boolean
  onResubmit: (id: string, qty: string, text: string) => void
  onAward: (id: string) => void
  onOpen: (reading: Reading) => void
}) {
  const [approvedQty, setApprovedQty] = useState(request?.qty.toString() || "")
  const [editQty, setEditQty] = useState(request?.qty.toString() || "")
  const [editText, setEditText] = useState(request?.text || "")
  useEffect(() => { setApprovedQty(request?.qty.toString() || ""); setEditQty(request?.qty.toString() || ""); setEditText(request?.text || "") }, [request?.id, request?.qty, request?.text])
  if (!request) return null
  const order = orders.find((item) => item.id === request.poId || item.requestId === request.id)
  const canCover = request.status === "tesdiq" && stock + 1e-9 >= request.qty
  const canOrder = request.status === "tesdiq" && stock + 1e-9 < request.qty
  const canReject = canApprove && (request.status === "gozleyir" || request.status === "teklif")
  const canCancel = canApprove && request.status === "tesdiq" && !(request.fulfilledQty && request.fulfilledQty > 0)
  const canApproveRequest = canApprove && (request.status === "gozleyir" || request.status === "teklif")
  return (
    <Drawer className="supply-drawer" title={request.id} onClose={onClose}>
      <div className="supply-sheet">
        <Chain request={request} quotes={quotes} orders={orders} payables={payables} />
        <div className="supply-facts">
          <p>{request.project}</p>
           <p><b>{request.material}</b> · {num(request.qty)} {request.unit}{(request.fulfilledQty || 0) > 0 ? ` · sahəyə ${num(request.fulfilledQty || 0, 3)} verilib` : ""}</p>
          {canApproveRequest && <Field label={`Təsdiq miqdarı (${request.unit})`}><Input type="number" min="0.001" step="0.001" value={approvedQty} onChange={(event) => setApprovedQty(event.target.value)} /></Field>}
          <p className="muted">Ümumi anbarlarda sərbəst: {num(stock, stock % 1 ? 1 : 0)} {request.unit}. Yazıb: {request.author}, {dateAZ(request.date)}.</p>
          {request.text && <p>{request.text}</p>}
          {request.decision && <p className="muted">Qərar: {request.decision}{request.decidedBy ? ` · ${request.decidedBy}` : ""}</p>}
        </div>
        {request.status === "qaytarildi" && canEditReturned && (
          <form className="form supply-reject" onSubmit={(event) => { event.preventDefault(); onResubmit(request.id, editQty, editText) }}>
            <Field label={`Düzəliş edilmiş miqdar (${request.unit})`}><Input type="number" min="0.001" step="0.001" required value={editQty} onChange={(event) => setEditQty(event.target.value)} /></Field>
            <Field label="İzah"><Input value={editText} onChange={(event) => setEditText(event.target.value)} /></Field>
            <div className="form-actions"><Button type="submit">Düzəlişi göndər</Button></div>
          </form>
        )}
        {order && <Button type="button" className="ghost small" onClick={() => onOpen({ kind: "sifaris", id: order.id })}>{order.id} · {order.supplier}</Button>}
        {quotes.length > 0 && (
          <div className="supply-quotes">
            {quotes.map((item) => (
              <article key={item.id} className="supply-quote">
                <button type="button" className="text-btn" onClick={() => onOpen({ kind: "teklif", id: item.id })}>
                  <b>{item.supplier}</b>
                  <span>{item.days} gün · {money(item.amount)}</span>
                </button>
                <span className="supply-quote-actions">
                  <Badge status={item.status} />
                  {item.status === "acik" && <Button type="button" className="small" onClick={() => onAward(item.id)}>Seç</Button>}
                </span>
              </article>
            ))}
          </div>
        )}
        {(canApproveRequest || canCover || canOrder) && (
          <div className="supply-actions">
            {canApproveRequest && <Button type="button" onClick={() => onApprove(request.id, approvedQty)}>Rəhbər təsdiqi</Button>}
            {canCover && <Button type="button" onClick={() => onCover(request.id)}>Anbardan köçür</Button>}
            {canOrder && <Button type="button" onClick={() => onOrder(request.id)}>Birbaşa sifariş</Button>}
          </div>
        )}
        {(canReject || canCancel) && (
          <form className="form supply-reject" onSubmit={(event) => { event.preventDefault(); if (canReject) onReject(request.id); else onCancel(request.id) }}>
            <Field label="Qərar səbəbi">
              <Input value={reason} onChange={(event) => onReason(event.target.value)} />
            </Field>
            <div className="form-actions">
              {canReject && <><Button className="ghost" type="submit" disabled={!reason.trim()}>Rədd et</Button><Button className="ghost" type="button" disabled={!reason.trim()} onClick={() => onReturn(request.id)}>Düzəlişə qaytar</Button></>}
              {canCancel && <Button className="ghost" type="button" disabled={!reason.trim()} onClick={() => onCancel(request.id)}>Təsdiqi və rezervi ləğv et</Button>}
            </div>
          </form>
        )}
        {error && <p className="form-error">{error}</p>}
      </div>
    </Drawer>
  )
}

function QuoteRead({
  quote, request, siblings, error, onClose, onAward, onOpen,
}: {
  quote?: Quote
  request?: MaterialRequest
  siblings: Quote[]
  error: string
  onClose: () => void
  onAward: (id: string) => void
  onOpen: (reading: Reading) => void
}) {
  if (!quote) return null
  return (
    <Drawer className="supply-drawer" title={quote.supplier} onClose={onClose}>
      <p className="muted">{quote.id} · {quote.days} gün · {money(quote.amount)}</p>
      <Badge status={quote.status} />
      {request && (
        <p>
          <button type="button" className="text-btn" onClick={() => onOpen({ kind: "teleb", id: request.id })}>{request.id} · {request.material} · {num(request.qty)} {request.unit}</button>
        </p>
      )}
      {request?.text && <p>{request.text}</p>}
      <div className="mini-list">
        {siblings.map((item) => (
          <article key={item.id} className="split">
            <span><b>{item.supplier}</b> <span className="muted">· {item.days} gün · {money(item.amount)}</span></span>
            <Badge status={item.status} />
          </article>
        ))}
      </div>
      {quote.status === "acik" && <Button type="button" onClick={() => onAward(quote.id)}>Bu təklifi seç</Button>}
      {error && <p className="form-error">{error}</p>}
    </Drawer>
  )
}

function OrderRead({
  order, request, bills, error, onClose, onReceive, onOpen,
}: {
  order?: PurchaseOrder
  request?: MaterialRequest
  bills: Payable[]
  error: string
  onClose: () => void
  onReceive: (id: string) => void
  onOpen: (reading: Reading) => void
}) {
  if (!order) return null
  return (
    <Drawer className="supply-drawer" title={order.id} onClose={onClose}>
      <OrderChain order={order} payables={bills} />
      <p><b>{order.supplier}</b></p>
      <p>{order.item} · {num(order.receivedQty || 0)} / {num(order.qty)} {order.unit}</p>
      <p className="muted">Gəliş {dateAZ(order.eta)} · {money(order.amount)}. Qəbul mərkəzi anbara düşür və borc açır.</p>
      {request && <Button type="button" className="ghost small" onClick={() => onOpen({ kind: "teleb", id: request.id })}>{request.id}</Button>}
      {bills.map((item) => (
        <Button key={item.id} type="button" className="ghost small" onClick={() => onOpen({ kind: "borc", id: item.id })}>{item.id} · {money(item.amount)}</Button>
      ))}
      {order.status !== "qebul" && order.materialId && (
        <div className="form-actions">
          <Button type="button" onClick={() => onReceive(order.id)}>Qəbul et</Button>
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
    </Drawer>
  )
}

function BillRead({
  bill, order, error, onClose, onPay, onOpen,
}: {
  bill?: Payable
  order?: PurchaseOrder
  error: string
  onClose: () => void
  onPay: (id: string) => void
  onOpen: (reading: Reading) => void
}) {
  if (!bill) return null
  return (
    <Drawer className="supply-drawer" title={bill.id} onClose={onClose}>
      <p><b>{bill.supplier}</b> · {money(bill.amount)}</p>
      <p className="muted">{dateAZ(bill.date)}</p>
      <Badge status={bill.status} />
      {order && <p><button type="button" className="text-btn" onClick={() => onOpen({ kind: "sifaris", id: order.id })}>{order.id} · {order.item}</button></p>}
      {bill.status === "acik" && <Button type="button" onClick={() => onPay(bill.id)}>Ödə</Button>}
      {error && <p className="form-error">{error}</p>}
    </Drawer>
  )
}

function VendorRead({
  vendor, orders, quotes, bills, onClose, onOpen,
}: {
  vendor?: { id: string; name: string; category: string; city: string; terms: string; contact: string; rating: string }
  orders: PurchaseOrder[]
  quotes: Quote[]
  bills: Payable[]
  onClose: () => void
  onOpen: (reading: Reading) => void
}) {
  if (!vendor) return null
  return (
    <Drawer className="supply-drawer" title={vendor.name} onClose={onClose}>
      <p className="muted">{vendor.category} · {vendor.city} · {vendor.terms}</p>
      <p>{vendor.contact} · reytinq {vendor.rating}</p>
      <h3 className="block-title">Sifariş</h3>
      {orders.length === 0 && <p className="muted">Sifariş yoxdur.</p>}
      {orders.map((item) => (
        <p key={item.id}><button type="button" className="text-btn" onClick={() => onOpen({ kind: "sifaris", id: item.id })}>{item.id} · {item.item} · {money(item.amount)}</button></p>
      ))}
      <h3 className="block-title">Təklif</h3>
      {quotes.length === 0 && <p className="muted">Təklif yoxdur.</p>}
      {quotes.map((item) => (
        <p key={item.id}><button type="button" className="text-btn" onClick={() => onOpen({ kind: "teklif", id: item.id })}>{item.id} · {money(item.amount)} · {item.days} gün</button></p>
      ))}
      <h3 className="block-title">Borc</h3>
      {bills.length === 0 && <p className="muted">Borc yoxdur.</p>}
      {bills.map((item) => (
        <p key={item.id}><button type="button" className="text-btn" onClick={() => onOpen({ kind: "borc", id: item.id })}>{item.id} · {money(item.amount)}</button></p>
      ))}
    </Drawer>
  )
}

function GearRead({
  gear, events, note, error, onNote, onClose, onCheck, onStart, onConfirm, onFinish, onReturn, onReplace, onAccept, onObsolete, onLose,
}: {
  gear?: Gear
  events: GearEvent[]
  note: string
  error: string
  onNote: (value: string) => void
  onClose: () => void
  onCheck: (id: string) => string
  onStart: (id: string) => string
  onConfirm: (id: string) => string
  onFinish: (id: string) => string
  onReturn: (id: string) => string
  onReplace: (id: string) => string
  onAccept: (id: string) => string
  onObsolete: (id: string) => string
  onLose: (id: string) => string
}) {
  if (!gear) return null
  const closed = gear.status === "itki" || gear.status === "kohnelmis"
  const checking = gear.status === "gonderildi" || gear.status === "yoxlamada" || gear.status === "tesdiq"
  const index = checkIndex(gear)
  return (
    <Drawer className="supply-drawer" title={gear.name} onClose={onClose}>
      <p className="muted">{gear.id} · {CATEGORY_LABEL[gear.category]} · {gear.place}</p>
      <p>{num(gear.qty)} {gear.unit}</p>
      <p>Növbəti yoxlama {dateAZ(gear.nextCheck)}</p>
      {index >= 0 ? <Track labels={["Gözləyir", "Göndərildi", "Yoxlamada", "Təsdiq", "Bitdi"]} index={index} /> : <Badge status={gear.status} />}
      {!closed && (
        <form className="form" onSubmit={(event) => event.preventDefault()}>
          <Field label="Qeyd">
            <Input value={note} onChange={(event) => onNote(event.target.value)} />
          </Field>
          <div className="form-actions">
            {(gear.status === "istifade" || gear.status === "anbarda") && (
              <Button type="button" onClick={() => onCheck(gear.id)}>Yoxlamaya göndər</Button>
            )}
            {gear.status === "gonderildi" && (
              <Button type="button" onClick={() => onStart(gear.id)}>Yoxlamanı aç</Button>
            )}
            {gear.status === "yoxlamada" && (
              <Button type="button" onClick={() => onConfirm(gear.id)}>Təsdiqlə</Button>
            )}
            {gear.status === "tesdiq" && (
              <Button type="button" onClick={() => onFinish(gear.id)}>Yoxlama bitdi</Button>
            )}
            {checking && (
              <Button type="button" className="ghost" onClick={() => onReturn(gear.id)}>Qaytar</Button>
            )}
            {gear.status === "deyisme" && (
              <Button type="button" onClick={() => onAccept(gear.id)}>Dəyişməni qəbul et</Button>
            )}
            {!checking && gear.status !== "deyisme" && (
              <Button type="button" className="ghost" onClick={() => onReplace(gear.id)}>Dəyiş</Button>
            )}
            {!checking && (
              <>
                <Button type="button" className="ghost" onClick={() => onObsolete(gear.id)}>Köhnəlmiş</Button>
                <Button type="button" className="ghost" onClick={() => onLose(gear.id)}>İtki</Button>
              </>
            )}
          </div>
        </form>
      )}
      {error && <p className="form-error">{error}</p>}
      <h3 className="block-title">Jurnal</h3>
      {events.length === 0 && <p className="muted">Hələ hərəkət yoxdur.</p>}
      <div className="mini-list">
        {events.map((item) => (
          <article key={item.id}>
            <b>{EVENT_LABEL[item.kind]}</b>
            <p className="muted">{dateAZ(item.date)} · {item.by}</p>
            <p>{item.note}</p>
          </article>
        ))}
      </div>
    </Drawer>
  )
}
