import { PartnerMark } from "../components/PartnerMark"
import { ToneBadge } from "../components/ToneBadge"
import { Button, Input, SearchInput, TableContainer, Toolbar } from "../components/primitives"
import { useEffect, useState } from "react"
import { ApiError, api, dec } from "../api"
import { Icon } from "../icons"
import { Checkbox } from "../components/Checkbox"
import { money, dateAZ } from "../format"
import { Empty, Modal, PageHead, Select, Tabs, useTitle } from "../ui"

const STATUSES = [
  { value: "qaralama", label: "Qaralama" },
  { value: "teqdim", label: "Təqdim olundu" },
  { value: "yoxlanir", label: "Yoxlanır" },
  { value: "elave", label: "Əlavə sənəd" },
  { value: "qiymet", label: "Qiymətləndirmə" },
  { value: "imtina", label: "İmtina" },
  { value: "tesdiq", label: "Təsdiq" },
]

type Partner = { id: string; kind: string; name: string; logo?: string }
type Offer = { id: string; name: string; partner: string; rate: unknown; commission: unknown; termDays: number | null; partnerLogo?: string }
type Application = { id: string; kind: string; status: string; amount: unknown; purpose: string; partner: { name: string; logo?: string } | null; events: { id: string; status: string; note: string; at: string }[] }

export function InsurancePage() {
  useTitle("Sığorta")
  const [partners, setPartners] = useState<Partner[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [apps, setApps] = useState<Application[]>([])
  const [form, setForm] = useState({ partnerId: "", amount: "", purpose: "", object: "", gear: "", workers: "", consent: false })
  const [product, setProduct] = useState({ partnerId: "", name: "", rate: "", termDays: "" })
  const [note, setNote] = useState("")
  const [view, setView] = useState("applications")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("all")
  const [selected, setSelected] = useState("")
  const [compose, setCompose] = useState<"application" | "product" | null>(null)
  const [busy, setBusy] = useState(false)

  function reload() {
    return Promise.all([
      api<Partner[]>("/api/platform/finance/partners"),
      api<Application[]>("/api/platform/finance/applications"),
    ]).then(([all, applications]) => {
      setPartners(all.filter((item) => item.kind === "sigorta"))
      setApps(applications.filter((item) => item.kind === "sigorta"))
    })
  }

  useEffect(() => {
    reload().catch((reason) => setNote(reason instanceof ApiError ? reason.message : "Sığorta oxunmadı"))
    api<{rows:Offer[]}>("/api/platform/finance/products/compare?line=sigorta").then((result) => setOffers(result.rows)).catch(() => undefined)
  }, [])

  async function compare() {
    try {
      const result = await api<{ rows: Offer[] }>("/api/platform/finance/products/compare?line=sigorta")
      setOffers(result.rows)
      setNote(result.rows.length ? "Təsdiqli təkliflər göstərilir." : "Təsdiqli sığorta təklifi yoxdur.")
    } catch (reason) {
      setNote(reason instanceof ApiError ? reason.message : "Müqayisə alınmadı")
    }
  }

  async function addProduct() {
    if (busy || !product.partnerId || !product.name.trim()) return
    setBusy(true)
    try {
      await api("/api/platform/finance/products", {
        method: "POST",
        body: JSON.stringify({ ...product, line: "sigorta", confirmed: true, validUntil: "2027-12-31" }),
      })
      setNote("Təklif bazada saxlandı.")
      await compare()
      setCompose(null)
      setProduct({partnerId:"",name:"",rate:"",termDays:""})
    } catch (reason) {
      setNote(reason instanceof ApiError ? reason.message : "Təklif saxlanmadı")
    } finally {setBusy(false)}
  }

  async function apply() {
    if(busy) return
    if (!form.partnerId) {
      setNote("Sığorta şirkəti seçilməlidir.")
      return
    }
    if (!form.consent) {
      setNote("Sənəd paketi yalnız şirkətin razılığı ilə hazırlanır.")
      return
    }
    setBusy(true)
    try {
      await api("/api/platform/finance/applications", {
        method: "POST",
        body: JSON.stringify({
          consent: true,
          kind: "sigorta",
          partnerId: form.partnerId,
          amount: form.amount,
          purpose: form.purpose || "Sığorta müraciəti",
          payload: { object: form.object, gear: form.gear, workers: form.workers },
        }),
      })
      await reload()
      setCompose(null)
      setView("applications")
      setForm({partnerId:"",amount:"",purpose:"",object:"",gear:"",workers:"",consent:false})
      setNote("Müraciət paketi bazada saxlandı. Sığortaçının sisteminə göndərilmir.")
    } catch (reason) {
      setNote(reason instanceof ApiError ? reason.message : "Müraciət saxlanmadı")
    } finally {setBusy(false)}
  }

  async function status(id: string, next: string) {
    try {
      await api(`/api/platform/finance/applications/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: next, note: "Əl ilə yazılan cavab" }),
      })
      await reload()
    } catch (reason) {
      setNote(reason instanceof ApiError ? reason.message : "Status saxlanmadı")
    }
  }

  const selectedPartner = partners.find((item) => item.id === (compose === "application" ? form.partnerId : product.partnerId))
  const active = apps.find((item) => item.id === selected)
  const shown = apps.filter((row) => (filter === "all" || row.status === filter) && `${row.purpose} ${row.partner?.name || ""}`.toLocaleLowerCase("az").includes(query.trim().toLocaleLowerCase("az")))
  const shownOffers = offers.filter((row) => `${row.name} ${row.partner}`.toLocaleLowerCase("az").includes(query.trim().toLocaleLowerCase("az")))
  return <div className="finance-simple insurance-workspace">
    <PageHead title="Sığorta" text="Müraciətləri və sığorta təkliflərini idarə edin."><Button onClick={() => {setNote("");setCompose(view === "applications" ? "application" : "product")}}><Icon name="plus" />{view === "applications" ? "Yeni müraciət" : "Yeni təklif"}</Button></PageHead>
    <p className="finance-list-count">{apps.length} müraciət · {partners.length} sığortaçı · {offers.length} təklif</p>
    <Tabs value={view} onChange={(next) => {setView(next);setQuery("")}} options={[{id:"applications",label:"Müraciətlər"},{id:"offers",label:"Təkliflər"}]} />
    <Toolbar className="finance-list-toolbar"><SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder={view === "applications" ? "Müraciət axtar" : "Təklif axtar"} />{view === "applications" ? <Select ariaLabel="Müraciət statusu" value={filter} onValueChange={setFilter} options={[{value:"all",label:"Bütün statuslar"},...STATUSES]} /> : <Button className="ghost" onClick={() => void compare()}>Təklifləri yenilə</Button>}</Toolbar>
    {note && !compose && <p className="lede" role="status">{note}</p>}
    {view === "applications" ? <TableContainer className="finance-records-table"><table><thead><tr><th>Məqsəd</th><th>Sığortaçı</th><th>Məbləğ, AZN</th><th>Status</th><th><span className="sr-only">Detala bax</span></th></tr></thead><tbody>{shown.map((row) => <tr key={row.id} tabIndex={0} onClick={() => setSelected(row.id)} onKeyDown={(event) => {if(event.key === "Enter" || event.key === " "){event.preventDefault();setSelected(row.id)}}}><td><strong>{row.purpose}</strong><small>{row.events[0]?.at ? dateAZ(row.events[0].at.slice(0,10)) : "Tarix yazılmayıb"}</small></td><td><span className="partner-name"><PartnerMark name={row.partner?.name || "Seçilməyib"} logo={row.partner?.logo} /><span>{row.partner?.name || "Seçilməyib"}</span></span></td><td className="num">{money(Number(row.amount)||0)}</td><td><ToneBadge tone={applicationTone(row.status)}>{STATUSES.find((item) => item.value === row.status)?.label || row.status}</ToneBadge></td><td><Icon name="chevron" /></td></tr>)}</tbody></table>{!shown.length && <Empty title="Müraciət tapılmadı" text="Filtri dəyişin və ya yeni müraciət əlavə edin." />}</TableContainer> : <TableContainer className="finance-records-table"><table><thead><tr><th>Təklif</th><th>Sığortaçı</th><th>Tarif</th><th>Komissiya</th><th>Müddət</th></tr></thead><tbody>{shownOffers.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td><span className="partner-name"><PartnerMark name={row.partner} logo={row.partnerLogo || partners.find((item) => item.name === row.partner)?.logo} /><span>{row.partner}</span></span></td><td>{row.rate == null ? "—" : `${dec(row.rate)}%`}</td><td>{row.commission == null ? "—" : `${dec(row.commission)}%`}</td><td>{row.termDays == null ? "—" : `${row.termDays} gün`}</td></tr>)}</tbody></table>{!shownOffers.length && <Empty title="Təklif tapılmadı" text="Təsdiqli sığorta təklifləri burada görünür." />}</TableContainer>}
    {active && <Modal title={active.purpose} className="finance-record-modal" onClose={() => setSelected("")}><dl className="finance-breakdown"><div><dt>Sığortaçı</dt><dd><span className="partner-name"><PartnerMark name={active.partner?.name || "Seçilməyib"} logo={active.partner?.logo} /><span>{active.partner?.name || "Seçilməyib"}</span></span></dd></div><div><dt>Məbləğ</dt><dd>{money(Number(active.amount)||0)}</dd></div></dl><label className="finance-status-edit">Müraciət statusu<Select value={active.status} onValueChange={(next) => void status(active.id,next)} options={STATUSES} /></label><h3 className="finance-history-title">Status tarixçəsi</h3><div className="finance-history">{active.events.map((event) => <div key={event.id}><ToneBadge tone={applicationTone(event.status)}>{STATUSES.find((item) => item.value === event.status)?.label || event.status}</ToneBadge><small>{dateAZ(event.at.slice(0,10))}</small><p>{event.note || "Qeyd yoxdur"}</p></div>)}</div></Modal>}
    {compose && <Modal title={compose === "application" ? "Yeni sığorta müraciəti" : "Yeni sığorta təklifi"} className="finance-record-modal" onClose={() => {if(!busy)setCompose(null)}}><form onSubmit={(event) => {event.preventDefault();void (compose === "application" ? apply() : addProduct())}}>{selectedPartner && <div className="insurance-partner-preview partner-name"><PartnerMark name={selectedPartner.name} logo={selectedPartner.logo} /><strong>{selectedPartner.name}</strong></div>}<div className="finance-form-grid">
      {compose === "application" ? <>
        <label className="full">Sığortaçı<Select value={form.partnerId} onValueChange={(partnerId) => setForm({...form,partnerId})} options={[{value:"",label:"Sığortaçı seçin"},...partners.map((item) => ({value:item.id,label:item.name}))]} /></label><label>Məbləğ, AZN<Input required inputMode="decimal" value={form.amount} onChange={(event) => setForm({...form,amount:event.target.value})} /></label><label>Məqsəd<Input required value={form.purpose} onChange={(event) => setForm({...form,purpose:event.target.value})} /></label><label className="full">Obyekt<Input value={form.object} onChange={(event) => setForm({...form,object:event.target.value})} /></label><label>Texnika<Input value={form.gear} onChange={(event) => setForm({...form,gear:event.target.value})} /></label><label>İşçilər<Input value={form.workers} onChange={(event) => setForm({...form,workers:event.target.value})} /></label><Checkbox className="full" label="Şirkət sənəd paketinin hazırlanmasına razıdır" checked={form.consent} onChange={(event) => setForm({...form,consent:event.target.checked})} />
      </> : <><label className="full">Sığortaçı<Select value={product.partnerId} onValueChange={(partnerId) => setProduct({...product,partnerId})} options={[{value:"",label:"Sığortaçı seçin"},...partners.map((item) => ({value:item.id,label:item.name}))]} /></label><label className="full">Təklifin adı<Input required value={product.name} onChange={(event) => setProduct({...product,name:event.target.value})} /></label><label>Tarif, %<Input value={product.rate} onChange={(event) => setProduct({...product,rate:event.target.value})} /></label><label>Müddət, gün<Input value={product.termDays} onChange={(event) => setProduct({...product,termDays:event.target.value})} /></label></>}
    </div>{note && <p className="form-error" role="alert">{note}</p>}<div className="form-actions"><Button className="ghost" disabled={busy} onClick={() => setCompose(null)}>Ləğv et</Button><Button type="submit" disabled={busy}>{busy ? "Saxlanılır…" : compose === "application" ? "Paketi saxla" : "Təklifi saxla"}</Button></div></form></Modal>}
  </div>
}

function applicationTone(status:string) {
  if(status === "tesdiq") return "pine"
  if(status === "imtina") return "rose"
  if(status === "elave" || status === "yoxlanir" || status === "qiymet") return "gold"
  if(status === "teqdim") return "copper"
  return "stone"
}
