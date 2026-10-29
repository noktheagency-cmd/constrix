import { DataTable } from '../components/DataTable'
import { Button, Input, TableContainer, Textarea, Toolbar } from "../components/primitives"
import { useState, type FormEvent } from "react"
import { FILE_KINDS, FILE_STATUSES, parties, stepOf } from "../domain/crm"
import { ownerOptions } from "../domain/hrm"
import { TODAY } from "../domain/ops"
import type { CrmFile, FileForm, FileKind } from "../domain/types"
import { DateField } from "../DateField"
import { dateAZ, hit } from "../format"
import { Icon } from "../icons"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Badge, Drawer, Empty, Field, Modal, PageHead, RowMenu, Select, Tabs, useTitle } from "../ui"

const empty: FileForm = { title: "", number: "", kind: "teklif", date: "2026-09-23", due: "", client: "", dealId: "", projectId: "", note: "", owner: "" }

export default function CrmFiles() {
  const { t } = usePrefs()
  useTitle(t("page.files.title"))
  const store = useStore()
  const [tab, setTab] = useState("hamisi")
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState("")
  const [openId, setOpenId] = useState("")
  const [error, setError] = useState("")
  const selected = store.files.find((item) => item.id === openId)
  const names = parties(store)
  const rows = store.files.filter((item) => (tab === "hamisi" || item.status === tab) && hit(store.query, item.title, item.number, item.client, item.owner, item.kind))

  function openForm(file?: CrmFile) {
    setError("")
    setEditing(file?.id || "")
    setForm(file ? { title: file.title, number: file.number, kind: file.kind, date: file.date, due: file.due, client: file.client, dealId: file.dealId, projectId: file.projectId, note: file.note, owner: file.owner } : { ...empty, owner: store.actor.name })
    setModal(true)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = store.saveCrmFile(form, editing || undefined)
    setError(message)
    if (!message) setModal(false)
  }

  return (
    <>
      <PageHead kicker={t("page.files.kicker")} title={t("page.files.title")} text={t("page.files.text")}>
        <Button type="button" onClick={() => openForm()}><Icon name="plus" /> Sənəd</Button>
      </PageHead>
      <Toolbar>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[{ id: "hamisi", label: "Hamısı" }, ...FILE_STATUSES.map((item) => ({ id: item, label: t(`status.${item}`) }))]}
        />
        <span className="muted">{rows.length} sənəd</span>
      </Toolbar>
      {error && !modal && !selected && <p className="form-error">{error}</p>}
      <TableContainer>
        <DataTable>
          <thead>
            <tr>
              <th>Sənəd</th>
              <th>Növ</th>
              <th>Sifarişçi</th>
              <th>Status</th>
              <th>Son tarix</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((file) => {
              const late = file.due && file.due < TODAY && file.status !== "tesdiq" && file.status !== "arxiv"
              const forward = stepOf(FILE_STATUSES, file.status, 1)
              const back = stepOf(FILE_STATUSES, file.status, -1)
              return (
                <tr key={file.id} className="click" onClick={() => setOpenId(file.id)}>
                  <td>
                    <div className="name-cell">
                      <b>{file.title}</b>
                      <span className="mono">{file.number || file.id}</span>
                    </div>
                  </td>
                  <td><Badge status={file.kind} /></td>
                  <td>{file.client || "—"}</td>
                  <td><Badge status={file.status} /></td>
                  <td>{file.due ? dateAZ(file.due) : "—"}{late ? " · gecikir" : ""}</td>
                  <td>
                    <RowMenu
                      items={[
                        ...(file.status === "qaralama" || file.status === "gozleyir" ? [{ id: "edit", label: "Redaktə", onClick: () => openForm(file) }] : []),
                        ...(back ? [{ id: "back", label: "Geri", onClick: () => { if (back) setError(store.moveCrmFile(file.id, back)) } }] : []),
                        ...(forward ? [{ id: "next", label: forward === "arxiv" ? "Arxivə" : "İrəli", onClick: () => { if (forward) setError(store.moveCrmFile(file.id, forward)) } }] : []),
                        ...(file.status === "qaralama" ? [{ id: "delete", label: "Sil", onClick: () => { const message = store.removeCrmFile(file.id); setError(message); if (!message && openId === file.id) setOpenId("") } }] : []),
                      ]}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </DataTable>
        {rows.length === 0 && <Empty title="Sənəd tapılmadı" text="Filtri dəyişin və ya yeni qaralama açın." />}
      </TableContainer>

      {selected && (
        <Drawer title={selected.title} onClose={() => setOpenId("")}>
          <dl className="kv">
            <dt>Nömrə</dt><dd className="mono">{selected.number || selected.id}</dd>
            <dt>Növ</dt><dd><Badge status={selected.kind} /></dd>
            <dt>Status</dt><dd><Badge status={selected.status} /></dd>
            <dt>Məsul</dt><dd>{selected.owner}</dd>
            <dt>Tarix</dt><dd>{dateAZ(selected.date)}</dd>
            <dt>Son tarix</dt><dd>{selected.due ? dateAZ(selected.due) : "—"}</dd>
            <dt>Sifarişçi</dt><dd>{selected.client || "—"}</dd>
            <dt>Sövdə</dt><dd>{store.deals.find((item) => item.id === selected.dealId)?.title || "—"}</dd>
            <dt>Layihə</dt><dd>{store.projects.find((item) => item.id === selected.projectId)?.name || "—"}</dd>
          </dl>
          {selected.note && <p>{selected.note}</p>}
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            {(selected.status === "qaralama" || selected.status === "gozleyir") && (
              <Button type="button" className="ghost" onClick={() => openForm(selected)}><Icon name="edit" /> Redaktə</Button>
            )}
            {stepOf(FILE_STATUSES, selected.status, 1) && (
              <Button type="button" onClick={() => setError(store.moveCrmFile(selected.id, stepOf(FILE_STATUSES, selected.status, 1) as typeof selected.status))}>İrəli</Button>
            )}
          </div>
        </Drawer>
      )}

      {modal && (
        <Modal wide title={editing ? "Sənədi yaz" : "Yeni sənəd"} onClose={() => setModal(false)}>
          <form className="form cols" onSubmit={submit}>
            <Field label="Ad">
              <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </Field>
            <Field label="Nömrə">
              <Input value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} />
            </Field>
            <Field label="Növ">
              <Select value={form.kind} onValueChange={(kind) => setForm({ ...form, kind: kind as FileKind })} options={FILE_KINDS.map((item) => ({ value: item, label: t(`status.${item}`) }))} />
            </Field>
            <Field label="Məsul">
              <Select value={form.owner} onValueChange={(owner) => setForm({ ...form, owner })} options={ownerOptions(store.people, form.owner)} />
            </Field>
            <Field label="Tarix">
              <DateField value={form.date} onChange={(date) => setForm({ ...form, date })} />
            </Field>
            <Field label="Son tarix">
              <DateField value={form.due} onChange={(due) => setForm({ ...form, due })} />
            </Field>
            <Field label="Sifarişçi">
              <Select value={form.client} onValueChange={(client) => setForm({ ...form, client })} options={[{ value: "", label: "—" }, ...names.map((item) => ({ value: item, label: item }))]} />
            </Field>
            <Field label="Sövdə">
              <Select value={form.dealId} onValueChange={(dealId) => setForm({ ...form, dealId })} options={[{ value: "", label: "—" }, ...store.deals.map((item) => ({ value: item.id, label: item.title }))]} />
            </Field>
            <Field label="Layihə">
              <Select value={form.projectId} onValueChange={(projectId) => setForm({ ...form, projectId })} options={[{ value: "", label: "—" }, ...store.projects.map((item) => ({ value: item.id, label: item.name }))]} />
            </Field>
            <Field label="Qeyd">
              <Textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
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
