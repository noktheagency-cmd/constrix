import * as XLSX from "xlsx"

export const KINDS = [
  ["tikinti", "Tikinti şirkəti və podratçı"],
  ["memar", "Memar, mühəndis və layihə"],
  ["qapi", "Alüminium qapı-pəncərə"],
  ["suse", "Şüşə istehsalı və təchizatı"],
  ["pvc", "PVC"],
  ["fasad", "Fasad və metal konstruksiya"],
  ["material", "Tikinti materialı"],
  ["montaj", "Montaj və texniki xidmət"],
  ["logistika", "Logistika və xüsusi yük"],
  ["admin", "Platforma administratoru"],
] as const

export type CompanyKind = (typeof KINDS)[number][0]

export const STAGES = [
  ["yeni", "Yeni layihə"],
  ["fayl", "Faylların təhlili"],
  ["olcu", "Ölçülərin təsdiqi"],
  ["hesab", "Hesablamanın tamamlanması"],
  ["qiymet", "Təchizatçılardan qiymət"],
  ["teklif", "Kommersiya təklifi"],
  ["tesdiq", "Sifarişin təsdiqi"],
  ["istehsal", "İstehsala verilməsi"],
  ["yoxlama", "Hazır məhsulun yoxlanılması"],
  ["dasima", "Daşınma"],
  ["montaj", "Montaj"],
  ["tehvil", "Təhvil-təslim"],
  ["zemanet", "Zəmanət və satışdan sonra"],
] as const

export type Stage = (typeof STAGES)[number][0]

export const UNITS = ["m", "m2", "kq", "eded", "dest", "saat", "km"] as const
export type Unit = (typeof UNITS)[number]

export const OPENINGS = [
  ["sabit", "Sabit"],
  ["doner", "Dönər"],
  ["asqili", "Aşqı"],
  ["surusken", "Sürüşkən"],
] as const

export type Opening = (typeof OPENINGS)[number][0]

export const ALLOWED_EXT = ["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "dwg", "dxf", "ifc", "rvt", "png", "jpg", "jpeg", "webp"] as const

export const FILE_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.dwg,.dxf,.ifc,.rvt,.png,.jpg,.jpeg,.webp"

export type Flag = "oxunmadi" | "ziddiyyet" | "qeyri-deqiq"

export type Extracted = {
  id: string
  name: string
  code: string
  qty: string
  width: string
  height: string
  profile: string
  glass: string
  hardware: string
  spec: string
  install: string
  flags: Flag[]
  confirmed: boolean
}

export type Company = {
  id: string
  kind: CompanyKind
  name: string
  voen: string
  phone: string
  email: string
  director: string
  legalAddress: string
  actualAddress: string
  capacity: string
  warehouse: string
  regions: string
  warranty: string
  reliability: string
}

export type PriceBreak = { id: string; minQty: string; size: string; spec: string; delivery: string; price: string }

export type Product = {
  id: string
  companyId: string
  name: string
  code: string
  category: string
  params: string
  colors: string
  sizes: string
  unit: string
  price: string
  cost: string
  validUntil: string
  minQty: string
  leadDays: string
  deliveryPrice: string
  installPrice: string
  breaks: PriceBreak[]
}

export type PriceLog = { id: string; productId: string; at: string; from: string; to: string; by: string }

export type ProfileRule = {
  id: string
  companyId: string
  system: string
  confirmed: boolean
  kgPerM: string
  wastePercent: string
  glassDeductMm: string
  glassWastePercent: string
}

export type WindowInput = {
  title: string
  width: string
  height: string
  count: string
  opening: Opening
  sections: string
  systemId: string
  color: string
  profileNote: string
  glassKind: string
  glassThickness: string
  hardware: string
  installKind: string
  address: string
  profileUnit: "m" | "kq"
  profileRate: string
  glassRate: string
  hardwareRate: string
  laborRate: string
  installRate: string
  packRate: string
  transport: string
  extra: string
  vat: string
  profit: string
  profitMode: "faiz" | "marja"
  glassConfirmed: boolean
}

export type LogisticsInput = {
  id: string
  companyId: string
  carrierId: string
  from: string
  to: string
  km: string
  weight: string
  volume: string
  glassWidth: string
  glassHeight: string
  vehicle: "standart" | "suse"
  capacityKg: string
  maxGlassMm: string
  roundTrip: boolean
  loadCost: string
  waitCost: string
  extra: string
  tariff: string
  speed: string
  days: string
}

export type Job = { id: string; companyId: string; input: WindowInput; productIds: string[]; logisticsId: string; at: string }

export type FlowEvent = { stage: Stage; person: string; date: string; note: string; docs: string }

export type Flow = {
  id: string
  companyId: string
  title: string
  stage: Stage
  supplierId: string
  carrierId: string
  installerId: string
  jobId: string
  history: FlowEvent[]
}

export type PlanKind = "abune" | "layihe" | "kabinet" | "komissiya" | "modul" | "korporativ"

export type Plan = { id: string; kind: PlanKind; name: string; amount: string; note: string }

export type Charge = { id: string; companyId: string; planId: string; amount: string; invoice: string; status: "gozleyir" | "qeyd" }

export type Dispute = { id: string; companyId: string; company?: string; text: string; status: "aciq" | "bagli" }

export type AuditRow = { id: string; at: string; actor: string; action: string; detail: string }

export type FileVersion = {
  id: string
  name: string
  ext: string
  size: number
  at: string
  scanNote: string
  blobId?: string
  rows: Extracted[]
}

export type ProjectFile = {
  id: string
  companyId: string
  name: string
  ext: string
  size: number
  scan: "temiz" | "redd"
  scanNote: string
  rows: Extracted[]
  at?: string
  blobId?: string
  revised?: boolean
  versions?: FileVersion[]
  formats?: string[]
}

export type ProcureState = {
  actor: string
  activeId: string
  companies: Company[]
  categories: string[]
  units: string[]
  products: Product[]
  prices: PriceLog[]
  rules: ProfileRule[]
  files: ProjectFile[]
  jobs: Job[]
  logistics: LogisticsInput[]
  flows: Flow[]
  plans: Plan[]
  charges: Charge[]
  disputes: Dispute[]
  audit: AuditRow[]
}

export function blankCompany(kind: CompanyKind = "tikinti"): Omit<Company, "id"> {
  return {
    kind,
    name: "",
    voen: "",
    phone: "",
    email: "",
    director: "",
    legalAddress: "",
    actualAddress: "",
    capacity: "",
    warehouse: "",
    regions: "",
    warranty: "",
    reliability: "",
  }
}

export function blankWindow(): WindowInput {
  return {
    title: "",
    width: "",
    height: "",
    count: "1",
    opening: "doner",
    sections: "1",
    systemId: "",
    color: "",
    profileNote: "",
    glassKind: "",
    glassThickness: "",
    hardware: "",
    installKind: "",
    address: "",
    profileUnit: "m",
    profileRate: "",
    glassRate: "",
    hardwareRate: "",
    laborRate: "",
    installRate: "",
    packRate: "",
    transport: "",
    extra: "",
    vat: "18",
    profit: "10",
    profitMode: "faiz",
    glassConfirmed: false,
  }
}

export function blankState(): ProcureState {
  return {
    actor: "Kabinet",
    activeId: "",
    companies: [],
    categories: ["Alüminium profil", "Şüşə", "Furnitur", "PVC", "Fasad", "Metal", "Montaj", "Daşınma", "Köməkçi"],
    units: [...UNITS],
    products: [],
    prices: [],
    rules: [],
    files: [],
    jobs: [],
    logistics: [],
    flows: [],
    plans: [
      { id: "abune", kind: "abune", name: "Aylıq abunə", amount: "149", note: "Tikinti şirkəti və memar kabineti bu haqla açıq saxlayır." },
      { id: "layihe", kind: "layihe", name: "Layihə hesablama haqqı", amount: "85", note: "Hər yeni layihə bir dəfə hesablanır. Variant üçün təkrar haqq yoxdur." },
      { id: "kabinet", kind: "kabinet", name: "Təchizatçı kabineti", amount: "99", note: "İstehsalçı qiymətini və təklifini bu kabinetdən göndərir." },
      { id: "komissiya", kind: "komissiya", name: "Sifariş komissiyası", amount: "2.5", note: "Yalnız bağlanmış sifarişin məbləğindən tutulur. Ləğv olunmuş sifarişdən yox." },
      { id: "modul", kind: "modul", name: "Hesablama modulu", amount: "45", note: "Zavod profil, şüşə və furnitur sərfiyyatını özü hesablayır." },
      { id: "korporativ", kind: "korporativ", name: "Korporativ tarif", amount: "890", note: "Aylıq abunənin yerinə keçir: 15 istifadəçi, layihə sayı limitsiz." },
    ],
    charges: [],
    disputes: [
      { id: "disp-glass", companyId: "seed-org-glass", company: "Abşeron Şüşə", text: "Köhnə 6 mm şüşə qiyməti vaxtı keçib, müqayisəyə düşməməlidir", status: "aciq" },
      { id: "disp-alum", companyId: "seed-org-alum", company: "Xəzər Alüminium Sistemləri", text: "Profil rəngi sifarişdə antrasit yazılıb, təklifdə gümüş gəlib", status: "aciq" },
      { id: "disp-afez", companyId: "seed-org-afez", company: "Sənaye Xidmətləri Tikinti Qrupu", text: "Port Baku fasadında montaj gecikir, cərimə şərtinə baxılmalıdır", status: "aciq" },
      { id: "disp-pvc", companyId: "seed-org-pvc", company: "Qafqaz PVC Profil", text: "Pəncərə partiyasında iki ölçü çertyojla tutmur", status: "aciq" },
      { id: "disp-log", companyId: "seed-org-log", company: "Şüşədaşıma Lojistik", text: "Şüşə daşınanda iki paket çatmayıb, akt gözlənilir", status: "aciq" },
      { id: "disp-metal", companyId: "seed-org-metal", company: "Kür Armatur və İnert", text: "Armaturun diametri sertifikatla üst-üstə düşmür", status: "bagli" },
      { id: "disp-boya", companyId: "seed-org-boya", company: "Azər Boya İstehsalat", text: "Boya partiyasının rəng kodu nümunədən fərqlənir", status: "bagli" },
      { id: "disp-fasad", companyId: "seed-org-fasad", company: "Fasad Konstruksiya", text: "Anker sayı smetada az göstərilib, əlavə iş təsdiqi bağlandı", status: "bagli" },
    ],
    audit: [
      { id: "aud-1", at: "2026-10-08T09:10:00.000Z", actor: "Elvin Məmmədov", action: "Şirkət açıldı", detail: "Sənaye Xidmətləri Tikinti Qrupu · Tikinti" },
      { id: "aud-2", at: "2026-10-08T11:40:00.000Z", actor: "Platforma inzibatçısı", action: "Tarif yazıldı", detail: "Aylıq abunə · 149 ₼" },
      { id: "aud-3", at: "2026-10-09T10:15:00.000Z", actor: "Kamal İbrahimov", action: "Məhsul açıldı", detail: "Alüminium profil 45 mm" },
      { id: "aud-4", at: "2026-10-09T14:30:00.000Z", actor: "Leyla Qasımova", action: "Qiymət dəyişdi", detail: "6 mm şəffaf şüşə: 18 ₼ → 16.5 ₼" },
      { id: "aud-5", at: "2026-10-10T09:00:00.000Z", actor: "Elvin Məmmədov", action: "Fayl qəbul oldu", detail: "Port-Baku-fasad.xlsx" },
      { id: "aud-6", at: "2026-10-11T12:20:00.000Z", actor: "Aygün Əlizadə", action: "Hesab saxlandı", detail: "Xətt Layihə · pəncərə partiyası" },
      { id: "aud-7", at: "2026-10-12T15:45:00.000Z", actor: "Orxan Vəliyev", action: "Faylın yeni versiyası", detail: "Dasima-marşrutu.pdf" },
      { id: "aud-8", at: "2026-10-13T10:05:00.000Z", actor: "Platforma inzibatçısı", action: "Mübahisə bağlandı", detail: "Kür Armatur və İnert · sertifikat" },
      { id: "aud-9", at: "2026-10-14T08:50:00.000Z", actor: "Günel Rzayeva", action: "Qaimə açıldı", detail: "Korporativ tarif · 890 ₼" },
    ],
  }
}

function planText(value: unknown, fallback: string) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value === "string" && value.trim()) return value.trim()
  return fallback
}

export function withPlanDefaults(plans: Plan[]): Plan[] {
  const seeds = blankState().plans
  const rows = Array.isArray(plans) ? plans : []
  if (!rows.length) return seeds.map((plan) => ({ ...plan }))
  const saved = new Map(rows.map((plan) => [plan.id, plan]))
  const known = new Set(seeds.map((plan) => plan.id))
  const merged = seeds.map((seed) => {
    const row = saved.get(seed.id)
    if (!row) return { ...seed }
    return {
      ...seed,
      ...row,
      name: planText(row.name, seed.name),
      amount: planText(row.amount, seed.amount),
      note: planText(row.note, seed.note),
    }
  })
  return [...merged, ...rows.filter((plan) => plan && !known.has(plan.id)).map((plan) => ({ ...plan }))]
}

const BUYERS = new Set<CompanyKind>(["tikinti", "memar"])
const MAKERS = new Set<CompanyKind>(["qapi", "suse", "pvc", "fasad", "material"])

export function kindLabel(kind: CompanyKind) {
  return KINDS.find((item) => item[0] === kind)?.[1] ?? kind
}

export function stageLabel(stage: Stage) {
  return STAGES.find((item) => item[0] === stage)?.[1] ?? stage
}

const PROCURE_PATHS = new Set(["/sirket", "/layihe-fayl", "/kataloq", "/hesablama", "/dasima", "/teklif", "/sifaris-merhele", "/tarif", "/platforma"])

function procureBase(path: string) {
  for (const item of PROCURE_PATHS) {
    if (path === item || path.startsWith(`${item}/`)) return item
  }
  return path
}

export function showPath(path: string, kind: CompanyKind | "") {
  const base = procureBase(path)
  if (!PROCURE_PATHS.has(base)) return true
  if (base === "/platforma") return kind === "admin"
  if (!kind) return base === "/sirket"
  if (kind === "admin" || BUYERS.has(kind)) return true
  if (MAKERS.has(kind)) return ["/sirket", "/kataloq", "/hesablama", "/teklif", "/sifaris-merhele", "/tarif"].includes(base)
  if (kind === "montaj") return ["/sirket", "/teklif", "/sifaris-merhele", "/tarif"].includes(base)
  if (kind === "logistika") return ["/sirket", "/dasima", "/sifaris-merhele", "/tarif"].includes(base)
  return base === "/sirket"
}

export function seesCost(kind: CompanyKind | "", ownerId: string, activeId: string) {
  return kind === "admin" || (ownerId !== "" && ownerId === activeId)
}

export function num(value: string) {
  const parsed = Number(String(value).replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
}

export function pickPrice(product: Product, qty: number, size: string, spec: string, delivery: string) {
  const fits = product.breaks.filter((row) => {
    const min = num(row.minQty) ?? 0
    if (qty + 1e-9 < min) return false
    if (row.size.trim() && row.size.trim() !== size.trim()) return false
    if (row.spec.trim() && row.spec.trim() !== spec.trim()) return false
    if (row.delivery.trim() && row.delivery.trim() !== delivery.trim()) return false
    return num(row.price) != null
  })
  fits.sort((a, b) => (num(b.minQty) ?? 0) - (num(a.minQty) ?? 0))
  return fits[0] ? num(fits[0].price) : num(product.price)
}

export function framePieces(width: number, height: number, sections: number, count: number) {
  const bays = Math.max(1, Math.floor(sections))
  const pieces = [
    { name: "Üst çərçivə", lengthMm: width, qty: count },
    { name: "Alt çərçivə", lengthMm: width, qty: count },
    { name: "Sol çərçivə", lengthMm: height, qty: count },
    { name: "Sağ çərçivə", lengthMm: height, qty: count },
  ]
  if (bays > 1) pieces.push({ name: "Orta bölücü", lengthMm: height, qty: count * (bays - 1) })
  const lengthMm = pieces.reduce((sum, piece) => sum + piece.lengthMm * piece.qty, 0)
  return { pieces, bays, lengthM: lengthMm / 1000 }
}

export type CostLine = { name: string; unit: string; qty: number | null; rate: number | null; amount: number | null; note: string }

export function windowMath(input: WindowInput, rule: ProfileRule | undefined) {
  const blocked: string[] = []
  const width = num(input.width)
  const height = num(input.height)
  const count = num(input.count)
  const sections = num(input.sections) ?? 1
  if (width == null || height == null || count == null || width <= 0 || height <= 0 || count <= 0) {
    return { ready: false as const, blocked: ["En, hündürlük və say yazılmalıdır"], pieces: [], lengthM: 0, weightKg: null as number | null, wasteM: null as number | null, glassArea: null as number | null, cutArea: null as number | null, hardwareQty: null as number | null, lines: [] as CostLine[], cost: null as number | null, profit: null as number | null, vat: null as number | null, sale: null as number | null, gross: null as number | null }
  }
  const frame = framePieces(width, height, sections, count)
  const confirmed = Boolean(rule?.confirmed)
  const kgPerM = confirmed ? num(rule?.kgPerM ?? "") : null
  const wastePercent = confirmed ? num(rule?.wastePercent ?? "") : null
  const deduct = confirmed ? num(rule?.glassDeductMm ?? "") : null
  const glassWaste = confirmed ? num(rule?.glassWastePercent ?? "") : null
  if (!confirmed) blocked.push("Profil sistemi təsdiqlənməyib. Kiloqram, kəsim itkisi və şüşənin kəsim ölçüsü ümumi əmsalla doldurulmur.")
  else {
    if (kgPerM == null) blocked.push("Təsdiqli qaydada kiloqram/metr yoxdur")
    if (wastePercent == null) blocked.push("Təsdiqli qaydada kəsim itkisi yoxdur")
    if (deduct == null) blocked.push("Təsdiqli qaydada şüşə payı yoxdur")
  }
  const weightKg = kgPerM == null ? null : frame.lengthM * kgPerM
  const wasteM = wastePercent == null ? null : frame.lengthM * wastePercent / 100
  const opening = (width / 1000) * (height / 1000) * count
  let cutArea: number | null = null
  if (deduct != null) {
    const paneW = width / frame.bays - deduct
    const paneH = height - deduct
    cutArea = paneW > 0 && paneH > 0 ? (paneW / 1000) * (paneH / 1000) * frame.bays * count : null
    if (cutArea == null) blocked.push("Şüşə payı ölçüdən böyükdür")
  } else if (input.glassConfirmed) cutArea = opening
  else blocked.push("Şüşə ölçüsü təsdiqlənməyib")
  const cutWithWaste = cutArea == null || glassWaste == null ? cutArea : cutArea * (1 + glassWaste / 100)
  if (confirmed && glassWaste == null) blocked.push("Təsdiqli qaydada şüşə itkisi yoxdur")
  const hardwareQty = input.opening === "sabit" ? 0 : count

  function line(name: string, unit: string, qty: number | null, rateRaw: string, note = ""): CostLine {
    const rate = num(rateRaw)
    const amount = qty == null ? null : qty === 0 ? 0 : rate == null ? null : qty * rate
    return { name, unit, qty, rate, amount, note: amount == null ? "Miqdar və ya qiymət yoxdur" : note }
  }

  const profileQty = input.profileUnit === "kq" ? weightKg : frame.lengthM + (wasteM ?? 0)
  const lines: CostLine[] = [
    line("Alüminium profil", input.profileUnit, profileQty, input.profileRate, wasteM == null && input.profileUnit === "m" ? "İtki qaydası yoxdur, uzunluq itkizsizdir" : ""),
    line("Şüşə", "m2", confirmed && glassWaste != null ? cutWithWaste : cutArea, input.glassRate),
    line("Furnitur və aksesuar", "dest", hardwareQty, input.hardwareRate),
    line("İstehsal əməkhaqqı", "eded", count, input.laborRate),
    line("Qablaşdırma", "eded", count, input.packRate),
    line("Montaj", "eded", input.installKind.trim() ? count : 0, input.installKind.trim() ? input.installRate : "0"),
    line("Daşınma", "sifaris", 1, input.transport),
    line("Əlavə xərc", "sifaris", 1, input.extra || "0"),
  ]
  if (lines.some((item) => item.amount == null)) blocked.push("Bəzi xərc sətirlərinin qiyməti yoxdur")
  const amounts = lines.map((item) => item.amount)
  const complete = amounts.every((item) => item != null) && blocked.length === 0
  const cost = complete ? amounts.reduce<number>((sum, item) => sum + (item ?? 0), 0) : null
  const profitRate = num(input.profit)
  let profit: number | null = null
  let sale: number | null = null
  if (cost != null && profitRate != null) {
    if (input.profitMode === "marja") {
      if (profitRate >= 100 || profitRate < 0) blocked.push("Marja 0 ilə 100 arasında olmalıdır")
      else {
        sale = cost / (1 - profitRate / 100)
        profit = sale - cost
      }
    } else {
      profit = cost * profitRate / 100
      sale = cost + profit
    }
  } else if (cost == null) blocked.push("Maya tam deyil, satış qiyməti bağlanmır")
  const vatRate = num(input.vat)
  const vat = sale != null && vatRate != null ? sale * vatRate / 100 : null
  const gross = sale != null && vat != null ? sale + vat : null
  return { ready: true as const, blocked, pieces: frame.pieces, lengthM: frame.lengthM, weightKg, wasteM, glassArea: opening, cutArea, hardwareQty, lines, cost, profit, vat, sale, gross }
}

export function logisticsMath(input: LogisticsInput) {
  const oneWay = num(input.km)
  const tariff = num(input.tariff)
  const weight = num(input.weight)
  const capacity = num(input.capacityKg)
  const glass = Math.max(num(input.glassWidth) ?? 0, num(input.glassHeight) ?? 0)
  const maxGlass = num(input.maxGlassMm)
  const notes: string[] = []
  if (oneWay == null || oneWay < 0) notes.push("Məsafə yazılmalıdır. Xəritə xidməti bağlanmayıb, təsdiqli məsafə əl ilə daxil edilir.")
  if (tariff == null) notes.push("Kilometr tarifi yazılmalıdır")
  let fit: "uygun" | "tutum" | "olcu" = "uygun"
  if (weight != null && capacity != null && weight > capacity) {
    fit = "tutum"
    notes.push("Yük seçilmiş maşının tutumunu aşır")
  }
  if (input.vehicle === "standart" && maxGlass != null && glass > maxGlass) {
    fit = "olcu"
    notes.push("Şüşə ölçüsü standart maşına sığmır. Şüşədaşıyan seçilməlidir.")
  }
  const km = oneWay == null ? null : input.roundTrip ? oneWay * 2 : oneWay
  const load = num(input.loadCost) ?? 0
  const wait = num(input.waitCost) ?? 0
  const extra = num(input.extra) ?? 0
  const cost = km == null || tariff == null || fit !== "uygun" ? null : km * tariff + load + wait + extra
  const speed = num(input.speed)
  const days = km != null && speed != null && speed > 0 ? Math.ceil(km / speed) : num(input.days)
  if (days == null) notes.push("Çatdırılma müddəti və ya günlük yol yazılmalıdır")
  return { km, cost, days, fit, notes }
}

const HEADER: Record<string, keyof Omit<Extracted, "id" | "flags" | "confirmed">> = {
  ad: "name",
  name: "name",
  mehsul: "name",
  "məhsul": "name",
  kod: "code",
  code: "code",
  say: "qty",
  qty: "qty",
  miqdar: "qty",
  en: "width",
  width: "width",
  hundurluk: "height",
  "hündürlük": "height",
  height: "height",
  profil: "profile",
  suse: "glass",
  "şüşə": "glass",
  glass: "glass",
  furnitur: "hardware",
  hardware: "hardware",
  spesifikasiya: "spec",
  spec: "spec",
  montaj: "install",
}

function cleanKey(value: string) {
  return value.trim().toLocaleLowerCase("az")
}

export function emptyExtract(name: string): Omit<Extracted, "id"> {
  return { name, code: "", qty: "", width: "", height: "", profile: "", glass: "", hardware: "", spec: "", install: "", flags: ["oxunmadi"], confirmed: false }
}

function rowFromRecord(record: Record<string, string>, fallback: string): Omit<Extracted, "id"> {
  const row = emptyExtract(fallback)
  row.flags = []
  let seen = false
  for (const [key, value] of Object.entries(record)) {
    const field = HEADER[cleanKey(key)]
    if (!field) continue
    seen = true
    row[field] = String(value ?? "").trim()
  }
  if (!seen) row.flags.push("oxunmadi")
  for (const field of ["name", "qty", "width", "height"] as const) {
    if (!row[field].trim()) row.flags.push("oxunmadi")
  }
  if (!row.name.trim()) row.name = fallback
  const width = num(row.width)
  const height = num(row.height)
  if ((row.width.trim() && width == null) || (row.height.trim() && height == null)) row.flags.push("qeyri-deqiq")
  if (width != null && height != null && (width <= 0 || height <= 0)) row.flags.push("ziddiyyet")
  row.confirmed = false
  return row
}

export function parseTable(records: Record<string, string>[], fallback: string): Omit<Extracted, "id">[] {
  if (!records.length) return [emptyExtract(fallback)]
  return records.map((record, index) => rowFromRecord(record, `${fallback} ${index + 1}`))
}

export function parseCsv(text: string, fallback: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return [emptyExtract(fallback)]
  const delimiter = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ","
  const headers = splitCsv(lines[0], delimiter)
  const records = lines.slice(1).map((line) => {
    const cells = splitCsv(line, delimiter)
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]))
  })
  return parseTable(records, fallback)
}

function splitCsv(line: string, delimiter: string) {
  const cells: string[] = []
  let current = ""
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else quoted = !quoted
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim())
      current = ""
    } else current += char
  }
  cells.push(current.trim())
  return cells
}

const SIZE_RE = /(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)/i
const PROFILE_RE = /(alum(?:inium|inyum)?(?:\s*\d+)?|pvc(?:\s*\d+)?|rehau|sch[uü]co|aluprof|x[əe]z[əe]r(?:\s*\d+)?|profil(?:\s+[a-z0-9əğıöüşç]+){0,2})/i

export function measurePair(rawA: string, rawB: string) {
  const a = Number(rawA.replace(",", "."))
  const b = Number(rawB.replace(",", "."))
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null
  const [width, height] = a < 20 && b < 20 ? [Math.round(a * 1000), Math.round(b * 1000)] : [Math.round(a), Math.round(b)]
  return { width: String(width), height: String(height), precise: width >= 50 && height >= 50 }
}

export function sizeFromText(text: string) {
  const match = text.match(SIZE_RE)
  if (!match) return null
  return measurePair(match[1], match[2])
}

export function profileFromText(text: string) {
  return text.match(PROFILE_RE)?.[1]?.replace(/\s+/g, " ").trim() ?? ""
}

function cleanDxfText(value: string) {
  return value.replace(/\\P/g, " ").replace(/[{}]/g, " ").replace(/\s+/g, " ").trim()
}

function drawingRow(fallback: string, width: string, height: string, profile: string, precise: boolean): Omit<Extracted, "id"> {
  return {
    ...emptyExtract(fallback),
    name: fallback,
    qty: "1",
    width,
    height,
    profile,
    flags: precise ? [] : ["qeyri-deqiq"],
    confirmed: false,
  }
}

export function parseDxf(text: string, fallback: string): Omit<Extracted, "id">[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0)
  const polys: { xs: number[]; ys: number[]; layer: string }[] = []
  const notes: { text: string; layer: string }[] = []
  let entity = ""
  let xs: number[] = []
  let ys: number[] = []
  let layer = ""
  let written = ""
  function flush() {
    if (entity === "LWPOLYLINE" && xs.length >= 2 && ys.length >= 2) polys.push({ xs: [...xs], ys: [...ys], layer })
    if (["TEXT", "MTEXT", "ATTRIB", "DIMENSION"].includes(entity) && written.trim()) notes.push({ text: cleanDxfText(written), layer })
    if (entity === "INSERT" && written.trim()) notes.push({ text: cleanDxfText(written), layer })
    xs = []
    ys = []
    layer = ""
    written = ""
  }
  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = lines[i]
    const value = lines[i + 1]
    if (code === "0") {
      flush()
      entity = value.toUpperCase()
    } else if (code === "8") layer = value
    else if (code === "1" || code === "3") written = `${written} ${value}`.trim()
    else if (entity === "INSERT" && code === "2") written = value
    else if (entity === "LWPOLYLINE" && code === "10") xs.push(Number(value))
    else if (entity === "LWPOLYLINE" && code === "20") ys.push(Number(value))
  }
  flush()
  const sized = notes.map((note) => ({ note, size: sizeFromText(note.text) })).filter((item) => item.size)
  const profile = notes.map((note) => profileFromText(note.text) || profileFromText(note.layer)).find(Boolean) ?? ""
  if (sized.length) {
    return sized.map((item) => drawingRow(fallback, item.size!.width, item.size!.height, profile || profileFromText(item.note.layer), item.size!.precise))
  }
  const rows = polys.flatMap((poly) => {
    const width = (Math.max(...poly.xs) - Math.min(...poly.xs)) * 1000
    const height = (Math.max(...poly.ys) - Math.min(...poly.ys)) * 1000
    if (width < 50 || height < 50) return []
    return [drawingRow(fallback, width.toFixed(0), height.toFixed(0), profile || profileFromText(poly.layer), false)]
  })
  return rows.length ? rows : [emptyExtract(fallback)]
}

function ifcLength(text: string, label: string) {
  const named = text.match(new RegExp(`${label}[\\s\\S]{0,120}?IFCLENGTHMEASURE\\(([\\d.]+)\\)`, "i"))
  if (named) return named[1]
  const quantity = text.match(new RegExp(`IFCQUANTITYLENGTH\\('${label}'[^)]*?,([\\d.]+)\\)`, "i"))
  return quantity?.[1] ?? ""
}

export function parseIfc(text: string, fallback: string): Omit<Extracted, "id">[] {
  if (!/IFC/i.test(text)) return [emptyExtract(fallback)]
  const names: string[] = []
  const re = /IFC(?:WINDOW|DOOR)\s*\(([^;]*)\)/gi
  let match = re.exec(text)
  while (match) {
    const quotes = [...match[1].matchAll(/'([^']*)'/g)].map((item) => item[1]).filter(Boolean)
    const name = quotes[1] || quotes[0]
    if (name) names.push(name)
    match = re.exec(text)
  }
  const widthRaw = ifcLength(text, "OverallWidth") || ifcLength(text, "Width")
  const heightRaw = ifcLength(text, "OverallHeight") || ifcLength(text, "Height")
  const size = widthRaw && heightRaw ? measurePair(widthRaw, heightRaw) : null
  const profile = text.match(/IFCPROPERTYSINGLEVALUE\('(?:Reference|Profile|System)'[^']*'([^']+)'/i)?.[1] ?? profileFromText(text)
  if (!names.length && !size) return [emptyExtract(fallback)]
  const title = names[0] || fallback
  if (size) return [drawingRow(title, size.width, size.height, profile, size.precise)]
  return names.map((name) => ({ ...emptyExtract(name), name, qty: "1", profile, flags: ["qeyri-deqiq"], confirmed: false }))
}

export function rowsFromPlainText(text: string, fallback: string): Omit<Extracted, "id">[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const sharedProfile = lines.map((line) => profileFromText(line)).find(Boolean) ?? ""
  const rows = lines.flatMap((line) => {
    const size = sizeFromText(line)
    if (!size) return []
    const profile = profileFromText(line) || sharedProfile
    const qty = line.match(/(?:^|\s)(\d+)\s*(?:ədəd|eded|qty)/i)?.[1] ?? "1"
    return [drawingRow(fallback, size.width, size.height, profile, size.precise && Boolean(profile))]
      .map((row) => ({ ...row, qty, spec: line }))
  })
  return rows.length ? rows : [emptyExtract(fallback)]
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function xmlBits(xml: string, tag: string) {
  return [...xml.matchAll(new RegExp(`<${tag}[\\s>][\\s\\S]*?<\\/${tag}>`, "g"))].map((item) => item[0])
}

function xmlText(xml: string) {
  return decodeXml([...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((item) => item[1]).join(" ")).replace(/\s+/g, " ").trim()
}

export function parseDocxXml(xml: string, fallback: string): Omit<Extracted, "id">[] {
  const table = xmlBits(xml, "w:tr").map((row) => xmlBits(row, "w:tc").map(xmlText)).filter((cells) => cells.some(Boolean))
  if (table.length) {
    const header = table[0].map((cell) => cleanKey(cell))
    const known = header.some((cell) => HEADER[cell])
    const body = known ? table.slice(1) : table
    if (known) {
      const records = body.map((cells) => Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ""])))
      const rows = parseTable(records, fallback)
      if (rows.some((row) => row.name && !row.flags.includes("oxunmadi"))) return rows
    }
    const sized = body.flatMap((cells) => {
      const joined = cells.join(" ")
      const size = sizeFromText(joined) ?? (cells.length >= 3 ? measurePair(cells[cells.length - 2] || "", cells[cells.length - 1] || "") : null)
      if (!size) return []
      return [drawingRow(cells[0] || fallback, size.width, size.height, profileFromText(joined), size.precise)]
    })
    if (sized.length) return sized
  }
  const paragraphs = xmlBits(xml, "w:p").map(xmlText).filter(Boolean)
  const plain = paragraphs.length ? paragraphs.join("\n") : xmlText(xml)
  return rowsFromPlainText(plain, fallback)
}

function latinStrings(bytes: Uint8Array) {
  const found: string[] = []
  let current = ""
  for (const byte of bytes) {
    if (byte >= 32 && byte < 127) current += String.fromCharCode(byte)
    else {
      if (current.length >= 4) found.push(current)
      current = ""
    }
  }
  if (current.length >= 4) found.push(current)
  return found
}

export function parseDwg(bytes: Uint8Array, fallback: string): Omit<Extracted, "id">[] {
  return rowsFromPlainText(latinStrings(bytes).join("\n"), fallback)
}

export function parsePdf(text: string, fallback: string): Omit<Extracted, "id">[] {
  const found: string[] = []
  const re = /\(([^)\\]{2,120})\)/g
  let match = re.exec(text)
  while (match) {
    const value = match[1].replace(/\\[()\\]/g, (item) => item.slice(1)).trim()
    if (/[A-Za-zƏəĞğİıÖöŞşÜüÇç]/.test(value)) found.push(value)
    match = re.exec(text)
  }
  if (!found.length) return [emptyExtract(fallback)]
  return found.slice(0, 30).map((name) => ({ ...emptyExtract(name), name, flags: ["qeyri-deqiq", "oxunmadi"], confirmed: false }))
}

export function scanBytes(name: string, bytes: Uint8Array) {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  if (!ALLOWED_EXT.includes(ext as (typeof ALLOWED_EXT)[number])) return { ok: false as const, ext, note: "Bu fayl növü qəbul olunmur" }
  if (!bytes.length) return { ok: false as const, ext, note: "Fayl boşdur" }
  if (bytes.length > 15_000_000) return { ok: false as const, ext, note: "Fayl 15 MB həddini aşır" }
  if (["csv", "txt", "dxf", "ifc"].includes(ext)) {
    const sample = new TextDecoder().decode(bytes.slice(0, 4000)).toLowerCase()
    if (sample.includes("<script") || sample.includes("javascript:")) return { ok: false as const, ext, note: "Faylda icra olunan məzmun görünür" }
  }
  return { ok: true as const, ext, note: "Növ və həcm yoxlanıldı" }
}

export function parseUpload(name: string, bytes: Uint8Array) {
  const scan = scanBytes(name, bytes)
  const fallback = name.replace(/\.[^.]+$/, "")
  if (!scan.ok) return { scan, rows: [] as Omit<Extracted, "id">[] }
  const text = new TextDecoder().decode(bytes)
  if (scan.ext === "csv" || scan.ext === "txt") return { scan, rows: parseCsv(text, fallback) }
  if (scan.ext === "xls" || scan.ext === "xlsx") {
    const book = XLSX.read(bytes, { type: "array" })
    const sheet = book.Sheets[book.SheetNames[0]]
    const records = sheet ? XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "", raw: false }) : []
    return { scan, rows: parseTable(records, fallback) }
  }
  if (scan.ext === "dxf") return { scan, rows: parseDxf(text, fallback) }
  if (scan.ext === "ifc") return { scan, rows: parseIfc(text, fallback) }
  if (scan.ext === "pdf") return { scan, rows: parsePdf(text, fallback) }
  if (scan.ext === "dwg" || scan.ext === "doc") return { scan, rows: parseDwg(bytes, fallback) }
  return { scan, rows: [emptyExtract(fallback)] }
}

export function nextStage(stage: Stage): Stage | null {
  const index = STAGES.findIndex((item) => item[0] === stage)
  return STAGES[index + 1]?.[0] ?? null
}

export function chargeAmount(plan: Plan, base: number) {
  const amount = num(plan.amount)
  if (amount == null) return null
  if (plan.kind === "komissiya") return base * amount / 100
  return amount
}
