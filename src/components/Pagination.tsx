import { Button } from "./primitives"
import { Icon } from "../icons"

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  if (!total) return null
  const pages = Math.ceil(total / pageSize)
  const numbers = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1)
  return <div className="collection-pagination">
    <span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total} fayl</span>
    {pages > 1 && <nav aria-label="Faylların səhifələri">
      <Button className="ghost small" aria-label="Əvvəlki səhifə" disabled={page === 1} onClick={() => onChange(page - 1)}><Icon name="chevronLeft" /></Button>
      {numbers.map((n, i) => <span key={n} className="pagination-number">
        {i > 0 && n - numbers[i - 1] > 1 && <span aria-hidden="true">…</span>}
        <Button className="ghost small" aria-label={`${n}-ci səhifə`} aria-current={page === n ? "page" : undefined} onClick={() => onChange(n)}>{n}</Button>
      </span>)}
      <Button className="ghost small" aria-label="Növbəti səhifə" disabled={page === pages} onClick={() => onChange(page + 1)}><span className="next-page-icon"><Icon name="chevronLeft" /></span></Button>
    </nav>}
  </div>
}
