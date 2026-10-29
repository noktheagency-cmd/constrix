import { DataTable } from '../components/DataTable'
import { Button, Input, Metric, StatGrid, TableContainer, Toolbar } from "../components/primitives"
import { useState, type FormEvent } from "react"
import { MARKS } from "../domain/hrm"
import { TODAY } from "../domain/ops"
import type { AttendanceForm, AttendanceMark, AttendanceRow } from "../domain/types"
import { DateField } from "../DateField"
import { dateAZ, hit } from "../format"
import { Icon } from "../icons"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Badge, Empty, Field, Modal, PageHead, RowMenu, Select, useTitle } from "../ui"

const empty: AttendanceForm = { personId: "", date: TODAY, inAt: "08:00", outAt: "18:00", mark: "geldi", terminalId: "", note: "" }

export default function HrmAttendance() {
  const { t } = usePrefs()
  useTitle(t("page.attendance.title"))
  const store = useStore()
  const [day, setDay] = useState(TODAY)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState("")
  const [error, setError] = useState("")
  const personOf = (id: string) => store.people.find((item) => item.id === id)
  const rows = store.attendance.filter((item) => {
    const person = personOf(item.personId)
    return item.date === day && hit(store.query, person?.name, person?.role, item.note, item.mark)
  })

  function openForm(row?: AttendanceRow) {
    setError("")
    setEditing(row?.id || "")
    setForm(
      row
        ? { personId: row.personId, date: row.date, inAt: row.inAt, outAt: row.outAt, mark: row.mark, terminalId: row.terminalId, note: row.note }
        : { ...empty, date: day, personId: store.people[0]?.id || "", terminalId: store.terminals[0]?.id || "" },
    )
    setModal(true)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const message = store.saveAttendance(form, editing || undefined)
    setError(message)
    if (!message) setModal(false)
  }

  return (
    <>
      <PageHead kicker={t("page.attendance.kicker")} title={t("page.attendance.title")} text={t("page.attendance.text")}>
        <Button type="button" onClick={() => openForm()}><Icon name="plus" /> Sətir</Button>
      </PageHead>
      <StatGrid>
        {(["geldi", "gec", "gelmedi", "mezuniyyet"] as const).map((mark) => (
          <Metric key={mark}>
            <span>{t(`status.${mark}`)}</span>
            <strong>{rows.filter((item) => item.mark === mark).length}</strong>
            <em>{dateAZ(day)}</em>
          </Metric>
        ))}
      </StatGrid>
      <Toolbar>
        <DateField value={day} onChange={setDay} />
        <span className="muted">{rows.length} sətir</span>
      </Toolbar>
      {error && !modal && <p className="form-error">{error}</p>}
      <TableContainer>
        <DataTable>
          <thead>
            <tr>
              <th>İşçi</th>
              <th>Nişan</th>
              <th>Giriş</th>
              <th>Çıxış</th>
              <th className="num">Saat</th>
              <th>Terminal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const person = personOf(row.personId)
              const terminal = store.terminals.find((item) => item.id === row.terminalId)
              return (
                <tr key={row.id}>
                  <td><b>{person?.name || row.personId}</b><div className="muted">{person?.role}</div></td>
                  <td><Badge status={row.mark} /></td>
                  <td className="mono">{row.inAt || "—"}</td>
                  <td className="mono">{row.outAt || "—"}</td>
                  <td className="num">{row.hours || "—"}</td>
                  <td>{terminal?.name || "—"}</td>
                  <td>
                    <RowMenu
                      items={[
                        { id: "edit", label: "Redaktə", onClick: () => openForm(row) },
                        { id: "delete", label: "Sil", onClick: () => setError(store.removeAttendance(row.id)) },
                      ]}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </DataTable>
        {rows.length === 0 && <Empty title="Bu gün boşdur" text="Terminaldan və ya əl ilə sətir yazın." />}
      </TableContainer>

      {modal && (
        <Modal wide title={editing ? "Davamiyyəti yaz" : "Yeni davamiyyət"} onClose={() => setModal(false)}>
          <form className="form cols" onSubmit={submit}>
            <Field label="İşçi">
              <Select value={form.personId} onValueChange={(personId) => setForm({ ...form, personId })} options={store.people.map((item) => ({ value: item.id, label: `${item.name} · ${item.role}` }))} />
            </Field>
            <Field label="Nişan">
              <Select value={form.mark} onValueChange={(mark) => setForm({ ...form, mark: mark as AttendanceMark })} options={MARKS.map((item) => ({ value: item, label: t(`status.${item}`) }))} />
            </Field>
            <Field label="Tarix">
              <DateField value={form.date} onChange={(date) => setForm({ ...form, date })} />
            </Field>
            <Field label="Terminal">
              <Select value={form.terminalId} onValueChange={(terminalId) => setForm({ ...form, terminalId })} options={[{ value: "", label: "—" }, ...store.terminals.map((item) => ({ value: item.id, label: `${item.name} · ${item.site}` }))]} />
            </Field>
            <Field label="Giriş">
              <Input type="time" value={form.inAt} onChange={(event) => setForm({ ...form, inAt: event.target.value })} />
            </Field>
            <Field label="Çıxış">
              <Input type="time" value={form.outAt} onChange={(event) => setForm({ ...form, outAt: event.target.value })} />
            </Field>
            <Field label="Qeyd">
              <Input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <Button type="button" className="ghost" onClick={() => setModal(false)}>Ləğv et</Button>
              <Button  type="submit">Saxla</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
