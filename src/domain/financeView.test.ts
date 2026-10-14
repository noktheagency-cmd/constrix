import assert from "node:assert/strict"
import test from "node:test"
import { cashAccounts, financePosition, moneyMoves, openReceivable } from "./financeView"
import { closePeriod, confirmExpense, createInvoice, deleteInvoice, saveExpense, sendInvoice } from "./ops"
import { createInitialState } from "./seed"

test("ödənmiş qaimə banka düşür, açıq qaimə debitor qalır", () => {
  const state = createInitialState()
  const moves = moneyMoves(state)
  const paid = moves.find((item) => item.id === "INV-1038")
  assert.equal(paid?.direction, "in")
  assert.equal(paid?.accountId, "kapital")
  assert.equal(paid?.amount, 1250000)
  assert.equal(moves.some((item) => item.id === "INV-1042"), false)
  assert.equal(openReceivable(state), 860000 + 420000 + 740000 + 310000)
})

test("yanacaq kassadan, qalan xərc bankdan çıxır", () => {
  const state = createInitialState()
  const accounts = cashAccounts(moneyMoves(state))
  const kassa = accounts.find((item) => item.id === "kassa")
  const bank = accounts.find((item) => item.id === "kapital")
  assert.equal(kassa?.outflow, 38000)
  assert.equal(kassa?.balance, 10000)
  assert.equal(bank?.inflow, 1250000)
  assert.equal(bank?.outflow, 1126000)
  assert.equal(bank?.balance, 764000)
})

test("anbar, kreditor və icarə vəsaiti pula qarışmır", () => {
  const state = createInitialState()
  const position = financePosition(state)
  assert.equal(position.stock, 2096480)
  assert.equal(position.payable, 41600)
  assert.equal(position.cash, 984000)
  const hired = position.assets.find((item) => item.id === "AST-051")
  assert.equal(hired?.capitalized, false)
  const crane = position.assets.find((item) => item.id === "AST-014")
  assert.equal(crane?.capitalized, true)
  assert.ok(crane && crane.nbv < crane.cost && crane.nbv > 0)
})

const actor = { name: "Test", role: "director" }

test("qaralama qaimə debitora düşmür, göndəriləndə düşür və silinmir", () => {
  const state = createInitialState()
  const before = openReceivable(state)
  const created = createInvoice(state, { client: "Xəzər Holdinq", project: "Port Baku Residence", amount: "1000", due: "2026-10-01" }, actor)
  assert.equal(created.error, undefined)
  const draft = { ...state, ...created.patch }
  assert.equal(openReceivable(draft), before)
  const id = draft.invoices[0].id
  const sent = sendInvoice(draft, id, actor)
  assert.equal(sent.error, undefined)
  const open = { ...draft, ...sent.patch }
  assert.equal(openReceivable(open), before + 1000)
  const removed = deleteInvoice(open, id, actor)
  assert.match(removed.error ?? "", /silinmir/)
})

test("xərc təsdiqdən sonra pula və layihə xərcinə düşür", () => {
  const state = createInitialState()
  const project = state.projects.find((item) => item.name === "Port Baku Residence")
  assert.ok(project)
  const saved = saveExpense(state, { category: "Material", vendor: "Test", project: project.name, amount: "500", date: "2026-09-23" }, actor)
  assert.equal(saved.error, undefined)
  const draft = { ...state, ...saved.patch }
  const id = draft.expenses[0].id
  assert.equal(moneyMoves(draft).some((item) => item.id === id), false)
  assert.equal(draft.projects.find((item) => item.name === project.name)?.spent, project.spent)
  const confirmed = confirmExpense(draft, id, actor)
  assert.equal(confirmed.error, undefined)
  const posted = { ...draft, ...confirmed.patch }
  assert.equal(posted.projects.find((item) => item.name === project.name)?.spent, project.spent + 500)
  assert.equal(moneyMoves(posted).some((item) => item.id === id), true)
})

test("bağlı dövrə xərc yazılmır", () => {
  const state = createInitialState()
  const august = saveExpense(state, { category: "Material", vendor: "Test", project: "Port Baku Residence", amount: "10", date: "2026-08-02" }, actor)
  assert.match(august.error ?? "", /Bağlı dövr/)
  const closed = closePeriod(state, "2026-09", actor)
  assert.equal(closed.error, undefined)
  const shut = { ...state, ...closed.patch }
  const september = saveExpense(shut, { category: "Material", vendor: "Test", project: "Port Baku Residence", amount: "10", date: "2026-09-23" }, actor)
  assert.match(september.error ?? "", /Bağlı dövr/)
})
