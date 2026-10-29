import { Button, Disclosure, Input, Panel, SectionHeader, TableContainer, Toolbar } from "../components/primitives"
import { useState, type FormEvent } from "react"
import { DateField } from "../DateField"
import { bills, moneyMoves, periods, type BillRow } from "../domain/financeView"
import type { Invoice, InvoiceForm, PayableForm } from "../domain/types"
import { dateAZ, hit, money, monthWord } from "../format"
import { Icon } from "../icons"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Badge, Columns, Confirm, Drawer, Empty, Field, FlowBars, Modal, PageHead, RowMenu, Select, Tabs, useTitle } from "../ui"

const emptyInvoice: InvoiceForm = { client: "", project: "", amount: "", due: "2026-10-23" }

export default function FinanceInvoices() {
  const { t } = usePrefs()
  useTitle(t("page.invoices.title"))
  const state = useStore()
  const [tab, setTab] = useState("satis")
  const [form, setForm] = useState<InvoiceForm | null>(null)
  const [editing, setEditing] = useState("")
  const [billForm, setBillForm] = useState<PayableForm | null>(null)
  const [billId, setBillId] = useState("")
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<Invoice | null>(null)
  const [bill, setBill] = useState<BillRow | null>(null)
  const [drop, setDrop] = useState<{ id: string; kind: "qaimə" | "borc"; label: string } | null>(null)
  const rows = bills(state).filter((item) => item.side === tab && hit(state.query, item.id, item.party, item.project, item.ref, item.status))
  const sales = state.invoices.filter((item) => item.status === "gonderilib" || item.status === "gecikir" || item.status === "odenilib")
  const sent = sales.filter((item) => item.status !== "odenilib").reduce((sum, item) => sum + item.amount, 0)
  const paid = sales.filter((item) => item.status === "odenilib").reduce((sum, item) => sum + item.amount, 0)
  const flow = periods(moneyMoves(state), state.closedPeriods).slice().reverse().map((row) => ({ label: monthWord(row.id), inn: row.inflow, out: row.outflow }))

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) return
    const message = editing ? state.editInvoice(editing, form) : state.addInvoice(form)
    setError(message)
    if (!message) {
      setForm(null)
      setEditing("")
    }
  }

  function submitBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!billForm || !billId) return
    const message = state.editPayable(billId, billForm)
    setError(message)
    if (!message) {
      setBillForm(null)
      setBillId("")
    }
  }

  return (
    <>
      <PageHead kicker={t("page.invoices.kicker")} title={t("page.invoices.title")} text={t("page.invoices.text")}>
        {tab === "satis" && (
          <Button type="button" onClick={() => { setError(""); setEditing(""); setForm(emptyInvoice) }}>
            <Icon name="plus" /> Satış qaiməsi
          </Button>
        )}
      </PageHead>
      <div className="grid-2">
        <Disclosure title="Satış və xərc"><Panel className="pad">
          <SectionHeader><h2>Satış və xərc</h2></SectionHeader>
          <FlowBars rows={flow} />
        </Panel></Disclosure>
        <Disclosure title="Satış qaiməsi"><Panel className="pad">
          <SectionHeader><h2>Satış qaiməsi</h2></SectionHeader>
          <Columns rows={[{ label: "Açıq", value: sent, tone: "copper" }, { label: "Ödənilib", value: paid, tone: "pine" }]} />
        </Panel></Disclosure>
      </div>
      <Toolbar>
        <Tabs value={tab} onChange={setTab} options={[{ id: "satis", label: "Satış" }, { id: "alis", label: "Alış" }]} />
      </Toolbar>
      <TableContainer>
        <table>
          <thead>
            <tr>
              <th>Qaimə</th>
              <th>{tab === "satis" ? "Sifarişçi" : "Təchizatçı"}</th>
              <th>{tab === "satis" ? "Layihə" : "Material"}</th>
              <th>Son tarix</th>
              <th>Status</th>
              <th className="num">Məbləğ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={`${item.side}-${item.id}`} className={item.side === "satis" || item.payable ? "click" : undefined} onClick={() => {
                if (item.side === "satis") {
                  const invoice = state.invoices.find((row) => row.id === item.id)
                  if (invoice) setSelected(invoice)
                  return
                }
                if (item.payable) setBill(item)
              }}>
                <td>
                  <div className="name-cell">
                    <b>{item.id}</b>
                    <span className="muted">{dateAZ(item.date)}{item.ref ? ` · ${item.ref}` : ""}</span>
                  </div>
                </td>
                <td>{item.party}</td>
                <td>{item.project}</td>
                <td>{dateAZ(item.due)}</td>
                <td><Badge status={item.status} /></td>
                <td className="num">{money(item.amount)}</td>
                <td>
                  {item.side === "satis" && (
                    <RowMenu items={[
                      ...(item.status === "qaralama" ? [
                        { id: "edit", label: "Redaktə", onClick: () => { setError(""); setEditing(item.id); setForm({ client: item.party, project: item.project, amount: String(item.amount), due: item.due }) } },
                        { id: "send", label: "Göndər", onClick: () => state.sendInvoice(item.id) },
                        { id: "delete", label: "Sil", onClick: () => setDrop({ id: item.id, kind: "qaimə", label: item.id }) },
                      ] : []),
                      ...((item.status === "gonderilib" || item.status === "gecikir") && !item.ref ? [
                        { id: "return", label: "Qaralamaya qaytar", onClick: () => state.returnInvoice(item.id) },
                        { id: "pay", label: "Banka düşdü", onClick: () => state.markInvoicePaid(item.id) },
                      ] : []),
                      ...((item.status === "gonderilib" || item.status === "gecikir") && item.ref ? [
                        { id: "pay", label: "Banka düşdü", onClick: () => state.markInvoicePaid(item.id) },
                      ] : []),
                    ]} />
                  )}
                  {item.payable && item.status === "acik" && (
                    <RowMenu items={[
                      { id: "edit", label: "Redaktə", onClick: () => { setError(""); setBillId(item.id); setBillForm({ supplier: item.party, amount: String(item.amount), date: item.date }) } },
                      { id: "pay", label: "Ödəndi", onClick: () => state.payPayable(item.id) },
                      { id: "delete", label: "Sil", onClick: () => setDrop({ id: item.id, kind: "borc", label: item.id }) },
                    ]} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty title="Qaimə yoxdur" text="Bu tərəfdə sənəd tapılmadı." />}
      </TableContainer>

      {selected && (
        <Drawer title={selected.id} onClose={() => setSelected(null)}>
          <dl className="kv">
            <dt>Sifarişçi</dt><dd>{selected.client}</dd>
            <dt>Layihə</dt><dd>{selected.project}</dd>
            <dt>Verilib</dt><dd>{dateAZ(selected.issued)}</dd>
            <dt>Son tarix</dt><dd>{dateAZ(selected.due)}</dd>
            <dt>Status</dt><dd><Badge status={selected.status} /></dd>
            <dt>Ödəniləcək</dt><dd>{money(selected.amount)}</dd>
          </dl>
          {selected.status === "qaralama" && !selected.actId && (
            <Button type="button" onClick={() => { state.sendInvoice(selected.id); setSelected(null) }}>Göndər</Button>
          )}
          {selected.status !== "odenilib" && selected.status !== "qaralama" && (
            <Button type="button" onClick={() => { const message = state.markInvoicePaid(selected.id); if (!message) setSelected({ ...selected, status: "odenilib" }) }}>Banka düşdü</Button>
          )}
        </Drawer>
      )}

      {bill && (
        <Drawer title={bill.id} onClose={() => setBill(null)}>
          <dl className="kv">
            <dt>Təchizatçı</dt><dd>{bill.party}</dd>
            <dt>Material</dt><dd>{bill.project}</dd>
            <dt>Sifariş</dt><dd>{bill.ref}</dd>
            <dt>Status</dt><dd><Badge status={bill.status} /></dd>
            <dt>Məbləğ</dt><dd>{money(bill.amount)}</dd>
          </dl>
          {bill.status === "acik" && (
            <Button type="button" onClick={() => { const message = state.payPayable(bill.id); if (!message) setBill({ ...bill, status: "odenilib" }) }}>Ödəndi</Button>
          )}
        </Drawer>
      )}

      {form && (
        <Modal title={editing ? "Qaiməni yaz" : "Satış qaiməsi"} onClose={() => setForm(null)}>
          <form className="form" onSubmit={submit}>
            <Field label="Sifarişçi">
              <Select value={form.client} onValueChange={(client) => setForm({ ...form, client })} options={state.clients.map((client) => ({ value: client.name, label: client.name }))} />
            </Field>
            <Field label="Layihə">
              <Select value={form.project} onValueChange={(project) => setForm({ ...form, project })} options={state.projects.map((project) => ({ value: project.name, label: project.name }))} />
            </Field>
            <Field label="Məbləğ, ₼">
              <Input type="number" min="1" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
            </Field>
            <Field label="Son tarix">
              <DateField value={form.due} onChange={(due) => setForm({ ...form, due })} />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <Button type="button" className="ghost" onClick={() => setForm(null)}>Ləğv et</Button>
              <Button  type="submit">Saxla</Button>
            </div>
          </form>
        </Modal>
      )}

      {billForm && (
        <Modal title="Təchizat borcu" onClose={() => setBillForm(null)}>
          <form className="form" onSubmit={submitBill}>
            <Field label="Təchizatçı">
              <Input value={billForm.supplier} onChange={(event) => setBillForm({ ...billForm, supplier: event.target.value })} />
            </Field>
            <Field label="Məbləğ, ₼">
              <Input type="number" min="1" value={billForm.amount} onChange={(event) => setBillForm({ ...billForm, amount: event.target.value })} />
            </Field>
            <Field label="Tarix">
              <DateField value={billForm.date} onChange={(date) => setBillForm({ ...billForm, date })} />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <Button type="button" className="ghost" onClick={() => setBillForm(null)}>Ləğv et</Button>
              <Button  type="submit">Saxla</Button>
            </div>
          </form>
        </Modal>
      )}

      {drop && (
        <Confirm
          title="Silinsin?"
          text={`${drop.label} silinəcək. Göndərilmiş və ödənmiş sənəd silinmir.`}
          onClose={() => setDrop(null)}
          onYes={() => {
            if (drop.kind === "qaimə") state.removeInvoice(drop.id)
            else state.removePayable(drop.id)
            setDrop(null)
          }}
        />
      )}
    </>
  )
}
