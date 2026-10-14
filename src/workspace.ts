import { useSyncExternalStore } from "react"
import { costBreakdown, liveRules, seedRules, type Complexity, type CostRule, type GearBasis, type Method } from "./procure/smeta"

export type Fit = "uygun" | "deyil" | "catismir" | "gozleyir" | "el"
export type Light = "gozleme" | "tesdiq" | "legv"
export type Party = "podratci" | "esas" | "sifarisci"
export type Approval = "gozleyir" | "tesdiq" | "geri"

export const FIT_LABEL: Record<Fit, string> = {
  uygun: "Uyğundur",
  deyil: "Uyğun deyil",
  catismir: "Sənəd çatışmır",
  gozleyir: "Təsdiq gözləyir",
  el: "Əl ilə yoxlanılmalıdır",
}

export const CHECKS = [
  "Şirkət qeydiyyatı",
  "VÖEN və vergi sənədi",
  "İcazə və lisenziya",
  "Maliyyə hesabatı",
  "Oxşar müqavilə",
  "İcra aktı",
  "Mühəndis diplomu",
  "İşçi təcrübəsi",
  "Texnika sənədi",
  "Keyfiyyət və SƏTƏM",
  "Smeta və qiymət təklifi",
  "İş qrafiki",
  "İştirak təminatı",
  "İcra təminatı öhdəliyi",
]

export const SPEC_SECTIONS = [
  "01100 İcmal",
  "01200 Keyfiyyət təminatı",
  "01330 Sənəd təhvili",
  "01400 Keyfiyyət tələbləri",
  "01500 Müvəqqəti qurğular",
  "01600 Məhsul tələbləri",
  "03300 Yerində tökülən beton",
  "05120 Konstruktiv polad",
  "Sınaq və sertifikat",
]

export const WEATHER_RULES = [
  { when: "Yağış ehtimalı 80% və yuxarı", stop: "Hündürmərtəbəli iş, dam, fasad, açıq beton" },
  { when: "Külək 12 m/s və yuxarı", stop: "Kran, fasad, hündürlükdə iş" },
  { when: "Külək 15 m/s və yuxarı", stop: "Bütün açıq sahə işləri" },
  { when: "Yağış başlayıb", stop: "Açıq beton tökmə" },
]

export const CATEGORIES = [
  "Sement",
  "Beton",
  "Armatur",
  "Metal",
  "Alüminium",
  "Şüşə",
  "Qapı və pəncərə",
  "Boya",
  "Fasad",
  "Dam",
  "İzolyasiya",
]

export const APPROVALS = ["Smetaçı", "Layihə rəhbəri", "Maliyyə", "Direktor"]

export const PARTNER_KINDS = ["Bank", "Faktorinq", "Sığorta", "POS", "Əmək haqqı kartı"]

export const EXTRA_COSTS = ["Köməkçi material", "Nəqliyyat", "Yükləmə və boşaltma", "Tullantı norması", "Sahənin təşkili", "Risk ehtiyatı"]

export const SEAT_ROLES = ["Direktor", "Layihə rəhbəri", "Smeta mühəndisi", "Satınalma", "Anbardar", "Mühasib", "Kadrlar", "Hüquqşünas", "Sahə rəisi"]

export type Line = {
  id: string
  sheet: string
  name: string
  unit: string
  qty: string
  material: string
  labor: string
  laborOnly: boolean
  confirmed?: boolean
  source?: string
  pricedOn?: string
  stale?: boolean
}
export type Cost = { id: string; name: string; amount: string }
export type Duty = { id: string; work: string; party: Party }
export type StaffRow = { id: string; role: string; count: string }
export type GearRow = {
  id: string
  name: string
  count: string
  insurance: string
  basis?: GearBasis
  rate?: string
  span?: string
  fuel?: string
  operator?: string
  minSpan?: string
}
export type ScheduleRow = { id: string; name: string; start: string; end: string }
export type CashSources = { inflow: string; advance: string; equity: string; loan: string; days30: string; days60: string; days90: string }
export type WeatherLog = {
  id: string
  rain: string
  wind: string
  pouring: boolean
  stop: string
  officer: string
  date?: string
  site?: string
  temp?: string
  sky?: string
}
export type Product = {
  id: string
  name: string
  category: string
  price: string
  vat: string
  source: string
  updated: string
  region: string
  delivery: string
  validUntil: string
  unit?: string
  stale?: boolean
}
export type CoopRow = { id: string; company: string; note: string; status: string }
export type Partner = {
  id: string
  kind: string
  name: string
  note: string
  logo: string
  commission: string
  discount: string
  light: Light
  proof: string
  proofDate: string
  api: "bagli" | "novbe"
}
export type TemplateRow = { id: string; name: string; kind: string; version: string; updated: string; legal: string; party: string; status: string }
export type PassportRow = {
  id: string
  material: string
  section: string
  fit: Fit
  maker: string
  standard: string
  certificate: string
  issuer: string
  validUntil: string
  batch: string
  origin: string
  protocol: string
}
export type Seat = { id: string; name: string; role: string }
export type Rental = { id: string; name: string; rate: string; unit: string; place: string; operator: string }
export type Lot = { id: string; material: string; batch: string; expires: string; place: string }

export function bankTone(row: { light?: Light; proof?: string; proofDate?: string }) {
  const proof = row.proof?.trim() ?? ""
  const proofDate = row.proofDate?.trim() ?? ""
  if (row.light === "legv") return { color: "stop" as const, word: "Ləğv" }
  if (row.light === "tesdiq" && proof && proofDate) return { color: "ok" as const, word: "Təsdiq" }
  if (row.light === "tesdiq") return { color: "wait" as const, word: "Təsdiq sənədi çatışmır" }
  return { color: "wait" as const, word: "Gözləmə" }
}

export type Workspace = {
  tender: {
    id: string
    link: string
    price: string
    deadline: string
    subject: string
    classCode: string
    classText: string
    bidMode: "fixed" | "percent"
    bidValue: string
    sme: boolean
    discount: string
    advance: string
    opened: boolean
    confirmed: boolean
    checks: { name: string; fit: Fit }[]
    approvals: { role: string; status: Approval }[]
    buyer: string
    task: string
    contractDraft: string
    qualification: string
    similar: string
    bondDays: string
    performDays: string
  }
  boq: {
    id: string
    sheets: string[]
    lines: Line[]
    indirect: Cost[]
    overhead: Cost[]
    extras: Cost[]
    profit: string
    vat: string
    duties: Duty[]
    staff: StaffRow[]
    gear: GearRow[]
    management: string
    method: Method
    region: string
    complexity: Complexity
    rules: CostRule[]
  }
  schedule: { rows: ScheduleRow[]; bondDay: string }
  cash: CashSources
  weather: { rain: string; wind: string; pouring: boolean; officer: string; site: string; log: WeatherLog[] }
  guarantee: { kind: string; mode: "percent" | "fixed"; amount: string; rate: string; offer: string; light: Light; bankId: string; reviewed: boolean; packed: boolean }
  market: Product[]
  cabinet: {
    name: string
    voen: string
    code: string
    legalAddress: string
    actualAddress: string
    director: string
    phone: string
    email: string
    activity: string
    permits: string
    headcount: string
    fleet: string
    pastWork: string
    turnover: string
    bankAccount: string
  }
  seats: Seat[]
  rentals: Rental[]
  lots: Lot[]
  coop: CoopRow[]
  partners: Partner[]
  templates: TemplateRow[]
  passports: PassportRow[]
  spec: { name: string; fit: Fit }[]
  registry: { sima: string; tax: string; insolvency: string; consent: boolean }
}

function blank(): Workspace {
  return {
    tender: {
      id: "",
      link: "",
      price: "",
      deadline: "",
      subject: "",
      classCode: "",
      classText: "",
      bidMode: "fixed",
      bidValue: "",
      sme: false,
      discount: "",
      advance: "",
      opened: false,
      confirmed: false,
      checks: [],
      approvals: [],
      buyer: "",
      task: "",
      contractDraft: "",
      qualification: "",
      similar: "",
      bondDays: "",
      performDays: "",
    },
    boq: {
      id: "",
      sheets: ["Dəmir-beton", "Memarlıq", "Elektrik", "Mexanika", "Fasad"],
      lines: [
        { id: "ln-beton-1", sheet: "Dəmir-beton", name: "Bünövrə betonu C25/30", unit: "m3", qty: "420", material: "145", labor: "38", laborOnly: false, confirmed: true, source: "Holcim Beton", pricedOn: "2026-09-18", stale: false },
        { id: "ln-beton-2", sheet: "Dəmir-beton", name: "Armatur A500C, Ø12–25", unit: "tn", qty: "86", material: "1280", labor: "210", laborOnly: false, confirmed: true, source: "Baku Steel", pricedOn: "2026-09-14", stale: false },
        { id: "ln-beton-3", sheet: "Dəmir-beton", name: "Qəlib", unit: "m2", qty: "3100", material: "12", labor: "18", laborOnly: false, confirmed: true, source: "Sahə norması", pricedOn: "2026-09-01", stale: false },
        { id: "ln-beton-4", sheet: "Dəmir-beton", name: "Plitə betonu C30/37", unit: "m3", qty: "680", material: "162", labor: "42", laborOnly: false, confirmed: true, source: "Holcim Beton", pricedOn: "2026-09-18", stale: false },
        { id: "ln-beton-5", sheet: "Dəmir-beton", name: "Sütun və diafraqma", unit: "m3", qty: "190", material: "168", labor: "55", laborOnly: false, confirmed: true, source: "Holcim Beton", pricedOn: "2026-09-18", stale: false },
        { id: "ln-beton-6", sheet: "Dəmir-beton", name: "Sement 42.5, köhnə partiya", unit: "tn", qty: "40", material: "210", labor: "18", laborOnly: false, confirmed: false, source: "Norm Sement", pricedOn: "2026-06-01", stale: true },
        { id: "ln-mem-1", sheet: "Memarlıq", name: "Kərpic hörgü", unit: "m3", qty: "240", material: "95", labor: "48", laborOnly: false, confirmed: true, source: "Sahə norması", pricedOn: "2026-09-20", stale: false },
        { id: "ln-mem-2", sheet: "Memarlıq", name: "Sement-qum suvağı", unit: "m2", qty: "4200", material: "6.4", labor: "4.2", laborOnly: false, confirmed: true, source: "Sahə norması", pricedOn: "2026-09-22", stale: false },
        { id: "ln-mem-3", sheet: "Memarlıq", name: "Keramika döşəmə 60×60", unit: "m2", qty: "1850", material: "28", labor: "12", laborOnly: false, confirmed: true, source: "Kale", pricedOn: "2026-09-25", stale: false },
        { id: "ln-mem-4", sheet: "Memarlıq", name: "Alçıpan arakəsmə", unit: "m2", qty: "960", material: "18", labor: "14", laborOnly: false, confirmed: true, source: "Knauf", pricedOn: "2026-09-11", stale: false },
        { id: "ln-mem-5", sheet: "Memarlıq", name: "Daxili boya, iki qat", unit: "m2", qty: "6400", material: "3.8", labor: "2.4", laborOnly: false, confirmed: true, source: "Marshall", pricedOn: "2026-10-01", stale: false },
        { id: "ln-mem-6", sheet: "Memarlıq", name: "Landşaft səkiləri", unit: "m2", qty: "640", material: "42", labor: "16", laborOnly: false, confirmed: false, source: "Əl ilə", pricedOn: "2026-10-02", stale: false },
        { id: "ln-el-1", sheet: "Elektrik", name: "Kabel NYM 3×2.5", unit: "m", qty: "8200", material: "1.85", labor: "0.65", laborOnly: false, confirmed: true, source: "Azərkabel", pricedOn: "2026-09-16", stale: false },
        { id: "ln-el-2", sheet: "Elektrik", name: "Paylayıcı lövhə", unit: "ədəd", qty: "18", material: "420", labor: "95", laborOnly: false, confirmed: true, source: "Ekip", pricedOn: "2026-09-16", stale: false },
        { id: "ln-el-3", sheet: "Elektrik", name: "İşıq nöqtəsi", unit: "ədəd", qty: "640", material: "22", labor: "14", laborOnly: false, confirmed: true, source: "Ekip", pricedOn: "2026-09-19", stale: false },
        { id: "ln-el-4", sheet: "Elektrik", name: "Rozetka və açar", unit: "ədəd", qty: "890", material: "8.5", labor: "6", laborOnly: false, confirmed: true, source: "Ekip", pricedOn: "2026-09-19", stale: false },
        { id: "ln-mx-1", sheet: "Mexanika", name: "PPR boru Ø25", unit: "m", qty: "2400", material: "3.2", labor: "2.1", laborOnly: false, confirmed: true, source: "Sahə norması", pricedOn: "2026-09-21", stale: false },
        { id: "ln-mx-2", sheet: "Mexanika", name: "Fan-coil", unit: "ədəd", qty: "86", material: "680", labor: "95", laborOnly: false, confirmed: true, source: "Ekip", pricedOn: "2026-09-27", stale: false },
        { id: "ln-mx-3", sheet: "Mexanika", name: "Yanğın hidrantı", unit: "ədəd", qty: "24", material: "310", labor: "70", laborOnly: false, confirmed: true, source: "Sahə norması", pricedOn: "2026-09-27", stale: false },
        { id: "ln-fas-1", sheet: "Fasad", name: "Ventilyasiya fasadı", unit: "m2", qty: "2100", material: "78", labor: "32", laborOnly: false, confirmed: true, source: "Alubond", pricedOn: "2026-09-28", stale: false },
        { id: "ln-fas-2", sheet: "Fasad", name: "Şüşə paket montajı", unit: "m2", qty: "980", material: "", labor: "28", laborOnly: true, confirmed: true, source: "Sifarişçi materialı", pricedOn: "2026-09-28", stale: false },
        { id: "ln-fas-3", sheet: "Fasad", name: "Daş yunu 100 mm", unit: "m2", qty: "2100", material: "14", labor: "6", laborOnly: false, confirmed: true, source: "Rockwool", pricedOn: "2026-09-28", stale: false },
      ],
      indirect: [
        { id: "ind-1", name: "Sahə ofisi və mühafizə", amount: "18600" },
        { id: "ind-2", name: "Müvəqqəti elektrik və su", amount: "9400" },
        { id: "ind-3", name: "Geodeziya və laboratoriya", amount: "4200" },
      ],
      overhead: [
        { id: "ov-1", name: "Layihə idarəetməsi", amount: "28000" },
        { id: "ov-2", name: "SƏTƏM", amount: "7600" },
        { id: "ov-3", name: "Keyfiyyət nəzarəti", amount: "5400" },
      ],
      extras: [
        { id: "Köməkçi material", name: "Köməkçi material", amount: "12500" },
        { id: "Nəqliyyat", name: "Nəqliyyat", amount: "18400" },
        { id: "Yükləmə və boşaltma", name: "Yükləmə və boşaltma", amount: "6200" },
        { id: "Tullantı norması", name: "Tullantı norması", amount: "4800" },
        { id: "Sahənin təşkili", name: "Sahənin təşkili", amount: "9100" },
        { id: "Risk ehtiyatı", name: "Risk ehtiyatı", amount: "22000" },
      ],
      profit: "10",
      vat: "18",
      duties: [
        { id: "du-1", work: "Beton, armatur və qəlib", party: "podratci" },
        { id: "du-2", work: "Fasad paneli", party: "esas" },
        { id: "du-3", work: "Şüşə paket", party: "sifarisci" },
        { id: "du-4", work: "Elektrik lövhəsi", party: "podratci" },
      ],
      staff: [
        { id: "st-1", role: "Sahə rəisi", count: "1" },
        { id: "st-2", role: "İş icraçısı", count: "2" },
        { id: "st-3", role: "Betonçu", count: "18" },
        { id: "st-4", role: "Armaturçu", count: "12" },
        { id: "st-5", role: "Elektrik montajçısı", count: "8" },
        { id: "st-6", role: "Fasad montajçısı", count: "14" },
      ],
      gear: [
        { id: "ge-1", name: "Qüllə kranı", count: "2", insurance: "8400", basis: "gun", rate: "450", span: "20", fuel: "80", operator: "40", minSpan: "5" },
        { id: "ge-2", name: "Beton nasosu", count: "1", insurance: "2100", basis: "novbe", rate: "380", span: "12", fuel: "60", operator: "35", minSpan: "1" },
        { id: "ge-3", name: "Avtokran 25 t", count: "1", insurance: "1600", basis: "saat", rate: "85", span: "16", fuel: "12", operator: "8", minSpan: "4" },
        { id: "ge-4", name: "Ekskavator", count: "1", insurance: "980", basis: "gun", rate: "320", span: "6", fuel: "70", operator: "40", minSpan: "1" },
      ],
      management: "Port Baku Residence, Yasamal. Növbə 08:00–18:00, sahə rəisi bir nəfərdir. İki qüllə kranı və beton nasosu podratçının texnikasıdır. Şüşə paketi sifarişçi verir, montaj podratçıdadır. Həftəlik həcm Forma-2 ilə bağlanır.",
      method: "tam",
      region: "Bakı və Abşeron",
      complexity: "orta",
      rules: [],
    },
    schedule: { rows: [], bondDay: "" },
    cash: { inflow: "", advance: "", equity: "", loan: "", days30: "", days60: "", days90: "" },
    weather: { rain: "35", wind: "9", pouring: false, officer: "Rauf Hüseynov", site: "Port Baku Residence", log: [] },
    guarantee: { kind: "icra", mode: "percent", amount: "", rate: "5", offer: "", light: "gozleme", bankId: "", reviewed: false, packed: false },
    market: [],
    cabinet: {
      name: "",
      voen: "",
      code: "",
      legalAddress: "",
      actualAddress: "",
      director: "",
      phone: "",
      email: "",
      activity: "",
      permits: "",
      headcount: "",
      fleet: "",
      pastWork: "",
      turnover: "",
      bankAccount: "",
    },
    seats: [],
    rentals: [],
    lots: [],
    coop: [],
    partners: [],
    templates: [],
    passports: [],
    spec: [],
    registry: { sima: "", tax: "", insolvency: "", consent: false },
  }
}

let current = present(blank())
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return current
}

function present(state: Workspace): Workspace {
  const fresh = blank()
  return {
    ...fresh,
    ...state,
    tender: { ...fresh.tender, ...state.tender },
    boq: {
      ...fresh.boq,
      ...state.boq,
      gear: state.boq?.gear ?? fresh.boq.gear,
      extras: state.boq?.extras ?? fresh.boq.extras,
      method: state.boq?.method ?? "tam",
      region: state.boq?.region || "Bakı və Abşeron",
      complexity: state.boq?.complexity ?? "orta",
      rules: state.boq?.rules?.length
        ? state.boq.rules
        : seedRules({
            method: state.boq?.method ?? "tam",
            extras: state.boq?.extras ?? fresh.boq.extras,
            indirect: state.boq?.indirect ?? fresh.boq.indirect,
            overhead: state.boq?.overhead ?? fresh.boq.overhead,
          }),
    },
    schedule: { ...fresh.schedule, ...state.schedule },
    cash: { ...fresh.cash, ...state.cash },
    weather: { ...fresh.weather, ...state.weather },
    guarantee: { ...fresh.guarantee, ...state.guarantee },
    cabinet: { ...fresh.cabinet, ...state.cabinet },
    seats: state.seats ?? [],
    rentals: state.rentals ?? [],
    lots: state.lots ?? [],
    market: state.market ?? [],
    coop: state.coop ?? [],
    partners: state.partners ?? [],
    templates: state.templates ?? [],
    passports: state.passports ?? [],
    spec: state.spec ?? [],
    registry: { ...fresh.registry, ...state.registry },
  }
}

function commit(next: Workspace) {
  current = next
  listeners.forEach((listener) => listener())
}

export function patch(recipe: (state: Workspace) => Workspace) {
  commit(recipe(present(current)))
}

export function useWorkspace() {
  return useSyncExternalStore(subscribe, getSnapshot)
}

export function uid() {
  return crypto.randomUUID()
}

export function money(value: number) {
  return new Intl.NumberFormat("az-AZ", { maximumFractionDigits: 2 }).format(value)
}

function words(value: string) {
  return value
    .toLocaleLowerCase("az")
    .split(/[^0-9a-zəğıöüşç]+/i)
    .filter((word) => word.length > 3)
}

export function hoursUntil(value: string) {
  if (!value) return null
  const time = Date.parse(value)
  if (!Number.isFinite(time)) return null
  return (time - Date.now()) / 36e5
}

export function reminders(hours: number | null) {
  if (hours == null) return [] as string[]
  if (hours < 0) return ["Müddət keçib"]
  const list: string[] = []
  if (hours <= 168) list.push("7 gün qalıb")
  if (hours <= 72) list.push("3 gün qalıb")
  if (hours <= 24) list.push("24 saat qalıb")
  return list
}

export function textsDiffer(subject: string, classText: string) {
  const left = new Set(words(subject))
  const right = words(classText)
  if (!left.size || !right.length) return false
  return !right.some((word) => left.has(word))
}

export function tenderMath(tender: Workspace["tender"]) {
  const estimate = Number(tender.price) || 0
  const performRate = tender.discount.trim() ? Number(tender.discount) : tender.sme ? 5 : 10
  const safeRate = Number.isFinite(performRate) ? performRate : 0
  const perform = estimate * safeRate / 100
  const bidRaw = Number(tender.bidValue) || 0
  const bid = tender.bidMode === "fixed" ? bidRaw : estimate * bidRaw / 100
  const advance = estimate * ((Number(tender.advance) || 0) / 100)
  const id = tender.link.match(/detail\/(\d+)/)?.[1] || ""
  const hours = hoursUntil(tender.deadline)
  return {
    estimate,
    performRate: safeRate,
    perform,
    bid,
    advance,
    id,
    hours,
    mismatch: textsDiffer(tender.subject, tender.classText),
    reminders: reminders(hours),
  }
}

export function boqMath(boq: Workspace["boq"]) {
  const rules = liveRules({
    method: boq.method,
    extras: boq.extras,
    indirect: boq.indirect,
    overhead: boq.overhead,
    rules: boq.rules,
  })
  const parts = costBreakdown({ lines: boq.lines, rules, gear: boq.gear ?? [], profit: boq.profit, vat: boq.vat })
  const amount = (key: string) => parts.find((part) => part.key === key && part.on)?.amount ?? 0
  const material = amount("material")
  const labor = amount("iscilik")
  const indirect = amount("muveqqeti")
  const overhead = amount("inzibati")
  const extra = ["komekci", "texnika", "neqliyyat", "yukleme", "tullanti", "sahe", "risk"].reduce((sum, key) => sum + amount(key), 0)
  const measured = material + labor
  const base = measured + indirect + overhead + extra
  const profit = amount("menfeet")
  const net = base + profit
  const vat = amount("vergi")
  return { material, labor, measured, indirect, overhead, extra, base, profit, net, vat, gross: net + vat, parts }
}

export function shiftedDay(end: string, reserve: number) {
  if (!end.trim() || !Number.isFinite(Number(end))) return ""
  return String(Number(end) + reserve)
}

export function weatherStops(rain: string, wind: string, pouring: boolean) {
  return [
    Number(rain) >= 80 ? "Hündürmərtəbəli iş, dam, fasad, açıq beton" : "",
    Number(wind) >= 15 ? "Bütün açıq sahə" : Number(wind) >= 12 ? "Kran, fasad, hündürlük" : "",
    pouring ? "Açıq beton tökmə" : "",
  ].filter(Boolean)
}

export function lineTotal(line: Line) {
  if (line.confirmed === false || line.stale) return 0
  const qty = Number(line.qty) || 0
  const material = line.laborOnly ? 0 : Number(line.material) || 0
  const labor = Number(line.labor) || 0
  return (material + labor) * qty
}

export function guaranteeAmount(row: Workspace["guarantee"]) {
  const base = Number(row.amount) || 0
  if (row.mode === "fixed") return { asked: base, applied: base, rate: 0 }
  const asked = base * ((Number(row.rate) || 0) / 100)
  const rate = row.offer.trim() ? Number(row.offer) : Number(row.rate) || 0
  return { asked, applied: base * (rate / 100), rate }
}
