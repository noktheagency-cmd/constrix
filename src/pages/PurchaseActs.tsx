import { Button, Input, TableContainer, Toolbar } from "../components/primitives"
import { useMemo, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { DateField } from "../DateField"
import type { PurchaseActForm } from "../domain/purchaseActs"
import type { PurchaseAct } from "../domain/types"
import { dateAZ, hit, money, num } from "../format"
import { Icon } from "../icons"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Badge, Drawer, Empty, Field, PageHead, RowMenu, Select, Tabs, useTitle } from "../ui"

type Tab = "aktlar" | "umumi" | "elave"
type Reading = { kind: "act"; id: string; edit?: boolean } | { kind: "new" } | null

const emptyLine = () => ({
  materialName: "",
  unit: "ədəd",
  qty: "",
  unitPrice: "",
  amount: "",
  firmName: "",
  note: "",
  sender: "",
})

export default function PurchaseActs() {
  const { t } = usePrefs()
  useTitle(t("nav.purchaseActs"))
  const {
    query, purchaseActs, projects, locations,
    makePurchaseAct, editPurchaseAct, approvePurchaseAct, returnPurchaseAct, removePurchaseAct,
  } = useStore()
  const [tab, setTab] = useState<Tab>("aktlar")
  const [reading, setReading] = useState<Reading>(null)
  const [error, setError] = useState("")
  const [receiveLocation, setReceiveLocation] = useState(locations.find((item) => item.id === "LOC-MERKEZ")?.id || locations[0]?.id || "")
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
          ]}
        />
        <span className="muted">{rows.filter((item) => item.status === "qaralama").length} qaralama · {money(rows.reduce((sum, item) => sum + item.net, 0))}</span>
      </Toolbar>

      {tab === "aktlar" && (
        <TableContainer className="wide">
          <table>
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
                          { id: "return", label: "Qaralamaya qaytar", onClick: () => setError(returnPurchaseAct(item.id)) },
                        ] : []),
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <Empty title="Alış aktı yoxdur" text="Sahəyə alınan malı bu sənədlə yazın." />}
        </TableContainer>
      )}

      {tab === "umumi" && (
        <TableContainer className="wide">
          <table>
            <thead>
              <tr>
                <th>Akt</th>
                <th>Tarix</th>
                <th>Material</th>
                <th>Ölçü</th>
                <th className="num">Miqdar</th>
                <th className="num">Qiymət</th>
                <th className="num">Dəyər</th>
                <th>Firma</th>
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
                  <td>{item.firmName || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {ledger.length === 0 && <Empty title="Reyestr boşdur" text="Təsdiqlənmiş aktların sətirləri burada toplanır." />}
        </TableContainer>
      )}

      {tab === "elave" && (
        <TableContainer className="wide">
          <table>
            <thead>
              <tr>
                <th>Akt</th>
                <th>Material</th>
                <th className="num">Miqdar</th>
                <th className="num">Qiymət</th>
                <th className="num">Fərq</th>
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
                  <td className="num">{num(item.diff, 4)}</td>
                  <td className="num">{money(item.diffAmount)}</td>
                  <td>{item.actLabel || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
          onApprove={() => setError(approvePurchaseAct(act.id, receiveLocation))}
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
          <table>
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
          </table>
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
  act, projects, locations, receiveLocation, onReceiveLocation, error, startEdit, onClose, onApprove, onReturn, onDelete, onSave,
}: {
  act: PurchaseAct
  projects: { id: string; name: string }[]
  locations: { id: string; name: string }[]
  receiveLocation: string
  onReceiveLocation: (id: string) => void
  error: string
  startEdit: boolean
  onClose: () => void
  onApprove: () => void
  onReturn: () => void
  onDelete: () => void
  onSave: (form: PurchaseActForm) => string
}) {
  const [editing, setEditing] = useState(startEdit)
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
                <span className="muted"> · {line.firmName || "firma yox"}{line.sender ? ` · göndərən ${line.sender}` : ""}</span>
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
            {act.status === "tesdiq" && (
              <p className="muted">Təsdiqdən sonra sətirlər anbara mədaxil olub. <Link to="/anbar">Anbara bax</Link></p>
            )}
          </>
        )}
        {act.status === "qaralama" && !editing && (
          <Field label="Qəbul anbarı">
            <Select
              value={receiveLocation}
              onValueChange={onReceiveLocation}
              options={locations.map((item) => ({ value: item.id, label: item.name }))}
            />
          </Field>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          {act.status === "qaralama" && !editing && <Button type="button" className="ghost" onClick={() => setEditing(true)}><Icon name="edit" /> Redaktə</Button>}
          {act.status === "qaralama" && !editing && <Button type="button" className="ghost" onClick={onDelete}><Icon name="trash" /> Sil</Button>}
          {editing && <Button type="button" className="ghost" onClick={() => setEditing(false)}>Ləğv et</Button>}
          {editing && <Button type="button" onClick={save}>Yaz</Button>}
          {act.status === "qaralama" && !editing && <Button type="button" onClick={onApprove}>Təsdiqlə və anbara yaz</Button>}
          {act.status === "tesdiq" && <Button type="button" className="ghost" onClick={onReturn}>Qaralamaya qaytar</Button>}
        </div>
      </div>
    </Drawer>
  )
}
