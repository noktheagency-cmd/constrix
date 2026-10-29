import { DataTable } from './DataTable'
import { useEffect, useState } from 'react'
import { api } from '../api'
import { Select } from '../ui'
import { Button, Panel, SearchInput, TableContainer, Toolbar } from './primitives'

type Book = { id: string; name: string; sheets: { id: string; name: string; rowCount: number; cellCount: number }[] }
type Cell = { column: string; value: string | number | null; formula?: string }
type Result = { columns: string[]; rows: { number: number; cells: Cell[] }[]; page: number; pages: number; total: number }

export function SourceWorkbookViewer({ kind,boqId }: { kind: 'purchase' | 'nakopitel' | 'boq';boqId?:string }) {
  const [books, setBooks] = useState<Book[]>([])
  const [sheetId, setSheetId] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [data, setData] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting,setExporting]=useState(false)
  async function exportPrices(){
    if(!book||!boqId)return;setExporting(true);setError('');
    try{const response=await fetch(`/api/platform/source-workbooks/${book.id}/prices`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({boqId})});if(!response.ok){const body=await response.json();throw new Error(body.message||'İxrac alınmadı')}const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download=book.name.replace(/\.xlsx$/i,'-qiymet.xlsx');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){setError(e instanceof Error?e.message:'İxrac alınmadı')}finally{setExporting(false)}
  }
  useEffect(() => {
    let live = true
    api<Book[]>(`/api/platform/source-workbooks?kind=${kind}`).then(rows => {
      if (!live) return
      setBooks(rows); setSheetId(rows[0]?.sheets[0]?.id || ''); setError(''); setLoading(false)
    }).catch(e => { if (live) { setError(e.message); setLoading(false) } })
    return () => { live = false }
  }, [kind])
  useEffect(() => {
    if (!sheetId) return
    let live = true
    setLoading(true); setError(''); setData(null)
    const timer = setTimeout(() => {
      api<Result>(`/api/platform/source-sheets/${encodeURIComponent(sheetId)}?page=${page}&pageSize=${pageSize}&q=${encodeURIComponent(query)}`).then(result => {
        if (live) { setData(result); setLoading(false) }
      }).catch(e => { if (live) { setError(e.message); setLoading(false) } })
    }, 200)
    return () => { live = false; clearTimeout(timer) }
  }, [sheetId, page, pageSize, query])
  const book = books.find(item => item.sheets.some(sheet => sheet.id === sheetId))
  return <section className="source-workbook">
    <Panel className="pad"><strong>Excel mənbəsi</strong><p className="muted">Bütün vərəqlər və doldurulmuş sütunlar. Rəqəmlər Excel-in saxlanmış nəticələridir; formulun üzərinə gəldikdə mənbə düsturu görünür. Orijinal fayl format və şəkilləri ilə saxlanılıb.</p>
      <Toolbar><Select ariaLabel="Excel vərəqi" value={sheetId} onValueChange={value => { setSheetId(value); setPage(1) }} options={books.flatMap(item => item.sheets.map(sheet => ({ value: sheet.id, label: sheet.name })))} />
      {book && <a className="btn ghost" href={`/api/platform/source-workbooks/${book.id}/download`}>Orijinalı yüklə</a>}{kind==='boq'&&boqId&&<Button disabled={exporting} onClick={()=>void exportPrices()}>{exporting?'Hazırlanır…':'Qiymətləri orijinal şablonda yüklə'}</Button>}</Toolbar>
      {kind==='boq'&&<p className="muted">Əvvəl qiymətləri və tarixlərini yoxlayın, sətirləri təsdiqləyib “Bazaya yaz” seçin. İxrac yalnız həmin aktual qiymətləri J/K xanalarına yazır; orijinal düsturlar, vərəqlər və format saxlanır. Mənbənin mövcud formula xətaları düzəldilmiş sayılmır.</p>}
      <SearchInput aria-label="Excel sətirlərində axtar" placeholder="Bütün sətirlərdə axtar" value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} />
    </Panel>
    {error && <p role="alert" className="form-error">{error}</p>}
    {loading && <p role="status">Yüklənir…</p>}
    {!loading && !books.length && !error && <p>Bu şirkət üçün Excel mənbəsi yüklənməyib.</p>}
    {data && <><Toolbar><span className="muted">{book?.name} · {data.total} dolu sətir · {data.columns.length} sütun</span></Toolbar>
      <TableContainer className="source-sheet-table"><DataTable pagination={{ page: data.page, pageSize, total: data.total, onPageChange: setPage, onPageSizeChange: size => { setPageSize(size); setPage(1) } }}><thead><tr><th>Sətir</th>{data.columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{data.rows.map(row => <tr key={row.number}><th scope="row">{row.number}</th>{data.columns.map(column => { const cell = row.cells.find(c => c.column === column); return <td key={column} title={cell?.formula || undefined} className={typeof cell?.value === 'string' && /^#(REF!|DIV\/0!|VALUE!|N\/A|NAME\?)/.test(cell.value) ? 'source-cell-error' : undefined}>{cell?.value == null ? (cell?.formula ? 'Nəticə saxlanılmayıb' : '') : String(cell.value)}</td> })}</tr>)}</tbody></DataTable></TableContainer></>}
  </section>
}
