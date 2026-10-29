import { DataTable } from '../components/DataTable'
import { Button, Input, Panel, SearchInput, SectionHeader, StatGrid, TableContainer } from "../components/primitives"
import { FileTile } from "../components/FileTile"
import { Pagination } from "../components/Pagination"
import { useEffect, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { ApiError, api } from "../api"
import {
  KINDS,
  STAGES,
  blankState,
  chargeAmount,
  emptyExtract,
  kindLabel,
  num,
  FILE_ACCEPT,
  showPath,
  withPlanDefaults,
  type AuditRow,
  type Dispute,
  type Extracted,
  type Plan,
} from "../procure/engine"
import { readProjectFile } from "../procure/read"
import { money } from "../format"
import { EXPORTS, downloadSheet, putBlob, type ExportKind } from "../procure/files"
import { Icon } from "../icons"
import { patchProcure, procureNow, replaceProcure, stamp, useProcure } from "../procure/store"
import { chooseOrg, loadAccountOrgs, orgKind, useOrgs, type AccountOrg } from "../orgs"
import { useStore } from "../store"
import { Confirm, Empty, Field, Meter, Modal, PageHead, RowMenu, Select, Tabs, useTitle } from "../ui"

function id() {
  return crypto.randomUUID()
}

function activeOf(state: ReturnType<typeof useProcure>) {
  return state.companies.find((item) => item.id === state.activeId)
}

function Guard({ path, children }: { path: string; children: ReactNode }) {
  const state = useProcure()
  const kind = activeOf(state)?.kind ?? ""
  if (showPath(path, kind)) return children
  return <PageHead kicker="Kabinet" title="Bu bölmə bağlıdır" text={`${kind ? kindLabel(kind) : "Şirkət seçilməyib"}. Bu növün kabinetində həmin iş yoxdur.`} />
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

const FLAG_LABEL = { oxunmadi: "Oxunmadı", ziddiyyet: "Ziddiyyət", "qeyri-deqiq": "Qeyri-dəqiq" }

type Firm = {
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
  reliability: string
  staffCount: string
  directions: string
  permits: string
  equipmentPark: string
  turnoverNote: string
}

function firmKind(kind: string) {
  return kindLabel(orgKind(kind))
}

function firmFromOrg(org: AccountOrg): Firm {
  return {
    ...org,
    reliability: org.reliability == null ? "" : String(org.reliability),
    staffCount: org.staffCount == null ? "" : String(org.staffCount),
  }
}

export function CompanyPage() {
  useTitle("Şirkət")
  const state = useProcure()
  const active = activeOf(state)
  const { orgs, activeId } = useOrgs()
  const people = useStore().people
  const companyKey = activeId || state.activeId
  const remote = orgs.find((item) => item.id === companyKey)
  const others = orgs.filter((item) => item.id !== companyKey)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<CompanyDraft | null>(null)
  const [editError, setEditError] = useState("")
  const [saving, setSaving] = useState(false)
  const [secretsReady, setSecretsReady] = useState(false)
  const [secrets, setSecrets] = useState<{ voen: string; bankDetails: string } | null>(null)
  const [askSecret, setAskSecret] = useState(false)
  const [secretPassword, setSecretPassword] = useState("")
  const [secretError, setSecretError] = useState("")
  const [secretBusy, setSecretBusy] = useState(false)
  const [directorId, setDirectorId] = useState("")
  const [seenCompany, setSeenCompany] = useState(companyKey)
  if (seenCompany !== companyKey) {
    setSeenCompany(companyKey)
    setEditing(false)
    setDraft(null)
    setEditError("")
    setSecretsReady(false)
    setSecrets(null)
    setAskSecret(false)
    setSecretPassword("")
    setSecretError("")
    setDirectorId("")
  }

  useEffect(() => {
    let gone = false
    api<{ director: { id: string } | null }>("/api/platform/me")
      .then((row) => {
        if (!gone) setDirectorId(row.director?.id ?? "")
      })
      .catch(() => {
        if (!gone) setDirectorId("")
      })
    return () => {
      gone = true
    }
  }, [companyKey])

  const view: Firm | null = remote ? firmFromOrg(remote) : active ? {
    id: active.id,
    kind: active.kind,
    name: active.name,
    code: "",
    hasVoen: false,
    hasBank: false,
    phone: active.phone,
    email: active.email,
    director: active.director,
    legalAddress: active.legalAddress,
    actualAddress: active.actualAddress,
    capacity: active.capacity,
    warehouse: active.warehouse,
    regions: active.regions,
    warranty: active.warranty,
    reliability: active.reliability,
    staffCount: "",
    directions: "",
    permits: "",
    equipmentPark: "",
    turnoverNote: "",
  } : null

  if (!view) {
    return (
      <Panel className="pad firm-create">
        <div className="page-head">
          <div>
            <p className="eyebrow">Şirkət</p>
            <h1>Şirkət yoxdur</h1>
          </div>
        </div>
        <Link className="btn" to="/sirket/yeni">Şirkət yaz</Link>
      </Panel>
    )
  }

  const firm = view
  const facts = [
    ["İşçi", firm.staffCount],
    ["Ərazi", firm.regions],
    ["Zəmanət", firm.warranty],
  ].filter(([, value]) => value)

  async function beginEdit() {
    const next: CompanyDraft = {
      kind: firm.kind,
      name: firm.name,
      phone: firm.phone,
      email: firm.email,
      director: firm.director,
      legalAddress: firm.legalAddress,
      actualAddress: firm.actualAddress,
      regions: firm.regions,
      warranty: firm.warranty,
      capacity: firm.capacity,
      warehouse: firm.warehouse,
      directions: firm.directions,
      permits: firm.permits,
      equipmentPark: firm.equipmentPark,
      turnoverNote: firm.turnoverNote,
      staffCount: firm.staffCount,
      voen: secrets?.voen ?? "",
      bankDetails: secrets?.bankDetails ?? "",
    }
    setDraft(next)
    setSecretsReady(Boolean(secrets))
    setEditError("")
    setEditing(true)
  }

  async function revealSecrets() {
    setSecretBusy(true)
    setSecretError("")
    try {
      const row = await api<{ voen: string; bankDetails: string }>("/api/platform/organizations/secrets", {
        method: "POST",
        body: JSON.stringify({ password: secretPassword }),
      })
      setSecrets(row)
      setSecretsReady(true)
      setDraft((current) => current ? { ...current, voen: row.voen, bankDetails: row.bankDetails } : current)
      setAskSecret(false)
      setSecretPassword("")
    } catch (err) {
      setSecretError(err instanceof ApiError ? err.message : "Şifrə yanlışdır")
    } finally {
      setSecretBusy(false)
    }
  }

  async function saveCompany(event: FormEvent) {
    event.preventDefault()
    if (!draft?.name.trim()) {
      setEditError("Şirkətin adı yazılmalıdır.")
      return
    }
    setSaving(true)
    setEditError("")
    try {
      await api("/api/platform/organizations/current", {
        method: "PATCH",
        body: JSON.stringify({
          kind: draft.kind,
          name: draft.name.trim(),
          phone: draft.phone,
          email: draft.email,
          director: draft.director,
          legalAddress: draft.legalAddress,
          actualAddress: draft.actualAddress,
          regions: draft.regions,
          warranty: draft.warranty,
          capacity: draft.capacity,
          warehouse: draft.warehouse,
          directions: draft.directions,
          permits: draft.permits,
          equipmentPark: draft.equipmentPark,
          turnoverNote: draft.turnoverNote,
          staffCount: draft.staffCount,
          voen: secretsReady ? draft.voen : undefined,
          bankDetails: secretsReady ? draft.bankDetails : undefined,
        }),
      })
      await loadAccountOrgs()
      setEditing(false)
      setSecretsReady(false)
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Məlumat yazılmadı")
    } finally {
      setSaving(false)
    }
  }

  function setField<K extends keyof CompanyDraft>(key: K, value: CompanyDraft[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current)
  }

  return (
    <div className="firm">
      <header className="firm-hero">
        <div>
          <p>{firmKind(view.kind)}</p>
          <h1>{view.name}</h1>
          {view.directions && view.directions !== view.kind && <span>{view.directions}</span>}
        </div>
        <div className="firm-side">
          {view.code && <strong>{view.code}</strong>}
          {view.reliability && <em>Etibar {view.reliability}/5</em>}
        </div>
      </header>
      {!editing && (
        <div className="firm-tools">
          {remote?.seat === "direktor" && <button type="button" onClick={() => void beginEdit()}>Məlumatları yenilə</button>}
          <Link to="/sirket/yeni">Başqa şirkət</Link>
        </div>
      )}
      {editing && draft ? (
        <form className="firm-edit" onSubmit={saveCompany}>
          <article>
            <h2>Şirkət</h2>
            <label>Fəaliyyət<Select value={draft.kind} onValueChange={(kind) => setField("kind", kind)} options={KINDS.filter(([value]) => value !== "admin").map(([value, label]) => ({ value, label }))} /></label>
            <label>Ad<Input value={draft.name} onChange={(event) => setField("name", event.target.value)} /></label>
            <label>İşçi sayı<Input value={draft.staffCount} onChange={(event) => setField("staffCount", event.target.value)} /></label>
            <label>Ərazi<Input value={draft.regions} onChange={(event) => setField("regions", event.target.value)} /></label>
            <label>İstiqamət<Input value={draft.directions} onChange={(event) => setField("directions", event.target.value)} /></label>
          </article>
          <article>
            <h2>Əlaqə</h2>
            <label>Məsul<Input value={draft.director} onChange={(event) => setField("director", event.target.value)} /></label>
            <label>Telefon<Input value={draft.phone} onChange={(event) => setField("phone", event.target.value)} /></label>
            <label>E-poçt<Input value={draft.email} onChange={(event) => setField("email", event.target.value)} /></label>
            {secrets ? (
              <>
                <label>VÖEN<Input value={draft.voen} onChange={(event) => setField("voen", event.target.value)} autoComplete="off" /></label>
                <label>Bank<Input value={draft.bankDetails} onChange={(event) => setField("bankDetails", event.target.value)} autoComplete="off" /></label>
              </>
            ) : (
              <SecretAsk ask={askSecret} password={secretPassword} error={secretError} busy={secretBusy} onAsk={() => setAskSecret(true)} onPassword={setSecretPassword} onSubmit={() => void revealSecrets()} />
            )}
          </article>
          <article>
            <h2>Ünvan</h2>
            <label>Hüquqi<Input value={draft.legalAddress} onChange={(event) => setField("legalAddress", event.target.value)} /></label>
            <label>Faktiki<Input value={draft.actualAddress} onChange={(event) => setField("actualAddress", event.target.value)} /></label>
            <label>Anbar<Input value={draft.warehouse} onChange={(event) => setField("warehouse", event.target.value)} /></label>
          </article>
          <article>
            <h2>İmkan və icazə</h2>
            <label>Həcm<Input value={draft.capacity} onChange={(event) => setField("capacity", event.target.value)} /></label>
            <label>Texnika<Input value={draft.equipmentPark} onChange={(event) => setField("equipmentPark", event.target.value)} /></label>
            <label>Dövriyyə<Input value={draft.turnoverNote} onChange={(event) => setField("turnoverNote", event.target.value)} /></label>
            <label>İcazə<Input value={draft.permits} onChange={(event) => setField("permits", event.target.value)} /></label>
            <label>Zəmanət<Input value={draft.warranty} onChange={(event) => setField("warranty", event.target.value)} /></label>
          </article>
          {editError && <p className="form-error">{editError}</p>}
          <div className="firm-edit-actions">
            <Button type="submit"  disabled={saving}>Saxla</Button>
            <Button type="button" className="ghost" onClick={() => setEditing(false)}>Bağla</Button>
          </div>
        </form>
      ) : facts.length > 0 && (
        <section className="firm-facts">
          {facts.map(([label, value]) => label === "İşçi" ? (
            <Link key={label} to="/isciler" className="firm-fact">
              <span>{label}</span>
              <strong>{value}</strong>
            </Link>
          ) : (
            <article key={label}><span>{label}</span><strong>{value}</strong></article>
          ))}
        </section>
      )}
      {!editing && <section className="firm-grid">
        <article>
          <h2>Əlaqə</h2>
          <FirmRow label="Məsul" value={view.director} to={directorHref(people, view.director, directorId)} />
          <FirmRow label="Telefon" value={view.phone} />
          <FirmRow label="E-poçt" value={view.email} />
          {(remote?.hasVoen || secrets) && (
            <button type="button" className="firm-lock-row" onClick={() => secrets ? setSecrets(null) : setAskSecret((value) => !value)}>
              <span>VÖEN</span>
              <strong>{secrets?.voen || "••••••••"}</strong>
            </button>
          )}
          {(remote?.hasBank || secrets) && (
            <button type="button" className="firm-lock-row" onClick={() => secrets ? setSecrets(null) : setAskSecret((value) => !value)}>
              <span>Bank</span>
              <strong>{secrets?.bankDetails || "••••••••"}</strong>
            </button>
          )}
          {!secrets && <SecretAsk bare ask={askSecret} password={secretPassword} error={secretError} busy={secretBusy} onAsk={() => setAskSecret(true)} onPassword={setSecretPassword} onSubmit={() => void revealSecrets()} />}
        </article>
        <article>
          <h2>Ünvan</h2>
          <FirmRow label="Hüquqi" value={view.legalAddress} />
          <FirmRow label="Faktiki" value={view.actualAddress} />
          <FirmRow label="Anbar" value={view.warehouse} />
        </article>
        <article>
          <h2>İmkan</h2>
          <FirmRow label="Həcm" value={view.capacity} />
          <FirmRow label="İstiqamət" value={view.directions !== view.kind ? view.directions : ""} />
          <FirmRow label="Texnika" value={view.equipmentPark} />
          <FirmRow label="Dövriyyə" value={view.turnoverNote} />
        </article>
        <article>
          <h2>İcazə</h2>
          <FirmRow label="Sənəd" value={view.permits} />
          <FirmRow label="Zəmanət" value={view.warranty} />
        </article>
      </section>}
      {others.length > 0 && (
        <section className="firm-others">
          <h2>{others.length > 1 ? "Digər şirkətlər" : "Digər şirkət"}</h2>
          {others.map((org) => (
            <article key={org.id} className="firm-other">
              <div>
                <p>{firmKind(org.kind)}</p>
                <strong>{org.name}</strong>
                <span>{org.regions}</span>
              </div>
              <Button type="button" className="ghost" onClick={() => void chooseOrg(org.id)}>Keç</Button>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}

type CompanyDraft = {
  kind: string
  name: string
  phone: string
  email: string
  director: string
  legalAddress: string
  actualAddress: string
  regions: string
  warranty: string
  capacity: string
  warehouse: string
  directions: string
  permits: string
  equipmentPark: string
  turnoverNote: string
  staffCount: string
  voen: string
  bankDetails: string
}

function directorHref(people: { id: string; name: string }[], name: string, fallbackId: string) {
  const found = people.find((item) => item.name.trim().toLocaleLowerCase("az") === name.trim().toLocaleLowerCase("az"))
  if (found) return `/isciler/${found.id}`
  return fallbackId ? `/isciler/${fallbackId}` : ""
}

function SecretAsk({
  ask,
  bare,
  password,
  error,
  busy,
  onAsk,
  onPassword,
  onSubmit,
}: {
  ask: boolean
  bare?: boolean
  password: string
  error: string
  busy: boolean
  onAsk: () => void
  onPassword: (value: string) => void
  onSubmit: () => void
}) {
  if (!ask) {
    if (bare) return null
    return (
      <button type="button" className="firm-lock-row" onClick={onAsk}>
        <span>VÖEN və bank</span>
        <strong>••••••••</strong>
      </button>
    )
  }
  return (
    <div className="firm-pass">
      <Input type="password" value={password} onChange={(event) => onPassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onSubmit() } }} placeholder="Şifrə" autoComplete="current-password" autoFocus />
      <button type="button" disabled={busy} onClick={onSubmit}>Göstər</button>
      {error && <p>{error}</p>}
    </div>
  )
}

function FirmRow({ label, value, to }: { label: string; value: string; to?: string }) {
  if (!value) return null
  return (
    <div className="firm-row">
      <span>{label}</span>
      {to ? <Link to={to}><strong>{value}</strong></Link> : <strong>{value}</strong>}
    </div>
  )
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileWhen(value?: string) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`
}

async function keepBlob(bytes: Uint8Array) {
  const key = id()
  try {
    await putBlob(key, bytes)
    return key
  } catch {
    return undefined
  }
}

export function FileDetailPage() {
  const { fileId } = useParams()
  return <FilesPage key={fileId} />
}

export function FilesPage() {
  const { fileId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const libraryUrl = `/layihe-fayl${searchParams.size ? `?${searchParams}` : ""}`
  const state = useProcure()
  const active = activeOf(state)
  const [error, setError] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState(false)
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [rowId, setRowId] = useState("")
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState("")
  const query = searchParams.get("q") ?? ""
  const [fileView, setFileView] = useState("rows")
  const [rowQuery, setRowQuery] = useState("")
  const [rowFilter, setRowFilter] = useState("all")
  const menuRef = useRef<HTMLDivElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const versionRef = useRef<HTMLInputElement>(null)
  const files = state.files.filter((item) => item.companyId === state.activeId)
  const open = files.find((item) => item.id === fileId) ?? null
  useTitle(fileId ? open?.name ?? "Fayl tapılmadı" : "Fayllar")
  const needle = query.trim().toLocaleLowerCase("az")
  const visible = needle ? files.filter((file) => file.name.toLocaleLowerCase("az").includes(needle) || file.ext.toLocaleLowerCase("az").includes(needle)) : files
  const pageSize = 12
  const requestedPage = Number(searchParams.get("page") ?? 1)
  const page = Math.min(Math.max(1, Math.ceil(visible.length / pageSize)), Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1)
  const pageFiles = visible.slice((page - 1) * pageSize, page * pageSize)

  function setQuery(value: string) {
    const params = new URLSearchParams(searchParams)
    if (value) params.set("q", value)
    else params.delete("q")
    params.delete("page")
    setSearchParams(params, { replace: true })
  }

  function changePage(value: number) {
    const params = new URLSearchParams(searchParams)
    if (value > 1) params.set("page", String(value))
    else params.delete("page")
    setSearchParams(params)
  }
  const confirmed = files.reduce((sum, file) => sum + file.rows.filter((row) => row.confirmed).length, 0)
  const rows = files.reduce((sum, file) => sum + file.rows.length, 0)
  const excel = open?.ext === "xlsx" || open?.ext === "xls"
  const rowNeedle = rowQuery.trim().toLocaleLowerCase("az")
  const shownRows = (open?.rows ?? []).filter((row) =>
    (rowFilter === "all" || (rowFilter === "confirmed" ? row.confirmed : !row.confirmed)) &&
    (!rowNeedle || [row.name, row.code, row.profile, row.spec].some((value) => value.toLocaleLowerCase("az").includes(rowNeedle))))
  const confirmedRows = open?.rows.filter((row) => row.confirmed).length ?? 0

  function showFile(targetId: string) {
    setError("")
    setNote("")
    setRowId("")
    setPicking(false)
    setPicked([])
    setMenu(false)
    setRenaming(false)
    setFileView("rows")
    setRowQuery("")
    setRowFilter("all")
    if (targetId !== fileId) navigate(`/layihe-fayl/${encodeURIComponent(targetId)}${searchParams.size ? `?${searchParams}` : ""}`)
  }

  function changeFile(fileId: string, recipe: (file: (typeof files)[number]) => (typeof files)[number]) {
    patchProcure((current) => ({
      ...current,
      files: current.files.map((file) => file.id === fileId ? recipe(file) : file),
    }))
  }

  async function take(file: File) {
    setError("")
    setNote("")
    const bytes = new Uint8Array(await file.arrayBuffer())
    const parsed = await readProjectFile(file.name, bytes)
    if (!parsed.scan.ok || !active) {
      setError(parsed.scan.note || "Fayl qəbul olunmadı")
      return
    }
    const fileId = id()
    const blobId = await keepBlob(bytes)
    const extracted: Extracted[] = parsed.rows.map((row) => ({ ...row, id: id() }))
    patchProcure((current) => ({
      ...current,
      files: [...current.files, { id: fileId, companyId: active.id, name: file.name, ext: parsed.scan.ext, size: file.size, at: new Date().toISOString(), blobId, scan: "temiz", scanNote: parsed.scan.note, rows: extracted, versions: [] }],
      audit: [...current.audit, stamp(current, "Fayl qəbul oldu", file.name)],
    }))
    showFile(fileId)
  }

  async function takeVersion(file: File) {
    if (!open) return
    setError("")
    setNote("")
    const bytes = new Uint8Array(await file.arrayBuffer())
    const parsed = await readProjectFile(file.name, bytes)
    if (!parsed.scan.ok) {
      setError(parsed.scan.note)
      return
    }
    const blobId = await keepBlob(bytes)
    const extracted: Extracted[] = parsed.rows.map((row) => ({ ...row, id: id() }))
    const currentFile = open
    patchProcure((current) => ({
      ...current,
      files: current.files.map((item) => item.id === currentFile.id ? {
        ...item,
        name: file.name,
        ext: parsed.scan.ext,
        size: file.size,
        at: new Date().toISOString(),
        blobId,
        revised: false,
        scan: "temiz",
        scanNote: parsed.scan.note,
        rows: extracted,
        versions: [...(item.versions ?? []), { id: id(), name: item.name, ext: item.ext, size: item.size, at: item.at || new Date().toISOString(), scanNote: item.scanNote, blobId: item.blobId, rows: item.rows }],
      } : item),
      audit: [...current.audit, stamp(current, "Faylın yeni versiyası", file.name)],
    }))
    showFile(currentFile.id)
  }

  function patchRow(fileId: string, target: string, recipe: (row: Extracted) => Extracted) {
    changeFile(fileId, (file) => ({ ...file, revised: true, rows: file.rows.map((row) => row.id === target ? recipe(row) : row) }))
  }

  useEffect(() => {
    if (!menu) return
    function close(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(false)
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [menu])

  async function downloadRows(rows: Extracted[], kind?: ExportKind, original = false) {
    if (!open || rows.length === 0) return
    setBusy(true)
    setMenu(false)
    setError("")
    setNote("")
    try {
      const message = await downloadSheet(original ? open : { ...open, rows, revised: true }, kind)
      if (kind && kind !== open.ext) {
        changeFile(open.id, (file) => file.formats?.includes(kind) ? file : { ...file, formats: [...(file.formats ?? []), kind] })
      }
      if (message) setNote(message)
    } catch {
      setError("Fayl yazılmadı")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Guard path="/layihe-fayl">
      {!fileId && <PageHead title="Fayllar" text="Faylı seçin və məzmununu ayrıca səhifədə açın.">
        {active && <Button onClick={() => uploadRef.current?.click()}><Icon name="plus" />Fayl əlavə et</Button>}
      </PageHead>}
      {fileId && <Link className="file-library-back" to={libraryUrl}><Icon name="chevronLeft" />Fayl kitabxanasına qayıt</Link>}
      <div className={`library file-library${fileId ? " file-detail-page" : ""}`}>
        <input ref={uploadRef} hidden type="file" accept={FILE_ACCEPT} onChange={(event) => { const file = event.target.files?.[0]; if (file) void take(file); event.target.value = "" }} />
        {error && <p className="form-error">{error}</p>}
        {!active && <p className="lede">Əvvəl şirkət seçilməlidir.</p>}
        {!fileId && files.length === 0 && <Empty title="Hələ fayl yoxdur" text="İlk faylı əlavə etmək üçün “Fayl əlavə et” düyməsini seçin." />}
        {fileId && !open && <PageHead title="Fayl tapılmadı" text="Bu fayl seçilmiş şirkətdə yoxdur. Kitabxanaya qayıdıb başqa fayl seçin." />}
          <div className={fileId ? "file-workspace has-detail" : "file-workspace"}>
            {!fileId && files.length > 0 && <div className="file-index">
              <div className="file-collection-head"><div><h2>Fayl kitabxanası</h2><p>{files.length} fayl · {rows} sətir · {confirmed} təsdiq</p></div><SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Fayllarda axtar..." /></div>
              <div className="file-entries" aria-label="Fayllar">
                {pageFiles.map((file) => {
                  const done = file.rows.filter((row) => row.confirmed).length
                  return (
                    <FileTile key={file.id} name={file.name} extension={file.ext} metadata={`${file.rows.length} sətir · ${done} təsdiq`} progress={file.rows.length ? done / file.rows.length * 100 : 0} to={`/layihe-fayl/${encodeURIComponent(file.id)}${searchParams.size ? `?${searchParams}` : ""}`} />
                  )
                })}
              </div>
              {visible.length === 0 && <Empty title="Uyğun fayl yoxdur" text="Faylın adını və ya uzantısını dəyişib yenidən axtarın." />}
              <Pagination page={page} pageSize={pageSize} total={visible.length} onChange={changePage} />
            </div>}
            {fileId && <div className="file-detail-slot">
        {open && (
          <section key={open.id} className="file-sheet" aria-label={`${open.name} sətirləri`}>
            <header>
              <div>
                <p>{open.ext.toUpperCase()} · {fileSize(open.size)}{fileWhen(open.at) ? ` · ${fileWhen(open.at)}` : ""}</p>
                <div className="file-title">
                  <h1>{open.name}</h1>
                  {!renaming && (
                    <button type="button" aria-label="Adı dəyiş" onClick={() => { setNameDraft(open.name); setRenaming(true) }}>
                      <Icon name="edit" />
                    </button>
                  )}
                </div>
                {renaming && (
                  <form className="file-rename" onSubmit={(event) => {
                    event.preventDefault()
                    const name = nameDraft.trim()
                    if (!name) return
                    changeFile(open.id, (file) => ({ ...file, name }))
                    setRenaming(false)
                  }}>
                    <Input aria-label="Faylın adı" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setRenaming(false) }} autoFocus />
                    <button type="submit" aria-label="Saxla"><Icon name="check" /></button>
                    <button type="button" aria-label="Bağla" onClick={() => setRenaming(false)}><Icon name="close" /></button>
                  </form>
                )}
              </div>
              <div className="file-document-actions">
                <Button disabled={busy} onClick={() => void downloadRows(open.rows, undefined, !excel)}><Icon name="download" />Yüklə</Button>
                <Button className="ghost" title="Yenilənmiş faylı seçin. Əvvəlki nüsxə tarixçədə saxlanacaq." onClick={() => versionRef.current?.click()}>Faylı yenilə</Button>
              </div>
            </header>
            <Tabs value={fileView} onChange={setFileView} options={[{id: "rows", label: `Sətirlər ${open.rows.length}`}, {id: "history", label: `Tarixçə ${open.versions?.length ?? 0}`}]} />
            {fileView === "rows" && <>
            <div className="file-row-toolbar">
              <SearchInput value={rowQuery} onChange={(event) => setRowQuery(event.target.value)} placeholder="Sətirdə axtar..." />
              <div className="file-status-filters" aria-label="Sətir statusu">
                {[{id:"all",label:"Hamısı",count:open.rows.length},{id:"confirmed",label:"Təsdiqlənib",count:confirmedRows},{id:"waiting",label:"Gözləyir",count:open.rows.length-confirmedRows}].map((filter)=><Button key={filter.id} className="ghost small" aria-pressed={rowFilter===filter.id} onClick={()=>setRowFilter(filter.id)}>{filter.label}<span>{filter.count}</span></Button>)}
              </div>
              <Button className="ghost file-add-row" onClick={() => {
                const row = { ...emptyExtract("Yeni sətir"), id: id(), flags: [] as Extracted["flags"] }
                changeFile(open.id, (file) => ({ ...file, revised: true, rows: [...file.rows, row] }))
                setRowQuery(""); setRowFilter("all"); setRowId(row.id)
              }}><Icon name="plus" />Sətir əlavə et</Button>
            </div>
            <div className="file-actions">
              <div className="file-actions-side">
                <div className="file-menu" ref={menuRef}>
                  <Button disabled={busy} aria-expanded={menu} aria-controls="file-download-options" onClick={() => setMenu((value) => !value)}>
                    <Icon name="download" />{busy ? "Hazırlanır..." : "Yükləmə seçimləri"}<Icon name="chevron" />
                  </Button>
                  {menu && (
                    <div className="file-menu-pop" id="file-download-options" onKeyDown={(event) => { if (event.key === "Escape") { setMenu(false); menuRef.current?.querySelector('button')?.focus() } }}>
                      {excel ? (
                        <>
                          <button type="button" onClick={() => void downloadRows(open.rows)}>Bütün sətirləri yüklə</button>
                          <button type="button" onClick={() => {
                            if (picking && picked.length) void downloadRows(open.rows.filter((row) => picked.includes(row.id)))
                            else { setPicking(true); setMenu(false) }
                          }}>{picking && picked.length ? `Seçilənləri yüklə (${picked.length})` : "Yükləmək üçün sətir seç"}</button>
                        </>
                      ) : (
                        <button type="button" onClick={() => void downloadRows(open.rows, undefined, true)}>Faylı yüklə</button>
                      )}
                      {EXPORTS.filter(([item]) => item !== open.ext && !(excel && item === "xlsx")).map(([item, label]) => (
                        <button key={item} type="button" onClick={() => void downloadRows(open.rows, item)}>{label}</button>
                      ))}
                      {picking && <button type="button" onClick={() => { setPicking(false); setPicked([]); setMenu(false) }}>Seçimi bağla</button>}
                    </div>
                  )}
                </div>
              </div>
              <span className="file-row-count">{shownRows.length} / {open.rows.length} sətir · Miqdarlar təsdiqdən sonra hesablanır</span>
            </div>
            {note && <p className="lede">{note}</p>}
            {picking && <div className="file-selection-bar"><span>{picked.length} sətir seçilib</span><Button className="small" disabled={!picked.length || busy} onClick={()=>void downloadRows(open.rows.filter(row=>picked.includes(row.id)))}>Seçilənləri yüklə</Button><Button className="ghost small" onClick={()=>{setPicking(false);setPicked([])}}>Seçimi ləğv et</Button></div>}
            <div className={picking ? "file-table picking" : "file-table"}>
              <div className="file-head"><span>Ad</span><span>Kod</span><span>Say</span><span>Ölçü</span><span>Profil</span><span>Təsdiq</span><span /></div>
              {shownRows.map((row) => (
                <div key={row.id} className={rowId === row.id ? "file-line open" : "file-line"}>
                  <div className="file-line-top">
                    {picking && (
                      <input type="checkbox" aria-label={row.name} checked={picked.includes(row.id)} onChange={(event) => setPicked((current) => event.target.checked ? [...current, row.id] : current.filter((item) => item !== row.id))} />
                    )}
                    <button type="button" className="file-line-main" aria-expanded={rowId === row.id} onClick={() => setRowId((current) => current === row.id ? "" : row.id)}>
                    <span>{row.name}</span>
                    <span data-label="Kod">{row.code || "—"}</span>
                    <span data-label="Say">{row.qty}</span>
                    <span data-label="Ölçü">{row.width && row.height ? `${row.width}×${row.height}` : "—"}</span>
                    <span data-label="Profil">{row.profile || "—"}</span>
                    <span data-label="Təsdiq" className={row.confirmed ? "is-yes" : ""}>{row.confirmed ? "Bəli" : "Xeyr"}</span>
                    <span className="file-line-open"><Icon name="edit" />{rowId === row.id ? "Bağla" : "Düzəliş"}</span>
                    </button>
                  </div>
                  {row.flags.length > 0 && <div className="file-flags">{row.flags.map((flag) => <em key={flag}>{FLAG_LABEL[flag]}</em>)}</div>}
                  {rowId === row.id && (
                    <div className="file-edit">
                      <label>Ad<Input value={row.name} onChange={(event) => patchRow(open.id, row.id, (item) => ({ ...item, name: event.target.value }))} /></label>
                      <label>Kod<Input value={row.code} onChange={(event) => patchRow(open.id, row.id, (item) => ({ ...item, code: event.target.value }))} /></label>
                      <label>Say<Input value={row.qty} onChange={(event) => patchRow(open.id, row.id, (item) => ({ ...item, qty: event.target.value }))} /></label>
                      <label>En<Input value={row.width} onChange={(event) => patchRow(open.id, row.id, (item) => ({ ...item, width: event.target.value }))} /></label>
                      <label>Hündürlük<Input value={row.height} onChange={(event) => patchRow(open.id, row.id, (item) => ({ ...item, height: event.target.value }))} /></label>
                      <label>Profil<Input value={row.profile} onChange={(event) => patchRow(open.id, row.id, (item) => ({ ...item, profile: event.target.value }))} /></label>
                      <label>Şüşə<Input value={row.glass} onChange={(event) => patchRow(open.id, row.id, (item) => ({ ...item, glass: event.target.value }))} /></label>
                      <label>Furnitur<Input value={row.hardware} onChange={(event) => patchRow(open.id, row.id, (item) => ({ ...item, hardware: event.target.value }))} /></label>
                      <label>Spesifikasiya<Input value={row.spec} onChange={(event) => patchRow(open.id, row.id, (item) => ({ ...item, spec: event.target.value }))} /></label>
                      <label>Montaj<Input value={row.install} onChange={(event) => patchRow(open.id, row.id, (item) => ({ ...item, install: event.target.value }))} /></label>
                      <div className="file-row-actions">
                        <button type="button" className={row.confirmed ? "file-quiet on" : "file-quiet"} onClick={() => patchRow(open.id, row.id, (item) => ({ ...item, confirmed: !item.confirmed }))}>{row.confirmed ? "Təsdiqlənib" : "Təsdiq"}</button>
                        <button type="button" className="file-quiet" disabled={busy} onClick={() => void downloadRows([row])}>Sətri yüklə</button>
                        <button type="button" className="file-drop" onClick={() => { changeFile(open.id, (file) => ({ ...file, revised: true, rows: file.rows.filter((item) => item.id !== row.id) })); setPicked((current) => current.filter((item) => item !== row.id)); setRowId("") }}>Sil</button>
                        <button type="button" className="file-quiet" onClick={() => setRowId("")}>Bağla</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {shownRows.length===0 && <Empty title="Uyğun sətir yoxdur" text="Axtarışı və ya status filtrini dəyişin." />}
            </>}
            {fileView === "history" && <div className="file-history">
              <p className="file-version-hint">Faylı yenilədikdə əvvəlki nüsxə və sətirlər burada saxlanılır.</p>
              {(open.versions?.length ?? 0)===0 ? <Empty title="Əvvəlki nüsxə yoxdur" text="Bu faylın ilk nüsxəsi ilə işləyirsiniz." /> : [...(open.versions ?? [])].reverse().map((version)=><article key={version.id}><span className="history-point" /><div><strong>{version.name}</strong><p>{fileWhen(version.at)} · {fileSize(version.size)} · {version.rows.length} sətir</p>{version.scanNote&&<small>{version.scanNote}</small>}</div><span className="file-history-label">Əvvəlki nüsxə</span></article>)}
            </div>}
            <input ref={versionRef} hidden type="file" accept={FILE_ACCEPT} onChange={(event) => { const file = event.target.files?.[0]; if (file) void takeVersion(file); event.target.value = "" }} />
          </section>
        )}
            </div>}
          </div>
      </div>
    </Guard>
  )
}

const TARIFF: Record<string, { cadence: string; unit: string; payer: string; when: string; covers: string[] }> = {
  abune: {
    cadence: "Hər ay",
    unit: "/ ay",
    payer: "Tikinti şirkəti və memar",
    when: "Ayın 1-i, kabinet açıq qaldıqca",
    covers: ["Kabinet və kataloq", "3 aktiv layihə", "2 istifadəçi"],
  },
  layihe: {
    cadence: "Hər layihə",
    unit: "/ layihə",
    payer: "Tikinti şirkəti və memar",
    when: "Hesablama bağlananda, bir dəfə",
    covers: ["Pəncərə, qapı və fasad smetası", "Eyni layihənin variantı pulsuzdur", "Növbəti layihə yenidən yazılır"],
  },
  kabinet: {
    cadence: "Hər ay",
    unit: "/ ay",
    payer: "Qapı, şüşə, PVC, fasad və material istehsalçısı",
    when: "Ayın 1-i, kabinet açıq qaldıqca",
    covers: ["Öz qiymət cədvəli", "Kataloqa məhsul", "Təklif göndərmək"],
  },
  komissiya: {
    cadence: "Hər sifariş",
    unit: "sifarişdən",
    payer: "Sifarişi bağlayan təchizatçı",
    when: "Sifariş təhvilə keçəndə",
    covers: ["Bağlanmış məbləğin faizi", "Sifarişçi bu faizi ödəmir", "Ləğv olunmuş sifarişdən tutulmur"],
  },
  modul: {
    cadence: "Hər ay",
    unit: "/ ay",
    payer: "İstehsalçı və montaj",
    when: "Modul açıq olanda, hər ay",
    covers: ["Profil sərfiyyatı", "Şüşə və furnitur", "Aylıq, ayrıca açılır"],
  },
  korporativ: {
    cadence: "Hər ay",
    unit: "/ ay",
    payer: "Çox istifadəçili tikinti şirkəti və memar",
    when: "Müqavilə ilə, aylıq abunənin yerinə",
    covers: ["Aylıq abunəni əvəz edir", "15 istifadəçi", "Layihə sayı limitsiz"],
  },
}

function buyerKind(kind: string) {
  return kind === "tikinti" || kind === "memar"
}

function makerKind(kind: string) {
  return kind === "qapi" || kind === "suse" || kind === "pvc" || kind === "fasad" || kind === "material"
}

function paysTariff(kind: string, planId: string) {
  if (planId === "abune" || planId === "layihe" || planId === "korporativ") return buyerKind(kind)
  if (planId === "kabinet" || planId === "komissiya") return makerKind(kind)
  if (planId === "modul") return makerKind(kind) || kind === "montaj"
  return false
}

function feeText(plan: Plan) {
  const amount = num(plan.amount)
  if (amount == null) return "Məbləğ yoxdur"
  if (plan.kind === "komissiya") return `${String(amount).replace(".", ",")}%`
  return money(amount)
}

function sampleLine(plan: Plan, order: number) {
  const amount = num(plan.amount)
  if (amount == null) return "Məbləğ yazılandan sonra nümunə çıxacaq."
  if (plan.id === "abune" || plan.id === "kabinet") return `Bir il ${money(amount)} × 12 = ${money(amount * 12)}`
  if (plan.id === "layihe") return `4 layihə ${money(amount)} × 4 = ${money(amount * 4)}`
  if (plan.kind === "komissiya") return `${money(order)} sifarişdən ${String(amount).replace(".", ",")}% = ${money((order * amount) / 100)}`
  if (plan.id === "modul") return `6 ay ${money(amount)} × 6 = ${money(amount * 6)}`
  if (plan.id === "korporativ") return `Aylıq abunənin yerinə keçir. İldə ${money(amount * 12)}.`
  return plan.note || "—"
}

function partyName(companies: { id: string; kind: string; name: string }[], active: { id: string; kind: string; name: string } | undefined, side: "buyer" | "maker") {
  const fit = (kind: string) => (side === "buyer" ? buyerKind(kind) : makerKind(kind))
  if (active && fit(active.kind) && active.name.trim()) return active.name
  return companies.find((company) => fit(company.kind) && company.name.trim())?.name || (side === "buyer" ? "Tikinti şirkəti" : "Fasad zavodu")
}

function nextInvoice(charges: { invoice: string }[]) {
  const max = charges.reduce((highest, item) => {
    const match = /^Q-(\d+)$/.exec(item.invoice)
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)
  return `Q-${max + 1}`
}

function TariffEditor({ plan, onSave }: { plan: Plan; onSave: (amount: string, note: string) => void }) {
  const [amount, setAmount] = useState(plan.amount)
  const [note, setNote] = useState(plan.note)
  useEffect(() => {
    setAmount(plan.amount)
    setNote(plan.note)
  }, [plan.amount, plan.note])
  const dirty = amount.trim() !== plan.amount || note.trim() !== plan.note
  return (
    <div className="tariff-edit">
      <label>
        {plan.kind === "komissiya" ? "Faiz" : "Məbləğ, ₼"}
        <Input value={amount} inputMode="decimal" onChange={(event) => setAmount(event.target.value)} />
      </label>
      <label>
        Qısa izah
        <Input value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <Button type="button" className="small" disabled={!dirty || !amount.trim()} onClick={() => onSave(amount.trim(), note.trim())}>Saxla</Button>
    </div>
  )
}

export function TariffPage() {
  useTitle("Tarif")
  const state = useProcure()
  const active = activeOf(state)
  const admin = active?.kind === "admin"
  const kind = active?.kind ?? ""
  const plans = withPlanDefaults(state.plans)
  const [tab, setTab] = useState("plans")
  const [selectedId, setSelectedId] = useState("")
  const selected = plans.find((plan) => plan.id === selectedId)
  const [orderSum, setOrderSum] = useState("18400")
  const [focusId, setFocusId] = useState("")
  const [notice, setNotice] = useState("")
  const [editId, setEditId] = useState("")
  const [editAmount, setEditAmount] = useState("")
  const [dropId, setDropId] = useState("")
  const opening = useRef(false)
  const order = num(orderSum) ?? 0
  const showMine = Boolean(active && !admin)
  const buyerName = partyName(state.companies, active, "buyer")
  const makerName = partyName(state.companies, active, "maker")
  const project = state.files.some((file) => file.name.toLocaleLowerCase("az").includes("yasamal")) ? "Yasamal, Zərdabi 12" : "nümunə layihə"
  const rate = num(plans.find((plan) => plan.id === "komissiya")?.amount ?? "")
  const rows = [
    { side: "buyer" as const, who: buyerName, fee: "Aylıq abunə", why: "Kabinet bu ay açıqdır", amount: num(plans.find((plan) => plan.id === "abune")?.amount ?? "") },
    { side: "buyer" as const, who: buyerName, fee: "Layihə hesablaması", why: `${project} bir dəfə hesablanır`, amount: num(plans.find((plan) => plan.id === "layihe")?.amount ?? "") },
    { side: "maker" as const, who: makerName, fee: "Təchizatçı kabineti", why: "Qiymət və təklif buradan gedir", amount: num(plans.find((plan) => plan.id === "kabinet")?.amount ?? "") },
    { side: "maker" as const, who: makerName, fee: "Sifariş komissiyası", why: rate == null ? "Faiz yazılmayıb" : `${money(order)} × ${String(rate).replace(".", ",")} faiz`, amount: rate == null ? null : (order * rate) / 100 },
  ]
  const total = rows.reduce((sum, row) => sum + (row.amount ?? 0), 0)
  const ordered = [...plans].sort((a, b) => Number(paysTariff(kind, b.id)) - Number(paysTariff(kind, a.id)))
  const bills = state.charges.filter((item) => admin || item.companyId === state.activeId).slice().reverse()
  const waiting = bills.filter((item) => item.status === "gozleyir")
  const waitingSum = waiting.reduce((sum, item) => sum + (num(item.amount) ?? 0), 0)

  useEffect(() => {
    const next = withPlanDefaults(state.plans)
    const changed = next.length !== state.plans.length || next.some((plan, index) => {
      const prev = state.plans[index]
      return !prev || prev.id !== plan.id || prev.name !== plan.name || prev.amount !== plan.amount || prev.note !== plan.note
    })
    if (!changed) return
    patchProcure((current) => ({ ...current, plans: withPlanDefaults(current.plans) }))
  }, [state.plans])

  function setPlan(plan: Plan, amount: string, note: string) {
    if (!admin || !amount.trim()) return
    patchProcure((current) => ({
      ...current,
      plans: current.plans.map((item) => item.id === plan.id ? { ...item, amount, note } : item),
      audit: [...current.audit, stamp(current, "Tarif yazıldı", plan.name)],
    }))
  }

  useEffect(() => {
    if (!focusId || tab !== "bills") return
    document.getElementById(`bill-${focusId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [focusId, bills.length, tab])

  function charge(plan: Plan) {
    if (!active || admin || !paysTariff(active.kind, plan.id) || opening.current) return
    setSelectedId("")
    setTab("bills")
    const waitingBill = state.charges.find((item) => item.companyId === active.id && item.planId === plan.id && item.status === "gozleyir")
    if (waitingBill) {
      setNotice(`${waitingBill.invoice} artıq gözləyir. Eyni haqq üçün ikinci qaimə açılmır.`)
      setFocusId(waitingBill.id)
      return
    }
    const amount = chargeAmount(plan, plan.kind === "komissiya" ? order : 0)
    if (amount == null || (plan.kind === "komissiya" && order <= 0)) return
    const billId = id()
    const invoice = nextInvoice(procureNow().charges)
    opening.current = true
    patchProcure((current) => {
      if (current.charges.some((item) => item.companyId === active.id && item.planId === plan.id && item.status === "gozleyir")) return current
      return {
        ...current,
        charges: [...current.charges, { id: billId, companyId: active.id, planId: plan.id, amount: String(amount), invoice, status: "gozleyir" }],
      }
    })
    opening.current = false
    const saved = procureNow().charges.find((item) => item.id === billId)
    if (!saved) {
      const existing = procureNow().charges.find((item) => item.companyId === active.id && item.planId === plan.id && item.status === "gozleyir")
      if (existing) {
        setNotice(`${existing.invoice} artıq gözləyir. Eyni haqq üçün ikinci qaimə açılmır.`)
        setFocusId(existing.id)
      }
      return
    }
    setNotice(`${invoice} açıldı.`)
    setFocusId(billId)
  }

  function saveBill() {
    const amount = editAmount.trim()
    if (!editId || !amount || num(amount) == null) return
    patchProcure((current) => ({
      ...current,
      charges: current.charges.map((row) => row.id === editId && row.status === "gozleyir" ? { ...row, amount } : row),
    }))
    setEditId("")
  }

  function removeBill() {
    if (!dropId) return
    patchProcure((current) => ({
      ...current,
      charges: current.charges.filter((row) => !(row.id === dropId && row.status === "gozleyir")),
    }))
    if (focusId === dropId) setFocusId("")
    setDropId("")
    setNotice("")
  }

  return (
    <Guard path="/tarif">
      <div className="tariff-page">
        <PageHead title="Tariflər" text="Platforma haqları və qaimələr." />
        <Tabs value={tab} onChange={setTab} options={[{ id: "plans", label: "Tariflər" }, { id: "bills", label: "Qaimələr " + bills.length }, { id: "example", label: "Hesablama nümunəsi" }]} />
        {tab === "example" && <Panel className="pad tariff-story">
          <SectionHeader>
            <div>
              <h2>Bir sifarişdə kim nə ödəyir</h2>
              <p className="lede">{buyerName} «{project}» layihəsində {makerName} ilə sifariş bağlayır. Komissiya aşağıdakı məbləğdən düşür.</p>
            </div>
            <label className="tariff-order">
              Sifariş məbləği, ₼
              <Input value={orderSum} inputMode="decimal" onChange={(event) => setOrderSum(event.target.value)} />
            </label>
          </SectionHeader>
          <TableContainer>
            <DataTable>
              <thead>
                <tr>
                  <th>Kim</th>
                  <th>Haqq</th>
                  <th>Nə üçün</th>
                  <th className="num">Məbləğ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.fee} className={showMine && ((row.side === "buyer" && buyerKind(kind)) || (row.side === "maker" && makerKind(kind))) ? "on" : ""}>
                    <td>{row.who}</td>
                    <td>{row.fee}</td>
                    <td>{row.why}</td>
                    <td className="num">{row.amount == null ? "—" : money(row.amount)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td colSpan={3}>Platformanın bu sifarişdən gəliri</td>
                  <td className="num">{money(total)}</td>
                </tr>
              </tbody>
            </DataTable>
          </TableContainer>
          {showMine && active && (
            <p className="tariff-key"><i /> Açıq rəng {active.name} üçündür. Bu şirkətin hər haqqı eyni rəngdədir, ona görə yan-yana sətirlər eyni görünür.</p>
          )}
          <p className="lede">Hesablama modulu bu cəmə daxil deyil: zavod və ya montaj onu ayrıca, aylıq ödəyir. Korporativ tarif seçiləndə aylıq abunə düşür və onun yerinə korporativ məbləğ yazılır.</p>
        </Panel>}
        {tab === "plans" && <>
          <p className="tariff-hint">{admin ? "Tarifi seçərək məbləği və izahı dəyişə bilərsiniz." : "Şirkətinizə uyğun tariflər işarələnib. Ətraflı məlumat üçün tarifi seçin."}</p>
          <TableContainer className="tariff-library"><DataTable>
            <thead><tr><th>Tarif</th><th>Kim üçün</th><th>Ödəniş dövrü</th><th className="num">Qiymət</th>{showMine && <th>Uyğunluq</th>}<th>Aç</th></tr></thead>
            <tbody>{ordered.map((plan) => <tr key={plan.id} tabIndex={0} onClick={() => setSelectedId(plan.id)} onKeyDown={(event) => { if(event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(plan.id) } }}>
              <td><strong>{plan.name}</strong></td><td>{TARIFF[plan.id]?.payer || "—"}</td><td>{TARIFF[plan.id]?.cadence || "—"}</td><td className="num">{feeText(plan)}</td>{showMine && <td>{paysTariff(kind, plan.id) ? <span className="badge pine">Uyğundur</span> : <span className="tariff-hint">—</span>}</td>}<td><Icon name="chevron" /></td>
            </tr>)}</tbody>
          </DataTable></TableContainer>
        </>}
        {selected && <Modal title={selected.name} onClose={() => setSelectedId("")} className="tariff-detail-modal">
          {[selected].map((plan) => {
            const copy = TARIFF[plan.id]
            const mine = paysTariff(kind, plan.id)
            const due = chargeAmount(plan, plan.kind === "komissiya" ? order : 0)
            const blocked = due == null || (plan.kind === "komissiya" && order <= 0)
            return (
              <div key={plan.id} className="tariff-detail">
                <header>
                  <span className="badge pine">{copy?.cadence ?? "Haqq"}</span>
                  {showMine && <span className={mine ? "badge gold" : "badge stone"}>{mine ? "Siz ödəyirsiniz" : "Siz ödəmirsiniz"}</span>}
                </header>
                
                {plan.note && <p className="tariff-note">{plan.note}</p>}
                <p className="tariff-price">{feeText(plan)}{copy && <span>{copy.unit}</span>}</p>
                {copy && (
                  <dl className="tariff-facts">
                    <div><dt>Kim</dt><dd>{copy.payer}</dd></div>
                    <div><dt>Nə vaxt</dt><dd>{copy.when}</dd></div>
                  </dl>
                )}
                {copy && <ul className="tariff-covers">{copy.covers.map((item) => <li key={item}>{item}</li>)}</ul>}
                {plan.kind === "komissiya" && <Field label="Sifariş məbləği, ₼"><Input value={orderSum} inputMode="decimal" onChange={(event) => setOrderSum(event.target.value)} /></Field>}
                <p className="tariff-example"><b>Nümunə.</b> {sampleLine(plan, order)}</p>
                {admin && <TariffEditor plan={plan} onSave={(amount, note) => setPlan(plan, amount, note)} />}
                {showMine && mine && (() => {
                  const openBill = state.charges.find((item) => item.companyId === active?.id && item.planId === plan.id && item.status === "gozleyir")
                  return (
                    <Button type="button" disabled={blocked && !openBill} onClick={() => charge(plan)}>
                      {openBill ? `Açıq qaimə · ${openBill.invoice}` : `Qaimə aç${due == null ? "" : ` · ${money(due)}`}`}
                    </Button>
                  )
                })()}
              </div>
            )
          })}
        </Modal>}
        {tab === "bills" && <Panel className="pad tariff-bills" id="yazilmis-qaimeler">
          <SectionHeader>
            <h2>Yazılmış qaimələr</h2>
            <span>{waiting.length ? `${waiting.length} gözləyir · ${money(waitingSum)}` : bills.length ? "Açıq qaimə yoxdur" : "Hələ yazılmayıb"}</span>
          </SectionHeader>
          {notice && <p className="tariff-opened">{notice}</p>}
          {bills.length === 0 && <p className="lede">{admin ? "Şirkət tarifdən qaimə açanda burada görünəcək." : "Qaimə yaratmaq üçün Tariflər tabından şirkətinizə uyğun tarifi seçin."}</p>}
          {bills.length > 0 && (
            <TableContainer>
              <DataTable>
                <thead>
                  <tr>
                    <th>Qaimə</th>
                    <th>Kim</th>
                    <th>Haqq</th>
                    <th>Vəziyyət</th>
                    <th className="num">Məbləğ</th>
                    <th className="acts"><span className="sr">Əməliyyat</span></th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((item) => {
                    const plan = plans.find((row) => row.id === item.planId)
                    const company = state.companies.find((row) => row.id === item.companyId)
                    const amount = num(item.amount)
                    const open = item.status === "gozleyir"
                    return (
                      <tr key={item.id} id={`bill-${item.id}`} className={focusId === item.id ? "fresh" : ""}>
                        <td>{item.invoice}</td>
                        <td>{company?.name || "Şirkət"}</td>
                        <td>{plan?.name || "Haqq"}</td>
                        <td><span className={open ? "badge gold" : "badge pine"}>{open ? "Gözləyir" : "Ödənilib"}</span></td>
                        <td className="num">{amount == null ? "—" : money(amount)}</td>
                        <td className="acts">
                          {open && (
                            <div className="row-actions stay">
                              {admin && <Button type="button" className="small" onClick={() => patchProcure((current) => ({ ...current, charges: current.charges.map((row) => row.id === item.id ? { ...row, status: "qeyd" } : row) }))}>Təsdiqlə</Button>}
                              <RowMenu label={`${item.invoice} əməliyyat`} items={[
                                { id: "edit", label: "Düzəlt", onClick: () => { setEditId(item.id); setEditAmount(item.amount); setDropId("") } },
                                { id: "delete", label: "Sil", onClick: () => { setDropId(item.id); setEditId("") } },
                              ]} />
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </DataTable>
            </TableContainer>
          )}
        </Panel>}
        {editId && (
          <Modal title="Qaiməni düzəlt" onClose={() => setEditId("")}>
            <Field label="Məbləğ, ₼">
              <Input value={editAmount} inputMode="decimal" autoFocus onChange={(event) => setEditAmount(event.target.value)} />
            </Field>
            <div className="form-actions">
              <Button type="button" className="ghost" onClick={() => setEditId("")}>Ləğv et</Button>
              <Button type="button" disabled={!editAmount.trim() || num(editAmount) == null} onClick={saveBill}>Saxla</Button>
            </div>
          </Modal>
        )}
        {dropId && (
          <Confirm
            title="Qaimə silinsin?"
            text={`${bills.find((item) => item.id === dropId)?.invoice ?? "Qaimə"} silinəcək. Təsdiqlənmiş qaimə silinmir.`}
            onClose={() => setDropId("")}
            onYes={removeBill}
          />
        )}
      </div>
    </Guard>
  )
}

function listed(names: string[], value: string) {
  const key = value.trim().toLocaleLowerCase("az")
  return names.some((item) => item.toLocaleLowerCase("az") === key)
}

function reliabilityOf(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const score = Number(trimmed.replace(",", "."))
  if (!Number.isFinite(score)) return null
  return Math.max(0, Math.min(100, score))
}

function backupState(value: unknown): ReturnType<typeof blankState> | null {
  if (!value || typeof value !== "object") return null
  const row = value as Partial<ReturnType<typeof blankState>>
  if (!Array.isArray(row.companies) || !Array.isArray(row.plans)) return null
  const base = blankState()
  const strings = (items: unknown, fallback: string[]) => Array.isArray(items) ? items.filter((item): item is string => typeof item === "string") : fallback
  const list = (items: unknown) => Array.isArray(items) ? items : []
  return {
    ...base,
    ...row,
    actor: typeof row.actor === "string" && row.actor ? row.actor : base.actor,
    activeId: typeof row.activeId === "string" ? row.activeId : base.activeId,
    companies: row.companies,
    plans: withPlanDefaults(row.plans),
    categories: strings(row.categories, base.categories),
    units: strings(row.units, base.units),
    products: list(row.products),
    prices: list(row.prices),
    rules: list(row.rules),
    files: list(row.files),
    jobs: list(row.jobs),
    logistics: list(row.logistics),
    flows: list(row.flows),
    charges: list(row.charges),
    disputes: list(row.disputes),
    audit: list(row.audit),
  } as ReturnType<typeof blankState>
}

function WordList({
  title,
  names,
  value,
  onChange,
  onAdd,
  label,
  placeholder,
}: {
  title: string
  names: string[]
  value: string
  onChange: (value: string) => void
  onAdd: () => void
  label: string
  placeholder: string
}) {
  const [query, setQuery] = useState("")
  const needle = query.trim().toLocaleLowerCase("az")
  const shown = needle ? names.filter((item) => item.toLocaleLowerCase("az").includes(needle)) : names
  return (
    <div className="dict-block">
      <header>
        <h3>{title}</h3>
        <span>{needle ? `${shown.length} / ${names.length}` : names.length}</span>
      </header>
      <form className="platform-join" onSubmit={(event) => { event.preventDefault(); onAdd() }}>
        <Input aria-label={label} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
        <Button type="submit"  disabled={!value.trim()}>Əlavə et</Button>
      </form>
      <label className="dict-find">
        <Icon name="search" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Siyahıda axtar" aria-label={`${title} axtar`} />
      </label>
      <div className="dict-scroll">
        {shown.length === 0 && <p>{names.length === 0 ? "Siyahı boşdur." : "Uyğun ad yoxdur."}</p>}
        <ul>
          {shown.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
    </div>
  )
}

function DisputeList({
  disputes,
  companies,
  draft,
  onDraft,
  onAdd,
  onToggle,
}: {
  disputes: Dispute[]
  companies: { id: string; name: string }[]
  draft: string
  onDraft: (value: string) => void
  onAdd: () => void
  onToggle: (id: string) => void
}) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<"hamisi" | "aciq" | "bagli">("hamisi")
  const needle = query.trim().toLocaleLowerCase("az")
  const named = disputes.map((item) => ({
    ...item,
    who: companies.find((company) => company.id === item.companyId)?.name || item.company || "Şirkət",
  }))
  const shown = named.filter((item) => {
    if (filter !== "hamisi" && item.status !== filter) return false
    if (!needle) return true
    return `${item.who} ${item.text}`.toLocaleLowerCase("az").includes(needle)
  })
  const openFirst = [...shown].sort((a, b) => Number(b.status === "aciq") - Number(a.status === "aciq"))
  return (
    <>
      <form className="dispute-compose" onSubmit={(event) => { event.preventDefault(); onAdd() }}>
        <Input aria-label="Mübahisə mətni" value={draft} placeholder="Nə baş verib" onChange={(event) => onDraft(event.target.value)} />
        <Button type="submit"  disabled={!draft.trim()}>Aç</Button>
        <label className="dict-find">
          <Icon name="search" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault() }} placeholder="Mübahisədə axtar" aria-label="Mübahisədə axtar" />
        </label>
        <div className="dispute-tabs">
          {([["hamisi", "Hamısı"], ["aciq", "Açıq"], ["bagli", "Bağlı"]] as const).map(([value, label]) => (
            <button key={value} type="button" className={filter === value ? "on" : ""} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
      </form>
      <div className="dict-scroll dispute-scroll">
        {openFirst.length === 0 && <p>{disputes.length === 0 ? "Mübahisə yazılmayıb." : "Uyğun mübahisə yoxdur."}</p>}
        <ul>
          {openFirst.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.who}</strong>
                <p>{item.text}</p>
              </div>
              <button type="button" className={item.status === "aciq" ? "switch on" : "switch"} onClick={() => onToggle(item.id)}>
                <i />
                {item.status === "aciq" ? "Açıq" : "Bağlı"}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

const AUDIT_MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"]

function auditWhen(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return `${date.getDate()} ${AUDIT_MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

function AuditLog({ rows }: { rows: AuditRow[] }) {
  const [query, setQuery] = useState("")
  const needle = query.trim().toLocaleLowerCase("az")
  const shown = [...rows].reverse().filter((item) => !needle || `${item.action} ${item.detail} ${item.actor}`.toLocaleLowerCase("az").includes(needle))
  return (
    <>
      <label className="dict-find">
        <Icon name="search" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Jurnalda axtar" aria-label="Jurnalda axtar" />
      </label>
      <div className="dict-scroll audit-scroll">
        {shown.length === 0 && <p>{rows.length === 0 ? "Jurnal boşdur." : "Uyğun yazı yoxdur."}</p>}
        <ul>
          {shown.map((item) => {
            const when = auditWhen(item.at)
            return (
            <li key={item.id}>
              <strong>{item.action}</strong>
              <p>{item.detail}</p>
              <em>{item.actor}{when ? ` · ${when}` : ""}</em>
            </li>
            )
          })}
        </ul>
      </div>
      <div className="stage-line">
        <span>Sifariş mərhələləri</span>
        <ol>
          {STAGES.map(([, label], index) => <li key={label}><b>{index + 1}</b>{label}</li>)}
        </ol>
      </div>
    </>
  )
}

export function PlatformPage() {
  useTitle("Platforma")
  const state = useProcure()
  const [category, setCategory] = useState("")
  const [unit, setUnit] = useState("")
  const [dispute, setDispute] = useState("")
  const [dictError, setDictError] = useState("")
  const [error, setError] = useState("")
  const [backup, setBackup] = useState<{ name: string; size: number; status: "reading" | "done" } | null>(null)
  const [over, setOver] = useState(false)
  const [scores, setScores] = useState<Record<string, string>>({})
  const openOrders = state.flows.filter((item) => item.stage !== "zemanet").length
  const openDisputes = state.disputes.filter((item) => item.status === "aciq").length

  useEffect(() => {
    if (state.disputes.length > 0 && state.audit.length > 0) return
    const seeded = blankState()
    patchProcure((current) => ({
      ...current,
      disputes: current.disputes.length ? current.disputes : seeded.disputes,
      audit: current.audit.length ? current.audit : seeded.audit,
    }))
  }, [state.disputes.length, state.audit.length])

  function addName(kind: "categories" | "units", value: string, clear: () => void) {
    const name = value.trim()
    if (!name) return
    if (listed(state[kind], name)) {
      setDictError(kind === "categories" ? "Bu kateqoriya artıq var" : "Bu vahid artıq var")
      return
    }
    setDictError("")
    patchProcure((current) => ({ ...current, [kind]: [...current[kind], name] }))
    clear()
  }

  function commitScore(companyId: string) {
    const value = scores[companyId]
    if (value == null) return
    patchProcure((current) => ({
      ...current,
      companies: current.companies.map((item) => item.id === companyId ? { ...item, reliability: value.trim() } : item),
    }))
  }

  function takeBackup(file: File) {
    const ext = file.name.split(".").pop()?.toLocaleLowerCase("az")
    if (ext !== "json") {
      setBackup({ name: file.name, size: file.size, status: "reading" })
      setError("Yalnız JSON ehtiyat faylı qəbul olunur")
      return
    }
    setBackup({ name: file.name, size: file.size, status: "reading" })
    setError("")
    void file.text().then((text) => {
      const next = backupState(JSON.parse(text))
      if (!next) {
        setError("Ehtiyat faylı tanınmadı")
        return
      }
      replaceProcure(next)
      setScores({})
      setBackup({ name: file.name, size: file.size, status: "done" })
      setError("")
    }).catch(() => setError("Ehtiyat faylı oxunmadı"))
  }

  function onBackupDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setOver(false)
    const file = event.dataTransfer.files?.[0]
    if (file) takeBackup(file)
  }

  return (
    <Guard path="/platforma">
      <div className="platform-page">
        <PageHead kicker="İdarə" title="Platforma idarəsi" text="Şirkətlər, təsnifatlar, müraciətlər və audit." />
        <StatGrid>
          <Link to="/sirket">
            <span>Şirkət</span>
            <strong>{state.companies.length}</strong>
          </Link>
          <Link to="/sifaris">
            <span>Açıq sifariş</span>
            <strong>{openOrders}</strong>
          </Link>
          <Link to="/layihe-fayl">
            <span>Fayl</span>
            <strong>{state.files.length}</strong>
          </Link>
          <Link to="/tarif#yazilmis-qaimeler">
            <span>Qaimə</span>
            <strong>{state.charges.length}</strong>
            <em className={openDisputes ? "warn" : ""}>{openDisputes ? `${openDisputes} açıq mübahisə` : "Mübahisə yoxdur"}</em>
          </Link>
        </StatGrid>
        <div className="platform-board">
          <div className="stack">
            <Panel className="pad">
              <SectionHeader>
                <h2>Etibarlılıq</h2>
                <span>0–100</span>
              </SectionHeader>
              {state.companies.length === 0 && <p className="lede">Şirkət yoxdur.</p>}
              <div className="trust-grid">
                {state.companies.map((company) => {
                  const raw = scores[company.id] ?? company.reliability
                  const score = reliabilityOf(raw)
                  const tone = score == null ? "copper" : score < 50 ? "rose" : score < 80 ? "copper" : "pine"
                  return (
                    <article key={company.id} className="trust-card">
                      <header>
                        <strong>{company.name || "Adsız şirkət"}</strong>
                        <span>{kindLabel(company.kind)}</span>
                      </header>
                      <div className="trust-score">
                        <b>{score == null ? "—" : Math.round(score)}</b>
                        <Input
                          aria-label={`${company.name || "Şirkət"} etibarlılığı`}
                          inputMode="decimal"
                          value={raw}
                          placeholder="0–100"
                          onChange={(event) => setScores((current) => ({ ...current, [company.id]: event.target.value }))}
                          onBlur={() => commitScore(company.id)}
                        />
                      </div>
                      <Meter value={score ?? 0} tone={tone} />
                    </article>
                  )
                })}
              </div>
            </Panel>
            <Panel className="pad">
              <SectionHeader>
                <h2>Kateqoriya və vahid</h2>
              </SectionHeader>
              <div className="dict-pair">
                <WordList
                  title="Kateqoriya"
                  names={state.categories}
                  value={category}
                  onChange={(next) => { setCategory(next); setDictError("") }}
                  onAdd={() => addName("categories", category, () => setCategory(""))}
                  label="Yeni kateqoriya"
                  placeholder="Yeni kateqoriya"
                />
                <WordList
                  title="Vahid"
                  names={state.units}
                  value={unit}
                  onChange={(next) => { setUnit(next); setDictError("") }}
                  onAdd={() => addName("units", unit, () => setUnit(""))}
                  label="Yeni vahid"
                  placeholder="Yeni vahid"
                />
              </div>
              {dictError && <p className="form-error">{dictError}</p>}
            </Panel>
            <Panel className="pad">
              <SectionHeader>
                <h2>Mübahisə</h2>
                <span>{openDisputes ? `${openDisputes} açıq` : "Açıq yoxdur"}</span>
              </SectionHeader>
              <DisputeList
                disputes={state.disputes}
                companies={state.companies}
                draft={dispute}
                onDraft={setDispute}
                onAdd={() => {
                  const text = dispute.trim()
                  if (!text) return
                  const who = state.companies.find((company) => company.id === state.activeId)?.name
                  patchProcure((current) => ({ ...current, disputes: [{ id: id(), companyId: current.activeId, company: who, text, status: "aciq" }, ...current.disputes] }))
                  setDispute("")
                }}
                onToggle={(target) => patchProcure((current) => ({ ...current, disputes: current.disputes.map((row) => row.id === target ? { ...row, status: row.status === "aciq" ? "bagli" : "aciq" } : row) }))}
              />
            </Panel>
          </div>
          <div className="stack">
            <Panel className="pad">
              <SectionHeader>
                <h2>Ehtiyat faylı</h2>
                <Button type="button" className="ghost small" onClick={() => download("afez-ehtiyat.json", JSON.stringify(state), "application/json")}>
                  <Icon name="download" />
                  Endir
                </Button>
              </SectionHeader>
              <p className="lede">Şirkət, tarif və sifariş vəziyyəti bir JSON faylındadır. Faylı sahəyə atın və ya seçin.</p>
              <label
                className={`backup-drop${over ? " over" : ""}${backup?.status === "done" && !error ? " done" : ""}${error ? " bad" : ""}`}
                onDragEnter={(event) => { event.preventDefault(); setOver(true) }}
                onDragOver={(event) => { event.preventDefault(); setOver(true) }}
                onDragLeave={(event) => {
                  event.preventDefault()
                  const next = event.relatedTarget
                  if (!(next instanceof Node) || !event.currentTarget.contains(next)) setOver(false)
                }}
                onDrop={onBackupDrop}
              >
                <input
                  type="file"
                  accept=".json,application/json"
                  aria-label="Ehtiyat faylını yüklə"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) takeBackup(file)
                    event.target.value = ""
                  }}
                />
                <Icon name="cloud" />
                <strong>{backup ? backup.name : over ? "Buraxın" : "JSON faylını bura atın"}</strong>
                <span>{backup ? `${fileSize(backup.size)} · ${error ? "qəbul olunmadı" : backup.status === "done" ? "qaytarıldı" : "oxunur"}` : "və ya seçin · yalnız .json"}</span>
              </label>
              {error && <p className="form-error">{error}</p>}
            </Panel>
            <Panel className="pad">
              <SectionHeader>
                <h2>Audit</h2>
                <span>{state.audit.length ? `${state.audit.length} yazı` : "Boş"}</span>
              </SectionHeader>
              <AuditLog rows={state.audit} />
            </Panel>
          </div>
        </div>
      </div>
    </Guard>
  )
}
