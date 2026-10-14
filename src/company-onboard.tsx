import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ApiError, api } from "./api"
import { loadAccountOrgs } from "./orgs"
import { KINDS, kindLabel, type Company, type CompanyKind } from "./procure/engine"
import { patchProcure, stamp } from "./procure/store"
import { useTitle } from "./ui"

const STEPS = ["Növ", "Şirkət", "Ünvan", "İmkan"]
const KINDS_PUBLIC = KINDS.filter(([value]) => value !== "admin")

export type CompanyDraft = Omit<Company, "id">

export function emptyCompany(seed?: Partial<CompanyDraft>): CompanyDraft {
  return {
    kind: "tikinti",
    name: "",
    voen: "",
    phone: "",
    email: "",
    director: "",
    legalAddress: "",
    actualAddress: "",
    capacity: "",
    warehouse: "",
    regions: "",
    warranty: "",
    reliability: "",
    ...seed,
  }
}

export function adoptOrg(org: {
  id: string
  kind: string
  name: string
  voen: string
  phone: string
  email: string
  director: string
  legalAddress: string
  actualAddress: string
  capacity: string
  warehouse: string
  regions: string
  warranty: string
  reliability: number | null
}) {
  const known = KINDS.some(([value]) => value === org.kind)
  const company: Company = {
    id: org.id,
    kind: (known ? org.kind : "tikinti") as CompanyKind,
    name: org.name,
    voen: org.voen,
    phone: org.phone,
    email: org.email,
    director: org.director,
    legalAddress: org.legalAddress,
    actualAddress: org.actualAddress,
    capacity: org.capacity,
    warehouse: org.warehouse,
    regions: org.regions,
    warranty: org.warranty,
    reliability: org.reliability == null ? "" : String(org.reliability),
  }
  patchProcure((current) => ({
    ...current,
    actor: company.name,
    activeId: company.id,
    companies: current.companies.some((item) => item.id === company.id)
      ? current.companies.map((item) => (item.id === company.id ? company : item))
      : [company, ...current.companies],
  }))
}

export function openCompany(form: CompanyDraft) {
  const company: Company = { ...form, name: form.name.trim(), id: crypto.randomUUID() }
  patchProcure((current) => ({
    ...current,
    actor: company.name,
    activeId: company.id,
    companies: [...current.companies, company],
    audit: [...current.audit, stamp(current, "Şirkət açıldı", `${company.name} · ${kindLabel(company.kind)}`)],
  }))
}

export function CompanyOnboard({
  initial,
  onDone,
  onSkip,
  persist = "local",
}: {
  initial?: Partial<CompanyDraft>
  onDone: () => void
  onSkip: () => void
  persist?: "local" | "api"
}) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<CompanyDraft>(() => emptyCompany(initial))
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  function set<K extends keyof CompanyDraft>(key: K, value: CompanyDraft[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function finish() {
    if (!form.name.trim()) {
      setError("Şirkətin adı yazılmalıdır.")
      setStep(1)
      return
    }
    if (persist === "local") {
      openCompany(form)
      onDone()
      return
    }
    setPending(true)
    setError("")
    try {
      await api("/api/platform/organizations", {
        method: "POST",
        body: JSON.stringify({
          kind: form.kind,
          name: form.name.trim(),
          voen: form.voen,
          phone: form.phone,
          email: form.email,
          director: form.director,
          legalAddress: form.legalAddress,
          actualAddress: form.actualAddress,
          regions: form.regions,
          capacity: form.capacity,
          warehouse: form.warehouse,
          warranty: form.warranty,
        }),
      })
      await loadAccountOrgs()
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Şirkət yazılmadı")
      setPending(false)
    }
  }

  return (
    <div className="onboard">
      <div className="onboard-steps">
        {STEPS.map((label, index) => (
          <span key={label} className={index === step ? "on" : index < step ? "done" : ""}>{index + 1}. {label}</span>
        ))}
      </div>
      {step === 0 && (
        <div className="kind-grid">
          {KINDS_PUBLIC.map(([value, label]) => (
            <button key={value} type="button" className={form.kind === value ? "kind-pick on" : "kind-pick"} onClick={() => set("kind", value as CompanyKind)}>
              {label}
            </button>
          ))}
        </div>
      )}
      {step === 1 && (
        <div className="onboard-fields">
          <label>Şirkətin adı<input value={form.name} onChange={(event) => set("name", event.target.value)} /></label>
          <label>VÖEN<input value={form.voen} onChange={(event) => set("voen", event.target.value)} /></label>
          <label>Telefon<input value={form.phone} onChange={(event) => set("phone", event.target.value)} /></label>
          <label>E-poçt<input type="email" value={form.email} onChange={(event) => set("email", event.target.value)} /></label>
          <label>Məsul şəxs<input value={form.director} onChange={(event) => set("director", event.target.value)} /></label>
        </div>
      )}
      {step === 2 && (
        <div className="onboard-fields">
          <label>Hüquqi ünvan<input value={form.legalAddress} onChange={(event) => set("legalAddress", event.target.value)} /></label>
          <label>Faktiki ünvan<input value={form.actualAddress} onChange={(event) => set("actualAddress", event.target.value)} /></label>
          <label>Ərazi<input value={form.regions} onChange={(event) => set("regions", event.target.value)} placeholder="şəhər və ya region" /></label>
        </div>
      )}
      {step === 3 && (
        <div className="onboard-fields">
          <p className="lede">İstehsalçı, montaj və logistika üçün. Boş buraxıla bilər.</p>
          <label>İstehsal və ya xidmət imkanı<input value={form.capacity} onChange={(event) => set("capacity", event.target.value)} /></label>
          <label>Anbar<input value={form.warehouse} onChange={(event) => set("warehouse", event.target.value)} /></label>
          <label>Zəmanət<input value={form.warranty} onChange={(event) => set("warranty", event.target.value)} /></label>
        </div>
      )}
      {error && <p className="login-error">{error}</p>}
      <div className="onboard-actions">
        {step > 0 && <button type="button" className="btn ghost" disabled={pending} onClick={() => setStep((value) => value - 1)}>Geri</button>}
        <button type="button" className="btn ghost" disabled={pending} onClick={onSkip}>Sonra</button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn" disabled={pending} onClick={() => setStep((value) => value + 1)}>Davam</button>
        ) : (
          <button type="button" className="btn" disabled={pending} onClick={() => void finish()}>Şirkəti yaz</button>
        )}
      </div>
    </div>
  )
}

export function CompanyCreatePage() {
  useTitle("Başqa şirkət")
  const navigate = useNavigate()
  return (
    <section className="panel pad firm-create">
      <div className="page-head">
        <div>
          <p className="eyebrow">Şirkət</p>
          <h1>Başqa şirkət</h1>
        </div>
      </div>
      <p className="lede">Yeni şirkət bu hesaba bağlanır və platforma onun məlumatına keçir.</p>
      <CompanyOnboard persist="api" onDone={() => navigate("/sirket")} onSkip={() => navigate("/sirket")} />
    </section>
  )
}
