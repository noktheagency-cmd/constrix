import { bucketOf } from "./financeReports"
import { TODAY, roundMoney } from "./ops"
import type { AppState, Payroll } from "./types"

/** Cash books. Balances move only when money actually settles. */
const CASH_BOOKS = [
  { id: "kassa", name: "Kassa", kind: "nagd" as const, opening: 48000 },
  { id: "kapital", name: "Kapital Bank", kind: "bank" as const, opening: 640000 },
  { id: "abb", name: "ABB", kind: "bank" as const, opening: 210000 },
]

const ASSET_BOOKS: Record<string, { cost: number; acquired: string; years: number }> = {
  "AST-014": { cost: 980000, acquired: "2021-04-01", years: 10 },
  "AST-021": { cost: 420000, acquired: "2022-06-01", years: 8 },
  "AST-033": { cost: 310000, acquired: "2020-11-01", years: 8 },
  "AST-040": { cost: 86000, acquired: "2019-03-01", years: 8 },
  "AST-044": { cost: 54000, acquired: "2023-01-01", years: 8 },
  "AST-058": { cost: 145000, acquired: "2021-08-01", years: 8 },
  "AST-062": { cost: 72000, acquired: "2024-02-01", years: 8 },
  "AST-070": { cost: 38000, acquired: "2022-09-01", years: 10 },
  "AST-071": { cost: 210000, acquired: "2023-04-01", years: 12 },
  "seed-ast-1": { cost: 640000, acquired: "2019-05-01", years: 10 },
  "seed-x-ast-1": { cost: 420000, acquired: "2022-06-01", years: 8 },
  "seed-x-ast-2": { cost: 310000, acquired: "2020-11-01", years: 8 },
  "seed-x-ast-3": { cost: 86000, acquired: "2019-03-01", years: 8 },
  "seed-x-ast-4": { cost: 145000, acquired: "2021-08-01", years: 8 },
  "seed-x-ast-5": { cost: 210000, acquired: "2023-04-01", years: 12 },
  "seed-x-ast-6": { cost: 54000, acquired: "2024-02-01", years: 8 },
}

const SALARY: Record<string, number> = {
  "Layihə rəhbəri": 2800,
  "Anbar müdiri": 1600,
  "Satış rəhbəri": 2200,
  Briqadir: 1800,
  Maliyyə: 2000,
  Usta: 1400,
  Təchizatçı: 1500,
  Mexanik: 1500,
}

const RESIDUAL = 0.1

export interface MoneyMove {
  id: string
  date: string
  direction: "in" | "out"
  amount: number
  accountId: string
  account: string
  category: string
  party: string
  project: string
  source: string
}

export interface CashAccount {
  id: string
  name: string
  kind: "nagd" | "bank"
  opening: number
  inflow: number
  outflow: number
  balance: number
}

export interface BalanceLine {
  id: string
  name: string
  kind: string
  amount: number
  note: string
}

export interface BillRow {
  id: string
  side: "satis" | "alis"
  party: string
  project: string
  date: string
  due: string
  amount: number
  status: string
  ref: string
  payable: boolean
}

export interface PartnerRow {
  name: string
  balance: number
  current: number
  days30: number
  days60: number
  older: number
}

export interface CategoryRow {
  name: string
  direction: "in" | "out"
  count: number
  amount: number
}

export interface PeriodRow {
  id: string
  status: "acik" | "bagli"
  inflow: number
  outflow: number
  net: number
}

export interface AssetRow {
  id: string
  name: string
  type: string
  site: string
  ownership: string
  cost: number
  depreciation: number
  nbv: number
  capitalized: boolean
}

export interface StaffPay {
  id: string
  name: string
  role: string
  site: string
  monthly: number
}

type FinanceState = Pick<
  AppState,
  "invoices" | "expenses" | "payables" | "payrolls" | "purchaseOrders" | "materials" | "assets" | "people" | "projects"
>

function bookName(id: string) {
  return CASH_BOOKS.find((item) => item.id === id)?.name || id
}

function expenseAccount(category: string) {
  return category === "Yanacaq" ? "kassa" : "kapital"
}

function monthsBetween(from: string, to: string) {
  const [fy, fm] = from.slice(0, 7).split("-").map(Number)
  const [ty, tm] = to.slice(0, 7).split("-").map(Number)
  if (!fy || !fm || !ty || !tm) return 0
  return Math.max(0, (ty - fy) * 12 + (tm - fm))
}

export function stockValue(state: Pick<AppState, "materials">) {
  return roundMoney(state.materials.reduce((sum, item) => sum + item.qty * item.price, 0))
}

export function moneyMoves(state: Pick<AppState, "invoices" | "expenses" | "payables" | "payrolls">): MoneyMove[] {
  const rows: MoneyMove[] = []
  for (const item of state.invoices) {
    if (item.status !== "odenilib") continue
    rows.push({
      id: item.id,
      date: item.due,
      direction: "in",
      amount: item.amount,
      accountId: "kapital",
      account: bookName("kapital"),
      category: "Satış",
      party: item.client,
      project: item.project,
      source: "Qaimə",
    })
  }
  for (const item of state.expenses) {
    if (item.status === "qaralama") continue
    const accountId = expenseAccount(item.category)
    rows.push({
      id: item.id,
      date: item.date,
      direction: "out",
      amount: item.amount,
      accountId,
      account: bookName(accountId),
      category: item.category,
      party: item.vendor,
      project: item.project,
      source: "Xərc",
    })
  }
  for (const item of state.payables) {
    if (item.status !== "odenilib") continue
    rows.push({
      id: item.id,
      date: item.date,
      direction: "out",
      amount: item.amount,
      accountId: "kapital",
      account: bookName("kapital"),
      category: "Təchizat",
      party: item.supplier,
      project: item.poId,
      source: "Təchizat",
    })
  }
  for (const item of state.payrolls) {
    if (item.status !== "odenilib") continue
    rows.push({
      id: item.id,
      date: item.date,
      direction: "out",
      amount: item.total,
      accountId: "kapital",
      account: bookName("kapital"),
      category: "Əmək haqqı",
      party: "Heyət",
      project: "Ümumi",
      source: "Əmək haqqı",
    })
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
}

export function cashAccounts(moves: MoneyMove[]): CashAccount[] {
  return CASH_BOOKS.map((book) => {
    const mine = moves.filter((item) => item.accountId === book.id)
    const inflow = roundMoney(mine.filter((item) => item.direction === "in").reduce((sum, item) => sum + item.amount, 0))
    const outflow = roundMoney(mine.filter((item) => item.direction === "out").reduce((sum, item) => sum + item.amount, 0))
    return { ...book, inflow, outflow, balance: roundMoney(book.opening + inflow - outflow) }
  })
}

export function openReceivable(state: Pick<AppState, "invoices">) {
  return roundMoney(
    state.invoices.filter((item) => item.status !== "odenilib" && item.status !== "qaralama").reduce((sum, item) => sum + item.amount, 0),
  )
}

export function openPayable(state: Pick<AppState, "payables">) {
  return roundMoney(state.payables.filter((item) => item.status === "acik").reduce((sum, item) => sum + item.amount, 0))
}

export function assetRows(state: Pick<AppState, "assets">, today = TODAY): AssetRow[] {
  return state.assets.map((asset) => {
    const hired = asset.ownership === "icare"
    const book = ASSET_BOOKS[asset.id]
    if (hired || !book) {
      return {
        id: asset.id,
        name: asset.name,
        type: asset.type,
        site: asset.site,
        ownership: asset.ownership || "oz",
        cost: 0,
        depreciation: 0,
        nbv: 0,
        capitalized: false,
      }
    }
    const depreciable = book.cost * (1 - RESIDUAL)
    const months = Math.min(book.years * 12, monthsBetween(book.acquired, today))
    const depreciation = roundMoney((depreciable / (book.years * 12)) * months)
    return {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      site: asset.site,
      ownership: asset.ownership || "oz",
      cost: book.cost,
      depreciation,
      nbv: roundMoney(book.cost - depreciation),
      capitalized: true,
    }
  })
}

export function balanceLines(state: FinanceState, moves: MoneyMove[]): BalanceLine[] {
  const books = assetRows(state)
  const nbv = roundMoney(books.filter((item) => item.capitalized).reduce((sum, item) => sum + item.nbv, 0))
  return [
    { id: "debitor", name: "Debitorlar", kind: "Borc", amount: openReceivable(state), note: "Göndərilmiş, hələ düşməyən satış qaimələri" },
    { id: "kreditor", name: "Kreditorlar", kind: "Borc", amount: openPayable(state), note: "Qəbul edilmiş, ödənməmiş təchizat" },
    { id: "ehtiyat", name: "Material ehtiyatı", kind: "Anbar", amount: stockValue(state), note: "Anbar qalığı alış qiyməti ilə" },
    { id: "vesait", name: "Əsas vəsaitlər", kind: "Park", amount: nbv, note: "Öz texnikanın qalıq dəyəri. İcarə kapitallaşmır." },
    { id: "pul", name: "Pul vəsaitləri", kind: "Hesab", amount: roundMoney(cashAccounts(moves).reduce((sum, item) => sum + item.balance, 0)), note: "Kassa və bank" },
  ]
}

export function bills(state: Pick<AppState, "invoices" | "payables" | "purchaseOrders">): BillRow[] {
  const sales: BillRow[] = state.invoices.map((item) => ({
    id: item.id,
    side: "satis",
    party: item.client,
    project: item.project,
    date: item.issued,
    due: item.due,
    amount: item.amount,
    status: item.status,
    ref: item.actId || "",
    payable: false,
  }))
  const posted = new Set(state.payables.map((item) => item.poId))
  const purchases: BillRow[] = state.payables.map((item) => {
    const order = state.purchaseOrders.find((row) => row.id === item.poId)
    return {
      id: item.id,
      side: "alis",
      party: item.supplier,
      project: order?.item || item.poId,
      date: item.date,
      due: item.date,
      amount: item.amount,
      status: item.status,
      ref: item.poId,
      payable: true,
    }
  })
  const waiting: BillRow[] = state.purchaseOrders
    .filter((item) => item.status !== "qebul")
    .map((item) => {
      const left = Math.max(0, item.qty - (item.receivedQty ?? 0))
      const amount = item.qty ? roundMoney((item.amount * left) / item.qty) : item.amount
      return {
        id: item.id,
        side: "alis" as const,
        party: item.supplier,
        project: item.item,
        date: item.eta,
        due: item.eta,
        amount,
        status: "gozleyir",
        ref: posted.has(item.id) ? "Qismən qəbul" : "Qaimə yoxdur",
        payable: false,
      }
    })
  return [...sales, ...purchases, ...waiting].sort((a, b) => b.date.localeCompare(a.date))
}

function addBucket(row: PartnerRow, bucket: string, amount: number) {
  row.balance = roundMoney(row.balance + amount)
  if (bucket === "Cari") row.current = roundMoney(row.current + amount)
  else if (bucket === "1–30 gün") row.days30 = roundMoney(row.days30 + amount)
  else if (bucket === "31–60 gün") row.days60 = roundMoney(row.days60 + amount)
  else row.older = roundMoney(row.older + amount)
}

export function receivables(state: Pick<AppState, "invoices">): PartnerRow[] {
  const map = new Map<string, PartnerRow>()
  for (const item of state.invoices) {
    if (item.status === "odenilib" || item.status === "qaralama" || item.status === "legv") continue
    const row = map.get(item.client) ?? { name: item.client, balance: 0, current: 0, days30: 0, days60: 0, older: 0 }
    addBucket(row, bucketOf(item.due), item.amount)
    map.set(item.client, row)
  }
  return [...map.values()].sort((a, b) => b.balance - a.balance)
}

export function payablesAging(state: Pick<AppState, "payables">): PartnerRow[] {
  const map = new Map<string, PartnerRow>()
  for (const item of state.payables) {
    if (item.status !== "acik") continue
    const row = map.get(item.supplier) ?? { name: item.supplier, balance: 0, current: 0, days30: 0, days60: 0, older: 0 }
    addBucket(row, bucketOf(item.date), item.amount)
    map.set(item.supplier, row)
  }
  return [...map.values()].sort((a, b) => b.balance - a.balance)
}

export function categories(moves: MoneyMove[]): CategoryRow[] {
  const map = new Map<string, CategoryRow>()
  for (const item of moves) {
    const key = `${item.direction}:${item.category}`
    const row = map.get(key) ?? { name: item.category, direction: item.direction, count: 0, amount: 0 }
    row.count += 1
    row.amount = roundMoney(row.amount + item.amount)
    map.set(key, row)
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount)
}

export function periods(moves: MoneyMove[], closed: string[] = [], today = TODAY): PeriodRow[] {
  const map = new Map<string, PeriodRow>()
  for (const item of moves) {
    const id = item.date.slice(0, 7)
    const row = map.get(id) ?? { id, status: closed.includes(id) ? "bagli" : "acik", inflow: 0, outflow: 0, net: 0 }
    if (item.direction === "in") row.inflow = roundMoney(row.inflow + item.amount)
    else row.outflow = roundMoney(row.outflow + item.amount)
    row.net = roundMoney(row.inflow - row.outflow)
    map.set(id, row)
  }
  const current = today.slice(0, 7)
  if (!map.has(current)) map.set(current, { id: current, status: closed.includes(current) ? "bagli" : "acik", inflow: 0, outflow: 0, net: 0 })
  for (const id of closed) {
    if (!map.has(id)) map.set(id, { id, status: "bagli", inflow: 0, outflow: 0, net: 0 })
  }
  return [...map.values()].sort((a, b) => b.id.localeCompare(a.id))
}

export function staffPay(state: Pick<AppState, "people">): StaffPay[] {
  return state.people.map((person) => ({
    id: person.id,
    name: person.name,
    role: person.role,
    site: person.site,
    monthly: person.salary > 0 ? person.salary : SALARY[person.role] ?? 1200,
  }))
}

export function payrollView(state: Pick<AppState, "people" | "payrolls" | "expenses">) {
  const staff = staffPay(state)
  const paid = state.expenses.filter((item) => item.category === "Əmək haqqı" && item.status !== "qaralama")
  const openRuns = state.payrolls.filter((item) => item.status === "acik")
  return {
    staff,
    staffTotal: roundMoney(staff.reduce((sum, item) => sum + item.monthly, 0)),
    paid,
    paidTotal: roundMoney(paid.reduce((sum, item) => sum + item.amount, 0)),
    openRuns,
    openTotal: roundMoney(openRuns.reduce((sum, item: Payroll) => sum + item.total, 0)),
  }
}

export function financePosition(state: FinanceState) {
  const moves = moneyMoves(state)
  const accounts = cashAccounts(moves)
  const assets = assetRows(state)
  return {
    moves,
    accounts,
    cash: roundMoney(accounts.reduce((sum, item) => sum + item.balance, 0)),
    receivable: openReceivable(state),
    payable: openPayable(state),
    stock: stockValue(state),
    nbv: roundMoney(assets.filter((item) => item.capitalized).reduce((sum, item) => sum + item.nbv, 0)),
    lines: balanceLines(state, moves),
    assets,
  }
}
