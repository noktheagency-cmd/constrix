import { TODAY, projectEconomics, roundMoney } from "./ops"
import type { AppState } from "./types"

export interface VatRow {
  period: string
  net: number
  vat: number
  gross: number
}

export interface ProfitRow {
  projectId: string
  project: string
  planned: number
  earned: number
  spent: number
  margin: number
}

export interface AgingRow {
  id: string
  client: string
  project: string
  due: string
  amount: number
  bucket: string
}

export interface CashRow {
  month: string
  inflow: number
  outflow: number
  net: number
}

function monthOf(iso: string) {
  return iso.slice(0, 7)
}

function daysPast(due: string, today: string) {
  const left = Date.parse(due)
  const right = Date.parse(today)
  if (!Number.isFinite(left) || !Number.isFinite(right)) return 0
  return Math.round((right - left) / 86400000)
}

export function bucketOf(due: string, today = TODAY) {
  const days = daysPast(due, today)
  if (days <= 0) return "Cari"
  if (days <= 30) return "1–30 gün"
  if (days <= 60) return "31–60 gün"
  return "60 gündən çox"
}

export function vatRows(state: AppState): VatRow[] {
  const map = new Map<string, VatRow>()
  for (const act of state.acts) {
    if (act.status !== "tesdiq" && act.status !== "faktura") continue
    const row = map.get(act.period) ?? { period: act.period, net: 0, vat: 0, gross: 0 }
    row.net += act.net
    row.vat += act.vat
    row.gross += act.gross
    map.set(act.period, row)
  }
  return [...map.values()]
    .map((row) => ({ ...row, net: roundMoney(row.net), vat: roundMoney(row.vat), gross: roundMoney(row.gross) }))
    .sort((a, b) => a.period.localeCompare(b.period))
}

export function profitRows(state: AppState): ProfitRow[] {
  return state.projects.map((project) => {
    const economy = projectEconomics(state, project.id)
    return {
      projectId: project.id,
      project: project.name,
      planned: roundMoney(economy.planned),
      earned: roundMoney(economy.earned),
      spent: roundMoney(economy.spent),
      margin: roundMoney(economy.earned - economy.spent),
    }
  })
}

export function agingRows(state: AppState, today = TODAY): AgingRow[] {
  return state.invoices
    .filter((item) => item.status === "gonderilib" || item.status === "gecikir")
    .map((item) => ({
      id: item.id,
      client: item.client,
      project: item.project,
      due: item.due,
      amount: item.amount,
      bucket: bucketOf(item.due, today),
    }))
}

export function cashRows(state: AppState): CashRow[] {
  const map = new Map<string, CashRow>()
  function row(month: string) {
    const current = map.get(month) ?? { month, inflow: 0, outflow: 0, net: 0 }
    map.set(month, current)
    return current
  }
  for (const invoice of state.invoices) {
    if (invoice.status !== "odenilib") continue
    row(monthOf(invoice.issued)).inflow += invoice.amount
  }
  for (const contract of state.saleContracts) {
    for (const line of contract.schedule) {
      if (line.status !== "odenilib" || !line.paidOn) continue
      row(monthOf(line.paidOn)).inflow += line.amount
    }
  }
  for (const expense of state.expenses) {
    row(monthOf(expense.date)).outflow += expense.amount
  }
  for (const payable of state.payables) {
    if (payable.status !== "odenilib") continue
    row(monthOf(payable.date)).outflow += payable.amount
  }
  return [...map.values()]
    .map((item) => ({
      ...item,
      inflow: roundMoney(item.inflow),
      outflow: roundMoney(item.outflow),
      net: roundMoney(item.inflow - item.outflow),
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
}
