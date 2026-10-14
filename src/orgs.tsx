import { useState, useSyncExternalStore } from "react"
import { ApiError, api } from "./api"
import { withDemo } from "./procure/demo"
import { KINDS, kindLabel, type Company, type CompanyKind } from "./procure/engine"
import { patchProcure } from "./procure/store"

export type AccountOrg = {
  id: string
  kind: string
  name: string
  code: string
  hasVoen: boolean
  hasBank: boolean
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
  staffCount: number | null
  directions: string
  permits: string
  equipmentPark: string
  turnoverNote: string
  seat: string
}

type OrgState = { ready: boolean; activeId: string; orgs: AccountOrg[] }

let state: OrgState = { ready: false, activeId: "", orgs: [] }
const listeners = new Set<() => void>()

function emit(next: OrgState) {
  state = next
  listeners.forEach((listener) => listener())
}

export function orgKind(kind: string): CompanyKind {
  return KINDS.some(([value]) => value === kind) ? (kind as CompanyKind) : "tikinti"
}

export function orgMark(name: string) {
  const parts = name.split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)
  return letters.toLocaleUpperCase("az")
}

function toCompany(org: AccountOrg): Company {
  return {
    id: org.id,
    kind: orgKind(org.kind),
    name: org.name,
    voen: "",
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
}

function remember(orgs: AccountOrg[], activeId: string) {
  const companies = orgs.map(toCompany)
  patchProcure((current) => withDemo({
    ...current,
    companies,
    activeId,
    actor: companies.find((item) => item.id === activeId)?.name || (activeId ? current.actor : ""),
  }, orgs))
}

export function useOrgs() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

export function resetOrgs() {
  emit({ ready: false, activeId: "", orgs: [] })
}

export async function loadAccountOrgs() {
  try {
    const row = await api<{ activeId: string | null; orgs: AccountOrg[] }>("/api/platform/organizations")
    const activeId = row.activeId ?? ""
    remember(row.orgs, activeId)
    emit({ ready: true, activeId, orgs: row.orgs })
  } catch {
    emit({ ...state, ready: true })
  }
}

export async function chooseOrg(id: string) {
  const snapshot = state
  remember(snapshot.orgs, id)
  emit({ ...snapshot, activeId: id })
  try {
    await api("/api/platform/organizations/select", {
      method: "POST",
      body: JSON.stringify({ id }),
    })
  } catch (error) {
    remember(snapshot.orgs, snapshot.activeId)
    emit(snapshot)
    throw error
  }
}

export function CompanyGate() {
  const { ready, orgs } = useOrgs()
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")

  async function pick(id: string) {
    setError("")
    setBusy(id)
    try {
      await chooseOrg(id)
    } catch (err) {
      setBusy("")
      setError(err instanceof ApiError ? err.message : "Şirkət seçilmədi")
    }
  }

  return (
    <div className="pick">
      <div className="pick-card">
        <p className="pick-kicker">CONSTRIX</p>
        <h1>Şirkət seçin</h1>
        <p>Platforma seçilən şirkətin məlumatını göstərir.</p>
        {!ready && <p className="pick-wait">Şirkətlər oxunur</p>}
        {ready && (
          <div className="pick-grid">
            {orgs.map((org) => (
              <button key={org.id} type="button" className={busy === org.id ? "pick-org busy" : "pick-org"} disabled={busy !== ""} onClick={() => void pick(org.id)}>
                <span>{orgMark(org.name)}</span>
                <small>{kindLabel(orgKind(org.kind))}</small>
                <strong>{org.name}</strong>
                <em>{org.regions || org.code}</em>
              </button>
            ))}
          </div>
        )}
        {error && <p className="pick-error">{error}</p>}
      </div>
    </div>
  )
}
