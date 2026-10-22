import {
  assets as seedAssets,
  clients,
  deals,
  expenses,
  invoices,
  journal,
  leads,
  materials as seedMaterials,
  movements,
  people,
  plants,
  projects as seedProjects,
  purchaseOrders as seedOrders,
  suppliers,
  workOrders,
} from "../data"
import type {
  Act,
  AppState,
  Asset,
  Driver,
  FleetDoc,
  FuelFill,
  Trip,
  Building,
  Complex,
  Buyer,
  Contract,
  Location,
  Project,
  Recipe,
  SaleContract,
  Smeta,
  Stock,
  SubCompany,
  Unit,
  User,
} from "./types"
import { hrmRecords } from "./hrm"
import { approveAct, approveForma3, createAct, createForma3, saveReport, smetaProgress } from "./ops"
import { buildSalmanogluBundle } from "./salmanogluSeed"

const PHASES: {
  code: string
  name: string
  unit: string
  share: number
  price: number
  bias: number
  laborHours: number
  recipe?: string
}[] = [
  { code: "01", name: "Torpaq işləri", unit: "m³", share: 0.08, price: 28, bias: 1.4, laborHours: 0.2 },
  { code: "02", name: "Karkas betonu", unit: "m³", share: 0.34, price: 110, bias: 1.15, laborHours: 1.1, recipe: "b25" },
  { code: "03", name: "Armatur", unit: "ton", share: 0.22, price: 1200, bias: 1.05, laborHours: 6, recipe: "armatur" },
  { code: "04", name: "Fasad", unit: "m²", share: 0.22, price: 86, bias: 1, laborHours: 0.55 },
  { code: "05", name: "Tamamlama", unit: "m²", share: 0.14, price: 55, bias: 0.4, laborHours: 0.7 },
]

const RATES: Record<string, number> = { Kran: 120, Ekskavator: 85, Beton: 70, Nəqliyyat: 45, Anbar: 25 }
const FUEL: Record<string, number> = { Kran: 8, Ekskavator: 14, Beton: 6, Nəqliyyat: 11, Anbar: 3 }

const PO_MATERIAL: Record<string, string> = {
  "PO-318": "MAT-SEM",
  "PO-321": "MAT-KAB",
  "PO-310": "MAT-ARM",
  "PO-324": "MAT-CIR",
}

export const users: User[] = [
  { id: "U-01", name: "Elvin Məmmədov", role: "director", title: "Əməliyyat direktoru", initials: "EM" },
  { id: "U-02", name: "Nigar Əliyeva", role: "pm", title: "Layihə rəhbəri", initials: "NƏ" },
  { id: "U-03", name: "Rauf Hüseynov", role: "site", title: "Sahə mühəndisi", initials: "RH" },
  { id: "U-04", name: "Kamran Əliyev", role: "warehouse", title: "Anbar müdiri", initials: "KƏ" },
  { id: "U-05", name: "Səbinə Əhmədova", role: "procurement", title: "Təchizatçı", initials: "SƏ" },
  { id: "U-06", name: "Günel Rzayeva", role: "accountant", title: "Mühasib", initials: "GR" },
  { id: "U-07", name: "Aysel Həsənova", role: "sales", title: "Satış rəhbəri", initials: "AH" },
]

export const recipes: Recipe[] = [
  {
    id: "b25",
    product: "B25 beton",
    unit: "m³",
    plantId: "beton",
    items: [
      { materialId: "MAT-SEM", qty: 0.32 },
      { materialId: "MAT-QUM", qty: 0.55 },
      { materialId: "MAT-CIR", qty: 0.85 },
    ],
  },
  {
    id: "b30",
    product: "B30 beton",
    unit: "m³",
    plantId: "beton",
    items: [
      { materialId: "MAT-SEM", qty: 0.38 },
      { materialId: "MAT-QUM", qty: 0.5 },
      { materialId: "MAT-CIR", qty: 0.9 },
    ],
  },
  {
    id: "armatur",
    product: "Ø16 karkas",
    unit: "ton",
    plantId: "armatur",
    items: [{ materialId: "MAT-ARM", qty: 1 }],
  },
  {
    id: "sebet",
    product: "Bünövrə səbəti",
    unit: "ton",
    plantId: "armatur",
    items: [{ materialId: "MAT-ARM", qty: 1 }],
  },
  {
    id: "panel",
    product: "Fasad paneli FP-12",
    unit: "ədəd",
    plantId: "panel",
    items: [{ materialId: "MAT-BOY", qty: 0.4 }],
  },
  {
    id: "divar",
    product: "Divar paneli DP-4",
    unit: "ədəd",
    plantId: "panel",
    items: [{ materialId: "MAT-BOY", qty: 0.35 }],
  },
]

function buildSmeta(project: Project): Smeta {
  let used = 0
  const lines = PHASES.map((phase, index) => {
    const last = index === PHASES.length - 1
    const target = last ? project.budget - used : Math.round(project.budget * phase.share)
    const qty = Math.max(1, Math.round(target / phase.price))
    const unitPrice = Math.max(1, Math.round(target / qty))
    used += qty * unitPrice
    const doneFactor = Math.min(1, (project.progress / 100) * phase.bias)
    const doneQty = Math.round(qty * doneFactor * 10) / 10
    return {
      id: `SL-${project.id}-${phase.code}`,
      code: phase.code,
      name: phase.name,
      unit: phase.unit,
      qty,
      unitPrice,
      doneQty,
      billedQty: Math.round(doneQty * 0.9 * 10) / 10,
      laborHours: phase.laborHours,
      recipe: phase.recipe || "",
      kind: "work" as const,
      houseNo: "",
      section: "",
    }
  })
  return {
    id: `SM-${project.id}`,
    projectId: project.id,
    version: 1,
    status: "razilasma",
    lines,
  }
}

function contractFor(project: Project, smeta: Smeta): Contract {
  const value = smeta.lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0)
  return {
    id: `MQ-${project.id.slice(4)}`,
    projectId: project.id,
    client: project.client,
    number: `MQ-${project.id.slice(4)}/26`,
    signed: project.start,
    value,
    advancePct: 20,
    retentionPct: 5,
    vat: 0.18,
    schedule: [
      { id: "1", title: "Avans", due: project.start, share: 0.2, status: "odenilib" },
      { id: "2", title: "Aralıq akt", due: "2026-09-30", share: 0.45, status: project.progress > 40 ? "gonderilib" : "gozleyir" },
      { id: "3", title: "Təhvil", due: project.end, share: 0.35, status: "gozleyir" },
    ],
  }
}

function archiveAct(project: Project, smeta: Smeta): Act | null {
  const lines = smeta.lines
    .filter((line) => line.billedQty > 0)
    .map((line) => ({
      smetaLineId: line.id,
      code: line.code,
      name: line.name,
      unit: line.unit,
      unitPrice: line.unitPrice,
      qty: line.billedQty,
      cumulativeQty: line.billedQty,
    }))
  if (!lines.length) return null
  const net = Math.round(lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0))
  const vat = Math.round(net * 0.18)
  return {
    id: `AKT-${project.id.slice(4)}`,
    number: `F2-${project.id.slice(4)}-202608-01`,
    projectId: project.id,
    project: project.name,
    client: project.client,
    contractNumber: `MQ-${project.id.slice(4)}/26`,
    period: "2026-08",
    date: "2026-08-31",
    lines,
    net,
    vat,
    gross: net + vat,
    status: "faktura",
    invoiceId: "",
  }
}

const FLEET: Record<string, Partial<Asset>> = {
  "AST-014": { plate: "10-CK-014", year: 2018, driverId: "DRV-004" },
  "AST-021": { plate: "90-BJ-021", year: 2021, driverId: "DRV-003" },
  "AST-033": { plate: "10-BN-033", year: 2017 },
  "AST-040": { plate: "90-AA-040", year: 2016, meter: "km", odometer: 186400, driverId: "DRV-002" },
  "AST-044": { plate: "10-AN-044", year: 2020 },
  "AST-051": { plate: "99-ZX-051", year: 2022, ownership: "icare" },
  "AST-058": { plate: "10-BM-058", year: 2019, meter: "km", odometer: 98420, driverId: "DRV-001" },
  "AST-062": { plate: "90-BL-062", year: 2023, nextService: "2026-09-20" },
  "AST-070": { year: 2015 },
  "AST-071": { year: 2016 },
}

const drivers: Driver[] = [
  { id: "DRV-001", name: "Ramin Qasımov", phone: "+994 50 611 20 14", license: "AA 102938", category: "C", expires: "2027-04-12", status: "aktiv" },
  { id: "DRV-002", name: "Orxan Bayramov", phone: "+994 55 220 18 40", license: "AA 220184", category: "CE", expires: "2026-11-02", status: "aktiv" },
  { id: "DRV-003", name: "Tofiq Nəsirov", phone: "+994 70 441 09 16", license: "AA 441091", category: "C", expires: "2027-01-20", status: "aktiv" },
  { id: "DRV-004", name: "Aydın Kərimov", phone: "+994 50 318 77 02", license: "AA 318770", category: "C", expires: "2027-06-01", status: "aktiv" },
  { id: "DRV-005", name: "Fuad Əlizadə", phone: "+994 51 909 33 21", license: "BA 090121", category: "B", expires: "2026-09-01", status: "aktiv" },
  { id: "DRV-006", name: "Cavid İsmayılov", phone: "+994 55 616 44 80", license: "AA 616448", category: "C", expires: "2028-02-11", status: "mezuniyyet" },
]

const trips: Trip[] = [
  { id: "TRP-014", assetId: "AST-058", driverId: "DRV-001", project: "Port Baku Residence", from: "Beton zavodu", to: "Port Baku Residence", cargo: "B25 beton, 8 m³", km: 18, date: "2026-09-23", status: "yolda", note: "7-ci mərtəbə" },
  { id: "TRP-011", assetId: "AST-040", driverId: "DRV-002", project: "Sumqayıt Lojistik Park", from: "Mərkəzi anbar", to: "Sumqayıt Lojistik Park", cargo: "Çınqıl 5–20", km: 46, date: "2026-09-21", status: "catdi", note: "" },
  { id: "TRP-009", assetId: "AST-021", driverId: "DRV-003", project: "Sumqayıt Lojistik Park", from: "Sumqayıt Lojistik Park", to: "Xırdalan Məktəb Kompleksi", cargo: "Texnikanın köçürülməsi", km: 28, date: "2026-09-24", status: "plan", note: "Sabah səhər" },
]

const fuels: FuelFill[] = [
  { id: "YNC-003", assetId: "AST-058", liters: 180, reading: 98200, amount: 207, project: "Port Baku Residence", date: "2026-09-22", by: "Ramin Qasımov", note: "Mikserin növbə dizeli" },
  { id: "YNC-002", assetId: "AST-021", liters: 140, reading: 2860, amount: 161, project: "Sumqayıt Lojistik Park", date: "2026-09-21", by: "Murad Cəfərov", note: "Ekskavator" },
  { id: "YNC-001", assetId: "AST-014", liters: 90, reading: 4120, amount: 104, project: "Port Baku Residence", date: "2026-09-20", by: "Murad Cəfərov", note: "Kran generatoru" },
]

const fleetDocs: FleetDoc[] = [
  { id: "SDN-001", assetId: "AST-014", kind: "sigorta", number: "SI-2026-014", issuer: "Paşa Sığorta", expires: "2026-12-15" },
  { id: "SDN-002", assetId: "AST-040", kind: "sigorta", number: "SI-2026-040", issuer: "Atəşgah", expires: "2026-10-01" },
  { id: "SDN-003", assetId: "AST-021", kind: "baxis", number: "TB-021-26", issuer: "Dövlət yol polisi", expires: "2026-09-18" },
  { id: "SDN-004", assetId: "AST-058", kind: "qeydiyyat", number: "10-BM-058", issuer: "DYNX", expires: "2027-03-01" },
  { id: "SDN-005", assetId: "AST-051", kind: "icaze", number: "IC-051", issuer: "Zoomlion icarə", expires: "2026-10-20" },
  { id: "SDN-006", assetId: "AST-033", kind: "baxis", number: "TB-033-26", issuer: "Servis mərkəzi", expires: "2026-09-23" },
]

function buildState(): AppState {
  const salman = buildSalmanogluBundle()
  const smetas = [...seedProjects.map(buildSmeta), salman.smeta]
  const projects = [
    ...seedProjects.map((project) => {
      const smeta = smetas.find((item) => item.projectId === project.id)
      if (!smeta) throw new Error("Smeta tapılmadı")
      return { ...project, smetaId: smeta.id, progress: smetaProgress(smeta) }
    }),
    { ...salman.project, progress: smetaProgress(salman.smeta) },
  ]
  const contracts = [
    ...projects
      .filter((project) => project.id !== salman.project.id)
      .map((project) => {
        const smeta = smetas.find((item) => item.id === project.smetaId)
        if (!smeta) throw new Error("Smeta tapılmadı")
        return contractFor(project, smeta)
      }),
    salman.contract,
  ]
  const acts = [
    ...projects
      .filter((project) => project.id !== salman.project.id)
      .flatMap((project) => {
        const smeta = smetas.find((item) => item.id === project.smetaId)
        if (!smeta) return []
        const act = archiveAct(project, smeta)
        return act ? [act] : []
      }),
    salman.act,
  ]
  const locations: Location[] = [
    { id: "LOC-MERKEZ", name: "Mərkəzi anbar", kind: "merkez" },
    { id: "LOC-ZAVOD", name: "Beton zavodu", kind: "zavod" },
    { id: "LOC-SEX", name: "Sex anbarı", kind: "sex" },
    ...projects.map((project) => ({ id: `LOC-${project.id}`, name: `${project.name} sahəsi`, kind: "sahe" as const, projectId: project.id })),
  ]
  const parked: Record<string, Record<string, number>> = {
    "MAT-SEM": { "LOC-ZAVOD": 80, "LOC-PRJ-2408": 120 },
    "MAT-ARM": { "LOC-SEX": 30, "LOC-PRJ-2414": 40 },
    "MAT-QUM": { "LOC-ZAVOD": 200 },
    "MAT-CIR": { "LOC-ZAVOD": 220 },
    "MAT-BOY": { "LOC-SEX": 80 },
    "MAT-DSL": { "LOC-PRJ-2408": 800, "LOC-ZAVOD": 400 },
  }
  const stocks: Stock[] = []
  for (const material of seedMaterials) {
    let left = material.qty
    const parts = parked[material.id] || {}
    for (const [locationId, qty] of Object.entries(parts)) {
      const take = Math.min(left, qty)
      if (take > 0) stocks.push({ materialId: material.id, locationId, qty: take })
      left -= take
    }
    if (left > 0) stocks.push({ materialId: material.id, locationId: "LOC-MERKEZ", qty: left })
  }
  const karkas = smetas.find((item) => item.projectId === "PRJ-2408")?.lines.find((line) => line.code === "02")
  if (!karkas) throw new Error("Karkas smeta sətri tapılmadı")
  return {
    users,
    currentUserId: "U-01",
    projects,
    smetas,
    contracts,
    acts,
    reports: [
      {
        id: "DR-014",
        projectId: "PRJ-2408",
        date: "2026-09-23",
        weather: "gunesli",
        note: "7-ci mərtəbədə 30 m³ B25 töküldü, kran 4 saat işlədi.",
        crew: 22,
        lines: [{ smetaLineId: karkas.id, qty: 30 }],
        machines: [{ assetId: "AST-014", hours: 4 }],
        status: "gonderilib",
        author: "Nigar Əliyeva",
      },
    ],
    locations,
    stocks,
    materials: seedMaterials.map((item) => ({ ...item })),
    movements: movements.map((item) => ({ ...item })),
    purchaseOrders: seedOrders.map((order) => ({
      ...order,
      materialId: PO_MATERIAL[order.id] || "",
      receivedQty: order.status === "qebul" ? order.qty : 0,
    })),
    purchaseActs: salman.purchaseActs,
    requests: [
      {
        id: "TLB-014",
        projectId: "PRJ-2408",
        project: "Port Baku Residence",
        materialId: "MAT-SEM",
        material: "Sement CEM II 42.5",
        qty: 120,
        unit: "ton",
        status: "gozleyir",
        author: "Nigar Əliyeva",
        date: "2026-09-23",
        text: "7-ci mərtəbənin tökülüşü üçün sement çatmır. 120 ton zavod anbarına göndərilsin.",
      },
      {
        id: "TLB-021",
        projectId: "PRJ-2391",
        project: "Sumqayıt Lojistik Park",
        materialId: "MAT-QUM",
        material: "Yuyulmuş qum",
        qty: 80,
        unit: "m³",
        status: "sifaris",
        author: "Elşən Qarayev",
        date: "2026-09-22",
        poId: "PO-324",
        text: "Döşəməaltı doldurma üçün yuyulmuş qum sifarişə yazılıb, gəliş gözlənilir.",
      },
      {
        id: "TLB-019",
        projectId: "PRJ-2414",
        project: "Xəzər Business Center",
        materialId: "MAT-CIR",
        material: "Çınqıl 5–20",
        qty: 50,
        unit: "m³",
        status: "teklif",
        author: "Elşən Qarayev",
        date: "2026-09-22",
        text: "Xəzər obyektinin bünövrə tökməsi üçün çınqıl lazımdır. Təkliflər toplanır.",
      },
      {
        id: "TLB-018",
        projectId: "PRJ-2377",
        project: "Abşeron Villa Qrupu",
        materialId: "MAT-SEM",
        material: "Sement CEM II 42.5",
        qty: 30,
        unit: "ton",
        status: "redd",
        author: "Nigar Əliyeva",
        date: "2026-09-21",
        decidedBy: "Elvin Məmmədov",
        decision: "Sahə anbarında sement kifayətdir.",
        text: "Villa fasadı üçün əlavə sement istənildi.",
      },
      {
        id: "TLB-016",
        projectId: "PRJ-2408",
        project: "Port Baku Residence",
        materialId: "MAT-QUM",
        material: "Yuyulmuş qum",
        qty: 20,
        unit: "m³",
        status: "anbar",
        author: "Elşən Qarayev",
        date: "2026-09-20",
        decidedBy: "Kamran Əliyev",
        text: "Port Baku sahəsinə 20 m³ qum anbardan köçürüldü.",
      },
      {
        id: "TLB-022",
        projectId: "PRJ-2414",
        project: "Xəzər Business Center",
        materialId: "MAT-ARM",
        material: "Armatur Ø16",
        qty: 8,
        unit: "ton",
        status: "gozleyir",
        author: "Rəşad Quliyev",
        date: "2026-09-23",
        text: "Bünövrə səbətinin ikinci zonası üçün armatur çatmır. 8 ton sex anbarına göndərilsin.",
      },
      {
        id: "TLB-015",
        projectId: "PRJ-2377",
        project: "Abşeron Villa Qrupu",
        materialId: "MAT-BOY",
        material: "Fasad boyası",
        qty: 120,
        unit: "litr",
        status: "teklif",
        author: "Vüsal Məlikov",
        date: "2026-09-22",
        text: "FP-12 panellərinin son qat boyası üçün 120 litr lazımdır. Təkliflər toplanır.",
      },
    ],
    recipes,
    orders: workOrders.map((item) => ({ ...item })),
    assets: seedAssets.map((item): Asset => ({
      ...item,
      rate: RATES[item.type] || 40,
      fuelPerHour: FUEL[item.type] || 5,
      ownership: "oz",
      fuel: "dizel",
      meter: "saat",
      odometer: item.hours,
      ...FLEET[item.id],
    })),
    drivers,
    trips,
    fuels,
    fleetDocs,
    plants: plants.map((item) => ({ ...item })),
    invoices: invoices.map((item) => ({ ...item, net: item.amount, vat: 0, actId: "" })),
    expenses: expenses.map((item) => ({ ...item })),
    documents: [
      { id: "DOC-01", projectId: "PRJ-2391", title: "Yanğın təhlükəsizliyi icazəsi", kind: "İcazə", status: "gozleyir", date: "2026-09-12" },
      { id: "DOC-02", projectId: "PRJ-2408", title: "Fasad cizgiləri, rev C", kind: "Çizgi", status: "tesdiq", date: "2026-09-18" },
      { id: "DOC-03", projectId: "PRJ-2414", title: "Əlavə iş — lift şaxtası", kind: "Əlavə iş", status: "gozleyir", date: "2026-09-21" },
    ],
    deals: deals.map((item) => ({ ...item, projectId: "" })),
    clients: clients.map((item) => ({ ...item })),
    leads: leads.map((item) => ({ ...item })),
    people: people.map((item) => ({ ...item })),
    ...hrmRecords(),
    journal: journal.map((item) => ({ ...item })),
    shipments: [
      {
        id: "TR-014",
        stops: ["LOC-ZAVOD", "LOC-MERKEZ", "LOC-SEX"],
        step: 0,
        lines: [
          { materialId: "MAT-SEM", material: "Sement CEM II 42.5", qty: 12, unit: "ton", price: 168, amount: 2016 },
          { materialId: "MAT-QUM", material: "Yuyulmuş qum", qty: 20, unit: "m³", price: 32, amount: 640 },
        ],
        date: "2026-09-23",
        by: "Elşən Qarayev",
        note: "Sex anbarına iki dayanacaqla.",
      },
      {
        id: "TR-011",
        stops: ["LOC-SEX", "LOC-PRJ-2414"],
        step: 0,
        lines: [{ materialId: "MAT-ARM", material: "Armatur Ø16", qty: 4, unit: "ton", price: 1040, amount: 4160 }],
        date: "2026-09-23",
        by: "Rəşad Quliyev",
        note: "Xəzər obyektinə armatur.",
      },
      {
        id: "TR-012",
        stops: ["LOC-SEX", "LOC-MERKEZ", "LOC-PRJ-2377"],
        step: 0,
        lines: [{ materialId: "MAT-BOY", material: "Fasad boyası", qty: 40, unit: "litr", price: 9, amount: 360 }],
        date: "2026-09-23",
        by: "Vüsal Məlikov",
        note: "Panel boyası əvvəl mərkəzi anbara, sonra villaya.",
      },
      {
        id: "TR-009",
        stops: ["LOC-ZAVOD", "LOC-PRJ-2408"],
        step: 1,
        lines: [{ materialId: "MAT-CIR", material: "Çınqıl 5–20", qty: 60, unit: "m³", price: 36, amount: 2160 }],
        date: "2026-09-23",
        by: "Elşən Qarayev",
      },
    ],
    audit: [{ id: "AUD-001", at: "2026-09-23 08:00", actor: "Sistem", role: "", action: "Əməliyyat günü açıldı", detail: "Smeta, anbar və müqavilələr yükləndi." }],
    suppliers,
    changes: [
      {
        id: "ELV-001",
        projectId: "PRJ-2414",
        title: "Lift şaxtası",
        reason: "Əlavə iş — lift şaxtası",
        status: "qaralama",
        lines: [{ name: "Lift şaxtası", unit: "m³", qty: 40, unitPrice: 180, laborHours: 1.4, recipe: "" }],
        author: "Nigar Əliyeva",
        date: "2026-09-21",
      },
    ],
    quotes: [
      { id: "TKL-001", requestId: "TLB-019", supplier: "Abşeron Qum", amount: 1680, days: 4, status: "acik" },
      { id: "TKL-002", requestId: "TLB-019", supplier: "Daşkənar Sement", amount: 1900, days: 6, status: "acik" },
    ],
    payables: [
      { id: "BRC-001", supplier: "Baku Steel Trading", poId: "PO-310", amount: 41600, status: "acik", date: "2026-09-18" },
    ],
    payrolls: [],
    closedPeriods: ["2026-08"],
    services: [],
    gear: [
      { id: "GR-001", name: "Liebherr qüllə kranı", category: "masin", place: "Port Baku Residence", qty: 1, unit: "ədəd", status: "istifade", home: "istifade", nextCheck: "2026-10-15" },
      { id: "GR-002", name: "CAT 320 ekskavator", category: "masin", place: "Sumqayıt Lojistik Park", qty: 1, unit: "ədəd", status: "gonderildi", home: "istifade", nextCheck: "2026-09-20" },
      { id: "GR-003", name: "Mercedes mikser", category: "masin", place: "Beton zavodu", qty: 1, unit: "ədəd", status: "istifade", home: "istifade", nextCheck: "2026-10-08" },
      { id: "GR-004", name: "Kamaz özüboşaldan", category: "masin", place: "Mərkəzi anbar", qty: 1, unit: "ədəd", status: "anbarda", home: "anbarda", nextCheck: "2026-11-12" },
      { id: "GR-005", name: "Beton nasosu Putzmeister", category: "avadanliq", place: "Servis mərkəzi", qty: 1, unit: "ədəd", status: "yoxlamada", home: "istifade", nextCheck: "2026-09-23" },
      { id: "GR-006", name: "Armatur əymə dəzgahı", category: "avadanliq", place: "Armatur sexi", qty: 1, unit: "ədəd", status: "istifade", home: "istifade", nextCheck: "2026-10-15" },
      { id: "GR-007", name: "Panel qəlib xətti", category: "avadanliq", place: "Panel sexi", qty: 1, unit: "ədəd", status: "istifade", home: "istifade", nextCheck: "2026-10-18" },
      { id: "GR-008", name: "Yanğınsöndürən 5 kq", category: "levazimat", place: "Port Baku Residence", qty: 12, unit: "ədəd", status: "istifade", home: "istifade", nextCheck: "2026-09-18" },
      { id: "GR-009", name: "İlkin yardım çantası", category: "levazimat", place: "Beton zavodu", qty: 6, unit: "ədəd", status: "anbarda", home: "anbarda", nextCheck: "2026-11-01" },
      { id: "GR-010", name: "Radiostansiya", category: "levazimat", place: "Xəzər Business Center", qty: 8, unit: "ədəd", status: "istifade", home: "istifade", nextCheck: "2026-12-01" },
      { id: "GR-011", name: "Kask", category: "geyim", place: "Mərkəzi anbar", qty: 40, unit: "ədəd", status: "anbarda", home: "anbarda", nextCheck: "2026-10-01" },
      { id: "GR-012", name: "İş gödəkcəsi", category: "geyim", place: "Port Baku Residence", qty: 22, unit: "ədəd", status: "istifade", home: "istifade", nextCheck: "2026-09-30" },
      { id: "GR-013", name: "Əlcək", category: "geyim", place: "Mərkəzi anbar", qty: 15, unit: "cüt", status: "kohnelmis", home: "anbarda", nextCheck: "2026-08-01" },
      { id: "GR-014", name: "İş çəkməsi", category: "geyim", place: "Abşeron Villa Qrupu", qty: 16, unit: "cüt", status: "tesdiq", home: "istifade", nextCheck: "2026-10-20" },
      { id: "GR-015", name: "Perforator", category: "alet", place: "Xəzər Business Center", qty: 1, unit: "ədəd", status: "itki", home: "istifade", nextCheck: "2026-09-12" },
      { id: "GR-016", name: "Açar dəsti", category: "alet", place: "Armatur sexi", qty: 6, unit: "dəst", status: "anbarda", home: "anbarda", nextCheck: "2026-11-20" },
      { id: "GR-017", name: "Mala", category: "alet", place: "Panel sexi", qty: 10, unit: "ədəd", status: "istifade", home: "istifade", nextCheck: "2026-10-05" },
      { id: "GR-018", name: "Çadır 3×6", category: "sair", place: "Abşeron Villa Qrupu", qty: 2, unit: "ədəd", status: "deyisme", home: "istifade", nextCheck: "2026-09-22" },
    ],
    gearEvents: [
      { id: "GV-001", gearId: "GR-002", kind: "yoxlama", note: "Hidravlikada sızıntı şübhəsi.", by: "Elşən Qarayev", date: "2026-09-22", status: "gonderildi" },
      { id: "GV-002", gearId: "GR-005", kind: "yoxlama", note: "Nasos xətti yoxlamaya göndərildi.", by: "Murad Cəfərov", date: "2026-09-22", status: "gonderildi" },
      { id: "GV-006", gearId: "GR-005", kind: "baslama", note: "Nasos xətti açıldı.", by: "Murad Cəfərov", date: "2026-09-23", status: "yoxlamada" },
      { id: "GV-007", gearId: "GR-014", kind: "tesdiq", note: "Altlıq yararlıdır, bağlanmanı gözləyir.", by: "Kamran Əliyev", date: "2026-09-23", status: "tesdiq" },
      { id: "GV-003", gearId: "GR-013", kind: "kohnelme", note: "Parça dağılmışdır.", by: "Kamran Əliyev", date: "2026-09-01", status: "kohnelmis" },
      { id: "GV-004", gearId: "GR-015", kind: "itki", note: "Obyektdə tapılmadı.", by: "Rəşad Quliyev", date: "2026-09-12", status: "itki" },
      { id: "GV-005", gearId: "GR-018", kind: "deyisme", note: "Tent cırılıb, yenisi gözlənilir.", by: "Vüsal Məlikov", date: "2026-09-22", status: "deyisme" },
    ],
    ...salesSeed(),
    ...crmSeed(),
    forma3s: [],
  }
}

function crmSeed(): Pick<AppState, "tasks" | "files" | "activities"> {
  return {
    tasks: [
      { id: "TSK-001", title: "Nərimanov təklifini göndər", kind: "teklif", status: "gedir", priority: "yuksek", owner: "Aysel Həsənova", due: "2026-09-26", client: "Mil-Muğan Development", dealId: "DL-226", leadId: "LD-088", note: "Kommersiya təklifi və smeta birlikdə gedəcək." },
      { id: "TSK-002", title: "Gəncə poliklinika zəngi", kind: "zeng", status: "acik", priority: "tecili", owner: "Aysel Həsənova", due: "2026-09-22", client: "Gəncə Səhiyyə Fondu", dealId: "", leadId: "", note: "Danışıqdan sonra qiymət aralığını təsdiqlə." },
      { id: "TSK-003", title: "Abşeron görüşü", kind: "gorus", status: "gozleyir", priority: "orta", owner: "Elvin Məmmədov", due: "2026-09-25", client: "Caspian Estates", dealId: "DL-221", leadId: "", note: "2-ci mərhələnin həcmi masada açılacaq." },
      { id: "TSK-004", title: "Baş ofis müqavilə paketi", kind: "sened", status: "acik", priority: "yuksek", owner: "Aysel Həsənova", due: "2026-09-30", client: "Xəzər Holdinq", dealId: "DL-218", leadId: "", note: "İmza üçün paket yığılır." },
      { id: "TSK-005", title: "Bilgəh ilkin qeyd", kind: "takip", status: "bitdi", priority: "asagi", owner: "Elvin Məmmədov", due: "2026-09-18", client: "Bakı Şəhər İctimai", dealId: "DL-230", leadId: "", note: "İlkin maraq qeydə alınıb." },
    ],
    files: [
      { id: "CRF-001", title: "Nərimanov kommersiya təklifi", number: "KT-226", kind: "teklif", status: "gozleyir", owner: "Aysel Həsənova", date: "2026-09-20", due: "2026-09-28", client: "Mil-Muğan Development", dealId: "DL-226", projectId: "", note: "Smeta əlavəsi gözlənilir." },
      { id: "CRF-002", title: "Baş ofis müqavilə layihəsi", number: "MQ-218", kind: "muqavile", status: "tesdiq", owner: "Aysel Həsənova", date: "2026-09-18", due: "2026-09-30", client: "Xəzər Holdinq", dealId: "DL-218", projectId: "", note: "Hüquq şöbəsi baxıb." },
      { id: "CRF-003", title: "Gəncə fasad cizgisi", number: "CZ-233", kind: "cizgi", status: "qaralama", owner: "Elvin Məmmədov", date: "2026-09-21", due: "2026-10-05", client: "Gəncə Səhiyyə Fondu", dealId: "", projectId: "", note: "Reviziya A." },
      { id: "CRF-004", title: "Abşeron niyyət məktubu", number: "MK-221", kind: "mektub", status: "gozleyir", owner: "Elvin Məmmədov", date: "2026-09-10", due: "2026-09-20", client: "Caspian Estates", dealId: "DL-221", projectId: "", note: "Cavab gecikir." },
      { id: "CRF-005", title: "Leyla Məmmədova şəxsiyyəti", number: "FIN-01", kind: "sexsiyyet", status: "tesdiq", owner: "Aysel Həsənova", date: "2026-08-12", due: "", client: "", dealId: "", projectId: "PRJ-2408", note: "Mənzil satışı üçün." },
    ],
    activities: [
      { id: "ACT-001", kind: "zeng", title: "Rəşadla təklif danışığı", at: "2026-09-23", owner: "Aysel Həsənova", client: "Xəzər Holdinq", dealId: "DL-218", leadId: "", note: "İmza həftəsi razılaşıldı." },
      { id: "ACT-002", kind: "gorus", title: "Lalə ilə 2-ci mərhələ", at: "2026-09-22", owner: "Elvin Məmmədov", client: "Caspian Estates", dealId: "DL-221", leadId: "", note: "Villa sayı 12-yə qalxdı." },
      { id: "ACT-003", kind: "email", title: "Nərimanov smetası göndərildi", at: "2026-09-21", owner: "Aysel Həsənova", client: "Mil-Muğan Development", dealId: "DL-226", leadId: "LD-088", note: "PDF və excel bir məktubda." },
      { id: "ACT-004", kind: "qeyd", title: "Şəki soyuq fürsət", at: "2026-09-19", owner: "Aysel Həsənova", client: "Şəki Turizm", dealId: "", leadId: "LD-096", note: "Büdcə hələ açılmayıb." },
    ],
  }
}

function salesSeed(): Pick<AppState, "companies" | "complexes" | "buildings" | "units" | "buyers" | "saleContracts"> {
  const companies: SubCompany[] = [
    { id: "CO-01", name: "Şəki Residence MMC", voen: "1700123451", city: "Bakı" },
    { id: "CO-02", name: "Xəzər Development MMC", voen: "1700987651", city: "Bakı" },
  ]
  const complexes: Complex[] = [
    { id: "KX-01", companyId: "CO-01", projectId: "PRJ-2408", name: "Port Baku Residence", city: "Bakı", district: "Yasamal" },
    { id: "KX-03", companyId: "CO-01", projectId: "PRJ-2377", name: "Abşeron bağları", city: "Bakı", district: "Mərdəkan" },
    { id: "KX-02", companyId: "CO-02", projectId: "PRJ-2414", name: "Xəzər Plaza", city: "Bakı", district: "Nəsimi" },
  ]
  const buildings: Building[] = [
    { id: "BL-A", companyId: "CO-01", complexId: "KX-01", projectId: "PRJ-2408", name: "Blok A", kind: "bina", floors: 18 },
    { id: "BL-B", companyId: "CO-01", complexId: "KX-01", projectId: "PRJ-2408", name: "Blok B", kind: "bina", floors: 16 },
    { id: "BL-V1", companyId: "CO-01", complexId: "KX-03", projectId: "PRJ-2377", name: "Villa 12", kind: "villa", floors: 2 },
    { id: "BL-V2", companyId: "CO-01", complexId: "KX-03", projectId: "PRJ-2377", name: "Villa 18", kind: "villa", floors: 2 },
    { id: "BL-H1", companyId: "CO-01", complexId: "KX-03", projectId: "PRJ-2377", name: "Həyət 4", kind: "heyet", floors: 1 },
    { id: "BL-H2", companyId: "CO-01", complexId: "KX-03", projectId: "PRJ-2377", name: "Həyət 9", kind: "heyet", floors: 1 },
    { id: "BL-X", companyId: "CO-02", complexId: "KX-02", projectId: "PRJ-2414", name: "Qüllə", kind: "plaza", floors: 22 },
    { id: "BL-P", companyId: "CO-02", complexId: "KX-02", projectId: "PRJ-2414", name: "Podium", kind: "plaza", floors: 6 },
  ]
  const units: Unit[] = [
    { id: "UN-A12", buildingId: "BL-A", kind: "menzil", number: "A-12", floor: 3, area: 86, price: 186000, status: "bos" },
    { id: "UN-A18", buildingId: "BL-A", kind: "menzil", number: "A-18", floor: 5, area: 112, price: 240000, status: "bron", buyerId: "BY-01" },
    { id: "UN-A21", buildingId: "BL-A", kind: "menzil", number: "A-21", floor: 7, area: 96, price: 210000, status: "muqavile", buyerId: "BY-02" },
    { id: "UN-P04", buildingId: "BL-A", kind: "parking", number: "P-04", floor: -1, area: 14, price: 18000, status: "bos" },
    { id: "UN-B02", buildingId: "BL-B", kind: "menzil", number: "B-02", floor: 1, area: 74, price: 164000, status: "satilib", buyerId: "BY-01" },
    { id: "UN-V12", buildingId: "BL-V1", kind: "menzil", number: "V-12", floor: 1, area: 220, price: 480000, status: "bos" },
    { id: "UN-V18", buildingId: "BL-V2", kind: "menzil", number: "V-18", floor: 1, area: 260, price: 560000, status: "bron", buyerId: "BY-02" },
    { id: "UN-H4", buildingId: "BL-H1", kind: "menzil", number: "H-4", floor: 1, area: 140, price: 220000, status: "bos" },
    { id: "UN-H9", buildingId: "BL-H2", kind: "menzil", number: "H-9", floor: 1, area: 160, price: 245000, status: "bos" },
    { id: "UN-X01", buildingId: "BL-X", kind: "ofis", number: "X-01", floor: 2, area: 140, price: 320000, status: "bos" },
    { id: "UN-P2", buildingId: "BL-P", kind: "ofis", number: "P-2", floor: 1, area: 86, price: 190000, status: "bos" },
  ]
  const buyers: Buyer[] = [
    { id: "BY-01", name: "Leyla Məmmədova", phone: "+994 50 410 22 18", email: "leyla@example.com" },
    { id: "BY-02", name: "Tural İsmayılov", phone: "+994 55 612 09 40", email: "tural@example.com" },
  ]
  const saleContracts: SaleContract[] = [
    {
      id: "SMQ-001",
      number: "SMQ-A-21",
      unitId: "UN-A21",
      buyerId: "BY-02",
      date: "2026-08-12",
      price: 210000,
      credit: "daxili",
      status: "aktiv",
      schedule: [
        { id: "1", title: "İlkin", due: "2026-08-12", amount: 63000, status: "odenilib", paidOn: "2026-08-12" },
        { id: "2", title: "Aralıq", due: "2027-01-01", amount: 84000, status: "gozleyir" },
        { id: "3", title: "Təhvil", due: "2027-06-01", amount: 63000, status: "gozleyir" },
      ],
    },
    {
      id: "SMQ-002",
      number: "SMQ-B-02",
      unitId: "UN-B02",
      buyerId: "BY-01",
      date: "2026-06-02",
      price: 164000,
      credit: "ipoteka",
      status: "aktiv",
      schedule: [
        { id: "1", title: "İlkin ödəniş", due: "2026-06-02", amount: 32800, status: "odenilib", paidOn: "2026-06-02" },
        { id: "2", title: "Bank ipotekası", due: "2026-07-01", amount: 131200, status: "odenilib", paidOn: "2026-07-01" },
      ],
    },
  ]
  return { companies, complexes, buildings, units, buyers, saleContracts }
}

export function createEmptyState(): AppState {
  return {
    users: [{ id: "U-01", name: "Admin", role: "director", title: "Direktor", initials: "AD" }],
    currentUserId: "U-01",
    projects: [],
    smetas: [],
    contracts: [],
    acts: [],
    reports: [],
    locations: [],
    stocks: [],
    materials: [],
    movements: [],
    shipments: [],
    purchaseOrders: [],
    purchaseActs: [],
    requests: [],
    recipes: [],
    orders: [],
    assets: [],
    drivers: [],
    trips: [],
    fuels: [],
    fleetDocs: [],
    gear: [],
    gearEvents: [],
    plants: [],
    invoices: [],
    expenses: [],
    documents: [],
    deals: [],
    clients: [],
    leads: [],
    tasks: [],
    files: [],
    activities: [],
    people: [],
    offices: [],
    departments: [],
    terminals: [],
    attendance: [],
    leaves: [],
    hrPayments: [],
    moves: [],
    journal: [],
    audit: [],
    suppliers: [],
    changes: [],
    quotes: [],
    payables: [],
    payrolls: [],
    closedPeriods: [],
    services: [],
    forma3s: [],
    companies: [],
    complexes: [],
    buildings: [],
    units: [],
    buyers: [],
    saleContracts: [],
  }
}

export function createInitialState(): AppState {
  const base = buildState()
  const opened = createForma3(base, "PRJ-2408", "araliq", { name: "Sistem", role: "director" })
  const withDraft = opened.patch ? { ...base, ...opened.patch } : base
  const doc = withDraft.forma3s[0]
  let state = withDraft
  if (doc) {
    const approved = approveForma3(withDraft, doc.id, { name: "Sistem", role: "director" })
    if (approved.patch) state = { ...withDraft, ...approved.patch }
  }
  const actor = { name: "Sistem", role: "director" as const }
  for (const projectId of ["PRJ-2391", "PRJ-2420"]) {
    const opened = createAct(state, projectId, actor)
    if (opened.patch) state = { ...state, ...opened.patch }
  }
  const villa = createForma3(state, "PRJ-2377", "araliq", actor)
  if (villa.patch) state = { ...state, ...villa.patch }
  const pending = state.acts.find((item) => item.projectId === "PRJ-2420" && item.status === "qaralama")
  if (pending) {
    const signed = approveAct(state, pending.id, actor)
    if (signed.patch) state = { ...state, ...signed.patch }
  }
  const sumqayit = state.smetas.find((item) => item.projectId === "PRJ-2391")?.lines.find((line) => line.qty - line.doneQty > 0)
  if (sumqayit) {
    const drafted = saveReport(state, {
      projectId: "PRJ-2391",
      date: "2026-09-22",
      weather: "buludlu",
      note: "Döşəməaltı doldurma davam edir.",
      lines: [{ smetaLineId: sumqayit.id, qty: 12 }],
      machines: [{ assetId: "AST-021", hours: 6 }],
      attendance: [{ personId: "HR-04", hours: 8 }],
    }, { name: "Elşən Qarayev", role: "site" })
    if (drafted.patch) state = { ...state, ...drafted.patch }
  }
  return state
}
