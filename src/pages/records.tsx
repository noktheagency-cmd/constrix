import { useEffect, useState } from "react"
import { ApiError, api, dec } from "../api"
import { PageHead, Select, useTitle } from "../ui"

const STATUSES = [
  { value: "qaralama", label: "Qaralama" },
  { value: "teqdim", label: "Təqdim olundu" },
  { value: "yoxlanir", label: "Yoxlanır" },
  { value: "elave", label: "Əlavə sənəd" },
  { value: "qiymet", label: "Qiymətləndirmə" },
  { value: "imtina", label: "İmtina" },
  { value: "tesdiq", label: "Bankın və ya sığortaçının təsdiqi" },
]

type Partner = { id: string; kind: string; name: string }
type Offer = { id: string; name: string; partner: string; rate: unknown; commission: unknown; termDays: number | null }
type Application = { id: string; kind: string; status: string; amount: unknown; purpose: string; partner: { name: string } | null; events: { id: string; status: string; note: string; at: string }[] }

export function InsurancePage() {
  useTitle("Sığorta")
  const [partners, setPartners] = useState<Partner[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [apps, setApps] = useState<Application[]>([])
  const [form, setForm] = useState({ partnerId: "", amount: "", purpose: "", object: "", gear: "", workers: "", consent: false })
  const [product, setProduct] = useState({ partnerId: "", name: "", rate: "", termDays: "" })
  const [note, setNote] = useState("")

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
    if (!product.partnerId || !product.name.trim()) return
    try {
      await api("/api/platform/finance/products", {
        method: "POST",
        body: JSON.stringify({ ...product, line: "sigorta", confirmed: true, validUntil: "2027-12-31" }),
      })
      setNote("Təklif bazada saxlandı.")
      await compare()
    } catch (reason) {
      setNote(reason instanceof ApiError ? reason.message : "Təklif saxlanmadı")
    }
  }

  async function apply() {
    if (!form.partnerId) {
      setNote("Sığorta şirkəti seçilməlidir.")
      return
    }
    if (!form.consent) {
      setNote("Sənəd paketi yalnız şirkətin razılığı ilə hazırlanır.")
      return
    }
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
      setNote("Müraciət paketi bazada saxlandı. Sığortaçının sisteminə göndərilmir.")
    } catch (reason) {
      setNote(reason instanceof ApiError ? reason.message : "Müraciət saxlanmadı")
    }
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

  return (
    <>
      <PageHead kicker="Sığorta" title="Sığorta müraciəti" text="Hər sığortaçı ayrıca tərəfdaşdır. Paket obyekt, texnika və işçiləri saxlayır. Təsdiqli təkliflər müqayisə olunur. Qərarı sığortaçı verir." />
      <section className="panel pad">
        <div className="form-row wide">
          <label>Sığortaçı<Select value={form.partnerId} onValueChange={(partnerId) => setForm({ ...form, partnerId })} options={[{ value: "", label: "Seçilməyib" }, ...partners.map((item) => ({ value: item.id, label: item.name }))]} /></label>
          <label>Məbləğ, AZN<input value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
          <label>Məqsəd<input value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} /></label>
          <label>Obyekt<input value={form.object} onChange={(event) => setForm({ ...form, object: event.target.value })} /></label>
          <label>Texnika<input value={form.gear} onChange={(event) => setForm({ ...form, gear: event.target.value })} /></label>
          <label>İşçilər<input value={form.workers} onChange={(event) => setForm({ ...form, workers: event.target.value })} /></label>
          <label>Şirkət razılığı<input type="checkbox" checked={form.consent} onChange={(event) => setForm({ ...form, consent: event.target.checked })} /></label>
          <button type="button" className="btn" onClick={() => void apply()}>Paketi saxla</button>
          <button type="button" className="btn" onClick={() => void compare()}>Təklifləri müqayisə et</button>
        </div>
        <h2 className="block-title">Təsdiqli təklif</h2>
        <div className="form-row wide">
          <label>Sığortaçı<Select value={product.partnerId} onValueChange={(partnerId) => setProduct({ ...product, partnerId })} options={[{ value: "", label: "Seçilməyib" }, ...partners.map((item) => ({ value: item.id, label: item.name }))]} /></label>
          <label>Təklif<input value={product.name} onChange={(event) => setProduct({ ...product, name: event.target.value })} /></label>
          <label>Tarif, %<input value={product.rate} onChange={(event) => setProduct({ ...product, rate: event.target.value })} /></label>
          <label>Müddət, gün<input value={product.termDays} onChange={(event) => setProduct({ ...product, termDays: event.target.value })} /></label>
          <button type="button" className="btn" onClick={() => void addProduct()}>Təklifi saxla</button>
        </div>
        {offers.map((row) => <div className="step-row" key={row.id}><span>{row.partner} · {row.name}</span><strong>{dec(row.rate) || "tarif yoxdur"}% · {row.termDays ?? "müddət yoxdur"} gün</strong></div>)}
        <h2 className="block-title">Müraciətlər</h2>
        {apps.length === 0 && <p className="lede">Müraciət yoxdur.</p>}
        {apps.map((row) => (
          <div className="form-row" key={row.id}>
            <span>{row.partner?.name || "Şirkət seçilməyib"} · {row.purpose} · {dec(row.amount)} AZN · {(row.events || []).map((event) => event.status).join(" → ") || "tarixçə yoxdur"}</span>
            <Select value={row.status} onValueChange={(next) => void status(row.id, next)} options={STATUSES} />
          </div>
        ))}
        {note && <p className="lede">{note}</p>}
      </section>
    </>
  )
}
