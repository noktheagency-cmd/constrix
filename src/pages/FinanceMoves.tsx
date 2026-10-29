import { DataTable } from '../components/DataTable'
import { Button, Disclosure, Input, Panel, SectionHeader, TableContainer, Toolbar } from "../components/primitives"
import { useState, type FormEvent } from "react"
import { DateField } from "../DateField"
import { moneyMoves, periods } from "../domain/financeView"
import type { ExpenseForm } from "../domain/types"
import { dateAZ, hit, money, monthWord } from "../format"
import { Icon } from "../icons"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Badge, Confirm, Empty, Field, FlowBars, Modal, PageHead, RowMenu, Select, Tabs, useTitle } from "../ui"

const categories = ["Material", "Əmək haqqı", "Texnika", "Yanacaq", "Subpodrat", "Digər"]
const emptyForm: ExpenseForm = { category: "Material", vendor: "", project: "", amount: "", date: "2026-09-23" }

export default function FinanceMoves() {
  const { t } = usePrefs()
  useTitle(t("page.moves.title"))
  const state = useStore()
  const [tab, setTab] = useState("hamisi")
  const [form, setForm] = useState<ExpenseForm | null>(null)
  const [error, setError] = useState("")
  const [drop, setDrop] = useState("")
  const moves = moneyMoves(state)
  const drafts = state.expenses.filter((item) => item.status === "qaralama" && hit(state.query, item.id, item.vendor, item.project, item.category))
  const rows = moves.filter((item) => {
    if (tab === "in" && item.direction !== "in") return false
    if (tab === "out" && item.direction !== "out") return false
    if (tab === "qaralama") return false
    return hit(state.query, item.id, item.party, item.project, item.category, item.account, item.source)
  })
  const flow = periods(moves, state.closedPeriods).slice().reverse().map((row) => ({ label: monthWord(row.id), inn: row.inflow, out: row.outflow }))

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) return
    const message = state.saveExpense(form)
    setError(message)
    if (!message) setForm(null)
  }

  return (
    <>
      <PageHead kicker={t("page.moves.kicker")} title={t("page.moves.title")} text={t("page.moves.text")}>
        {tab !== "in" && (
          <Button type="button" onClick={() => { setError(""); setForm({ ...emptyForm, project: state.projects[0]?.name || "" }) }}>
            <Icon name="plus" /> {tab === "out" ? "Məxaric" : "Xərc"}
          </Button>
        )}
      </PageHead>
      <Disclosure title="Ay üzrə pul"><Panel className="pad">
        <SectionHeader><h2>Ay üzrə pul</h2></SectionHeader>
        <FlowBars rows={flow} />
      </Panel></Disclosure>
      <Toolbar>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { id: "hamisi", label: "Hamısı" },
            { id: "in", label: "Mədaxil" },
            { id: "out", label: "Məxaric" },
            { id: "qaralama", label: `Qaralama (${drafts.length})` },
          ]}
        />
      </Toolbar>
      {tab !== "qaralama" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>Sənəd</th>
                <th>Tərəf</th>
                <th>Layihə</th>
                <th>Hesab</th>
                <th>Mənbə</th>
                <th className="num">Məbləğ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const expense = state.expenses.find((row) => row.id === item.id)
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="name-cell">
                        <b>{item.id}</b>
                        <span className="muted">{dateAZ(item.date)}</span>
                      </div>
                    </td>
                    <td>{item.party}</td>
                    <td>{item.project}</td>
                    <td>{item.account}</td>
                    <td>{item.source}</td>
                    <td className={item.direction === "in" ? "num in" : "num out"}>{item.direction === "in" ? "" : "−"}{money(item.amount)}</td>
                    <td>
                      {expense && !expense.smetaLineId && (
                        <RowMenu items={[
                          { id: "edit", label: "Redaktə", onClick: () => { setError(""); setForm({ id: expense.id, category: expense.category, vendor: expense.vendor, project: expense.project, amount: String(expense.amount), date: expense.date }) } },
                          { id: "return", label: "Qaralamaya qaytar", onClick: () => state.returnExpense(expense.id) },
                          { id: "delete", label: "Sil", onClick: () => setDrop(expense.id) },
                        ]} />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </DataTable>
          {rows.length === 0 && <Empty title="Hərəkət yoxdur" text="Pul hesabına düşən sənəd tapılmadı." />}
        </TableContainer>
      )}
      {tab === "qaralama" && (
        <TableContainer>
          <DataTable>
            <thead>
              <tr>
                <th>Xərc</th>
                <th>Layihə</th>
                <th>Tarix</th>
                <th>Status</th>
                <th className="num">Məbləğ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {drafts.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="name-cell">
                      <b>{item.vendor}</b>
                      <span className="muted">{item.id} · {item.category}</span>
                    </div>
                  </td>
                  <td>{item.project}</td>
                  <td>{dateAZ(item.date)}</td>
                  <td><Badge status={item.status || "qaralama"} /></td>
                  <td className="num">{money(item.amount)}</td>
                  <td>
                    <RowMenu items={[
                      { id: "edit", label: "Redaktə", onClick: () => { setError(""); setForm({ id: item.id, category: item.category, vendor: item.vendor, project: item.project, amount: String(item.amount), date: item.date }) } },
                      { id: "send", label: "Təsdiq", onClick: () => state.confirmExpense(item.id) },
                      { id: "delete", label: "Sil", onClick: () => setDrop(item.id) },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {drafts.length === 0 && <Empty title="Qaralama yoxdur" text="Yeni xərc əvvəl qaralama olur. Təsdiqdən sonra pula və layihə xərcinə düşür." />}
        </TableContainer>
      )}

      {form && (
        <Modal title={form.id ? "Xərci yaz" : "Yeni xərc"} onClose={() => setForm(null)}>
          <form className="form" onSubmit={submit}>
            <Field label="Kateqoriya">
              <Select value={form.category} onValueChange={(category) => setForm({ ...form, category })} options={categories.map((item) => ({ value: item, label: item }))} />
            </Field>
            <Field label="Tərəf">
              <Input value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value })} />
            </Field>
            <Field label="Layihə">
              <Select value={form.project} onValueChange={(project) => setForm({ ...form, project })} options={state.projects.map((project) => ({ value: project.name, label: project.name }))} />
            </Field>
            <Field label="Məbləğ, ₼">
              <Input type="number" min="1" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
            </Field>
            <Field label="Tarix">
              <DateField value={form.date} onChange={(date) => setForm({ ...form, date })} />
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <Button type="button" className="ghost" onClick={() => setForm(null)}>Ləğv et</Button>
              <Button  type="submit">Saxla</Button>
            </div>
          </form>
        </Modal>
      )}
      {drop && (
        <Confirm title="Xərc silinsin?" text={`${drop} silinəcək. Təsdiqli xərc layihənin xərcindən də çıxır.`} onClose={() => setDrop("")} onYes={() => { state.removeExpense(drop); setDrop("") }} />
      )}
    </>
  )
}
