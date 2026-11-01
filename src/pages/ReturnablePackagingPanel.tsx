import { useEffect, useState } from 'react'
import { DataTable } from '../components/DataTable'
import { Button, Input, TableContainer } from '../components/primitives'
import { ApiError, api } from '../api'
import { dateAZ, num } from '../format'
import { usePrefs } from '../i18n'
import { useStore } from '../store'
import { Empty, Select } from '../ui'

type EventRow = { id: string; kind: string; qty: number; status: string; reason: string; evidenceRef: string; requestedBy: string; reviewedBy: string | null; supplierRepName: string | null; supplierDocumentRef: string | null; responsibilityNote: string | null; createdAt: string }
type PackagingCase = {
  id: string; supplierName: string; packageType: string; projectId: string; projectName: string; locationId: string; locationName: string
  custodianAccountId: string; custodianName: string; receivedQty: number; returnedQty: number; resolvedQty: number; balanceQty: number
  pendingQty: number; dueAt: string; overdue: boolean; status: string; note: string; createdBy: string; acceptedBy: string | null; acceptedAt: string | null
  createdAt: string; events: EventRow[]
}
type Member = { accountId: string; name: string; canHoldReturnablePackaging: boolean; active: boolean }

export function ReturnablePackagingPanel({ receiverOnly, canCreate, canReview }: { receiverOnly: boolean; canCreate: boolean; canReview: boolean }) {
  const { session } = usePrefs()
  const { projects, locations } = useStore()
  const [rows, setRows] = useState<PackagingCase[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [projectId, setProjectId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [custodianAccountId, setCustodianAccountId] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [packageType, setPackageType] = useState('Poddon')
  const [qty, setQty] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [note, setNote] = useState('')
  const [caseId, setCaseId] = useState('')
  const [kind, setKind] = useState<'return' | 'loss' | 'damage'>('return')
  const [eventQty, setEventQty] = useState('')
  const [reason, setReason] = useState('')
  const [evidenceRef, setEvidenceRef] = useState('')
  const [supplierRepName, setSupplierRepName] = useState('')
  const [supplierDocumentRef, setSupplierDocumentRef] = useState('')
  const [responsibilityNote, setResponsibilityNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const projectLocations = locations.filter((row) => row.projectId === projectId)

  async function reload() {
    if (!session) return
    setBusy(true); setError('')
    try { setRows(await api<PackagingCase[]>('/api/returnable-packaging')) }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Tara reyestri yüklənmədi') }
    finally { setBusy(false) }
  }
  useEffect(() => { void reload() }, [session?.userId])
  useEffect(() => {
    setLocationId(''); setCustodianAccountId('')
    if (!projectId || !session) { setMembers([]); return }
    let current = true
    void api<Member[]>(`/api/returnable-packaging/custodians?projectId=${encodeURIComponent(projectId)}`)
      .then((items) => { if (current) setMembers(items.filter((item) => item.active && item.canHoldReturnablePackaging)) })
      .catch((cause) => { if (current) setError(cause instanceof ApiError ? cause.message : 'Tara məsulları yüklənmədi') })
    return () => { current = false }
  }, [projectId, session?.userId])

  async function runRequest(path: string, body: Record<string, unknown>, success: string) {
    setBusy(true); setError(''); setNotice('')
    try { await api(path, { method: 'POST', body: JSON.stringify(body) }); setNotice(success); await reload() }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Əməliyyat tamamlanmadı') }
    finally { setBusy(false) }
  }
  function createCase() {
    return runRequest('/api/returnable-packaging', { id: crypto.randomUUID(), key: crypto.randomUUID(), supplierName, packageType, projectId, locationId, custodianAccountId, qty, dueAt, note }, 'Tara məsula imza üçün göndərildi.')
  }
  function accept(id: string) { return runRequest(`/api/returnable-packaging/${encodeURIComponent(id)}/accept`, { key: crypto.randomUUID() }, 'Tara məsul tərəfindən qəbul edildi.') }
  function report() {
    return runRequest(`/api/returnable-packaging/${encodeURIComponent(caseId)}/events`, { id: crypto.randomUUID(), key: crypto.randomUUID(), kind, qty: eventQty, reason, evidenceRef }, kind === 'return' ? 'Qaytarma sorğusu anbar təsdiqinə göndərildi.' : 'İtki/zədə aktı rəhbər baxışına göndərildi.')
  }
  function confirmReturn(eventId: string) {
    return runRequest(`/api/returnable-packaging/events/${encodeURIComponent(eventId)}/confirm-return`, { key: crypto.randomUUID(), supplierRepName, supplierDocumentRef }, 'Təchizatçının sənədli qəbul imzası qeydə alındı.')
  }
  function reviewIncident(eventId: string, decision: 'approve' | 'reject') {
    return runRequest(`/api/returnable-packaging/events/${encodeURIComponent(eventId)}/review-incident`, { key: crypto.randomUUID(), decision, responsibilityNote }, decision === 'approve' ? 'Sənədli akt təsdiqləndi; avtomatik borc yaradılmadı.' : 'İtki/zədə aktı rədd edildi.')
  }

  return <>
    <p className="muted">Tara material stokundan ayrı reyestrdə izlənir. Son tarix hər qəbul sənədində ayrıca seçilir; vahid qaytarma müddəti hələ təsdiqlənməyib. Təsdiqlənmiş itki/zədə aktı qalığı bağlayır, avtomatik maliyyə borcu yaratmır.</p>
    {canCreate && <section className="panel"><h2>Təchizatçıdan tara qəbulu</h2><div className="form-row">
      <label>Təchizatçı<Input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} maxLength={200} /></label>
      <label>Tara növü<Input value={packageType} onChange={(event) => setPackageType(event.target.value)} maxLength={120} /></label>
      <label>Layihə<Select value={projectId} onValueChange={setProjectId} options={[{ value: '', label: 'Layihə seçin' }, ...projects.map((row) => ({ value: row.id, label: row.name }))]} /></label>
      <label>Anbar<Select value={locationId} onValueChange={setLocationId} options={[{ value: '', label: 'Anbar seçin' }, ...projectLocations.map((row) => ({ value: row.id, label: row.name }))]} /></label>
      <label>Tara məsulu<Select value={custodianAccountId} onValueChange={setCustodianAccountId} options={[{ value: '', label: 'Məsul seçin' }, ...members.map((row) => ({ value: row.accountId, label: row.name }))]} /></label>
      <label>Miqdar<Input inputMode="decimal" value={qty} onChange={(event) => setQty(event.target.value)} placeholder="0.000" /></label>
      <label>Qaytarılma son tarixi<Input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
      <label>Qeyd / təhvil sənədi<Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} /></label>
    </div><div className="form-actions"><Button type="button" disabled={busy || !supplierName.trim() || !packageType.trim() || !projectId || !locationId || !custodianAccountId || !qty || !dueAt} onClick={() => void createCase()}>Məsula imza üçün göndər</Button></div></section>}

    {receiverOnly && <section className="panel"><h2>Tara qaytarma / itki / zədə aktı</h2><div className="form-row">
      <label>Tara sənədi<Select value={caseId} onValueChange={setCaseId} options={[{ value: '', label: 'Sənəd seçin' }, ...rows.filter((row) => row.status === 'open' && row.balanceQty > row.pendingQty).map((row) => ({ value: row.id, label: `${row.supplierName} · ${row.packageType} · sərbəst ${num(row.balanceQty - row.pendingQty, 3)}` }))]} /></label>
      <label>Hərəkət<Select value={kind} onValueChange={(value) => setKind(value as 'return' | 'loss' | 'damage')} options={[{ value: 'return', label: 'Təchizatçıya qaytarma' }, { value: 'loss', label: 'İtki aktı' }, { value: 'damage', label: 'Zədə aktı' }]} /></label>
      <label>Miqdar<Input inputMode="decimal" value={eventQty} onChange={(event) => setEventQty(event.target.value)} placeholder="0.000" /></label>
      <label>Səbəb<Input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} /></label>
      {kind !== 'return' && <label>Akt / sübut istinadı<Input value={evidenceRef} onChange={(event) => setEvidenceRef(event.target.value)} maxLength={500} /></label>}
    </div><div className="form-actions"><Button type="button" disabled={busy || !caseId || !eventQty || !reason.trim() || (kind !== 'return' && !evidenceRef.trim())} onClick={() => void report()}>Sorğunu göndər</Button></div></section>}

    {(canCreate || canReview) && <section className="panel"><h2>Təchizatçı imzası və akt qərarı</h2><div className="form-row">
      <label>Təchizatçı nümayəndəsi<Input value={supplierRepName} onChange={(event) => setSupplierRepName(event.target.value)} maxLength={160} /></label>
      <label>İmzalı qaytarma sənədi<Input value={supplierDocumentRef} onChange={(event) => setSupplierDocumentRef(event.target.value)} maxLength={500} /></label>
      <label>İtki/zədə qərarı — məsuliyyət qeydi<Input value={responsibilityNote} onChange={(event) => setResponsibilityNote(event.target.value)} maxLength={500} placeholder="Borcsuz bağlama və ya ayrıca araşdırma qeydi" /></label>
    </div><p className="muted">Aşağıdakı gözləyən qaytarmada anbar məsulu və təchizatçı nümayəndəsinin adı/sənədi tələb olunur. İtki/zədə təsdiqində məsuliyyət qeydi saxlanır, sistem payable yazmır.</p></section>}

    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="lede" role="status">{notice}</p>}
    <TableContainer className="wide"><DataTable><thead><tr><th>Təchizatçı / növ</th><th>Layihə / anbar</th><th>Məsul şəxs</th><th className="num">Qəbul</th><th className="num">Qaytarılıb / bağlanıb</th><th className="num">Açıq qalıq</th><th>Son tarix / xəbərdarlıq</th><th>Status / imza və aktlar</th><th></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><b>{row.supplierName}</b><div className="muted">{row.packageType} · {row.id.slice(0, 8)}</div></td><td>{row.projectName}<div className="muted">{row.locationName}</div></td><td>{row.custodianName}</td><td className="num">{num(row.receivedQty, 3)}</td><td className="num">{num(row.returnedQty, 3)} / {num(row.resolvedQty, 3)}</td><td className="num">{num(row.balanceQty, 3)}{row.pendingQty > 0 && <div className="muted">{num(row.pendingQty, 3)} təsdiq gözləyir</div>}</td><td>{dateAZ(row.dueAt)}{row.overdue && <div className="form-error">Gecikib</div>}</td><td>{row.status === 'waiting_custodian' ? 'Məsul imzası gözlənilir' : row.status === 'closed' ? 'Bağlanıb' : `Açıq · ${row.acceptedBy || 'məsul imzası'}`}{row.events.map((event) => <div key={event.id} className="muted">{event.kind === 'return' ? `Qaytarma ${num(event.qty, 3)}` : event.kind === 'loss' ? `İtki ${num(event.qty, 3)}` : `Zədə ${num(event.qty, 3)}`} · {event.status}{event.evidenceRef && ` · ${event.evidenceRef}`}{event.supplierRepName && ` · ${event.supplierRepName} / ${event.supplierDocumentRef}`}{event.responsibilityNote && ` · ${event.responsibilityNote}`}{event.status === 'pending' && event.kind === 'return' && canCreate && <div><Button type="button" className="small" disabled={busy || !supplierRepName.trim() || !supplierDocumentRef.trim()} onClick={() => void confirmReturn(event.id)}>Təchizatçıya qaytarışı təsdiqlə</Button></div>}{event.status === 'pending' && event.kind !== 'return' && canReview && <div className="form-actions"><Button type="button" className="small" disabled={busy || !responsibilityNote.trim()} onClick={() => void reviewIncident(event.id, 'approve')}>Aktı təsdiqlə</Button><Button type="button" className="small ghost" disabled={busy} onClick={() => void reviewIncident(event.id, 'reject')}>Rədd et</Button></div>}</div>)}</td><td>{receiverOnly && row.status === 'waiting_custodian' && <Button type="button" className="small" disabled={busy} onClick={() => void accept(row.id)}>Qəbul et və imzala</Button>}</td></tr>)}</tbody></DataTable>{!busy && rows.length === 0 && <Empty title="Tara qeydi yoxdur" text="Qablaşdırma təchizatçıdan qəbul ediləndə və məsula təhvil veriləndə bu reyestrdə görünəcək." />}</TableContainer>
  </>
}
