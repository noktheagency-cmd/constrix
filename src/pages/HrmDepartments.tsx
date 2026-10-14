import { useState, type FormEvent } from "react"
import { placeGroups } from "../domain/places"
import type { Department, DepartmentForm } from "../domain/types"
import { hit } from "../format"
import { Icon } from "../icons"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Empty, Field, Modal, PageHead, RowMenu, Select, useTitle } from "../ui"

const empty: DepartmentForm = { name: "", code: "", leadId: "", site: "" }

export default function HrmDepartments() {
  const { t } = usePrefs()
  useTitle(t("page.departments.title"))
  const store = useStore()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState("")
  const [error, setError] = useState("")
  const groups = placeGroups(store).map((group) => ({ label: t(`place.${group.kind}`), options: group.options }))
  const firstPlace = groups[0]?.options[0]?.value || ""
  const rows = store.departments.filter((item) => {
    const lead = store.people.find((person) => person.id === item.leadId)
    return hit(store.query, item.name, item.code, item.site, lead?.name)
  })

  function openForm(row?: Department) {
    setError("")
    setEditing(row?.id || "")
    setForm(row ? { name: row.name, code: row.code, leadId: row.leadId, site: row.site } : { ...empty, site: firstPlace, leadId: store.people[0]?.id || "" })
    setModal(true)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const message = store.saveDepartment(form, editing || undefined)
    setError(message)
    if (!message) setModal(false)
  }

  return (
    <>
      <PageHead kicker={t("page.departments.kicker")} title={t("page.departments.title")} text={t("page.departments.text")}>
        <button type="button" className="btn" onClick={() => openForm()}><Icon name="plus" /> Şöbə</button>
      </PageHead>
      {error && !modal && <p className="form-error">{error}</p>}
      <div className="crew-grid">
        {rows.map((row) => {
          const lead = store.people.find((item) => item.id === row.leadId)
          const size = store.people.filter((item) => item.departmentId === row.id).length
          return (
            <article key={row.id} className="crew-card">
              <div className="card-top">
                <b>{row.name}</b>
                <span className="mono">{row.code}</span>
              </div>
              <p className="muted">{row.site}</p>
              <p>Rəhbər {lead?.name || "—"} · {size} nəfər</p>
            </article>
          )
        })}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Şöbə</th>
              <th>Kod</th>
              <th>Rəhbər</th>
              <th>Yer</th>
              <th className="num">İşçi</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><b>{row.name}</b></td>
                <td className="mono">{row.code}</td>
                <td>{store.people.find((item) => item.id === row.leadId)?.name || "—"}</td>
                <td>{row.site}</td>
                <td className="num">{store.people.filter((item) => item.departmentId === row.id).length}</td>
                <td>
                  <RowMenu
                    items={[
                      { id: "edit", label: "Redaktə", onClick: () => openForm(row) },
                      { id: "delete", label: "Sil", onClick: () => setError(store.removeDepartment(row.id)) },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty title="Şöbə yoxdur" text="İdarəetmə, sahə və ya istehsal şöbəsi açın." />}
      </div>

      {modal && (
        <Modal wide title={editing ? "Şöbəni yaz" : "Yeni şöbə"} onClose={() => setModal(false)}>
          <form className="form cols" onSubmit={submit}>
            <Field label="Ad">
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Field>
            <Field label="Kod">
              <input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
            </Field>
            <Field label="Rəhbər">
              <Select value={form.leadId} onValueChange={(leadId) => setForm({ ...form, leadId })} options={[{ value: "", label: "—" }, ...store.people.map((item) => ({ value: item.id, label: item.name }))]} />
            </Field>
            <Field label="Yer">
              <Select value={form.site} onValueChange={(site) => setForm({ ...form, site })} groups={groups} />
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
