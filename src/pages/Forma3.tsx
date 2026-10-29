import { DataTable } from '../components/DataTable'
import { DocumentSummary } from "../components/DocumentSummary"
import { Button, TableContainer, Toolbar } from "../components/primitives"
import { useState } from "react"
import { company } from "../data"
import { roundMoney, roundQty } from "../domain/ops"
import type { Act, Forma3, Forma3Kind, Forma3Status } from "../domain/types"
import { dateAZ, money, monthAZ, num } from "../format"
import { Icon } from "../icons"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { downloadWord, OfficialStatement, useOfficialSheet } from "./officialForms"
import { Badge, Drawer, Empty, Field, PageHead, RowMenu, Select, Tabs, useTitle } from "../ui"

type Tab = "icmallar" | "araliq" | "yekun" | "odenis"
type Read = { kind: "doc"; id: string } | { kind: "interim"; projectId: string } | { kind: "final"; projectId: string } | { kind: "pay"; id: string } | { kind: "new" }

const STEPS = ["Qaralama", "Təsdiq"]

function approvedOf(acts: Act[], projectId: string) {
  return acts.filter((act) => act.projectId === projectId && (act.status === "tesdiq" || act.status === "faktura"))
}

function latestPeriod(acts: Act[]) {
  return acts.reduce((max, act) => (act.period > max ? act.period : max), acts[0]?.period || "")
}

export default function Forma3Page() {
  const { t } = usePrefs()
  useTitle(t("nav.forma3"))
  const { query, forma3s, projects, acts, smetas, contracts, makeForma3, approveForma3Doc, returnForma3Doc, removeForma3, refreshForma3Doc } = useStore()
  const [tab, setTab] = useState<Tab>("icmallar")
  const [reading, setReading] = useState<Read | null>(null)
  const [projectId, setProjectId] = useState(projects[0]?.id || "")
  const [kind, setKind] = useState<Forma3Kind>("araliq")
  const [error, setError] = useState("")
  const q = query.trim().toLowerCase()
  const rows = forma3s.filter((item) => !q || `${item.number} ${item.project} ${item.client} ${item.kind}`.toLowerCase().includes(q))
  const interims = projects
    .map((project) => {
      const approved = approvedOf(acts, project.id)
      const period = latestPeriod(approved)
      const periodActs = approved.filter((act) => act.period === period)
      const periodValue = periodActs.reduce((sum, act) => sum + act.net, 0)
      const existing = forma3s.find((item) => item.projectId === project.id && item.kind === "araliq" && item.period === period)
      return { project, approved, period, periodActs, periodValue, existing }
    })
    .filter((item) => item.approved.length > 0 && (!q || `${item.project.name} ${item.project.client}`.toLowerCase().includes(q)))
  const finals = projects
    .map((project) => {
      const approved = approvedOf(acts, project.id)
      const lines = smetas.find((item) => item.projectId === project.id)?.lines || []
      const remain = lines.reduce((sum, line) => sum + Math.max(0, line.qty - line.billedQty) * line.unitPrice, 0)
      const openQty = lines.some((line) => roundQty(line.qty - line.billedQty) > 0 || roundQty(line.doneQty - line.billedQty) > 0)
      const draftAct = acts.some((act) => act.projectId === project.id && act.status === "qaralama")
      const existing = forma3s.find((item) => item.projectId === project.id && item.kind === "yekun")
      const reason = !approved.length
        ? "Təsdiqlənmiş Forma-2 yoxdur."
        : draftAct
          ? "Açıq Forma-2 qaralaması var."
          : openQty
            ? "Smetada bağlanmamış həcm qalıb."
            : existing
              ? existing.status === "tesdiq" ? "Yekun təsdiqlənib." : "Yekun qaralaması açıqdır."
              : ""
      return { project, approved, remain, existing, reason, ready: !reason }
    })
    .filter((item) => !q || `${item.project.name} ${item.project.client} ${item.reason}`.toLowerCase().includes(q))
  const doc = reading?.kind === "doc" || reading?.kind === "pay" ? forma3s.find((item) => item.id === reading.id) : undefined
  const interim = reading?.kind === "interim" ? interims.find((item) => item.project.id === reading.projectId) : undefined
  const finalRow = reading?.kind === "final" ? finals.find((item) => item.project.id === reading.projectId) : undefined
  const chosen = projects.find((item) => item.id === projectId) || projects[0]

  function openTab(next: string) {
    setTab(next as Tab)
    setReading(null)
    setError("")
  }

  function openNew(nextKind: Forma3Kind, nextProject = projects[0]?.id || "") {
    setError("")
    setKind(nextKind)
    setProjectId(nextProject)
    setReading({ kind: "new" })
  }

  return (
    <div className="forma-page">
      <PageHead kicker={t("page.forma3.kicker")} title={t("page.forma3.title")} text={t("page.forma3.text")}>
        {tab !== "odenis" && (
          <Button type="button" onClick={() => openNew(tab === "yekun" ? "yekun" : "araliq")}>
            <Icon name="plus" /> Forma-3
          </Button>
        )}
      </PageHead>
      <Toolbar>
        <Tabs
          value={tab}
          onChange={openTab}
          options={[
            { id: "icmallar", label: "İcmallar" },
            { id: "araliq", label: "Aralıq" },
            { id: "yekun", label: "Yekun" },
            { id: "odenis", label: "Ödəniş" },
          ]}
        />
        <span className="muted">
          {tab === "araliq" ? `${interims.filter((item) => !item.existing).length} layihə icmalsız` : tab === "yekun" ? `${finals.filter((item) => item.ready).length} layihə bağlana bilər` : tab === "odenis" ? `${rows.length} icmal` : `${rows.filter((item) => item.status === "qaralama").length} qaralama`}
        </span>
      </Toolbar>

      {tab === "icmallar" && (
        <TableContainer className="wide">
          <DataTable>
            <thead>
              <tr>
                <th>Sənəd</th>
                <th>Növ</th>
                <th>Dövr</th>
                <th>Obyekt</th>
                <th>Proses</th>
                <th className="num">Cari dövr</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="click" onClick={() => { setError(""); setReading({ kind: "doc", id: item.id }) }}>
                  <td><b>{item.number}</b></td>
                  <td><Badge status={item.kind} /></td>
                  <td>{monthAZ(item.period)}</td>
                  <td>{item.project}<div className="muted">{item.client}</div></td>
                  <td className="track-cell">
                    <button type="button" className="track-btn" aria-label={`${item.number} prosesi`} onClick={(event) => { event.stopPropagation(); setError(""); setReading({ kind: "doc", id: item.id }) }}>
                      <Track status={item.status} />
                    </button>
                  </td>
                  <td className="num">{money(item.periodValue)}</td>
                  <td>
                    <RowMenu
                      items={[
                        ...(item.status === "qaralama" ? [
                          { id: "refresh", label: "Yenilə", onClick: () => { setError(""); setReading({ kind: "doc", id: item.id }); setError(refreshForma3Doc(item.id)) } },
                          { id: "delete", label: "Sil", onClick: () => { const message = removeForma3(item.id); setError(message); if (!message) setReading((current) => (current?.kind === "doc" && current.id === item.id ? null : current)) } },
                        ] : []),
                        ...(item.status === "tesdiq" ? [{ id: "return", label: "Qaralamaya qaytar", onClick: () => setError(returnForma3Doc(item.id)) }] : []),
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {rows.length === 0 && <Empty title="Forma-3 yoxdur" text="Təsdiqlənmiş Forma-2-dən aralıq və ya yekun icmal açın." />}
        </TableContainer>
      )}

      {tab === "araliq" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>Layihə</th>
                <th>Son dövr</th>
                <th className="num">Forma-2</th>
                <th className="num">Cari dövr</th>
                <th>İcmal</th>
              </tr>
            </thead>
            <tbody>
              {interims.map((item) => (
                <tr key={item.project.id} className="click" onClick={() => { setError(""); setReading({ kind: "interim", projectId: item.project.id }) }}>
                  <td><b>{item.project.name}</b><div className="muted">{item.project.client}</div></td>
                  <td>{item.period ? monthAZ(item.period) : "—"}</td>
                  <td className="num">{item.approved.length}</td>
                  <td className="num">{money(item.periodValue)}</td>
                  <td>{item.existing ? <Badge status={item.existing.status} /> : <span className="muted">Açıq deyil</span>}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {interims.length === 0 && <Empty title="Aralıq üçün akt yoxdur" text="Təsdiqlənmiş və ya fakturalanmış Forma-2 olan layihə burada durur." />}
        </TableContainer>
      )}

      {tab === "yekun" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>Layihə</th>
                <th className="num">Smeta qalığı</th>
                <th>Vəziyyət</th>
              </tr>
            </thead>
            <tbody>
              {finals.map((item) => (
                <tr key={item.project.id} className="click" onClick={() => { setError(""); setReading({ kind: "final", projectId: item.project.id }) }}>
                  <td><b>{item.project.name}</b><div className="muted">{item.approved.length} təsdiqli akt</div></td>
                  <td className="num">{money(item.remain)}</td>
                  <td>{item.ready ? <Badge status="hazir" /> : item.reason}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableContainer>
      )}

      {tab === "odenis" && (
        <TableContainer className="wide">
          <DataTable>
            <thead>
              <tr>
                <th>İcmal</th>
                <th>Layihə</th>
                <th className="num">Əvvəldən</th>
                <th className="num">Avans qalığı</th>
                <th className="num">Saxlanc</th>
                <th className="num">Ödənilməli</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="click" onClick={() => { setError(""); setReading({ kind: "pay", id: item.id }) }}>
                  <td><b>{item.number}</b><div className="muted">{monthAZ(item.period)}</div></td>
                  <td>{item.project}</td>
                  <td className="num">{money(item.cumulativeValue)}</td>
                  <td className="num">{money(item.advanceBalance)}</td>
                  <td className="num">{money(item.retention)}</td>
                  <td className="num">{money(item.payable)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {rows.length === 0 && <Empty title="Ödəniş yoxdur" text="İcmal açıldıqda avans, saxlanc və ödəniləcək məbləğ burada durur." />}
        </TableContainer>
      )}

      {doc && reading?.kind === "doc" && (
        <DocRead
          doc={doc}
          address={[projects.find((item) => item.id === doc.projectId)?.address, projects.find((item) => item.id === doc.projectId)?.city].filter(Boolean).join(", ")}
          contractValue={contracts.find((item) => item.projectId === doc.projectId)?.value || doc.smetaValue}
          advancePool={roundMoney((contracts.find((item) => item.projectId === doc.projectId)?.value || 0) * ((contracts.find((item) => item.projectId === doc.projectId)?.advancePct || 0) / 100))}
          recovered={Math.max(0, roundMoney((contracts.find((item) => item.projectId === doc.projectId)?.value || 0) * ((contracts.find((item) => item.projectId === doc.projectId)?.advancePct || 0) / 100) - doc.advanceBalance))}
          error={error}
          onClose={() => setReading(null)}
          onApprove={() => setError(approveForma3Doc(doc.id))}
          onReturn={() => setError(returnForma3Doc(doc.id))}
          onRefresh={() => setError(refreshForma3Doc(doc.id))}
        />
      )}

      {doc && reading?.kind === "pay" && (
        <Drawer className="financial-drawer" title={doc.number} onClose={() => setReading(null)}>
          <div className="form">
            <p><b>{doc.project}</b> · {doc.kind === "yekun" ? "Yekun" : "Aralıq"} · {monthAZ(doc.period)}</p>
            <DocumentSummary rows={[{label:"Smeta",value:money(doc.smetaValue)},{label:"Əvvəlki dövrlər",value:money(doc.priorValue)},{label:"Cari dövr",value:money(doc.periodValue)},{label:"Əvvəlindən",value:money(doc.cumulativeValue)},{label:"Qalıq",value:money(doc.remainValue)},{label:"Avans qalığı",value:money(doc.advanceBalance)},{label:"Saxlanc",value:money(doc.retention)},{label:"ƏDV",value:money(doc.vat)}]} totalLabel="Ödənilməli" total={money(doc.payable)} />
          </div>
        </Drawer>
      )}

      {interim && (
        <Drawer className="financial-drawer" title={interim.project.name} onClose={() => setReading(null)}>
          <div className="form">
            <p className="muted">{interim.project.client}. Son dövr {interim.period ? monthAZ(interim.period) : "—"}.</p>
            {interim.periodActs.map((act) => (
              <p key={act.id}><b>{act.number}</b> · {money(act.net)} · <Badge status={act.status} /></p>
            ))}
            <p><b>Cari dövr {money(interim.periodValue)}</b></p>
            {interim.existing && <p>Bu dövrün icmalı {interim.existing.number}, status <Badge status={interim.existing.status} />.</p>}
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              {!interim.existing && (
                <Button type="button" onClick={() => { const message = makeForma3(interim.project.id, "araliq"); setError(message); if (!message) { setReading(null); setTab("icmallar") } }}>İcmal aç</Button>
              )}
            </div>
          </div>
        </Drawer>
      )}

      {finalRow && (
        <Drawer className="financial-drawer" title={finalRow.project.name} onClose={() => setReading(null)}>
          <div className="form">
            <p>Təsdiqli akt {finalRow.approved.length}. Smeta qalığı {money(finalRow.remain)}.</p>
            {finalRow.reason ? <p>{finalRow.reason}</p> : <p>Smeta bağlanıb. Yekun icmal açıla bilər.</p>}
            {finalRow.existing && <p>{finalRow.existing.number} · <Badge status={finalRow.existing.status} /></p>}
            {error && <p className="form-error">{error}</p>}
            {finalRow.ready && (
              <div className="form-actions">
                <Button type="button" onClick={() => { const message = makeForma3(finalRow.project.id, "yekun"); setError(message); if (!message) { setReading(null); setTab("icmallar") } }}>Yekun aç</Button>
              </div>
            )}
          </div>
        </Drawer>
      )}

      {reading?.kind === "new" && chosen && (
        <Drawer className="financial-drawer" title="Forma-3" onClose={() => setReading(null)}>
          <div className="form">
            <Field label="Layihə">
              <Select value={chosen.id} onValueChange={setProjectId} options={projects.map((project) => ({ value: project.id, label: project.name }))} />
            </Field>
            <Field label="Növ">
              <Select
                value={kind}
                onValueChange={(value) => setKind(value as Forma3Kind)}
                options={[
                  { value: "araliq", label: t("forma.interim") },
                  { value: "yekun", label: t("forma.final") },
                ]}
              />
            </Field>
            <p className="muted">{kind === "yekun" ? "Yekun smeta tam bağlananda açılır." : "Aralıq təsdiqlənmiş Forma-2-lərin son dövrünü yığır."}</p>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <Button type="button" className="ghost" onClick={() => setReading(null)}>Ləğv et</Button>
              <Button type="button" onClick={() => { const message = makeForma3(chosen.id, kind); setError(message); if (!message) { setReading(null); setTab("icmallar") } }}>İcmal aç</Button>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  )
}

function DocRead({
  doc, address, contractValue, advancePool, recovered, error, onClose, onApprove, onReturn, onRefresh,
}: {
  doc: Forma3
  address: string
  contractValue: number
  advancePool: number
  recovered: number
  error: string
  onClose: () => void
  onApprove: () => void
  onReturn: () => void
  onRefresh: () => void
}) {
  const sheetRef = useOfficialSheet()
  return (
    <Drawer className="financial-drawer" title={doc.number} onClose={onClose}>
      <div className="form act-sheet">
        <Track status={doc.status} />
        <p className="muted">{doc.kind === "yekun" ? "Yekun icra və qiymətləndirmə aktı" : "Aralıq icra və qiymətləndirmə aktı"} · {monthAZ(doc.period)} · {dateAZ(doc.date)}</p>
        <p><b>{doc.project}</b> · <Badge status={doc.kind} /> <Badge status={doc.status} /></p>
        <p className="muted">Sifarişçi {doc.client}. Podratçı {company.legal}. Müqavilə {doc.contractNumber || "—"}.</p>
        {error && <p className="form-error">{error}</p>}
        <div className="document-export no-print"><span>Sənədi yüklə</span>
          <Button type="button" className="ghost" onClick={() => window.print()}>Çap</Button>
          <Button type="button" className="ghost" onClick={() => downloadWord(doc.number, sheetRef.current)}>Word</Button>
        </div>
        <div className="form-actions document-actions no-print">
          {doc.status === "qaralama" && <Button type="button" className="ghost" onClick={onRefresh}>Yenilə</Button>}
          {doc.status === "qaralama" && <Button type="button" onClick={onApprove}>Təsdiqlə</Button>}
          {doc.status === "tesdiq" && <Button type="button" className="ghost" onClick={onReturn}>Qaralamaya qaytar</Button>}
        </div>
        <DocumentSummary rows={[{label:"Smeta",value:money(doc.smetaValue)},{label:"Əvvəlki dövrlər",value:money(doc.priorValue)},{label:"Cari dövr",value:money(doc.periodValue)},{label:"Əvvəlindən",value:money(doc.cumulativeValue)},{label:"Qalıq",value:money(doc.remainValue)},{label:"Avans qalığı",value:money(doc.advanceBalance)},{label:"Saxlanc",value:money(doc.retention)},{label:"ƏDV",value:money(doc.vat)}]} totalLabel="Ödənilməli məbləğ" total={money(roundMoney(doc.payable))} />
        <TableContainer className="document-lines"><DataTable><thead><tr><th>İş</th><th>Vahid</th><th className="num">Bu dövr</th><th className="num">Əvvəlindən</th><th className="num">Qalıq</th><th className="num">Məbləğ</th></tr></thead><tbody>{doc.lines.map((line) => <tr key={line.smetaLineId}><td><strong>{line.name}</strong><span className="document-line-code">{line.code}</span></td><td>{line.unit}</td><td className="num">{num(line.periodQty,1)}</td><td className="num">{num(line.cumulativeQty,1)}</td><td className="num">{num(line.remainQty,1)}</td><td className="num">{money(line.periodValue)}</td></tr>)}</tbody></DataTable></TableContainer>
        <div className="sign-row">
          <div>Sifarişçi<span>{doc.client}</span></div>
          <div>Podratçı<span>{company.legal}</span></div>
        </div>
      </div>
      <OfficialStatement doc={doc} address={address} contractValue={contractValue} advancePool={advancePool} recovered={recovered} sheetRef={sheetRef} />
    </Drawer>
  )
}

function Track({ status }: { status: Forma3Status }) {
  const index = status === "tesdiq" ? 1 : 0
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
