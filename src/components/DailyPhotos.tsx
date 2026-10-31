import { useState } from 'react'
import { api } from '../api'
import { MarketDownload, type MarketFile } from './MarketDocuments'
import { Button } from './primitives'

export function DailyPhotos({ value, onChange, onBusyChange }: { value: string[]; onChange: (ids: string[]) => void; onBusyChange?: (busy: boolean) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function upload(files: File[]) {
    if (files.length + value.length > 30) { setError('Bir gündəliyə ən çox 30 şəkil əlavə olunur.'); return }
    setBusy(true); onBusyChange?.(true); setError('')
    const ids = [...value]
    try {
      for (const file of files) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) throw new Error('PNG, JPEG və ya WebP şəkli seçin; hər fayl ən çox 20 MB ola bilər.')
        const row = await api<MarketFile>('/api/blob-files', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'x-file-name': encodeURIComponent(file.name), 'x-file-kind': 'project', 'x-upload-key': crypto.randomUUID() }, body: file })
        if (row.scanStatus !== 'clean') throw new Error(row.scanNote || 'Şəkil təhlükəsizlik yoxlamasını keçmədi.')
        ids.push(row.id)
      }
    } catch (error) { setError(error instanceof Error ? error.message : 'Şəkillər yüklənmədi.') }
    finally { onChange(ids); setBusy(false); onBusyChange?.(false) }
  }
  return <div><label>Şəkillər · {value.length}/30<input type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ''; void upload(files) }} /></label>
    {busy && <p role="status">Şəkillər yüklənir və yoxlanılır…</p>}{error && <p role="alert" className="form-error">{error}</p>}
    {value.map((id, index) => <div key={id}><MarketDownload id={id} label={`Şəkil ${index + 1}`} /><Button type="button" className="ghost small" disabled={busy} onClick={() => onChange(value.filter(fileId => fileId !== id))}>Çıxar</Button></div>)}
  </div>
}
