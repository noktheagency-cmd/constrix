import { api, ApiError } from "./api"
import type { AppState } from "./domain/types"

const routes: [keyof AppState, string][] = [
  ["smetas", "/api/smetas"],
  ["contracts", "/api/contracts"],
  ["acts", "/api/acts"],
  ["forma3s", "/api/forma3"],
  ["reports", "/api/reports"],
  ["locations", "/api/locations"],
  ["materials", "/api/materials"],
  ["stocks", "/api/stocks"],
  ["reservations", "/api/request-workflows/reservations"],
  ["movements", "/api/movements"],
  ["shipments", "/api/shipment-workflows"],
  ["purchaseOrders", "/api/purchase-orders"],
  ["purchaseActs", "/api/purchase-acts"],
  ["requests", "/api/requests"],
  ["recipes", "/api/recipes"],
  ["orders", "/api/work-orders"],
  ["assets", "/api/assets"],
  ["drivers", "/api/drivers"],
  ["trips", "/api/trips"],
  ["fuels", "/api/fuels"],
  ["fleetDocs", "/api/fleet-docs"],
  ["gear", "/api/gear"],
  ["gearEvents", "/api/gear-events"],
  ["plants", "/api/plants"],
  ["invoices", "/api/invoices"],
  ["expenses", "/api/expenses"],
  ["documents", "/api/documents"],
  ["deals", "/api/deals"],
  ["clients", "/api/clients"],
  ["leads", "/api/leads"],
  ["tasks", "/api/tasks"],
  ["files", "/api/files"],
  ["activities", "/api/activities"],
  ["people", "/api/people"],
  ["offices", "/api/offices"],
  ["departments", "/api/departments"],
  ["terminals", "/api/terminals"],
  ["attendance", "/api/attendance"],
  ["leaves", "/api/leaves"],
  ["hrPayments", "/api/hr-payments"],
  ["moves", "/api/hr-moves"],
  ["journal", "/api/journal"],
  ["audit", "/api/audit"],
  ["suppliers", "/api/suppliers"],
  ["changes", "/api/changes"],
  ["quotes", "/api/quotes"],
  ["payables", "/api/payables"],
  ["payrolls", "/api/payrolls"],
  ["services", "/api/services"],
  ["companies", "/api/companies"],
  ["complexes", "/api/complexes"],
  ["buildings", "/api/buildings"],
  ["units", "/api/units"],
  ["buyers", "/api/buyers"],
  ["saleContracts", "/api/sale-contracts"],
]

async function rows(path: string) {
  try {
    const data = await api<unknown>(path)
    if (!Array.isArray(data)) throw new Error(`Server düzgün siyahı qaytarmadı: ${path}`)
    return data
  } catch (error) {
    // A seat may intentionally lack access to some books loaded by the shared store.
    if (error instanceof ApiError && error.status === 403) return []
    throw error
  }
}

export async function loadBooks(): Promise<Partial<AppState>> {
  const [projects, periods, ...rest] = await Promise.all([
    rows("/api/projects"),
    rows("/api/periods"),
    ...routes.map(([, path]) => rows(path)),
  ])
  const patch = Object.fromEntries(routes.map(([key], index) => [key, rest[index]])) as Partial<AppState>
  patch.projects = projects as AppState["projects"]
  patch.closedPeriods = periods.map((item) => (typeof item === "string" ? item : String((item as { value?: string }).value || "")))
  return patch
}
