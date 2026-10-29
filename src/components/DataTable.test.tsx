import assert from 'node:assert/strict'
import test from 'node:test'
import { Fragment, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PrefsProvider } from '../i18n'
import { DataTable, TABLE_PAGE_SIZES } from './DataTable'

Object.defineProperty(globalThis, 'window', {value:{matchMedia:()=>({matches:false})},configurable:true})
const render = (children: ReactNode) => renderToStaticMarkup(<PrefsProvider>{children}</PrefsProvider>)

test('defaults to ten data rows, preserves headers/totals and handles fragments', () => {
  const html = render(<DataTable><thead><tr><th>Name</th></tr></thead><tbody><Fragment>{Array.from({length: 125}, (_, i) => <tr key={i}><td>{`row-${i + 1}!`}</td></tr>)}</Fragment></tbody><tfoot><tr><td>Total: 125</td></tr></tfoot></DataTable>)
  assert.equal((html.match(/row-\d+!/g) || []).length, 10)
  assert.ok(html.includes('row-10!'))
  assert.ok(!html.includes('row-11!'))
  assert.ok(html.includes('Total: 125'))
  assert.ok(html.includes('1–10'))
  assert.deepEqual(TABLE_PAGE_SIZES, [10, 15, 20, 25, 50, 100])
})
test('server pagination retains the supplied page and total without slicing twice', () => {
  const html = render(<DataTable pagination={{page:2,pageSize:15,total:125,onPageChange:()=>{},onPageSizeChange:()=>{}}}><tbody>{Array.from({length:15},(_,i)=><tr key={i}><td>{`server-${i}!`}</td></tr>)}</tbody></DataTable>)
  assert.equal((html.match(/server-\d+!/g)||[]).length,15)
  assert.ok(html.includes('16–30'))
})
