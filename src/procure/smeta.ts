export const REGIONS = [
  "Bakı və Abşeron",
  "Qarabağ və Şərqi Zəngəzur",
  "Gəncə-Qazax",
  "Şəki-Zaqatala",
  "Lənkəran-Astara",
  "Aran",
  "Digər",
] as const

export type Region = (typeof REGIONS)[number]

export const REGION_FACTOR: Record<Region, number> = {
  "Bakı və Abşeron": 1,
  "Qarabağ və Şərqi Zəngəzur": 1.18,
  "Gəncə-Qazax": 0.92,
  "Şəki-Zaqatala": 0.9,
  "Lənkəran-Astara": 0.94,
  "Aran": 0.88,
  Digər: 1,
}

export const TRADES = [
  "Fəhlə",
  "Betonçu",
  "Armaturçu",
  "Qəlibçi",
  "Hörgü ustası",
  "Suvaqçı",
  "Rəngsaz",
  "Qaynaqçı",
  "Elektrik",
  "Santexnik",
  "Fasad ustası",
  "Dam örtüyü ustası",
  "Mexanizator",
  "Ekskavator operatoru",
  "Mühəndis",
  "Sahə rəisi",
  "Layihə rəhbəri",
] as const

export type Trade = (typeof TRADES)[number]
export type Complexity = "sade" | "orta" | "murakkeb"
export type PayBasis = "gun" | "ay" | "vahid"

const COMPLEXITY_FACTOR: Record<Complexity, number> = { sade: 0.9, orta: 1, murakkeb: 1.2 }

const DAILY: Record<Trade, number> = {
  "Fəhlə": 40,
  "Betonçu": 55,
  "Armaturçu": 58,
  "Qəlibçi": 52,
  "Hörgü ustası": 50,
  "Suvaqçı": 48,
  "Rəngsaz": 42,
  "Qaynaqçı": 70,
  "Elektrik": 65,
  "Santexnik": 60,
  "Fasad ustası": 62,
  "Dam örtüyü ustası": 60,
  "Mexanizator": 75,
  "Ekskavator operatoru": 80,
  "Mühəndis": 90,
  "Sahə rəisi": 100,
  "Layihə rəhbəri": 140,
}

const UNIT_RATE: Record<Trade, number> = {
  "Fəhlə": 8,
  "Betonçu": 38,
  "Armaturçu": 210,
  "Qəlibçi": 18,
  "Hörgü ustası": 48,
  "Suvaqçı": 4.2,
  "Rəngsaz": 2.4,
  "Qaynaqçı": 12,
  "Elektrik": 6,
  "Santexnik": 6,
  "Fasad ustası": 32,
  "Dam örtüyü ustası": 16,
  "Mexanizator": 14,
  "Ekskavator operatoru": 18,
  "Mühəndis": 0,
  "Sahə rəisi": 0,
  "Layihə rəhbəri": 0,
}

const TRADE_WORD: [string, Trade][] = [
  ["ekskavator", "Ekskavator operatoru"],
  ["beton", "Betonçu"],
  ["armatur", "Armaturçu"],
  ["qəlib", "Qəlibçi"],
  ["qelib", "Qəlibçi"],
  ["hörgü", "Hörgü ustası"],
  ["horgu", "Hörgü ustası"],
  ["kərpic", "Hörgü ustası"],
  ["kerpic", "Hörgü ustası"],
  ["suvaq", "Suvaqçı"],
  ["boya", "Rəngsaz"],
  ["rəng", "Rəngsaz"],
  ["reng", "Rəngsaz"],
  ["qaynaq", "Qaynaqçı"],
  ["kabel", "Elektrik"],
  ["elektrik", "Elektrik"],
  ["rozetka", "Elektrik"],
  ["boru", "Santexnik"],
  ["hidrant", "Santexnik"],
  ["fan-coil", "Santexnik"],
  ["fasad", "Fasad ustası"],
  ["şüşə", "Fasad ustası"],
  ["suse", "Fasad ustası"],
  ["dam", "Dam örtüyü ustası"],
  ["kran", "Mexanizator"],
  ["mexanizator", "Mexanizator"],
]

export function tradeOf(name: string): Trade | null {
  const hay = name.toLocaleLowerCase("az")
  for (const [word, trade] of TRADE_WORD) {
    if (hay.includes(word)) return trade
  }
  const exact = TRADES.find((trade) => trade.toLocaleLowerCase("az") === hay)
  return exact ?? null
}

export function laborQuote(name: string, region: string, complexity: Complexity, basis: PayBasis) {
  const trade = TRADES.includes(name as Trade) ? (name as Trade) : tradeOf(name)
  if (!trade) return null
  const place = (REGIONS as readonly string[]).includes(region) ? (region as Region) : "Bakı və Abşeron"
  const base = basis === "vahid" ? UNIT_RATE[trade] : DAILY[trade]
  if (!base) return null
  const days = basis === "ay" ? 22 : 1
  const amount = base * days * REGION_FACTOR[place] * COMPLEXITY_FACTOR[complexity]
  return { trade, region: place, basis, amount: Math.round(amount * 100) / 100 }
}

export const MATERIALS = ["Beton", "Armatur", "Sement", "Boya", "Şüşə", "Alüminium", "Fasad"] as const

const MATERIAL_BASE: Record<(typeof MATERIALS)[number], { price: number; unit: string }> = {
  Beton: { price: 145, unit: "m3" },
  Armatur: { price: 1280, unit: "tn" },
  Sement: { price: 210, unit: "tn" },
  Boya: { price: 3.8, unit: "m2" },
  "Şüşə": { price: 46, unit: "m2" },
  "Alüminium": { price: 12, unit: "kq" },
  Fasad: { price: 78, unit: "m2" },
}

const MATERIAL_WORD: [string, (typeof MATERIALS)[number]][] = [
  ["alüminium", "Alüminium"],
  ["aluminium", "Alüminium"],
  ["alum", "Alüminium"],
  ["şüşə", "Şüşə"],
  ["suse", "Şüşə"],
  ["fasad", "Fasad"],
  ["boya", "Boya"],
  ["sement", "Sement"],
  ["armatur", "Armatur"],
  ["beton", "Beton"],
]

export function materialOf(name: string) {
  const hay = name.toLocaleLowerCase("az")
  for (const [word, material] of MATERIAL_WORD) {
    if (hay.includes(word)) return material
  }
  return null
}

export function regionMaterial(name: string, region: string) {
  const material = (MATERIALS as readonly string[]).includes(name) ? (name as (typeof MATERIALS)[number]) : materialOf(name)
  if (!material) return null
  const place = (REGIONS as readonly string[]).includes(region) ? (region as Region) : "Bakı və Abşeron"
  const base = MATERIAL_BASE[material]
  return {
    material,
    region: place,
    unit: base.unit,
    price: Math.round(base.price * REGION_FACTOR[place] * 100) / 100,
  }
}

export function regionMap() {
  return MATERIALS.map((material) => ({
    material,
    unit: MATERIAL_BASE[material].unit,
    cells: REGIONS.map((region) => ({ region, price: regionMaterial(material, region)?.price ?? 0 })),
  }))
}

export const GEAR_KINDS = ["Ekskavator", "Buldozer", "Avtokran", "Avtobetonqarışdıran", "Beton nasosu", "Yük maşını", "Damper", "Avtokar", "Katok", "Qaldırıcı platforma", "Generator", "Qüllə kranı"] as const

export type GearBasis = "saat" | "novbe" | "gun" | "ay" | "hecm"

export type GearInput = {
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

export function gearCost(row: GearInput) {
  const count = Number(row.count) || 0
  const insurance = Number(row.insurance) || 0
  const rate = Number(row.rate) || 0
  const span = Number(row.span) || 0
  const minSpan = Number(row.minSpan) || 0
  const used = Math.max(span, minSpan)
  const fuel = Number(row.fuel) || 0
  const operator = Number(row.operator) || 0
  const running = count * used * (rate + fuel + operator)
  return { running, insurance, total: running + insurance, used }
}

export const COST_KEYS = [
  "material",
  "komekci",
  "iscilik",
  "texnika",
  "neqliyyat",
  "yukleme",
  "tullanti",
  "sahe",
  "muveqqeti",
  "inzibati",
  "vergi",
  "risk",
  "menfeet",
] as const

export type CostKey = (typeof COST_KEYS)[number]

export const COST_LABEL: Record<CostKey, string> = {
  material: "Əsas materiallar",
  komekci: "Köməkçi materiallar",
  iscilik: "İşçilik",
  texnika: "Texnika və mexanizmlər",
  neqliyyat: "Nəqliyyat və logistika",
  yukleme: "Yükləmə və boşaltma",
  tullanti: "Tullantı və itki",
  sahe: "Sahənin təşkili",
  muveqqeti: "Müvəqqəti tikili və təhlükəsizlik",
  inzibati: "İnzibati və ümumi xərclər",
  vergi: "Vergi",
  risk: "Risk ehtiyatı",
  menfeet: "Planlaşdırılmış mənfəət",
}

export const METHODS = [
  ["tam", "Tam smeta"],
  ["podrat", "Podrat"],
  ["material", "Yalnız material"],
  ["iscilik", "Yalnız işçilik"],
] as const

export type Method = (typeof METHODS)[number][0]

const METHOD_ON: Record<Method, CostKey[]> = {
  tam: [...COST_KEYS],
  podrat: [...COST_KEYS],
  material: ["material", "komekci", "neqliyyat", "yukleme", "tullanti", "vergi"],
  iscilik: ["iscilik", "texnika", "sahe", "muveqqeti", "inzibati", "risk", "menfeet", "vergi"],
}

const EXTRA_KEY: Record<string, CostKey> = {
  "Köməkçi material": "komekci",
  "Nəqliyyat": "neqliyyat",
  "Yükləmə və boşaltma": "yukleme",
  "Tullantı norması": "tullanti",
  "Sahənin təşkili": "sahe",
  "Risk ehtiyatı": "risk",
}

const DEFAULT_PERCENT: Partial<Record<CostKey, number>> = {
  komekci: 3,
  neqliyyat: 2,
  yukleme: 1,
  tullanti: 2,
  sahe: 1.5,
  muveqqeti: 1,
  inzibati: 4,
  risk: 3,
}

export type CostRule = { key: CostKey; on: boolean; mode: "faiz" | "mebleg"; value: string }

export function seedRules(input: {
  method?: Method
  extras?: { name: string; amount: string }[]
  indirect?: { amount: string }[]
  overhead?: { amount: string }[]
}): CostRule[] {
  const method = input.method ?? "tam"
  const open = new Set(METHOD_ON[method])
  const fixed = new Map<CostKey, number>()
  for (const row of input.extras ?? []) {
    const key = EXTRA_KEY[row.name]
    const amount = Number(row.amount) || 0
    if (key && amount) fixed.set(key, (fixed.get(key) ?? 0) + amount)
  }
  const indirect = (input.indirect ?? []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  const overhead = (input.overhead ?? []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  if (indirect) fixed.set("muveqqeti", indirect)
  if (overhead) fixed.set("inzibati", overhead)
  return COST_KEYS.map((key) => {
    const amount = fixed.get(key)
    if (amount) return { key, on: open.has(key), mode: "mebleg" as const, value: String(amount) }
    return { key, on: open.has(key), mode: "faiz" as const, value: String(DEFAULT_PERCENT[key] ?? 0) }
  })
}

export function rulesForMethod(rules: CostRule[], method: Method): CostRule[] {
  const open = new Set(METHOD_ON[method])
  return rules.map((rule) => ({ ...rule, on: open.has(rule.key) }))
}

export function liveRules(input: {
  method?: Method
  extras?: { name: string; amount: string }[]
  indirect?: { amount: string }[]
  overhead?: { amount: string }[]
  rules?: CostRule[]
}): CostRule[] {
  const seeded = seedRules(input)
  if (!input.rules?.length) return seeded
  return seeded.map((rule) => {
    const kept = input.rules?.find((item) => item.key === rule.key)
    return kept ? { ...rule, on: kept.on } : rule
  })
}

type BreakdownLine = {
  qty: string
  material: string
  labor: string
  laborOnly?: boolean
  confirmed?: boolean
  stale?: boolean
}

export type BreakdownInput = {
  lines: BreakdownLine[]
  rules: CostRule[]
  gear: GearInput[]
  profit: string
  vat: string
}

export type CostPart = { key: CostKey; name: string; on: boolean; amount: number }

export function costBreakdown(input: BreakdownInput): CostPart[] {
  let material = 0
  let labor = 0
  for (const line of input.lines) {
    if (line.confirmed === false || line.stale) continue
    const qty = Number(line.qty) || 0
    if (!line.laborOnly) material += (Number(line.material) || 0) * qty
    labor += (Number(line.labor) || 0) * qty
  }
  const rule = (key: CostKey) => input.rules.find((item) => item.key === key)
  const on = (key: CostKey) => rule(key)?.on !== false
  const measured = (on("material") ? material : 0) + (on("iscilik") ? labor : 0)
  const gear = input.gear.reduce((sum, row) => sum + gearCost(row).total, 0)
  function middle(key: CostKey) {
    if (key === "texnika") return gear
    const item = rule(key)
    if (!item) return 0
    if (item.mode === "mebleg") return Number(item.value) || 0
    return measured * ((Number(item.value) || 0) / 100)
  }
  const middleKeys: CostKey[] = ["komekci", "texnika", "neqliyyat", "yukleme", "tullanti", "sahe", "muveqqeti", "inzibati", "risk"]
  const base = measured + middleKeys.reduce((sum, key) => sum + (on(key) ? middle(key) : 0), 0)
  const profit = on("menfeet") ? base * ((Number(input.profit) || 0) / 100) : 0
  const vat = on("vergi") ? (base + profit) * ((Number(input.vat) || 0) / 100) : 0
  const amounts: Record<CostKey, number> = {
    material,
    komekci: middle("komekci"),
    iscilik: labor,
    texnika: gear,
    neqliyyat: middle("neqliyyat"),
    yukleme: middle("yukleme"),
    tullanti: middle("tullanti"),
    sahe: middle("sahe"),
    muveqqeti: middle("muveqqeti"),
    inzibati: middle("inzibati"),
    vergi: vat,
    risk: middle("risk"),
    menfeet: profit,
  }
  return COST_KEYS.map((key) => ({ key, name: COST_LABEL[key], on: on(key), amount: amounts[key] }))
}
