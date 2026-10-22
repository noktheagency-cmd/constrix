import { api } from "./api"
import type { AppState, Stock } from "./domain/types"

/** Books that persist through /api/<route> with row.id */
const ID_BOOKS: [keyof AppState, string][] = [
  ["smetas", "/api/smetas"],
  ["contracts", "/api/contracts"],
  ["acts", "/api/acts"],
  ["forma3s", "/api/forma3"],
  ["reports", "/api/reports"],
  ["materials", "/api/materials"],
  ["movements", "/api/movements"],
  ["purchaseOrders", "/api/purchase-orders"],
  ["purchaseActs", "/api/purchase-acts"],
  ["requests", "/api/requests"],
  ["invoices", "/api/invoices"],
  ["expenses", "/api/expenses"],
  ["payables", "/api/payables"],
  ["documents", "/api/documents"],
  ["changes", "/api/changes"],
  ["journal", "/api/journal"],
  ["audit", "/api/audit"],
]

function asRows(value: unknown): { id: string }[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is { id: string } => Boolean(item && typeof item === "object" && "id" in item && (item as { id: unknown }).id))
}

function same(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function stockKey(row: Stock) {
  return `${row.materialId}|${row.locationId}`
}

async function syncIdBook(path: string, before: unknown, after: unknown) {
  const prev = asRows(before)
  const next = asRows(after)
  const prevMap = new Map(prev.map((row) => [row.id, row]))
  const nextMap = new Map(next.map((row) => [row.id, row]))
  const jobs: Promise<unknown>[] = []

  for (const [id, row] of nextMap) {
    const old = prevMap.get(id)
    if (!old) {
      jobs.push(api(path, { method: "POST", body: JSON.stringify(row) }).catch(() => undefined))
    } else if (!same(old, row)) {
      jobs.push(api(`${path}/${id}`, { method: "PUT", body: JSON.stringify(row) }).catch(() => undefined))
    }
  }
  for (const id of prevMap.keys()) {
    if (!nextMap.has(id)) {
      jobs.push(api(`${path}/${id}`, { method: "DELETE" }).catch(() => undefined))
    }
  }
  await Promise.all(jobs)
}

async function syncStocks(before: unknown, after: unknown) {
  const prev = (Array.isArray(before) ? before : []) as Stock[]
  const next = (Array.isArray(after) ? after : []) as Stock[]
  const prevMap = new Map(prev.map((row) => [stockKey(row), row]))
  const nextMap = new Map(next.map((row) => [stockKey(row), row]))

  type ServerStock = Stock & { id?: string }
  let server: ServerStock[] = []
  try {
    const data = await api<ServerStock[]>("/api/stocks")
    server = Array.isArray(data) ? data : []
  } catch {
    return
  }
  const serverMap = new Map(server.map((row) => [stockKey(row), row]))
  const jobs: Promise<unknown>[] = []

  for (const [key, row] of nextMap) {
    const old = prevMap.get(key)
    const remote = serverMap.get(key)
    if (!remote) {
      jobs.push(api("/api/stocks", {
        method: "POST",
        body: JSON.stringify({ materialId: row.materialId, locationId: row.locationId, qty: row.qty }),
      }).catch(() => undefined))
    } else if (!old || old.qty !== row.qty) {
      jobs.push(api(`/api/stocks/${remote.id}`, {
        method: "PUT",
        body: JSON.stringify({ materialId: row.materialId, locationId: row.locationId, qty: row.qty }),
      }).catch(() => undefined))
    }
  }
  for (const [key, remote] of serverMap) {
    if (!nextMap.has(key) && prevMap.has(key) && remote.id) {
      jobs.push(api(`/api/stocks/${remote.id}`, { method: "DELETE" }).catch(() => undefined))
    }
  }
  await Promise.all(jobs)
}

/** Persist domain patch books to the records API when a session is active. Failures are ignored so UI stays responsive. */
export async function syncBooks(prev: AppState, patch: Partial<AppState>) {
  const jobs: Promise<unknown>[] = []
  for (const [key, path] of ID_BOOKS) {
    if (!(key in patch)) continue
    jobs.push(syncIdBook(path, prev[key], patch[key]))
  }
  if ("stocks" in patch) jobs.push(syncStocks(prev.stocks, patch.stocks))
  await Promise.all(jobs)
}
