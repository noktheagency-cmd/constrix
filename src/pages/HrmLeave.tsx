import { useState, type FormEvent } from "react"
import { LEAVE_KINDS } from "../domain/hrm"
import type { LeaveForm, LeaveKind, LeaveRequest } from "../domain/types"
import { DateField } from "../DateField"
import { dateAZ, hit } from "../format"
import { Icon } from "../icons"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Badge, Empty, Field, Modal, PageHead, RowMenu, Select, Tabs, useTitle } from "../ui"

const empty: LeaveForm = { personId: "", kind: "illik", from: "2026-10-01", to: "2026-10-05", note: "" }

export default function HrmLeave() {
  const { t } = usePrefs()
  useTitle(t("page.leave.title"))
  const store = useStore()
  const [tab, setTab] = useState("hamisi")
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState("")
  const [error, setError] = useState("")
  const personOf = (id: string) => store.people.find((item) => item.id === id)
  const rows = store.leaves.filter((item) => {
    const person = personOf(item.personId)
    return (tab === "hamisi" || item.status === tab) && hit(store.query, person?.name, item.kind, item.note, item.id)
  })

  function openForm(row?: LeaveRequest) {
    setError("")
    setEditing(row?.id || "")
    setForm(row ? { personId: row.personId, kind: row.kind, from: row.from, to: row.to, note: row.note } : { ...empty, personId: store.people[0]?.id || "" })
    setModal(true)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const message = store.saveLeave(form, editing || undefined)
    setError(message)
    if (!message) setModal(false)
  }

  return (
    <>
      <PageHead kicker={t("page.leave.kicker")} title={t("page.leave.title")} text={t("page.leave.text")}>
        <button type="button" className="btn" onClick={() => openForm()}><Icon name="plus" /> Məzuniyyət</button>
      </PageHead>
      <div className="toolbar">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { id: "hamisi", label: "Hamısı" },
            { id: "gozleyir", label: "Gözləyir" },
            { id: "tesdiq", label: "Təsdiq" },
            { id: "redd", label: "Rədd" },
          ]}
        />
        <span className="muted">{store.leaves.filter((item) => item.status === "gozleyir").length} gözləyir</span>
      </div>
      {error && !modal && <p className="form-error">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>İşçi</th>
              <th>Növ</th>
              <th>Başlanğıc</th>
              <th>Son</th>
              <th className="num">Gün</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><b>{personOf(row.personId)?.name || row.personId}</b><div className="muted">{row.note}</div></td>
                <td><Badge status={row.kind} /></td>
                <td>{dateAZ(row.from)}</td>
                <td>{dateAZ(row.to)}</td>
                <td className="num">{row.days}</td>
                <td><Badge status={row.status} /></td>
                <td>
                  <RowMenu
                    items={[
                      { id: "edit", label: "Redaktə", onClick: () => openForm(row) },
                      { id: "ok", label: "Təsdiq", onClick: () => setError(store.approveLeave(row.id)) },
                      { id: "no", label: "Rədd", onClick: () => setError(store.rejectLeave(row.id)) },
                      { id: "delete", label: "Sil", onClick: () => setError(store.removeLeave(row.id)) },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty title="Məzuniyyət yoxdur" text="İşçi üçün aralıq yazın." />}
      </div>

      {modal && (
        <Modal wide title={editing ? "Məzuniyyəti yaz" : "Yeni məzuniyyət"} onClose={() => setModal(false)}>
          <form className="form cols" onSubmit={submit}>
            <Field label="İşçi">
              <Select value={form.personId} onValueChange={(personId) => setForm({ ...form, personId })} options={store.people.map((item) => ({ value: item.id, label: item.name }))} />
            </Field>
            <Field label="Növ">
              <Select value={form.kind} onValueChange={(kind) => setForm({ ...form, kind: kind as LeaveKind })} options={LEAVE_KINDS.map((item) => ({ value: item, label: t(`status.${item}`) }))} />
            </Field>
            <Field label="Başlanğıc">
              <DateField value={form.from} onChange={(from) => setForm({ ...form, from })} />
            </Field>
            <Field label="Son">
              <DateField value={form.to} onChange={(to) => setForm({ ...form, to })} />
            </Field>
            <Field label="Qeyd">
              <textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setModal(false)}>Ləğv et</button>
              <button className="btn" type="submit">Saxla</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
