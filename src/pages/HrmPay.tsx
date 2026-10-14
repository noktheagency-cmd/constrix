import { useState, type FormEvent } from "react"
import { PAY_KINDS } from "../domain/hrm"
import { TODAY } from "../domain/ops"
import type { HrPayForm, HrPayKind, HrPayment } from "../domain/types"
import { DateField } from "../DateField"
import { dateAZ, hit, money } from "../format"
import { Icon } from "../icons"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Badge, Empty, Field, Modal, PageHead, RowMenu, Select, Tabs, useTitle } from "../ui"

const empty: HrPayForm = { personId: "", kind: "avans", amount: "", date: TODAY, note: "" }

export default function HrmPay() {
  const { t } = usePrefs()
  useTitle(t("page.hrpay.title"))
  const store = useStore()
  const [tab, setTab] = useState("hamisi")
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState("")
  const [error, setError] = useState("")
  const personOf = (id: string) => store.people.find((item) => item.id === id)
  const rows = store.hrPayments.filter((item) => {
    const person = personOf(item.personId)
    return (tab === "hamisi" || item.status === tab) && hit(store.query, person?.name, item.kind, item.note, item.id)
  })
  const waiting = store.hrPayments.filter((item) => item.status === "gozleyir")
  const paid = store.hrPayments.filter((item) => item.status === "odenilib")

  function openForm(row?: HrPayment) {
    setError("")
    setEditing(row?.id || "")
    setForm(row ? { personId: row.personId, kind: row.kind, amount: String(row.amount), date: row.date, note: row.note } : { ...empty, personId: store.people[0]?.id || "" })
    setModal(true)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const message = store.saveHrPay(form, editing || undefined)
    setError(message)
    if (!message) setModal(false)
  }

  return (
    <>
      <PageHead kicker={t("page.hrpay.kicker")} title={t("page.hrpay.title")} text={t("page.hrpay.text")}>
        <button type="button" className="btn" onClick={() => openForm()}><Icon name="plus" /> Ödəniş</button>
      </PageHead>
      <section className="statstrip">
        <article>
          <span>Gözləyir</span>
          <strong>{money(waiting.reduce((sum, item) => sum + item.amount, 0))}</strong>
          <em>{waiting.length} sətir</em>
        </article>
        <article>
          <span>Ödənilib</span>
          <strong>{money(paid.reduce((sum, item) => sum + item.amount, 0))}</strong>
          <em>Maliyyə xərci</em>
        </article>
      </section>
      <div className="toolbar">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { id: "hamisi", label: "Hamısı" },
            { id: "gozleyir", label: "Gözləyir" },
            { id: "odenilib", label: "Ödənilib" },
          ]}
        />
      </div>
      {error && !modal && <p className="form-error">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>İşçi</th>
              <th>Növ</th>
              <th>Tarix</th>
              <th>Qeyd</th>
              <th>Status</th>
              <th className="num">Məbləğ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><b>{personOf(row.personId)?.name || row.personId}</b></td>
                <td><Badge status={row.kind} /></td>
                <td>{dateAZ(row.date)}</td>
                <td>{row.note || "—"}</td>
                <td><Badge status={row.status} /></td>
                <td className="num">{money(row.amount)}</td>
                <td>
                  <RowMenu
                    items={[
                      { id: "edit", label: "Redaktə", onClick: () => openForm(row) },
                      { id: "pay", label: "Ödə", onClick: () => setError(store.payHr(row.id)) },
                      { id: "delete", label: "Sil", onClick: () => setError(store.removeHrPay(row.id)) },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty title="Ödəniş yoxdur" text="Avans, mükafat və ya maaş sətri açın." />}
      </div>

      {modal && (
        <Modal wide title={editing ? "Ödənişi yaz" : "Yeni ödəniş"} onClose={() => setModal(false)}>
          <form className="form cols" onSubmit={submit}>
            <Field label="İşçi">
              <Select value={form.personId} onValueChange={(personId) => setForm({ ...form, personId })} options={store.people.map((item) => ({ value: item.id, label: item.name }))} />
            </Field>
            <Field label="Növ">
              <Select value={form.kind} onValueChange={(kind) => setForm({ ...form, kind: kind as HrPayKind })} options={PAY_KINDS.map((item) => ({ value: item, label: t(`status.${item}`) }))} />
            </Field>
            <Field label="Məbləğ, ₼">
              <input type="number" min="0" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
            </Field>
            <Field label="Tarix">
              <DateField value={form.date} onChange={(date) => setForm({ ...form, date })} />
            </Field>
            <Field label="Qeyd">
              <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
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
