import type { Area } from "./domain/types"
import type { IconName } from "./icons"

export type ModuleId = "hesab" | "insaat" | "tender" | "techizat" | "maliyye" | "kadr" | "klub"

export const MODULES: { id: ModuleId; label: string; hint: string; icon: IconName; to: string; area: Area }[] = [
  { id: "hesab", label: "mod.hesab", hint: "mod.hesab.hint", icon: "office", to: "/sirket", area: "procure" },
  { id: "insaat", label: "mod.insaat", hint: "mod.insaat.hint", icon: "crane", to: "/", area: "dashboard" },
  { id: "tender", label: "mod.tender", hint: "mod.tender.hint", icon: "stamp", to: "/e-tender", area: "tender" },
  { id: "techizat", label: "mod.techizat", hint: "mod.techizat.hint", icon: "truck", to: "/techizat", area: "supply" },
  { id: "maliyye", label: "mod.maliyye", hint: "mod.maliyye.hint", icon: "wallet", to: "/maliyye", area: "finance" },
  { id: "kadr", label: "mod.kadr", hint: "mod.kadr.hint", icon: "user", to: "/isciler", area: "people" },
  { id: "klub", label: "mod.klub", hint: "mod.klub.hint", icon: "users", to: "/emekdasliq", area: "club" },
]

type NavItem = { to: string; label: string; icon: IconName; end?: boolean; area: Area }

export const MODULE_NAV: Record<ModuleId, { label: string; items: NavItem[] }[]> = {
  hesab: [
    {
      label: "nav.procure",
      items: [
        { to: "/layihe-fayl", label: "nav.drawings", icon: "files", area: "procure" },
        { to: "/kataloq", label: "nav.catalog", icon: "boxes", area: "procure" },
        { to: "/hesablama", label: "nav.calc", icon: "calc", area: "procure" },
        { to: "/dasima", label: "nav.haul", icon: "route", area: "procure" },
        { to: "/teklif", label: "nav.offer", icon: "tag", area: "procure" },
        { to: "/sifaris-merhele", label: "nav.flow", icon: "flow", area: "procure" },
        { to: "/tarif", label: "nav.tariff", icon: "percent", area: "procure" },
        { to: "/platforma", label: "nav.platform", icon: "layers", area: "procure" },
      ],
    },
  ],
  insaat: [
    {
      label: "nav.ops",
      items: [
        { to: "/", label: "nav.overview", icon: "grid", end: true, area: "dashboard" },
        { to: "/layiheler", label: "nav.projects", icon: "crane", area: "projects" },
        { to: "/qrafik", label: "nav.schedule", icon: "calendar", area: "projects" },
        { to: "/spesifikasiya", label: "nav.spec", icon: "list", area: "spec" },
        { to: "/sahe", label: "nav.site", icon: "pin", area: "site" },
        { to: "/forma-2", label: "nav.forma2", icon: "form", area: "acts" },
        { to: "/forma-3", label: "nav.forma3", icon: "table", area: "acts" },
      ],
    },
  ],
  tender: [
    {
      label: "nav.tender",
      items: [
        { to: "/boq", label: "nav.boq", icon: "table", area: "boq" },
        { to: "/qarantiya", label: "nav.guarantee", icon: "shield", area: "guarantee" },
        { to: "/yoxlama", label: "nav.checks", icon: "checks", area: "tender" },
      ],
    },
  ],
  techizat: [
    {
      label: "nav.resources",
      items: [
        { to: "/bazar", label: "nav.market", icon: "store", area: "supply" },
        { to: "/alis-akti", label: "nav.purchaseActs", icon: "invoice", area: "supply" },
        { to: "/anbar", label: "nav.warehouse", icon: "warehouse", area: "warehouse" },
        { to: "/aktivler", label: "nav.assets", icon: "asset", area: "assets" },
        { to: "/zavod", label: "nav.plant", icon: "factory", area: "production" },
        { to: "/sexler", label: "nav.shops", icon: "shop", area: "production" },
      ],
    },
  ],
  maliyye: [
    {
      label: "nav.money",
      items: [
        { to: "/maliyye", label: "nav.panel", icon: "chart", end: true, area: "finance" },
        { to: "/pul-axini", label: "nav.cashflow", icon: "swap", area: "finance" },
        { to: "/emeliyyatlar", label: "nav.tx", icon: "list", area: "finance" },
        { to: "/hesablar", label: "nav.accounts", icon: "wallet", area: "finance" },
        { to: "/qaimeler", label: "nav.invoices", icon: "invoice", area: "finance" },
        { to: "/bank", label: "nav.bank", icon: "bank", area: "finance" },
        { to: "/emek-haqqi", label: "nav.payroll", icon: "coins", area: "finance" },
        { to: "/vesaitler", label: "nav.fixed", icon: "asset", area: "finance" },
        { to: "/terefler", label: "nav.partners", icon: "handshake", area: "finance" },
        { to: "/hesabatlar", label: "nav.reports", icon: "clipboard", area: "finance" },
        { to: "/partnyorlar", label: "nav.registry", icon: "book", area: "finance" },
        { to: "/sigorta", label: "nav.cover", icon: "cover", area: "finance" },
      ],
    },
  ],
  kadr: [
    {
      label: "nav.hr",
      items: [
        { to: "/isciler", label: "nav.staff", icon: "user", end: true, area: "people" },
        { to: "/mesgulluq", label: "nav.jobs", icon: "briefcase", area: "people" },
        { to: "/davamiyyet", label: "nav.attendance", icon: "clock", area: "people" },
        { to: "/mezuniyyet", label: "nav.leave", icon: "calendar", area: "people" },
        { to: "/odenisler", label: "nav.hrpay", icon: "card", area: "people" },
        { to: "/sobeler", label: "nav.departments", icon: "sitemap", area: "people" },
      ],
    },
  ],
  klub: [
    {
      label: "nav.club",
      items: [
        { to: "/emekdasliq", label: "nav.coop", icon: "handshake", area: "club" },
        { to: "/abune", label: "nav.subscription", icon: "card", area: "club" },
        { to: "/sifarisci", label: "nav.clients", icon: "users", area: "clients" },
        { to: "/senedler", label: "nav.files", icon: "files", area: "crm" },
        { to: "/sablonlar", label: "nav.templates", icon: "layout", area: "club" },
        { to: "/admin", label: "nav.admin", icon: "settings", area: "audit" },
        { to: "/tarixce", label: "nav.audit", icon: "history", area: "audit" },
      ],
    },
  ],
}

const PROCURE_PATHS = new Set(["/sirket", "/layihe-fayl", "/kataloq", "/hesablama", "/dasima", "/teklif", "/sifaris-merhele", "/tarif", "/platforma"])
const TENDER_PATHS = new Set(["/e-tender", "/boq", "/qarantiya", "/yoxlama"])
const SUPPLY_PATHS = new Set(["/techizat", "/bazar", "/alis-akti", "/anbar", "/aktivler", "/zavod", "/sexler", "/reseptler"])
const MONEY_PATHS = new Set(["/maliyye", "/pul-axini", "/emeliyyatlar", "/hesablar", "/qaimeler", "/bank", "/emek-haqqi", "/vesaitler", "/terefler", "/hesabatlar", "/partnyorlar", "/sigorta"])
const HR_PATHS = new Set(["/isciler", "/davamiyyet", "/mezuniyyet", "/odenisler", "/sobeler", "/mesgulluq"])
const CLUB_PATHS = new Set(["/emekdasliq", "/abune", "/sifarisci", "/senedler", "/sablonlar", "/admin"])

function listed(pathname: string, paths: Set<string>) {
  for (const path of paths) {
    if (pathname === path || pathname.startsWith(`${path}/`)) return true
  }
  return false
}

export function moduleFromPath(pathname: string, fallback: ModuleId): ModuleId {
  if (listed(pathname, PROCURE_PATHS)) return "hesab"
  if (listed(pathname, TENDER_PATHS)) return "tender"
  if (listed(pathname, SUPPLY_PATHS)) return "techizat"
  if (listed(pathname, MONEY_PATHS)) return "maliyye"
  if (listed(pathname, HR_PATHS)) return "kadr"
  if (listed(pathname, CLUB_PATHS)) return "klub"
  if (pathname === "/ayarlar" || pathname === "/tarixce") return fallback
  return "insaat"
}

export function firstModulePath(moduleId: ModuleId, allowed: (area: Area) => boolean) {
  const home = MODULES.find((item) => item.id === moduleId)
  if (home && allowed(home.area)) return home.to
  for (const group of MODULE_NAV[moduleId]) {
    for (const item of group.items) {
      if (allowed(item.area)) return item.to
    }
  }
  return "/"
}
