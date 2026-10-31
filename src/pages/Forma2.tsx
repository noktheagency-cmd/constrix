import { DataTable } from '../components/DataTable'
import { SourceWorkbookViewer } from "../components/SourceWorkbookViewer"
import { DocumentSummary } from "../components/DocumentSummary"
import { Button, Input, TableContainer, Toolbar } from "../components/primitives"
import { Fragment, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { company } from "../data"
import { nakopitelBook, nakopitelTotals } from "../domain/nakopitel"
import { actSettlement, roundMoney, roundQty } from "../domain/ops"
import {
  downloadBytes,
  exportActSheet,
  exportNakopitelSheet,
  parseSmetaWorkbook,
  inspectSmetaWorkbook,
  type SmetaColumns,
  type SmetaImportRow,
} from "../domain/smetaIo"
import type { Act, ActStatus } from "../domain/types"
import { dateAZ, money, monthAZ, num } from "../format"
import { Icon } from "../icons"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { downloadPdf, downloadWord, OfficialAct, useOfficialSheet } from "./officialForms"
import { Badge, Drawer, Empty, Field, PageHead, RowMenu, Select, Tabs, useTitle } from "../ui"

type Tab = "aktlar" | "nakopitel" | "hecm" | "smeta" | "hesablasma" | "faktura" | "source"
type Read =
  | { kind: "act"; id: string; edit?: boolean }
  | { kind: "open"; projectId: string }
  | { kind: "book"; projectId: string }
  | { kind: "ledger"; projectId: string }
  | { kind: "new" }
  | { kind: "import"; projectId: string; rows: SmetaImportRow[]; errors: string[]; buffer: ArrayBuffer; sheet: string; headerRow: number; columns?: SmetaColumns }

const STEPS = ["Qaralama", "Təsdiq", "Faktura"]

export default function Forma2() {
  const { t } = usePrefs()
  useTitle(t("nav.forma2"))
  const { query, acts, projects, smetas, contracts, invoices, approveAct, invoiceAct, makeAct, editAct, removeAct, returnAct, importSmeta } = useStore()
  const [tab, setTab] = useState<Tab>("aktlar")
  const [reading, setReading] = useState<Read | null>(null)
  const [projectId, setProjectId] = useState(projects.find((item) => item.id === "source-xocali-60")?.id || projects.find((item) => item.id === "PRJ-XOCA")?.id || projects[0]?.id || "")
  const [nakoPeriod, setNakoPeriod] = useState("2026-04")
  const [nakoHouse, setNakoHouse] = useState("")
  const [error, setError] = useState("")
  const [actPeriod, setActPeriod] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}` })
  const [actHouses, setActHouses] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const q = query.trim().toLowerCase()
  const rows = acts.filter((act) => !q || `${act.number} ${act.id} ${act.project} ${act.client} ${act.period}`.toLowerCase().includes(q))
  const nakoProject = projects.find((item) => item.id === projectId) || projects[0]
  const nakoSmeta = smetas.find((item) => item.projectId === nakoProject?.id)
  const nakoRows = useMemo(
    () => (nakoSmeta ? nakopitelBook(nakoSmeta, acts.filter((act) => act.projectId === nakoSmeta.projectId), nakoPeriod) : []),
    [nakoSmeta, acts, nakoPeriod],
  )
  const nakoSum = useMemo(() => nakopitelTotals(nakoRows), [nakoRows])
  const nakoHouses = [...new Set(nakoRows.map(row => row.houseNo).filter(Boolean))]
  const filteredNako = nakoRows.filter(row => (!nakoHouse || row.houseNo === nakoHouse) && (!q || `${row.name} ${row.code} ${row.houseNo} ${row.section}`.toLocaleLowerCase("az").includes(q)))
  const periodOptions = useMemo(() => {
    const periods = new Set(acts.filter((act) => act.projectId === nakoProject?.id).map((act) => act.period).filter(Boolean))
    periods.add(nakoPeriod)
    periods.add("2026-04")
    return [...periods].sort()
  }, [acts, nakoProject?.id, nakoPeriod])
  const openJobs = projects
    .map((project) => {
      const lines = openLines(smetas.find((item) => item.projectId === project.id)?.lines || [])
      const amount = lines.reduce((sum, line) => sum + line.open * line.unitPrice, 0)
      return { project, lines, amount }
    })
    .filter((item) => item.lines.length > 0 && (!q || `${item.project.name} ${item.project.client}`.toLowerCase().includes(q)))
  const bills = acts.filter((act) => act.status === "faktura" && (!q || `${act.number} ${act.project} ${act.invoiceId || ""}`.toLowerCase().includes(q)))
  const books = projects
    .map((project) => {
      const lines = smetas.find((item) => item.projectId === project.id)?.lines || []
      const plan = lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0)
      const done = lines.reduce((sum, line) => sum + line.doneQty * line.unitPrice, 0)
      const billed = lines.reduce((sum, line) => sum + line.billedQty * line.unitPrice, 0)
      return { project, lines, plan, done, billed, remain: plan - billed }
    })
    .filter((item) => !q || `${item.project.name} ${item.project.client}`.toLowerCase().includes(q))
  const ledgers = projects
    .map((project) => {
      const contract = contracts.find((item) => item.projectId === project.id)
      const advancePool = contract ? roundMoney(contract.value * (contract.advancePct / 100)) : 0
      const recovered = invoices.filter((item) => item.project === project.name).reduce((sum, item) => sum + (item.advance || 0), 0)
      const retention = invoices.filter((item) => item.project === project.name).reduce((sum, item) => sum + (item.retention || 0), 0)
      const open = openLines(smetas.find((item) => item.projectId === project.id)?.lines || []).reduce((sum, line) => sum + line.open * line.unitPrice, 0)
      return { project, contract, advancePool, recovered, left: Math.max(0, advancePool - recovered), retention, open }
    })
    .filter((item) => !q || `${item.project.name} ${item.contract?.number || ""}`.toLowerCase().includes(q))
  const book = reading?.kind === "book" ? books.find((item) => item.project.id === reading.projectId) : undefined
  const ledger = reading?.kind === "ledger" ? ledgers.find((item) => item.project.id === reading.projectId) : undefined
  const act = reading?.kind === "act" ? acts.find((item) => item.id === reading.id) : undefined
  const opened = reading?.kind === "open" ? openJobs.find((item) => item.project.id === reading.projectId) : undefined
  const chosen = projects.find((item) => item.id === projectId) || projects[0]
  const actSmeta = smetas.find((item) => item.projectId === chosen?.id)
  const availableHouses = [...new Set((actSmeta?.lines || []).filter(line => (line.kind || "work") === "work").map(line => line.houseNo || ""))]
  const preview = openLines((actSmeta?.lines || []).filter(line => !actHouses.length || actHouses.includes(line.houseNo || "")))

  function openTab(next: string) {
    setTab(next as Tab)
    setReading(null)
    setError("")
  }

  return (
    <div className="forma-page">
      <PageHead kicker={t("page.forma2.kicker")} title={t("nav.workActs")} text={t("page.forma2.text")}>
        <Link className="btn ghost" to="/forma-3">Forma-3</Link>
        {tab === "smeta" && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={async (event) => {
                const file = event.target.files?.[0]
                event.target.value = ""
                if (!file) return
                try {
                  const buffer = await file.arrayBuffer()
                  const info = inspectSmetaWorkbook(buffer)
                  const parsed = parseSmetaWorkbook(buffer)
                  setError("")
                  setReading({ kind: "import", projectId: projectId || projects[0]?.id || "", buffer, sheet: info.sheet, headerRow: info.headerRow, rows: parsed.rows, errors: parsed.errors })
                } catch { setError("Excel faylı oxunmadı. Faylın formatını və zədələnmədiyini yoxlayın.") }
              }}
            />
            <Button type="button" className="ghost" onClick={() => fileRef.current?.click()}>Excel idxal</Button>
          </>
        )}
        {tab === "nakopitel" && nakoRows.length > 0 && (
          <Button
            type="button"
            className="ghost"
            onClick={() => {
              const bytes = exportNakopitelSheet(nakoProject?.name || "Layihə", nakoPeriod, nakoRows)
              downloadBytes(`Nakopitel-${nakoPeriod}.xlsx`, bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            }}
          >
            Excel
          </Button>
        )}
        {(tab === "aktlar" || tab === "hecm" || tab === "smeta" || tab === "nakopitel") && (
          <Button type="button" onClick={() => { setError(""); setProjectId(projects.find((item) => item.id === "PRJ-XOCA")?.id || projects[0]?.id || ""); setReading({ kind: "new" }) }}>
            <Icon name="plus" /> Forma-2
          </Button>
        )}
      </PageHead>
      <Toolbar>
        <Tabs
          value={tab}
          onChange={openTab}
          options={[
            { id: "aktlar", label: "Aktlar" },
            { id: "nakopitel", label: "Nakopitel" },
            { id: "source", label: "Excel mənbəsi" },
            { id: "hecm", label: "Həcm" },
            { id: "smeta", label: "Smeta" },
            { id: "hesablasma", label: "Hesablaşma" },
            { id: "faktura", label: "Faktura" },
          ]}
        />
        <span className="muted">
          {tab === "nakopitel"
            ? `${nakoSum.houses} ev · ${nakoSum.works} iş · ay ${money(nakoSum.periodValue)}`
            : tab === "hecm" ? `${openJobs.length} layihədə açıq həcm` : tab === "smeta" ? `${books.length} smeta` : tab === "hesablasma" ? `${ledgers.length} müqavilə` : tab === "faktura" ? `${bills.length} bağlanmış akt` : `${rows.filter((item) => item.status === "qaralama").length} qaralama`}
        </span>
      </Toolbar>

      {tab === "source" && <SourceWorkbookViewer kind="nakopitel" />}
      {tab === "nakopitel" && (
        <>
          {nakoProject?.id === "source-xocali-60" && <p className="muted">İdxal edilmiş F2-lər yoxlama üçün qaralamadır. Bu cədvəl yalnız təsdiqlənmiş aktları hesablayır. Excel-dəki tarixi dövrlərə və F2-1/F2-2/F2-3 sütunlarına “Excel mənbəsi” tabından baxın.</p>}
          <Toolbar>
            <Field label="Layihə">
              <Select value={nakoProject?.id || ""} onValueChange={value => { setProjectId(value); setNakoHouse("") }} options={projects.map((project) => ({ value: project.id, label: project.name }))} />
            </Field>
            <Field label="Hesabat ayı">
              <Select value={nakoPeriod} onValueChange={setNakoPeriod} options={periodOptions.map((period) => ({ value: period, label: monthAZ(period) }))} />
            </Field>
            <Field label="Ev / obyekt"><Select value={nakoHouse} onValueChange={value => { setNakoHouse(value) }} options={[{value:"",label:"Bütün evlər"},...nakoHouses.map(value=>({value,label:`Ev №${value}`}))]} /></Field>
          </Toolbar>
          <TableContainer className="wide">
            <DataTable className="nakopitel-table">
              <thead>
                <tr><th rowSpan={2}>№</th><th rowSpan={2}>İşlərin adı / ev və bölmə</th><th rowSpan={2}>Ölçü</th><th className="num" rowSpan={2}>Həcm</th><th className="num" rowSpan={2}>Qiymət</th><th className="num" rowSpan={2}>Cəmi</th><th colSpan={2}>Əvvəlki dövr</th><th colSpan={2}>Yığılan</th><th colSpan={2}>Bu ay</th><th colSpan={2}>Qalıq</th></tr>
                <tr>{["prior", "cumulative", "period", "remain"].map(group => <Fragment key={group}><th className="num">Miqdar</th><th className="num">Məbləğ</th></Fragment>)}</tr>
              </thead>
              <tbody>
                {filteredNako.filter(row => row.kind === "work").map((row) => (
                  <tr key={row.id} className={row.kind === "house" || row.kind === "section" || row.kind === "sectionTotal" ? "muted" : undefined}>
                    <td>{row.code || ""}</td>
                    <td>
                      {row.name}<div className="muted">{[row.houseNo && `Ev №${row.houseNo}`, row.section].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td>{row.unit}</td>
                    <td className="num">{row.kind === "work" ? num(row.smetaQty, 2) : ""}</td>
                    <td className="num">{row.kind === "work" ? money(row.unitPrice) : ""}</td>
                    <td className="num">{row.kind === "work" || row.kind === "sectionTotal" ? money(row.smetaValue) : ""}</td>
                    <td className="num">{row.kind === "work" ? num(row.priorQty, 3) : ""}</td><td className="num">{row.kind === "work" || row.kind === "sectionTotal" ? money(row.priorValue) : ""}</td><td className="num">{row.kind === "work" ? num(row.cumulativeQty, 3) : ""}</td><td className="num">{row.kind === "work" || row.kind === "sectionTotal" ? money(row.cumulativeValue) : ""}</td>
                    <td className="num">{row.kind === "work" ? num(row.periodQty, 3) : ""}</td><td className="num">{row.kind === "work" || row.kind === "sectionTotal" ? money(row.periodValue) : ""}</td>
                    <td className="num">{row.kind === "work" ? num(row.remainQty, 3) : ""}</td><td className="num">{row.kind === "work" || row.kind === "sectionTotal" ? money(row.remainValue) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            {nakoRows.length === 0 && <Empty title="Nakopitel boşdur" text="Bu layihədə ev/bölmə smetası yoxdur. Layihəni dəyişin və ya smeta idxal edin." />}
          </TableContainer>
          {nakoRows.length > 0 && (
            <p className="muted">Smeta {money(nakoSum.smetaValue)} · əvvəlindən {money(nakoSum.cumulativeValue)} · bu ay {money(nakoSum.periodValue)} · qalıq {money(nakoSum.remainValue)}</p>
          )}
        </>
      )}

      {tab === "aktlar" && (
        <TableContainer className="wide">
          <DataTable>
            <thead>
              <tr>
                <th>Sənəd</th>
                <th>Dövr</th>
                <th>Obyekt</th>
                <th>Proses</th>
                <th className="num">Yekun</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="click" onClick={() => { setError(""); setReading({ kind: "act", id: item.id }) }}>
                  <td><b>{item.number}</b><div className="muted">{item.lines.length} iş</div></td>
                  <td>{monthAZ(item.period)}</td>
                  <td>{item.project}<div className="muted">{item.client}</div></td>
                  <td className="track-cell">
                    <button type="button" className="track-btn" aria-label={`${item.number} prosesi`} onClick={(event) => { event.stopPropagation(); setError(""); setReading({ kind: "act", id: item.id }) }}>
                      <Track status={item.status} />
                    </button>
                  </td>
                  <td className="num">{money(item.gross)}</td>
                  <td>
                    <RowMenu
                      items={[
                        ...(item.status === "qaralama" ? [{ id: "edit", label: "Redaktə", onClick: () => { setError(""); setReading({ kind: "act", id: item.id, edit: true }) } }] : []),
                        ...(item.status === "tesdiq" ? [{ id: "return", label: "Qaralamaya qaytar", onClick: () => setError(returnAct(item.id)) }] : []),
                        ...(item.status === "qaralama" ? [{ id: "delete", label: "Sil", onClick: () => { const message = removeAct(item.id); setError(message); if (!message) setReading((current) => (current?.kind === "act" && current.id === item.id ? null : current)) } }] : []),
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {rows.length === 0 && <Empty title="Forma-2 yoxdur" text="Təsdiqlənmiş gündəlikdən sonra bu ayın aktını açın." />}
        </TableContainer>
      )}

      {tab === "hecm" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>Layihə</th>
                <th>Açıq iş</th>
                <th className="num">Məbləğ</th>
              </tr>
            </thead>
            <tbody>
              {openJobs.map((item) => (
                <tr key={item.project.id} className="click" onClick={() => { setError(""); setReading({ kind: "open", projectId: item.project.id }) }}>
                  <td><b>{item.project.name}</b><div className="muted">{item.project.client}</div></td>
                  <td>
                    <button type="button" className="mat-open" onClick={(event) => { event.stopPropagation(); setError(""); setReading({ kind: "open", projectId: item.project.id }) }}>
                      <b>{item.lines.length} sətir</b>
                      <span className="clip">{item.lines.map((line) => line.name).join(", ")}</span>
                    </button>
                  </td>
                  <td className="num">{money(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {openJobs.length === 0 && <Empty title="Açıq həcm yoxdur" text="Təsdiqlənmiş gündəlik smeta həcmini artırır. Aktlaşmamış hissə burada durur." />}
        </TableContainer>
      )}

      {tab === "smeta" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>Layihə</th>
                <th className="num">Smeta</th>
                <th className="num">Görülən</th>
                <th className="num">Akt</th>
                <th className="num">Qalıq</th>
              </tr>
            </thead>
            <tbody>
              {books.map((item) => (
                <tr key={item.project.id} className="click" onClick={() => setReading({ kind: "book", projectId: item.project.id })}>
                  <td><b>{item.project.name}</b><div className="muted">{item.lines.length} sətir</div></td>
                  <td className="num">{money(item.plan)}</td>
                  <td className="num">{money(item.done)}</td>
                  <td className="num">{money(item.billed)}</td>
                  <td className="num">{money(item.remain)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableContainer>
      )}

      {tab === "hesablasma" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>Layihə</th>
                <th>Müqavilə</th>
                <th className="num">Avans qalığı</th>
                <th className="num">Saxlanc</th>
                <th className="num">Açıq həcm</th>
              </tr>
            </thead>
            <tbody>
              {ledgers.map((item) => (
                <tr key={item.project.id} className="click" onClick={() => setReading({ kind: "ledger", projectId: item.project.id })}>
                  <td><b>{item.project.name}</b></td>
                  <td>{item.contract?.number || "—"}</td>
                  <td className="num">{money(item.left)}</td>
                  <td className="num">{money(item.retention)}</td>
                  <td className="num">{money(item.open)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableContainer>
      )}

      {tab === "faktura" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>Akt</th>
                <th>Faktura</th>
                <th>Layihə</th>
                <th className="num">Ödəniləcək</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((item) => {
                const bill = invoices.find((invoice) => invoice.id === item.invoiceId || invoice.actId === item.id)
                return (
                  <tr key={item.id} className="click" onClick={() => { setError(""); setReading({ kind: "act", id: item.id }) }}>
                    <td><b>{item.number}</b><div className="muted">{monthAZ(item.period)}</div></td>
                    <td>{bill ? bill.id : "Nömrə yazılmayıb"}<div className="muted">{bill ? <Badge status={bill.status} /> : "Arxiv akt"}</div></td>
                    <td>{item.project}</td>
                    <td className="num">{money(bill?.amount || item.gross)}</td>
                  </tr>
                )
              })}
            </tbody>
          </DataTable>
          {bills.length === 0 && <Empty title="Faktura yoxdur" text="Təsdiqlənmiş aktdan faktura açılınca burada durur." />}
        </TableContainer>
      )}

      {act && (
        <ActRead
          act={act}
          smetaLines={smetas.find((item) => item.projectId === act.projectId)?.lines || []}
          contract={contracts.find((item) => item.projectId === act.projectId)}
          invoice={invoices.find((item) => item.id === act.invoiceId || item.actId === act.id)}
          settlement={act.status === "tesdiq" ? actSettlement({ contracts, invoices }, act) : undefined}
          error={error}
          onClose={() => setReading(null)}
          onApprove={() => setError(approveAct(act.id))}
          onInvoice={() => setError(invoiceAct(act.id))}
          onReturn={() => setError(returnAct(act.id))}
          onDelete={() => { const message = removeAct(act.id); setError(message); if (!message) setReading(null) }}
          startEdit={reading?.kind === "act" && reading.edit}
          onSave={(lines) => { const message = editAct(act.id, lines); setError(message); return message }}
          onExportExcel={() => {
            const bytes = exportActSheet(act)
            downloadBytes(`${act.number}.xlsx`, bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
          }}
        />
      )}

      {reading?.kind === "import" && (
        <Drawer className="financial-drawer" title="Smeta idxalı" onClose={() => setReading(null)}>
          <div className="form">
            <SmetaMapping value={reading} onChange={(options) => {
              try { const parsed = parseSmetaWorkbook(reading.buffer, options); setReading({ ...reading, ...options, ...parsed }); setError("") }
              catch { setError("Vərəq və başlıq sətrini yoxlayın.") }
            }} />
            <Field label="Layihə">
              <Select
                value={reading.projectId}
                onValueChange={(value) => setReading({ ...reading, projectId: value })}
                options={projects.map((project) => ({ value: project.id, label: project.name }))}
              />
            </Field>
            <p className="muted">
              {reading.rows.filter((row) => row.kind === "work").length} iş · {reading.rows.length} sətir
              {reading.errors.length ? ` · ${reading.errors.length} xəbərdarlıq` : ""}
            </p>
            {reading.errors.slice(0, 5).map((item) => (
              <p key={item} className="form-error">{item}</p>
            ))}
            <TableContainer>
              <DataTable>
                <thead>
                  <tr>
                    <th>Növ</th>
                    <th>Ad</th>
                    <th className="num">Miqdar</th>
                    <th className="num">Qiymət</th>
                  </tr>
                </thead>
                <tbody>
                  {reading.rows.map((row, index) => (
                    <tr key={`${row.kind}-${index}`}>
                      <td>{row.kind}</td>
                      <td>{row.name}{row.warning ? <div className="muted">{row.warning}</div> : null}</td>
                      <td className="num">{row.kind === "work" ? num(row.qty, 2) : ""}</td>
                      <td className="num">{row.kind === "work" ? money(row.unitPrice) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </TableContainer>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <Button type="button" className="ghost" onClick={() => setReading(null)}>Ləğv et</Button>
              <Button
                type="button"

                disabled={reading.errors.length > 0 || !reading.rows.some((row) => row.kind === "work")}
                onClick={() => {
                  const message = importSmeta(reading.projectId, reading.rows)
                  setError(message)
                  if (!message) {
                    setProjectId(reading.projectId)
                    setReading(null)
                    setTab("smeta")
                  }
                }}
              >
                Smetaya yaz
              </Button>
            </div>
          </div>
        </Drawer>
      )}

      {opened && (
        <Drawer className="financial-drawer" title={opened.project.name} onClose={() => setReading(null)}>
          <div className="form">
            <p className="muted">{opened.project.client}. Bu sətirlər görülüb, hələ akta düşməyib.</p>
            {opened.lines.map((line) => (
              <p key={line.id}><b>{line.code} {line.name}</b> · {num(line.open, 1)} {line.unit} · {money(line.open * line.unitPrice)}<span className="muted"> · görülən {num(line.doneQty, 1)}, akt {num(line.billedQty, 1)}</span></p>
            ))}
            <p><b>Cəmi {money(opened.amount)}</b></p>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <Button type="button" onClick={() => { const message = makeAct(opened.project.id); setError(message); if (!message) { setReading(null); setTab("aktlar") } }}>Aktı aç</Button>
            </div>
          </div>
        </Drawer>
      )}

      {book && (
        <Drawer className="financial-drawer" title={book.project.name} onClose={() => setReading(null)}>
          <div className="form">
            <p className="muted">Smeta {money(book.plan)} · görülən {money(book.done)} · akta düşən {money(book.billed)} · qalıq {money(book.remain)}</p>
            {book.lines.map((line) => (
              <p key={line.id}>
                {(line.kind === "house" || line.kind === "section") ? (
                  <b>{line.name}</b>
                ) : (
                  <>
                    <b>{line.code} {line.name}</b> · smeta {num(line.qty, 1)} {line.unit} · görülən {num(line.doneQty, 1)} · akt {num(line.billedQty, 1)} · qalıq {num(roundQty(line.qty - line.billedQty), 1)}
                    {line.houseNo ? <span className="muted"> · ev {line.houseNo}</span> : null}
                  </>
                )}
              </p>
            ))}
          </div>
        </Drawer>
      )}

      {ledger && (
        <Drawer className="financial-drawer" title={ledger.project.name} onClose={() => setReading(null)}>
          <div className="form">
            <p>Müqavilə {ledger.contract?.number || "—"}{ledger.contract ? ` · dəyər ${money(ledger.contract.value)}` : ""}</p>
            <DocumentSummary rows={[{label:"Avans hovuzu",value:money(ledger.advancePool)},{label:"Tutulmuş avans",value:money(ledger.recovered)},{label:"Avans qalığı",value:money(ledger.left)},{label:"Saxlanc",value:money(ledger.retention)}]} totalLabel="Aktlaşmamış həcm" total={money(ledger.open)} />
          </div>
        </Drawer>
      )}

      {reading?.kind === "new" && chosen && (
        <Drawer className="financial-drawer" title="Forma-2 yarat" onClose={() => setReading(null)}>
          <div className="form">
            <Field label="Layihə">
              <Select value={chosen.id} onValueChange={value => { setProjectId(value); setActHouses([]) }} options={projects.map((project) => ({ value: project.id, label: project.name }))} />
            </Field>
            <Field label="Hesabat dövrü"><Input type="month" value={actPeriod} onChange={event => setActPeriod(event.target.value)} /></Field>
            <fieldset className="act-house-picker"><legend>Obyektlər və evlər</legend><p className="muted">Seçim edilməzsə bütün obyektlər bir aktda birləşdirilir.</p><div className="act-house-grid">{availableHouses.map(house => <label key={house || "general"}><input type="checkbox" checked={actHouses.includes(house)} onChange={event => setActHouses(previous => event.target.checked ? [...previous, house] : previous.filter(value => value !== house))} /> {house || "Ümumi / ev təyin edilməyib"}</label>)}</div></fieldset>
            {preview.length === 0 ? (
              <p className="muted">Bu layihədə aktlaşmamış həcm yoxdur.</p>
            ) : preview.map((line) => (
              <p key={line.id}><b>{line.code} {line.name}</b> · {num(line.open, 1)} {line.unit} · {money(line.open * line.unitPrice)}</p>
            ))}
            <p><b>Cəmi {money(preview.reduce((sum, line) => sum + line.open * line.unitPrice, 0))}</b></p>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <Button type="button" className="ghost" onClick={() => setReading(null)}>Ləğv et</Button>
              <Button type="button" disabled={!actPeriod || preview.length === 0} onClick={() => { const message = makeAct(chosen.id, { period: actPeriod, houses: actHouses }); setError(message); if (!message) { setReading(null); setTab("aktlar") } }}>Aktı aç</Button>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  )
}

function SmetaMapping({ value, onChange }: { value: Extract<Read, { kind: "import" }>; onChange: (options: { sheet: string; headerRow: number; columns?: SmetaColumns }) => void }) {
  const info = useMemo(() => inspectSmetaWorkbook(value.buffer, value.sheet, value.headerRow), [value.buffer, value.sheet, value.headerRow])
  const labels: Record<keyof SmetaColumns, string> = { code: "İş kodu", name: "İşin adı", unit: "Ölçü vahidi", qty: "Miqdar", unitPrice: "Vahid qiyməti" }
  const patterns: Record<keyof SmetaColumns, RegExp> = { code: /kod|№|code/i, name: /iş.*ad|name|description/i, unit: /ölçü|unit(?!.*price)/i, qty: /miqdar|həcm|qty|quantity/i, unitPrice: /qiymət|dəyəri|price|rate/i }
  const suggested = Object.fromEntries(Object.keys(labels).map(key => [key, info.headers.find(header => patterns[key as keyof SmetaColumns].test(header.label))?.value || ""])) as SmetaColumns
  return <>
    <Field label="Excel vərəqi"><Select value={value.sheet} options={info.sheets.map(sheet => ({ value: sheet, label: sheet }))} onValueChange={sheet => { const next = inspectSmetaWorkbook(value.buffer, sheet); onChange({ sheet, headerRow: next.headerRow }) }} /></Field>
    <Field label="Başlıq sətri"><Input type="number" min="1" max="1000" value={value.headerRow + 1} onChange={event => { const row = Number(event.target.value); if (Number.isInteger(row) && row > 0 && row <= 1000) onChange({ sheet: value.sheet, headerRow: row - 1 }) }} /></Field>
    <p className="muted">Sütunları yoxlayın. Xətalı və dublikat sətirlər düzəldilmədən idxal edilmir. Vahidlər m², m³, kq və ədəd formasına uyğunlaşdırılır.</p>
    {(Object.keys(labels) as (keyof SmetaColumns)[]).map(key => <Field key={key} label={labels[key]}><Select value={value.columns?.[key] || "__auto"} options={[{ value: "__auto", label: "Avtomatik uyğunlaşdır" }, ...info.headers]} onValueChange={column => onChange({ sheet: value.sheet, headerRow: value.headerRow, columns: { ...(value.columns || suggested), [key]: column === "__auto" ? suggested[key] : column } })} /></Field>)}
  </>
}

function openLines(lines: { id: string; code: string; name: string; unit: string; unitPrice: number; qty: number; doneQty: number; billedQty: number; kind?: string }[]) {
  return lines
    .filter((line) => (line.kind || "work") === "work")
    .map((line) => ({ ...line, open: roundQty(line.doneQty - line.billedQty) }))
    .filter((line) => line.open > 0)
}

function ActRead({
  act, smetaLines, contract, invoice, settlement, error, startEdit, onClose, onApprove, onInvoice, onReturn, onDelete, onSave, onExportExcel,
}: {
  act: Act
  smetaLines: { id: string; code: string; name: string; unit: string; unitPrice: number; qty: number; doneQty: number; billedQty: number; kind?: string }[]
  contract?: { number: string; advancePct: number; retentionPct: number; value: number }
  invoice?: { id: string; amount: number; net?: number; vat?: number; advance?: number; retention?: number; due: string; status: string }
  settlement?: { advancePct: number; retentionPct: number; advance: number; retention: number; net: number; vat: number; payable: number }
  error: string
  startEdit?: boolean
  onClose: () => void
  onApprove: () => void
  onInvoice: () => void
  onReturn: () => void
  onDelete: () => void
  onSave: (lines: { smetaLineId: string; qty: string }[]) => string
  onExportExcel: () => void
}) {
  const editable = smetaLines
    .filter((line) => (line.kind || "work") === "work")
    .map((line) => {
      const old = act.lines.find((item) => item.smetaLineId === line.id)?.qty || 0
      return { ...line, old, room: roundQty(line.doneQty - line.billedQty + old) }
    })
    .filter((line) => line.room > 0)
  const [editing, setEditing] = useState(Boolean(startEdit))
  const [qty, setQty] = useState<Record<string, string>>(() => startEdit ? Object.fromEntries(editable.map((line) => [line.id, line.old ? String(line.old) : ""])) : {})
  const sheetRef = useOfficialSheet()
  return (
    <Drawer className="financial-drawer" title={act.number} onClose={onClose}>
      <div className="form act-sheet">
        <Track status={act.status} />
        <p className="muted">Tikinti işlərinin təhvil-qəbul aktı · {monthAZ(act.period)} · {dateAZ(act.date)}</p>
        <p><b>{act.project}</b></p>
        <p className="muted">Sifarişçi {act.client}. Podratçı {company.legal}.</p>
        <p>Müqavilə {act.contractNumber || contract?.number || "—"}.{contract ? ` Avans ${num(contract.advancePct)}%, saxlanc ${num(contract.retentionPct)}%.` : ""}</p>
        <p><Badge status={act.status} /></p>
        {act.status === "faktura" && <p className="muted">Fakturalanmış akt redaktə olunmur və silinmir.</p>}
        {error && <p className="form-error">{error}</p>}
        <div className="document-export no-print"><span>Sənədi yüklə</span>
          <Button type="button" className="ghost" onClick={() => window.print()}>Çap</Button>
          <Button type="button" className="ghost" onClick={onExportExcel}>Excel</Button>
          <Button type="button" className="ghost" onClick={() => downloadPdf(act.number, sheetRef.current)}>PDF</Button>
          <Button type="button" className="ghost" onClick={() => downloadWord(act.number, sheetRef.current)}>Word</Button>
        </div>
        <div className="form-actions document-actions no-print">
          {act.status === "qaralama" && !editing && <Button type="button" className="ghost" onClick={() => { setQty(Object.fromEntries(editable.map((line) => [line.id, line.old ? String(line.old) : ""]))); setEditing(true) }}><Icon name="edit" /> Redaktə</Button>}
          {act.status === "qaralama" && !editing && <Button type="button" className="ghost" onClick={onDelete}><Icon name="trash" /> Sil</Button>}
          {editing && <Button type="button" className="ghost" onClick={() => setEditing(false)}>Ləğv et</Button>}
          {editing && <Button type="button" onClick={() => { const message = onSave(editable.map((line) => ({ smetaLineId: line.id, qty: qty[line.id] || "0" }))); if (!message) setEditing(false) }}>Yaz</Button>}
          {act.status === "qaralama" && !editing && <Button type="button" onClick={onApprove}>Təsdiqlə</Button>}
          {act.status === "tesdiq" && <Button type="button" className="ghost" onClick={onReturn}>Qaralamaya qaytar</Button>}
          {act.status === "tesdiq" && <Button type="button" onClick={onInvoice}>Faktura aç</Button>}
        </div>
        {editing ? editable.map((line) => (
          <div className="recipe-line" key={line.id}>
            <b>{line.code} {line.name}</b>
            <div className="recipe-line-qty">
              <Input aria-label={`${line.name} miqdarı`} type="number" min="0" step="0.1" value={qty[line.id] ?? ""} onChange={(event) => setQty({ ...qty, [line.id]: event.target.value })} />
              <span className="muted">{line.unit} · ən çox {num(line.room, 1)}</span>
            </div>
          </div>
        )) : <TableContainer className="document-lines"><DataTable><thead><tr><th>İş</th><th>Vahid</th><th className="num">Həcm</th><th className="num">Qiymət</th><th className="num">Məbləğ</th><th className="num">Əvvəlindən</th><th className="num">Qalıq</th></tr></thead><tbody>{act.lines.map((line) => {
          const smeta = smetaLines.find((item) => item.id === line.smetaLineId)
          return <tr key={line.smetaLineId}><td><strong>{line.name}</strong><span className="document-line-code">{line.code}</span></td><td>{line.unit}</td><td className="num">{num(line.qty,1)}</td><td className="num">{money(line.unitPrice)}</td><td className="num">{money(line.qty * line.unitPrice)}</td><td className="num">{num(line.cumulativeQty,1)}</td><td className="num">{smeta ? num(roundQty(smeta.qty-line.cumulativeQty),1) : "—"}</td></tr>
        })}</tbody></DataTable></TableContainer>}
        <DocumentSummary rows={[{label:"Xalis məbləğ",value:money(act.net)},{label:"ƏDV",value:money(act.vat)}]} totalLabel="Yekun məbləğ" total={money(act.gross)} />
        {settlement && (
          <p className="muted">Fakturada saxlanc {money(settlement.retention)}, avans tutulması {money(settlement.advance)}. Ödəniləcək {money(settlement.payable)}, ondan ƏDV {money(settlement.vat)}.</p>
        )}
        {invoice && (
          <p>{invoice.id} · ödəniləcək {money(invoice.amount)}{invoice.advance ? ` · avans ${money(invoice.advance)}` : ""}{invoice.retention ? ` · saxlanc ${money(invoice.retention)}` : ""} · son {dateAZ(invoice.due)} · <Badge status={invoice.status} /></p>
        )}
        {act.status === "faktura" && !invoice && <p className="muted">Bu arxiv aktın faktura nömrəsi yazılmayıb.</p>}
        <div className="sign-row">
          <div>Sifarişçi<span>{act.client}</span></div>
          <div>Podratçı<span>{company.legal}</span></div>
        </div>
      </div>
      <OfficialAct act={act} sheetRef={sheetRef} />
    </Drawer>
  )
}

function Track({ status }: { status: ActStatus }) {
  const index = status === "faktura" ? 2 : status === "tesdiq" ? 1 : 0
  return (
    <ol className="phases track">
      {STEPS.map((label, step) => (
        <li key={label} className={step < index ? "done" : step === index ? "current" : ""}>
          <i />
          <span>{label}</span>
        </li>
      ))}
    </ol>
  )
}
