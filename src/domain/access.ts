import type { Area, Role } from "./types"

export const ROLES: Record<Role, string> = {
  director: "Direktor",
  pm: "Layihə rəhbəri",
  site: "Sahə mühəndisi",
  warehouse: "Anbar",
  procurement: "Təchizat",
  accountant: "Mühasib",
  sales: "Satış",
}

const ACCESS: Record<Role, Area[] | ["*"]> = {
  director: ["*"],
  pm: ["dashboard", "projects", "reports", "site", "assets", "production", "people", "finance", "audit", "clients", "acts", "tender", "boq", "spec", "weather", "guarantee", "procure"],
  site: ["site", "reports", "projects", "assets", "weather", "procure"],
  warehouse: ["warehouse", "supply", "reports", "procure"],
  procurement: ["supply", "warehouse", "dashboard", "tender", "boq", "procure"],
  accountant: ["finance", "dashboard", "audit", "projects", "acts", "boq", "guarantee", "procure"],
  sales: ["crm", "clients", "dashboard", "club", "procure"],
}

export function can(role: Role, area: Area) {
  const list = ACCESS[role]
  if (!list) return false
  if (list[0] === "*") return true
  return (list as Area[]).includes(area)
}
