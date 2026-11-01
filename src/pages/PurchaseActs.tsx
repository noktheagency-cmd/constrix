import { DataTable } from '../components/DataTable'
import { SourceWorkbookViewer } from "../components/SourceWorkbookViewer"
import { Button, Input, TableContainer, Toolbar } from "../components/primitives"
import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { DateField } from "../DateField"
import type { PurchaseActForm } from "../domain/purchaseActs"
import type { PurchaseAct } from "../domain/types"
import { dateAZ, hit, money, num } from "../format"
import { Icon } from "../icons"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { api } from "../api"
import { Badge, Drawer, Empty, Field, Modal, PageHead, RowMenu, Select, Tabs, useTitle } from "../ui"
import { MarketDocuments, MarketDownload } from "../components/MarketDocuments"

type Tab = "aktlar" | "umumi" | "elave" | "source" | "supplier"
type Reading = { kind: "act"; id: string; edit?: boolean } | { kind: "new" } | null

const emptyLine = () => ({
  materialName: "",
  unit: "ədəd",
  qty: "",
  unitPrice: "",
  amount: "",
  cashPaid: "",
  firmName: "",
  note: "",
  sender: "",
})

export default function PurchaseActs() {
  const { t } = usePrefs()
  useTitle(t("nav.purchaseActs"))
  const {
    query, purchaseActs, projects, locations, actor,
    makePurchaseAct, editPurchaseAct, receivePurchaseAct, returnPurchaseAct, removePurchaseAct,
  } = useStore()
  const [tab, setTab] = useState<Tab>("aktlar")
  const [reading, setReading] = useState<Reading>(null)
  const [error, setError] = useState("")
  const [supplierReport,setSupplierReport]=useState<{generatedAt:string;rows:{actId:string;actNumber:string;date:string;status:string;supplier:string;orderedQty:number;receivedQty:number;payableQty:number;closedQty:number;remainingQty:number;openDisputedQty:number;pendingCreditQty:number;netOpenPayable?:number;payableCount?:number;supplierQuantityClosed?:boolean;supplierClosedAt?:string|null;supplierClosedBy?:string|null;supplierClosureEvidenceRef?:string|null}[]}|null>(null)
  const [supplierBusy,setSupplierBusy]=useState(false)
  const [supplierRefresh,setSupplierRefresh]=useState(0)
  const [closureTarget,setClosureTarget]=useState<{actId:string;actNumber:string;supplier:string}|null>(null)
  const [closureEvidence,setClosureEvidence]=useState("")
  const [closureNote,setClosureNote]=useState("")
  const [closureBusy,setClosureBusy]=useState(false)
  const [receiveLocation, setReceiveLocation] = useState(locations.find((item) => item.id === "LOC-MERKEZ")?.id || locations[0]?.id || "")
  useEffect(() => {
    if (!locations.length) {
      if (receiveLocation) setReceiveLocation("")
      return
    }
    if (!locations.some((item) => item.id === receiveLocation)) {
      setReceiveLocation(locations.find((item) => item.id === "LOC-MERKEZ")?.id || locations[0].id)
    }
  }, [locations, receiveLocation])
  const rows = purchaseActs.filter((item) => hit(query, item.number, item.objectName, item.person, item.project, item.note))
  const act = reading?.kind === "act" ? purchaseActs.find((item) => item.id === reading.id) : undefined
  const ledger = useMemo(
    () => purchaseActs.flatMap((item) => item.lines.map((line) => ({
      actId: item.id,
      actNumber: item.number,
      date: item.date,
      objectName: item.objectName,
      person: item.person,
      status: item.status,
      ...line,
    }))),
    [purchaseActs],
  )
  const adjusts = useMemo(
    () => purchaseActs.flatMap((item) => item.adjustments.map((row) => ({
      actId: item.id,
      actNumber: item.number,
      ...row,
    }))),
    [purchaseActs],
  )

  useEffect(()=>{if(tab!=="supplier")return;let active=true;setSupplierBusy(true);void api<typeof supplierReport>("/api/act-workflows/purchase-supplier-reconciliation").then(row=>{if(active)setSupplierReport(row)}).catch(()=>{if(active)setSupplierReport(null)}).finally(()=>{if(active)setSupplierBusy(false)});return()=>{active=false}},[tab,purchaseActs,supplierRefresh])

  async function closeSupplierQuantity(){if(!closureTarget||!closureEvidence.trim())return;setClosureBusy(true);setError("");try{await api(`/api/act-workflows/${encodeURIComponent(closureTarget.actId)}/close-purchase-supplier`,{method:"POST",body:JSON.stringify({supplier:closureTarget.supplier,evidenceRef:closureEvidence.trim(),note:closureNote.trim(),key:crypto.randomUUID()})});setClosureTarget(null);setClosureEvidence("");setClosureNote("");setSupplierRefresh(value=>value+1)}catch(e){setError(e instanceof Error?e.message:"Supplier uzlaşması bağlanmadı")}finally{setClosureBusy(false)}}

  return (
    <div className="forma-page">
      <PageHead kicker={t("page.purchaseActs.kicker")} title={t("page.purchaseActs.title")} text={t("page.purchaseActs.text")}>
        <Link className="btn ghost" to="/anbar">Anbar</Link>
        <Button type="button" onClick={() => { setError(""); setReading({ kind: "new" }) }}>
          <Icon name="plus" /> Alış aktı
        </Button>
      </PageHead>
      <Toolbar>
        <Tabs
          value={tab}
          onChange={(next) => { setTab(next as Tab); setReading(null); setError("") }}
          options={[
            { id: "aktlar", label: "Aktlar" },
            { id: "umumi", label: "Ümumi" },
            { id: "elave", label: "Əlavə" },
            { id: "source", label: "Excel mənbəsi" },
            { id: "supplier", label: "Təchizatçı uzlaşması" },
          ]}
        />
        <span className="muted">{rows.filter((item) => item.status === "qaralama").length} qaralama · {money(rows.reduce((sum, item) => sum + item.net, 0))}</span>
      </Toolbar>

      {tab === "source" && <SourceWorkbookViewer kind="purchase" />}
      {tab === "supplier" && <>
        <Toolbar><span className="muted">Alış aktı, supplier, qəbul edilmiş miqdar, açıq mübahisə və borc üzrə read-only uzlaşma.</span><Button type="button" className="ghost" disabled={supplierBusy} onClick={()=>setSupplierRefresh(value=>value+1)}>{supplierBusy?"Yenilənir…":"Yenilə"}</Button></Toolbar>
        <TableContainer className="wide"><DataTable><thead><tr><th>Supplier / akt</th><th>Status</th><th className="num">Sifariş</th><th className="num">Qəbul</th><th className="num">Qalıq</th><th className="num">Mübahisə</th><th className="num">Pending kredit</th>{["director","procurement","accountant"].includes(actor.role)&&<th className="num">Açıq borc</th>}<th>Miqdar uzlaşması</th></tr></thead><tbody>{supplierReport?.rows.map((row,index)=><tr key={`${row.actId}-${row.supplier}-${index}`}><td><b>{row.supplier}</b><div className="muted">{row.actNumber} · {dateAZ(row.date)}</div></td><td><Badge status={row.status}/></td><td className="num">{num(row.orderedQty,3)}</td><td className="num">{num(row.receivedQty,3)}</td><td className="num">{num(row.remainingQty,3)}</td><td className="num">{num(row.openDisputedQty,3)}</td><td className="num">{num(row.pendingCreditQty,3)}</td>{["director","procurement","accountant"].includes(actor.role)&&<td className="num">{money(row.netOpenPayable||0)}</td>}<td>{row.supplierQuantityClosed?<><Badge status="Miqdar uzlaşıb"/><div className="muted">{row.supplierClosedBy} · {row.supplierClosureEvidenceRef}</div></>:actor.role==="director"&&row.remainingQty===0&&row.openDisputedQty===0&&row.pendingCreditQty===0?<Button type="button" className="small" onClick={()=>{setClosureTarget({actId:row.actId,actNumber:row.actNumber,supplier:row.supplier});setClosureEvidence("");setClosureNote("")}}>Miqdar uzlaşmasını bağla</Button>:<span className="muted">Açıq</span>}</td></tr>)}</tbody></DataTable>{supplierReport&&supplierReport.rows.length===0&&<Empty title="Supplier uzlaşması yoxdur" text="Alış aktı və supplier sətirləri bu şirkətdə tapılmadı."/>}</TableContainer>
        <p className="muted">Miqdar uzlaşmasının bağlanması supplier-in alış aktı üzrə fiziki qəbulunu sənədləyir. Açıq borc ayrıca Maliyyə bölməsində ödənişlə azaldılır.</p>
        {closureTarget&&<Modal title={`${closureTarget.supplier} · ${closureTarget.actNumber}`} onClose={()=>{if(!closureBusy)setClosureTarget(null)}}><div className="form"><Field label="Uzlaşma sənədinin istinadı"><Input value={closureEvidence} onChange={event=>setClosureEvidence(event.target.value)} maxLength={200} placeholder="Təhvil/qəbul aktı, məktub və ya protokol №" /></Field><Field label="Qeyd"><Input value={closureNote} onChange={event=>setClosureNote(event.target.value)} maxLength={500} placeholder="İstəyə görə" /></Field><p className="muted">Bu təsdiq yalnız miqdar uzlaşmasını bağlayır; ödəniş və borc qalıqları dəyişmir.</p><Button type="button" disabled={closureBusy||!closureEvidence.trim()} onClick={()=>void closeSupplierQuantity()}>{closureBusy?"Yadda saxlanır…":"Uzlaşmanı təsdiqlə"}</Button></div></Modal>}
      </>}
      {tab === "aktlar" && (
        <TableContainer className="wide">
          <DataTable>
            <thead>
              <tr>
                <th>Akt</th>
                <th>Tarix</th>
                <th>Obyekt</th>
                <th>Məsul</th>
                <th>Status</th>
                <th className="num">Yekun</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="click" onClick={() => { setError(""); setReading({ kind: "act", id: item.id }) }}>
                  <td><b>{item.number}</b><div className="muted">{item.lines.length} sətir</div></td>
                  <td>{dateAZ(item.date)}</td>
                  <td>{item.objectName}<div className="muted">{item.person || "—"}</div></td>
                  <td>{item.person || "—"}</td>
                  <td><Badge status={item.status} /></td>
                  <td className="num">{money(item.net)}</td>
                  <td>
                    <RowMenu
                      items={[
                        ...(item.status === "qaralama" ? [
                          { id: "edit", label: "Redaktə", onClick: () => { setError(""); setReading({ kind: "act", id: item.id, edit: true }) } },
                          { id: "delete", label: "Sil", onClick: () => { const message = removePurchaseAct(item.id); setError(message); if (!message) setReading(null) } },
                        ] : []),
                        ...(item.status === "tesdiq" ? [
                          { id: "return", label: "Qəbulu ləğv et", onClick: () => setError(returnPurchaseAct(item.id)) },
                        ] : []),
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {rows.length === 0 && <Empty title="Alış aktı yoxdur" text="Sahəyə alınan malı bu sənədlə yazın." />}
        </TableContainer>
      )}

      {tab === "umumi" && (
        <TableContainer className="wide">
          <DataTable>
            <thead>
              <tr>
                <th>Akt</th>
                <th>Tarix</th>
                <th>Material</th>
                <th>Ölçü</th>
                <th className="num">Miqdar</th>
                <th className="num">Qiymət</th>
                <th className="num">Dəyər</th>
                <th>Nağd ödəniş</th><th>Firma</th><th>Qeyd</th><th>Göndərən</th>
              </tr>
            </thead>
            <tbody>
              {ledger.filter((item) => hit(query, item.actNumber, item.materialName, item.firmName, item.objectName)).map((item) => (
                <tr key={`${item.actId}-${item.id}`} className="click" onClick={() => { setError(""); setReading({ kind: "act", id: item.actId }) }}>
                  <td><b>{item.actNumber}</b><div className="muted">{item.objectName}</div></td>
                  <td>{dateAZ(item.date)}</td>
                  <td>{item.materialName}</td>
                  <td>{item.unit}</td>
                  <td className="num">{num(item.qty, 2)}</td>
                  <td className="num">{num(item.unitPrice, 4)}</td>
                  <td className="num">{money(item.amount)}</td>
                  <td className="num">{item.cashPaid == null ? "—" : money(item.cashPaid)}</td><td>{item.firmName || "—"}</td><td>{item.note || "—"}</td><td>{item.sender || "—"}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {ledger.length === 0 && <Empty title="Reyestr boşdur" text="Təsdiqlənmiş aktların sətirləri burada toplanır." />}
        </TableContainer>
      )}

      {tab === "elave" && (
        <TableContainer className="wide">
          <DataTable>
            <thead>
              <tr>
                <th>Akt</th>
                <th>Material</th>
                <th className="num">Miqdar</th>
                <th className="num">Qiymət</th>
                <th className="num">Dəyər</th><th className="num">Fərq</th>
                <th className="num">Yekun</th>
                <th>Əsas akt</th>
              </tr>
            </thead>
            <tbody>
              {adjusts.map((item) => (
                <tr key={`${item.actId}-${item.id}`} className="click" onClick={() => { setError(""); setReading({ kind: "act", id: item.actId }) }}>
                  <td><b>{item.actNumber}</b></td>
                  <td>{item.materialName}<div className="muted">{item.unit}</div></td>
                  <td className="num">{num(item.qty, 2)}</td>
                  <td className="num">{num(item.unitPrice, 4)}</td>
                  <td className="num">{money(item.amount)}</td><td className="num">{num(item.diff, 4)}</td>
                  <td className="num">{money(item.diffAmount)}</td>
                  <td>{item.actLabel || "—"}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {adjusts.length === 0 && <Empty title="Əlavə yoxdur" text="Qiymət fərqi olan aktlar burada görünür." />}
        </TableContainer>
      )}

      {act && (
        <ActDrawer
          act={act}
          projects={projects}
          locations={locations}
          receiveLocation={receiveLocation}
          onReceiveLocation={setReceiveLocation}
          error={error}
          startEdit={Boolean(reading?.kind === "act" && reading.edit)}
          onClose={() => setReading(null)}
          onReceive={(lines) => setError(receivePurchaseAct(act.id, receiveLocation, lines))}
          onReturn={() => setError(returnPurchaseAct(act.id))}
          onDelete={() => { const message = removePurchaseAct(act.id); setError(message); if (!message) setReading(null) }}
          onSave={(form) => { const message = editPurchaseAct(act.id, form); setError(message); return message }}
        />
      )}

      {reading?.kind === "new" && (
        <ActComposer
          projects={projects}
          error={error}
          onClose={() => setReading(null)}
          onSave={(form) => {
            const message = makePurchaseAct(form)
            setError(message)
            if (!message) { setReading(null); setTab("aktlar") }
            return message
          }}
        />
      )}
    </div>
  )
}

function ActComposer({
  projects, error, onClose, onSave,
}: {
  projects: { id: string; name: string }[]
  error: string
  onClose: () => void
  onSave: (form: PurchaseActForm) => string
}) {
  const [form, setForm] = useState({
    projectId: "",
    objectName: "",
    person: "",
    date: "2026-10-22",
    note: "",
    lines: [emptyLine(), emptyLine()],
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    onSave({
      projectId: form.projectId || undefined,
      objectName: form.objectName,
      person: form.person,
      date: form.date,
      note: form.note,
      lines: form.lines.filter((line) => line.materialName.trim()).map((line) => ({
        ...line,
        qty: line.qty,
        unitPrice: line.unitPrice,
        amount: line.amount || undefined,
      })),
    })
  }

  return (
    <Drawer title="Yeni alış aktı" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Obyekt">
          <Input value={form.objectName} onChange={(event) => setForm({ ...form, objectName: event.target.value })} placeholder="Xocalı evlər (45 Ev)" required />
        </Field>
        <Field label="Layihə">
          <Select
            value={form.projectId}
            onValueChange={(value) => setForm({ ...form, projectId: value })}
            options={[{ value: "", label: "Layihəsiz" }, ...projects.map((project) => ({ value: project.id, label: project.name }))]}
          />
        </Field>
        <Field label="Məsul">
          <Input value={form.person} onChange={(event) => setForm({ ...form, person: event.target.value })} placeholder="Tapdıq / Sakit" />
        </Field>
        <Field label="Tarix">
          <DateField value={form.date} onChange={(value) => setForm({ ...form, date: value })} />
        </Field>
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>Material</th>
                <th>Ölçü</th>
                <th>Miqdar</th>
                <th>Qiymət</th>
                <th>Firma</th>
              </tr>
            </thead>
            <tbody>
              {form.lines.map((line, index) => (
                <tr key={index}>
                  <td><Input value={line.materialName} onChange={(event) => setForm({ ...form, lines: form.lines.map((row, i) => i === index ? { ...row, materialName: event.target.value } : row) })} /></td>
                  <td><Input value={line.unit} onChange={(event) => setForm({ ...form, lines: form.lines.map((row, i) => i === index ? { ...row, unit: event.target.value } : row) })} /></td>
                  <td><Input value={line.qty} inputMode="decimal" onChange={(event) => setForm({ ...form, lines: form.lines.map((row, i) => i === index ? { ...row, qty: event.target.value } : row) })} /></td>
                  <td><Input value={line.unitPrice} inputMode="decimal" onChange={(event) => setForm({ ...form, lines: form.lines.map((row, i) => i === index ? { ...row, unitPrice: event.target.value } : row) })} /></td>
                  <td><Input value={line.firmName} onChange={(event) => setForm({ ...form, lines: form.lines.map((row, i) => i === index ? { ...row, firmName: event.target.value } : row) })} /></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableContainer>
        <Button type="button" className="ghost" onClick={() => setForm({ ...form, lines: [...form.lines, emptyLine()] })}>Sətir əlavə et</Button>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <Button type="button" className="ghost" onClick={onClose}>Ləğv et</Button>
          <Button type="submit" >Yaz</Button>
        </div>
      </form>
    </Drawer>
  )
}

function ActDrawer({
  act, projects, locations, receiveLocation, onReceiveLocation, error, startEdit, onClose, onReceive, onReturn, onDelete, onSave,
}: {
  act: PurchaseAct
  projects: { id: string; name: string }[]
  locations: { id: string; name: string }[]
  receiveLocation: string
  onReceiveLocation: (id: string) => void
  error: string
  startEdit: boolean
  onClose: () => void
  onReceive: (lines: { purchaseActLineId: string; acceptedQty: string; disputedQty: string; disputeReason?: string }[]) => void
  onReturn: () => void
  onDelete: () => void
  onSave: (form: PurchaseActForm) => string
}) {
  const { actor, purchaseDisputeAction } = useStore()
  const [editing, setEditing] = useState(startEdit)
  const [received, setReceived] = useState<Record<string, { acceptedQty: string; disputedQty: string; disputeReason: string }>>(() => Object.fromEntries(act.lines.map((line) => [line.id, { acceptedQty: "0", disputedQty: "0", disputeReason: "" }])))
  const [receiptHistory, setReceiptHistory] = useState<{ id: string; receivedAt: string; receivedBy: string; reversedAt?: string | null; reversedBy?: string | null; reversalReason?: string | null; lines: { id: string; purchaseLineId: string; acceptedQty: string | number; replacementQty: string | number; disputedQty: string | number; resolvedQty: string | number; disputeStatus: string; disputeReason: string; purchaseLine: { materialName: string; unit: string } }[] }[]>([])
  const [resolutions,setResolutions]=useState<{id:string;purchaseLineId:string;sourceReceiptLineId?:string|null;kind:string;qty:string|number;reason:string;proofFileIds:unknown;status:string;requestedBy:string;requestedAt:string;reviewReason?:string|null;payableId?:string|null}[]>([])
  const [resolutionForm,setResolutionForm]=useState({qty:"",reason:"",proofFileIds:[] as string[]})
  const [resolutionBusy,setResolutionBusy]=useState(false)
  useEffect(() => { setReceived(Object.fromEntries(act.lines.map((line) => [line.id, { acceptedQty: "0", disputedQty: "0", disputeReason: "" }]))) }, [act.id, act.lines])
  useEffect(() => {
    let active = true
    void Promise.all([api<typeof receiptHistory>(`/api/act-workflows/${encodeURIComponent(act.id)}/purchase-receipts`),api<typeof resolutions>(`/api/act-workflows/${encodeURIComponent(act.id)}/purchase-dispute-resolutions`)]).then(([receipts,rows])=>{if(active){setReceiptHistory(receipts);setResolutions(rows)}}).catch(()=>{if(active){setReceiptHistory([]);setResolutions([])}})
    return () => { active = false }
  }, [act.id])
  const [form, setForm] = useState({
    projectId: act.projectId || "",
    objectName: act.objectName,
    person: act.person,
    date: act.date,
    note: act.note,
    lines: act.lines.length
      ? act.lines.map((line) => ({
          materialName: line.materialName,
          unit: line.unit,
          qty: String(line.qty),
          unitPrice: String(line.unitPrice),
          amount: String(line.amount),
          cashPaid: line.cashPaid == null ? "" : String(line.cashPaid),
          firmName: line.firmName,
          note: line.note,
          sender: line.sender,
        }))
      : [emptyLine()],
  })

  function save() {
    const message = onSave({
      projectId: form.projectId || undefined,
      objectName: form.objectName,
      person: form.person,
      date: form.date,
      note: form.note,
      lines: form.lines.filter((line) => line.materialName.trim()).map((line) => ({
        ...line,
        amount: line.amount || undefined,
      })),
    })
    if (!message) setEditing(false)
  }

  return (
    <Drawer title={act.number} onClose={onClose}>
      <div className="form">
        <p className="muted">Mal və materialların alış aktı · {dateAZ(act.date)}</p>
        <p><Badge status={act.status} /></p>
        {editing ? (
          <>
            <Field label="Obyekt"><Input value={form.objectName} onChange={(event) => setForm({ ...form, objectName: event.target.value })} /></Field>
            <Field label="Layihə">
              <Select
                value={form.projectId}
                onValueChange={(value) => setForm({ ...form, projectId: value })}
                options={[{ value: "", label: "Layihəsiz" }, ...projects.map((project) => ({ value: project.id, label: project.name }))]}
              />
            </Field>
            <Field label="Məsul"><Input value={form.person} onChange={(event) => setForm({ ...form, person: event.target.value })} /></Field>
            <Field label="Tarix"><DateField value={form.date} onChange={(value) => setForm({ ...form, date: value })} /></Field>
            {form.lines.map((line, index) => (
              <div className="recipe-line" key={index}>
                <Input aria-label="Material" placeholder="Material" value={line.materialName} onChange={(event) => setForm({ ...form, lines: form.lines.map((row, i) => i === index ? { ...row, materialName: event.target.value } : row) })} />
                <div className="recipe-line-qty">
                  <Input aria-label="Miqdar" value={line.qty} onChange={(event) => setForm({ ...form, lines: form.lines.map((row, i) => i === index ? { ...row, qty: event.target.value } : row) })} />
                  <Input aria-label="Qiymət" value={line.unitPrice} onChange={(event) => setForm({ ...form, lines: form.lines.map((row, i) => i === index ? { ...row, unitPrice: event.target.value } : row) })} />
                  <Input aria-label="Firma" placeholder="Firma" value={line.firmName} onChange={(event) => setForm({ ...form, lines: form.lines.map((row, i) => i === index ? { ...row, firmName: event.target.value } : row) })} />
                </div>
              </div>
            ))}
            <Button type="button" className="ghost" onClick={() => setForm({ ...form, lines: [...form.lines, emptyLine()] })}>Sətir əlavə et</Button>
          </>
        ) : (
          <>
            <p><b>{act.objectName}</b></p>
            <p className="muted">Məsul {act.person || "—"}{act.project ? ` · ${act.project}` : ""}</p>
            {act.lines.map((line) => (
              <p key={line.id}>
                <b>{line.materialName}</b> · {num(line.qty, 2)} {line.unit} · {num(line.unitPrice, 4)} · {money(line.amount)}
                <span className="muted"> · Nağd: {line.cashPaid == null ? "—" : money(line.cashPaid)} · {line.note || "Qeyd yoxdur"} · {line.firmName || "firma yox"}{line.sender ? ` · göndərən ${line.sender}` : ""}</span>
              </p>
            ))}
            {act.adjustments.length > 0 && (
              <>
                <p><b>Qiymət fərqi əlavəsi</b></p>
                {act.adjustments.map((row) => (
                  <p key={row.id}>
                    {row.materialName} · fərq {num(row.diff, 4)} · {money(row.diffAmount)}
                    <span className="muted"> · {row.actLabel || "—"}</span>
                  </p>
                ))}
              </>
            )}
            <p><b>Yekun {money(act.net)}</b></p>
            {act.lines.some((line) => (line.receivedQty || 0) > 0) && <p className="muted">Qəbul: {act.lines.reduce((sum, line) => sum + (line.receivedQty || 0), 0)} / {act.lines.reduce((sum, line) => sum + line.qty, 0)} · <Link to="/anbar">Anbara bax</Link></p>}
            {act.status === "qismən" && act.lines.every((line) => line.qty - (line.receivedQty || 0) - (line.closedQty || 0) <= 0) && receiptHistory.some((receipt) => !receipt.reversedAt && receipt.lines.some((line) => line.disputeStatus === "acıq" && Number(line.disputedQty) > 0)) && <p className="muted">Sifariş miqdarı qəbul edilib, amma mübahisəli mal üzrə qərar açıqdır.</p>}
            {receiptHistory.length > 0 && <section><b>Qəbul tarixçəsi</b>{receiptHistory.map((receipt) => <p className="muted" key={receipt.id}>{dateAZ(receipt.receivedAt.slice(0, 10))} · {receipt.receivedBy} · {receipt.lines.map((line) => `${line.purchaseLine.materialName}: ${line.acceptedQty} ${line.purchaseLine.unit} qəbul${Number(line.replacementQty)>0?`, ${line.replacementQty} əvəz mal (borcsuz)`:""}${Number(line.disputedQty) > 0 ? `, ${line.disputedQty} mübahisəli (${receipt.reversedAt ? "əks yazılıb" : line.disputeStatus}) · ${line.disputeReason}` : ""}`).join("; ")}{receipt.reversedAt ? ` · Ləğv edildi ${dateAZ(receipt.reversedAt.slice(0, 10))} (${receipt.reversedBy || "—"}): ${receipt.reversalReason || "səbəb göstərilməyib"}` : ""}</p>)}</section>}
            {receiptHistory.flatMap(receipt=>receipt.reversedAt?[]:receipt.lines.filter(line=>line.disputeStatus==="acıq"&&Number(line.disputedQty)>Number(line.resolvedQty)).map(line=>({line}))).map(({line})=><section className="form" key={line.id}>
              <b>Mübahisənin həlli · {line.purchaseLine.materialName}</b><p className="muted">Açıq miqdar: {num(Number(line.disputedQty)-Number(line.resolvedQty),3)} {line.purchaseLine.unit} · {line.disputeReason}</p>
              {actor.role==="procurement"||actor.role==="director"?<><Field label="Kredit miqdarı"><Input inputMode="decimal" value={resolutionForm.qty} onChange={e=>setResolutionForm({...resolutionForm,qty:e.target.value})}/></Field><Field label="Səbəb"><Input value={resolutionForm.reason} onChange={e=>setResolutionForm({...resolutionForm,reason:e.target.value})}/></Field><MarketDocuments value={resolutionForm.proofFileIds} onChange={proofFileIds=>setResolutionForm({...resolutionForm,proofFileIds})}/><Button type="button" disabled={resolutionBusy} onClick={()=>{setResolutionBusy(true);void purchaseDisputeAction(act.id,"request-purchase-dispute-resolution",{kind:"credit",purchaseActLineId:line.purchaseLineId,sourceReceiptLineId:line.id,qty:resolutionForm.qty,reason:resolutionForm.reason,proofFileIds:resolutionForm.proofFileIds}).then(()=>api<typeof resolutions>(`/api/act-workflows/${encodeURIComponent(act.id)}/purchase-dispute-resolutions`).then(setResolutions)).finally(()=>setResolutionBusy(false))}}>Sənədli kredit sorğusu</Button></>:null}
            </section>)}
            {actor.role==="director"&&act.lines.some(line=>line.qty-(line.receivedQty||0)-(line.closedQty||0)>0)&&<section className="form"><b>Qalıq miqdarın rəhbər qərarı</b>{act.lines.filter(line=>line.qty-(line.receivedQty||0)-(line.closedQty||0)>0).map(line=><div className="recipe-line" key={line.id}><span>{line.materialName}<small className="muted">Bağlana bilən qalıq: {num(line.qty-(line.receivedQty||0)-(line.closedQty||0),3)} {line.unit}</small></span><Input aria-label={`${line.materialName} bağlanan miqdar`} inputMode="decimal" placeholder={String(line.qty-(line.receivedQty||0)-(line.closedQty||0))} value={resolutionForm.qty} onChange={e=>setResolutionForm({...resolutionForm,qty:e.target.value})}/><Input aria-label="Bağlama səbəbi" placeholder="Rəhbər səbəbi" value={resolutionForm.reason} onChange={e=>setResolutionForm({...resolutionForm,reason:e.target.value})}/><Button type="button" disabled={resolutionBusy} onClick={()=>{setResolutionBusy(true);void purchaseDisputeAction(act.id,"request-purchase-dispute-resolution",{kind:"shortage-close",purchaseActLineId:line.id,qty:resolutionForm.qty||String(line.qty-(line.receivedQty||0)-(line.closedQty||0)),reason:resolutionForm.reason}).then(()=>api<typeof resolutions>(`/api/act-workflows/${encodeURIComponent(act.id)}/purchase-dispute-resolutions`).then(setResolutions)).finally(()=>setResolutionBusy(false))}}>Bağlama sorğusu</Button></div>)}</section>}
            {resolutions.length>0&&<section><b>Qərar sorğuları</b>{resolutions.map(item=><div className="form" key={item.id}><p>{item.kind==="credit"?"Təchizatçı krediti":"Qalıq miqdarın bağlanması"} · {item.qty} · {item.reason} · <Badge status={item.status}/></p><p className="muted">Sorğu: {item.requestedBy} · {dateAZ(item.requestedAt.slice(0,10))}{item.reviewReason?` · Baxış: ${item.reviewReason}`:""}</p>{Array.isArray(item.proofFileIds)&&item.proofFileIds.map((id)=>typeof id==="string"&&<MarketDownload key={id} id={id} label="Təsdiq sənədi"/>)}{item.status==="pending"&&((item.kind==="credit"&&["director","accountant"].includes(actor.role))||(item.kind==="shortage-close"&&actor.role==="director"))&&<div className="form-actions"><Button type="button" disabled={resolutionBusy} onClick={()=>{setResolutionBusy(true);void purchaseDisputeAction(act.id,"review-purchase-dispute-resolution",{resolutionId:item.id,decision:"approve"}).then(()=>api<typeof resolutions>(`/api/act-workflows/${encodeURIComponent(act.id)}/purchase-dispute-resolutions`).then(setResolutions)).finally(()=>setResolutionBusy(false))}}>Təsdiq et</Button><Button type="button" className="ghost" disabled={resolutionBusy} onClick={()=>{setResolutionBusy(true);void purchaseDisputeAction(act.id,"review-purchase-dispute-resolution",{resolutionId:item.id,decision:"reject",reason:"Sorğu rədd edildi"}).then(()=>api<typeof resolutions>(`/api/act-workflows/${encodeURIComponent(act.id)}/purchase-dispute-resolutions`).then(setResolutions)).finally(()=>setResolutionBusy(false))}}>Rədd et</Button></div>}</div>)}</section>}
          </>
        )}
        {["qaralama", "qismən"].includes(act.status) && !editing && <>
          <Field label="Qəbul anbarı"><Select value={receiveLocation} onValueChange={onReceiveLocation} options={locations.map((item) => ({ value: item.id, label: item.name }))} /></Field>
          {act.lines.map((line) => {
            const remaining = Math.max(0, line.qty - (line.receivedQty || 0) - (line.closedQty || 0))
            return <div className="recipe-line" key={line.id}><span>{line.materialName}<small className="muted">Sifariş: {num(line.qty, 3)} · Qəbul: {num(line.receivedQty || 0, 3)} · Qalıq: {num(remaining, 3)} {line.unit}</small></span><Input aria-label={`${line.materialName} qəbul`} inputMode="decimal" placeholder="Qəbul" value={received[line.id]?.acceptedQty ?? "0"} onChange={(event) => setReceived({ ...received, [line.id]: { ...received[line.id], acceptedQty: event.target.value } })} /><Input aria-label={`${line.materialName} mübahisəli miqdar`} inputMode="decimal" placeholder="Mübahisəli" value={received[line.id]?.disputedQty ?? "0"} onChange={(event) => setReceived({ ...received, [line.id]: { ...received[line.id], disputedQty: event.target.value } })} /><Input aria-label={`${line.materialName} mübahisə səbəbi`} placeholder="Səbəb (mübahisəli miqdar varsa)" value={received[line.id]?.disputeReason ?? ""} onChange={(event) => setReceived({ ...received, [line.id]: { ...received[line.id], disputeReason: event.target.value } })} /></div>
          })}
        </>}
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          {act.status === "qaralama" && !editing && <Button type="button" className="ghost" onClick={() => setEditing(true)}><Icon name="edit" /> Redaktə</Button>}
          {act.status === "qaralama" && !editing && <Button type="button" className="ghost" onClick={onDelete}><Icon name="trash" /> Sil</Button>}
          {editing && <Button type="button" className="ghost" onClick={() => setEditing(false)}>Ləğv et</Button>}
          {editing && <Button type="button" onClick={save}>Yaz</Button>}
          {["qaralama", "qismən"].includes(act.status) && !editing && <Button type="button" disabled={!act.lines.some((line) => Number(received[line.id]?.acceptedQty) > 0 || Number(received[line.id]?.disputedQty) > 0)} onClick={() => onReceive(act.lines.map((line) => ({ purchaseActLineId: line.id, acceptedQty: received[line.id]?.acceptedQty || "0", disputedQty: received[line.id]?.disputedQty || "0", disputeReason: received[line.id]?.disputeReason || "" })).filter((line) => Number(line.acceptedQty) > 0 || Number(line.disputedQty) > 0))}>Faktiki qəbulu yaz</Button>}
          {act.status === "tesdiq" && <Button type="button" className="ghost" onClick={onReturn}>Qəbulu ləğv et</Button>}
        </div>
      </div>
    </Drawer>
  )
}
