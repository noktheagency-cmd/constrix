import { useEffect, useState } from 'react'
import { DataTable } from '../components/DataTable'
import { Button, Input, TableContainer } from '../components/primitives'
import { ApiError, api } from '../api'
import { dateAZ, num } from '../format'
import { usePrefs } from '../i18n'
import { useStore } from '../store'
import { Empty, Select } from '../ui'

type CustodyAction = { id: string; kind: string; qty: number; status: string; reason: string; requestedBy: string; reviewedBy: string | null; reviewedAt: string | null; reviewReason: string | null; createdAt: string }
type Handover = {
  id: string; projectId: string; projectName: string; locationId: string; locationName: string
  materialId: string; materialName: string; unit: string; custodianAccountId: string; custodianName: string
  qty: number; remainingQty: number; custodyBalanceQty: number; status: string; reason: string; createdBy: string
  acceptedBy: string | null; acceptedAt: string | null; createdAt: string; actions: CustodyAction[]
}
type Custodian = { accountId: string; name: string; email: string; seatRole: string }
type ReviewItem = { id: string; kind: string; qty: number; reason: string; requestedBy: string; createdAt: string; handoverId: string; projectName: string; locationName: string; materialName: string; unit: string; custodianName: string }

export function MaterialHandoverPanel({ receiverOnly, canCreate, canReviewUse }: { receiverOnly: boolean; canCreate: boolean; canReviewUse: boolean }) {
  const { session } = usePrefs()
  const { projects, locations, materials } = useStore()
  const [rows, setRows] = useState<Handover[]>([])
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>([])
  const [custodians, setCustodians] = useState<Custodian[]>([])
  const [projectId, setProjectId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [materialId, setMaterialId] = useState('')
  const [custodianAccountId, setCustodianAccountId] = useState('')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [actionHandoverId, setActionHandoverId] = useState('')
  const [actionKind, setActionKind] = useState<'consume' | 'return'>('consume')
  const [actionQty, setActionQty] = useState('')
  const [actionReason, setActionReason] = useState('')
  const [reviewReason, setReviewReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const projectLocations = locations.filter((row) => row.projectId === projectId)

  async function reload() {
    if (!session) return
    setBusy(true); setError('')
    try {
      const [items, queue] = await Promise.all([
        api<Handover[]>('/api/material-handovers'),
        canReviewUse ? api<ReviewItem[]>('/api/material-handovers/review-queue') : Promise.resolve([] as ReviewItem[]),
      ])
      setRows(items); setReviewQueue(queue)
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Təhvil siyahısı yüklənmədi') }
    finally { setBusy(false) }
  }

  useEffect(() => { void reload() }, [session?.userId, canReviewUse])
  useEffect(() => {
    setLocationId(''); setCustodianAccountId('')
    if (!projectId || !session) { setCustodians([]); return }
    let current = true
    void api<Custodian[]>(`/api/material-handovers/custodians?projectId=${encodeURIComponent(projectId)}`)
      .then((items) => { if (current) setCustodians(items) })
      .catch((cause) => { if (current) setError(cause instanceof ApiError ? cause.message : 'Məsul şəxslər yüklənmədi') })
    return () => { current = false }
  }, [projectId, session?.userId])

  async function create() {
    if (!session) { setError('Bu əməliyyat üçün istifadəçi sessiyası tələb olunur'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      await api('/api/material-handovers', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), key: crypto.randomUUID(), projectId, locationId, materialId, custodianAccountId, qty, reason }) })
      setQty(''); setReason(''); setNotice('Təhvil imza üçün məsul şəxsə göndərildi.'); await reload()
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Təhvil yaradıla bilmədi') }
    finally { setBusy(false) }
  }

  async function accept(id: string) {
    if (!session) return
    setBusy(true); setError(''); setNotice('')
    try {
      await api(`/api/material-handovers/${encodeURIComponent(id)}/accept`, { method: 'POST', body: JSON.stringify({ key: crypto.randomUUID() }) })
      setNotice('Təhvil qəbul edildi və məsul şəxs balansına yazıldı.'); await reload()
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Təhvil qəbul edilmədi') }
    finally { setBusy(false) }
  }

  async function submitAction() {
    if (!session || !actionHandoverId) return
    setBusy(true); setError(''); setNotice('')
    try {
      await api(`/api/material-handovers/${encodeURIComponent(actionHandoverId)}/actions`, { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), key: crypto.randomUUID(), kind: actionKind, qty: actionQty, reason: actionReason }) })
      setActionQty(''); setActionReason(''); setNotice('Sorğu layihə rəhbəri/nəzarətçinin təsdiq növbəsinə göndərildi.'); await reload()
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Sorğu göndərilmədi') }
    finally { setBusy(false) }
  }

  async function reviewAction(id: string, decision: 'approve' | 'reject') {
    if (!session) return
    setBusy(true); setError(''); setNotice('')
    try {
      await api(`/api/material-handovers/actions/${encodeURIComponent(id)}/review`, { method: 'POST', body: JSON.stringify({ key: crypto.randomUUID(), decision, reason: reviewReason }) })
      setReviewReason(''); setNotice(decision === 'approve' ? 'Sərfiyyat/qaytarma təsdiqləndi.' : 'Sorğu səbəblə rədd edildi.'); await reload()
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Sorğuya qərar verilmədi') }
    finally { setBusy(false) }
  }

  return <>
    <p className="muted">Təhvil imzalanandan sonra məsul şəxs sərfiyyat və ya anbara qaytarma sorğusu yaradır. Stoku yalnız layihə rəhbəri/təyin edilmiş nəzarətçinin yekun təsdiqi dəyişir; qaytarma custody qalığını azaldır, fiziki stok əvvəlcədən azalmadığı üçün dəyişmir.</p>
    {!session && <p className="form-error" role="alert">Məsul şəxsə təhvil server sessiyası ilə işləyir.</p>}
    {canCreate && <section className="panel">
      <h2>Yeni təhvil</h2>
      <div className="form-row">
        <label>Layihə<Select value={projectId} onValueChange={setProjectId} options={[{ value: '', label: 'Layihə seçin' }, ...projects.map((row) => ({ value: row.id, label: row.name }))]} /></label>
        <label>Sahə anbarı<Select value={locationId} onValueChange={setLocationId} options={[{ value: '', label: 'Anbar seçin' }, ...projectLocations.map((row) => ({ value: row.id, label: row.name }))]} /></label>
        <label>Material<Select value={materialId} onValueChange={setMaterialId} options={[{ value: '', label: 'Material seçin' }, ...materials.map((row) => ({ value: row.id, label: row.name }))]} /></label>
        <label>Məsul şəxs<Select value={custodianAccountId} onValueChange={setCustodianAccountId} options={[{ value: '', label: 'İstifadəçi seçin' }, ...custodians.map((row) => ({ value: row.accountId, label: `${row.name} · ${row.seatRole}` }))]} /></label>
        <label>Miqdar<Input inputMode="decimal" value={qty} onChange={(event) => setQty(event.target.value)} placeholder="0.000" /></label>
        <label>Səbəb / iş hissəsi<Input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} /></label>
      </div>
      <div className="form-actions"><Button type="button" disabled={busy || !projectId || !locationId || !materialId || !custodianAccountId || !qty} onClick={() => void create()}>{busy ? 'Göndərilir…' : 'İmza üçün göndər'}</Button></div>
    </section>}
    {receiverOnly && <section className="panel">
      <h2>Sərfiyyat və ya qaytarma sorğusu</h2>
      <div className="form-row">
        <label>Təhvil / material<Select value={actionHandoverId} onValueChange={setActionHandoverId} options={[{ value: '', label: 'Təhvil seçin' }, ...rows.filter((row) => row.status === 'accepted' && row.remainingQty > 0).map((row) => ({ value: row.id, label: `${row.materialName} · ${row.projectName} · qalıq ${num(row.remainingQty, 3)} ${row.unit}` }))]} /></label>
        <label>Əməliyyat<Select value={actionKind} onValueChange={(value) => setActionKind(value as 'consume' | 'return')} options={[{ value: 'consume', label: 'Faktiki sərfiyyat' }, { value: 'return', label: 'Anbara qaytarma' }]} /></label>
        <label>Miqdar<Input inputMode="decimal" value={actionQty} onChange={(event) => setActionQty(event.target.value)} placeholder="0.000" /></label>
        <label>Səbəb / iş hissəsi<Input value={actionReason} onChange={(event) => setActionReason(event.target.value)} maxLength={500} /></label>
      </div>
      <div className="form-actions"><Button type="button" disabled={busy || !actionHandoverId || !actionQty || !actionReason.trim()} onClick={() => void submitAction()}>{busy ? 'Göndərilir…' : 'Təsdiqə göndər'}</Button></div>
    </section>}
    {canReviewUse && <section className="panel">
      <h2>Faktiki sərfiyyat və qaytarma — təsdiq növbəsi</h2>
      {reviewQueue.length > 0 && <label>Rədd səbəbi (rədd edərkən məcburidir)<Input value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} maxLength={500} /></label>}
      <TableContainer><DataTable><thead><tr><th>Layihə / anbar</th><th>Material</th><th>Məsul şəxs</th><th>Növ</th><th className="num">Miqdar</th><th>Səbəb</th><th>Əməliyyat</th></tr></thead><tbody>{reviewQueue.map((item) => <tr key={item.id}><td>{item.projectName}<div className="muted">{item.locationName}</div></td><td>{item.materialName}</td><td>{item.custodianName}<div className="muted">{item.requestedBy}</div></td><td>{item.kind === 'consume' ? 'Faktiki sərfiyyat' : 'Anbara qaytarma'}</td><td className="num">{num(item.qty, 3)} {item.unit}</td><td>{item.reason}</td><td><div className="form-actions"><Button type="button" className="small" disabled={busy} onClick={() => void reviewAction(item.id, 'approve')}>Təsdiqlə</Button><Button type="button" className="small ghost" disabled={busy || !reviewReason.trim()} onClick={() => void reviewAction(item.id, 'reject')}>Rədd et</Button></div></td></tr>)}</tbody></DataTable>{reviewQueue.length === 0 && <Empty title="Təsdiq gözləyən sorğu yoxdur" text="Yeni sərfiyyat və qaytarma sorğuları burada görünəcək." />}</TableContainer>
    </section>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="lede" role="status">{notice}</p>}
    <TableContainer className="wide"><DataTable><thead><tr><th>Sənəd</th><th>Layihə / anbar</th><th>Material</th><th>Məsul şəxs</th><th className="num">Təhvil</th><th className="num">Cari balans</th><th>Status / imza</th><th>Sərfiyyat və qaytarma</th><th></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><b>{row.id.slice(0, 8)}</b><div className="muted">{dateAZ(row.createdAt.slice(0, 10))} · {row.createdBy}</div></td><td>{row.projectName}<div className="muted">{row.locationName}</div></td><td>{row.materialName}</td><td>{row.custodianName}</td><td className="num">{num(row.qty, 3)} {row.unit}</td><td className="num">{num(row.custodyBalanceQty, 3)} {row.unit}</td><td>{row.status === 'accepted' ? `Qəbul: ${row.acceptedBy || 'imza'} · ${row.acceptedAt ? dateAZ(row.acceptedAt.slice(0, 10)) : ''}` : row.status === 'waiting_custodian' ? 'Qəbul imzası gözlənilir' : 'Ləğv edilib'}{row.reason && <div className="muted">{row.reason}</div>}</td><td>{row.actions.map((action) => <div key={action.id} className="muted">{action.kind === 'consume' ? 'Sərfiyyat' : 'Qaytarma'}: {num(action.qty, 3)} · {action.status === 'pending' ? 'təsdiq gözləyir' : action.status === 'approved' ? `təsdiq: ${action.reviewedBy || ''}` : `rədd: ${action.reviewReason || ''}`}</div>)}</td><td>{receiverOnly && row.status === 'waiting_custodian' && <Button type="button" className="small" disabled={busy} onClick={() => void accept(row.id)}>Qəbul et və imzala</Button>}</td></tr>)}</tbody></DataTable>{!busy && rows.length === 0 && <Empty title="Təhvil qeydi yoxdur" text="Yaradılmış təhvil və məsul şəxsdəki materiallar burada görünəcək." />}</TableContainer>
  </>
}
