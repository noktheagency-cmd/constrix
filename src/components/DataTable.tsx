import { Children, Fragment, cloneElement, isValidElement, useEffect, useState, type ReactElement, type ReactNode, type TableHTMLAttributes } from 'react'
import { flushSync } from 'react-dom'
import { Select } from '../ui'

export const TABLE_PAGE_SIZES = [10, 15, 20, 25, 50, 100]
type Paging = { page: number; pageSize: number; total: number; onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void }
function flatten(children: ReactNode): ReactElement<any>[] {
  return Children.toArray(children).flatMap(child => isValidElement(child) ? child.type === Fragment ? flatten((child.props as { children: ReactNode }).children) : [child] : [])
}
export function TablePagination({ page, pageSize, total, onPageChange, onPageSizeChange }: Paging) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return <div className="data-table-footer">
    <nav aria-label="Cədvəlin səhifələri" className="data-table-pagination">
      <button type="button" aria-label="İlk səhifə" disabled={page <= 1} onClick={() => onPageChange(1)}>«</button>
      <button type="button" aria-label="Əvvəlki səhifə" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>‹</button>
      <span>{page} / {pages}</span>
      <button type="button" aria-label="Növbəti səhifə" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>›</button>
      <button type="button" aria-label="Son səhifə" disabled={page >= pages} onClick={() => onPageChange(pages)}>»</button>
      <span className="muted">{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}` : '0'} / {total} sətir</span>
    </nav>
    <label className="data-table-size">Səhifədə <Select ariaLabel="Səhifədə sətir sayı" value={String(pageSize)} onValueChange={value => onPageSizeChange(Number(value))} options={TABLE_PAGE_SIZES.map(size => ({ value: String(size), label: String(size) }))} /></label>
  </div>
}

/** Native table semantics and row actions, with one shared paging contract. */
export function DataTable({ children, pagination, ...props }: TableHTMLAttributes<HTMLTableElement> & { pagination?: Paging }) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [printing, setPrinting] = useState(false)
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true)), after = () => flushSync(() => setPrinting(false))
    window.addEventListener('beforeprint', before); window.addEventListener('afterprint', after)
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after) }
  }, [])
  const parts = flatten(children)
  const rows = parts.filter(part => part.type === 'tbody').flatMap(part => flatten(part.props.children))
  const total = rows.filter(row => !row.props['data-table-empty']).length
  const current = Math.min(page, Math.max(1, Math.ceil(total / pageSize)))
  const identity = rows.map(row => row.key).join('|')
  useEffect(() => { setPage(1) }, [identity])
  const paging = pagination ?? { page: current, pageSize, total, onPageChange: setPage, onPageSizeChange: (size: number) => { setPageSize(size); setPage(1) } }
  let offset = 0
  return <div className="data-table"><div className="data-table-scroll"><table {...props}>{parts.map(part => {
    if (part.type !== 'tbody' || pagination || printing) return part
    const bodyRows = flatten(part.props.children)
    const start = Math.max(0, (current - 1) * pageSize - offset), end = Math.max(0, current * pageSize - offset)
    offset += bodyRows.length
    return cloneElement(part, {}, bodyRows.slice(start, end))
  })}</table></div><TablePagination {...paging} /></div>
}
