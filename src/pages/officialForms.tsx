import { DataTable } from '../components/DataTable'
import { useRef, type ReactNode, type RefObject } from "react"
import { company } from "../data"
import type { Act, Forma3 } from "../domain/types"
import { dateAZ, num } from "../format"

const ANNEX = "Azərbaycan Respublikası Nazirlər Kabinetinin 2018-ci il 19 dekabr tarixli 546 nömrəli Qərarına"

export const officialCss = `
.official-sheet{color:#000;background:#fff;font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:1.35}
.official-sheet *{box-sizing:border-box}
.official-sheet .annex{text-align:right;font-size:11pt;margin:0 0 8px}
.official-sheet .doc-name{text-align:center;font-weight:700;font-size:14pt;margin:8px 0}
.official-sheet .center{text-align:center}
.official-sheet .act-word{text-align:center;font-weight:700;font-size:18pt;letter-spacing:.45em;margin:14px 0}
.official-sheet .note{text-align:center;font-size:10pt;margin:4px 0 12px}
.official-sheet p{margin:4px 0}
.official-sheet table{width:100%;border-collapse:collapse;margin:10px 0 4px}
.official-sheet th,.official-sheet td{border:1px solid #000;padding:4px 6px;vertical-align:top;font-weight:400}
.official-sheet th{text-align:center;font-size:10pt}
.official-sheet td.num,.official-sheet th.num{text-align:right;white-space:nowrap}
.official-sheet .signs{display:flex;justify-content:space-between;gap:24px;margin-top:28px}
.official-sheet .signs div{width:46%}
.official-sheet .sign-line{display:block;margin-top:28px;border-bottom:1px solid #000;height:18px}
`

export function manat(value: number) {
  const n = Math.round(Number(value) || 0)
  const sign = n < 0 ? "−" : ""
  return sign + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

/** Export all rows, independently of the current on-screen page. */
function completeSheetHtml(node: HTMLDivElement) {
  window.dispatchEvent(new Event('beforeprint'))
  try {
    const copy = node.cloneNode(true) as HTMLDivElement
    copy.querySelectorAll('.data-table-footer').forEach(footer => footer.remove())
    return copy.innerHTML
  } finally { window.dispatchEvent(new Event('afterprint')) }
}

export function downloadWord(filename: string, node: HTMLDivElement | null) {
  if (!node) return
  const safeName = filename.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char)
  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${safeName}</title><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]--><style>${officialCss}@page{size:A4;margin:14mm}</style></head><body><div class="official-sheet">${completeSheetHtml(node)}</div></body></html>`
  const blob = new Blob(["\ufeff", html], { type: "application/msword" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename.endsWith(".doc") ? filename : `${filename}.doc`
  link.click()
  URL.revokeObjectURL(url)
}

/** Opens the official sheet in a print window so the user can save as PDF (brauzer «PDF kimi saxla»). */
export function downloadPdf(filename: string, node: HTMLDivElement | null) {
  if (!node) return
  const title = filename.replace(/\.pdf$/i, "")
  const popup = window.open("", "_blank", "noopener,noreferrer,width=900,height=1100")
  if (!popup) {
    window.print()
    return
  }
  popup.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${officialCss}@page{size:A4;margin:14mm}body{margin:0;padding:12mm;background:#fff}</style></head><body><div class="official-sheet">${completeSheetHtml(node)}</div><script>window.onload=function(){window.focus();window.print()}</script></body></html>`)
  popup.document.close()
}

function Sheet({ sheetRef, children }: { sheetRef: RefObject<HTMLDivElement | null>; children: ReactNode }) {
  return (
    <div ref={sheetRef} className="official-sheet">
      {children}
    </div>
  )
}

export function useOfficialSheet() {
  return useRef<HTMLDivElement>(null)
}

export function OfficialAct({ act, sheetRef }: { act: Act; sheetRef: RefObject<HTMLDivElement | null> }) {
  const net = act.lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0)
  return (
    <Sheet sheetRef={sheetRef}>
      <p className="annex">{ANNEX}<br />1 nömrəli əlavə</p>
      <p className="doc-name">F-2 formalı akt</p>
      <p>Sifarişçi {act.client}</p>
      <p>Baş podratçı {company.legal}</p>
      <p className="center">{dateAZ(act.date)} tarixinə yerinə yetirilən işlər haqqında</p>
      <p className="center">{act.project}</p>
      <p className="act-word">AKT</p>
      <p>Müqavilə — {act.contractNumber || "—"}</p>
      <DataTable>
        <thead>
          <tr>
            <th>Sıra №-si</th>
            <th>İşlərin adı</th>
            <th>Ölçü vahidi</th>
            <th>Miqdarı</th>
            <th>Vahidinin dəyəri (manatla)</th>
            <th>Ümumi dəyəri (manatla)</th>
          </tr>
        </thead>
        <tbody>
          {act.lines.map((line, index) => (
            <tr key={line.smetaLineId}>
              <td className="num">{index + 1}</td>
              <td>{line.code} {line.name}</td>
              <td>{line.unit}</td>
              <td className="num">{num(line.qty, 1)}</td>
              <td className="num">{manat(line.unitPrice)}</td>
              <td className="num">{manat(line.qty * line.unitPrice)}</td>
            </tr>
          ))}
        </tbody><tfoot>
          <tr>
            <td colSpan={5}>Cəmi</td>
            <td className="num">{manat(net)}</td>
          </tr>
          <tr>
            <td colSpan={5}>ƏDV (18 %)</td>
            <td className="num">{manat(act.vat)}</td>
          </tr>
          <tr>
            <td colSpan={5}>Yekun (ƏDV ilə birlikdə)</td>
            <td className="num">{manat(act.gross)}</td>
          </tr>
        </tfoot>
      </DataTable>
      <div className="signs">
        <div>Sifarişçi:<span className="sign-line" /></div>
        <div>Podratçı:<span className="sign-line" /></div>
      </div>
    </Sheet>
  )
}

export function OfficialStatement({
  doc, address, contractValue, advancePool, recovered, sheetRef,
}: {
  doc: Forma3
  address: string
  contractValue: number
  advancePool: number
  recovered: number
  sheetRef: RefObject<HTMLDivElement | null>
}) {
  const rate = doc.cumulativeValue ? doc.vat / doc.cumulativeValue : 0.18
  const periodVat = Math.round(doc.periodValue * rate)
  const blank = ""
  return (
    <Sheet sheetRef={sheetRef}>
      <p className="annex">{ANNEX}<br />2 nömrəli əlavə</p>
      <p className="doc-name">F-3 formalı arayış</p>
      <p className="center">{dateAZ(doc.date)} tarixində yerinə yetirilən podrat işləri və xərclər haqqında</p>
      <p className="act-word">ARAYIŞ</p>
      <p className="note">(Podratçı tərəfindən hər ay və hər il sifarişçiyə və maliyyələşdirmə bankına təqdim olunur)</p>
      <p>Sifarişçi {doc.client}</p>
      <p>Baş podratçı {company.legal}</p>
      <p>Müqavilə {doc.contractNumber || "—"}</p>
      <p>Tikinti obyektinin adı və ünvanı {doc.project}{address ? `, ${address}` : ""}</p>
      <DataTable>
        <thead>
          <tr>
            <th rowSpan={2}>Buraxılış komplekslərinin, obyektlərin və iş komplekslərinin adı</th>
            <th colSpan={5}>Yerinə yetirilmiş podrat işlərinin dəyəri (manatla)</th>
          </tr>
          <tr>
            <th>hesabat ayı daxil olmaqla, tikintinin əvvəlindən</th>
            <th>həmçinin, hesabat ayında tikinti-quraşdırma işləri</th>
            <th>həmçinin, yeni layihə həlləri və tədbirlərdən yaranan qənaət</th>
            <th>2-ci qrafadan avadanlıqların quraşdırılması işləri</th>
            <th>1-ci qrafadan tikinti-quraşdırma işlərinə daxil olmayan əlavə xərclər</th>
          </tr>
          <tr>
            <th>A</th>
            <th>1</th>
            <th>2</th>
            <th>3</th>
            <th>4</th>
            <th>5</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Müqavilə dəyəri</td>
            <td className="num">{manat(contractValue)}</td>
            <td className="num">{blank}</td>
            <td className="num">{blank}</td>
            <td className="num">{blank}</td>
            <td className="num">{blank}</td>
          </tr>
          <tr>
            <td>Yerinə yetirilmiş işlərin ümumi dəyəri</td>
            <td className="num">{manat(doc.cumulativeValue)}</td>
            <td className="num">{manat(doc.periodValue)}</td>
            <td className="num">{manat(0)}</td>
            <td className="num">{manat(0)}</td>
            <td className="num">{manat(0)}</td>
          </tr>
          <tr>
            <td>ƏDV 18 %</td>
            <td className="num">{manat(doc.vat)}</td>
            <td className="num">{manat(periodVat)}</td>
            <td className="num">{blank}</td>
            <td className="num">{blank}</td>
            <td className="num">{blank}</td>
          </tr>
          <tr>
            <td>ƏDV ilə birlikdə ümumi cəmi</td>
            <td className="num">{manat(doc.cumulativeValue + doc.vat)}</td>
            <td className="num">{manat(doc.periodValue + periodVat)}</td>
            <td className="num">{blank}</td>
            <td className="num">{blank}</td>
            <td className="num">{blank}</td>
          </tr>
          <tr>
            <td>Avans məbləği</td>
            <td className="num">{manat(advancePool)}</td>
            <td className="num">{blank}</td>
            <td className="num">{blank}</td>
            <td className="num">{blank}</td>
            <td className="num">{blank}</td>
          </tr>
          <tr>
            <td>Avans məbləğindən tutulur</td>
            <td className="num">{manat(recovered)}</td>
            <td className="num">{blank}</td>
            <td className="num">{blank}</td>
            <td className="num">{blank}</td>
            <td className="num">{blank}</td>
          </tr>
          <tr>
            <td>Ödəniləcək məbləğ</td>
            <td className="num">{manat(doc.payable)}</td>
            <td className="num">{blank}</td>
            <td className="num">{blank}</td>
            <td className="num">{blank}</td>
            <td className="num">{blank}</td>
          </tr>
        </tbody>
      </DataTable>
      <div className="signs">
        <div>Sifarişçi:<span className="sign-line" /></div>
        <div>Podratçı:<span className="sign-line" /></div>
      </div>
    </Sheet>
  )
}
