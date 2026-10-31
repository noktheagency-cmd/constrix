import { nextId } from "../format"
import { isAway, PLACE_STATUS, placeKindOf } from "./places"
import type {
  Act,
  Actor,
  Asset,
  AssetEdit,
  Person,
  PersonForm,
  HrPlace,
  AppState,
  ChangeForm,
  ChangeOrder,
  ClientForm,
  LeadForm,
  Contract,
  CreditKind,
  DailyReport,
  DispatchTicket,
  DocStatus,
  DocumentForm,
  NewProjectForm,
  ProjectForm,
  ProjectStatus,
  AssignForm,
  Driver,
  DriverForm,
  Expense,
  FleetDoc,
  FleetDocForm,
  Forma3,
  Forma3Kind,
  Forma3Line,
  FormulaLine,
  Gear,
  GearEvent,
  GearForm,
  GearStatus,
  Invoice,
  InvoiceForm,
  ExpenseForm,
  PayableForm,
  Location,
  LocationForm,
  LocationKind,
  Material,
  MaterialRequest,
  Movement,
  OpResult,
  Payable,
  Project,
  ProductForm,
  PurchaseOrder,
  PurchaseReceiveForm,
  Quote,
  QuoteForm,
  Recipe,
  RecipeEdit,
  RecipeItem,
  ReportForm,
  RequestForm,
  SaleContract,
  SaleScheduleRow,
  FuelFill,
  FuelForm,
  ServiceForm,
  ServiceJob,
  ShipmentForm,
  ShipmentLine,
  ShopForm,
  Smeta,
  Stock,
  StockForm,
  TransferForm,
  Trip,
  TripForm,
  VehicleForm,
  WasteForm,
  WorkOrder,
  WorkOrderForm,
} from "./types"

export const TODAY = "2026-09-23"
export const VAT = 0.18
export const LABOR_RATE = 8

export function roundQty(value: number | string) {
  return Math.round((Number(value) || 0) * 1000) / 1000
}

export function roundMoney(value: number | string) {
  return Math.round(Number(value) || 0)
}

export function smetaValue(smeta?: Smeta | null) {
  if (!smeta) return 0
  return smeta.lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0)
}

export function smetaDoneValue(smeta?: Smeta | null) {
  if (!smeta) return 0
  return smeta.lines.reduce((sum, line) => sum + Math.min(line.doneQty, line.qty) * line.unitPrice, 0)
}

export function smetaProgress(smeta?: Smeta | null) {
  const plan = smetaValue(smeta)
  if (!plan) return 0
  return Math.round((smetaDoneValue(smeta) / plan) * 100)
}

export function onHand(stocks: Stock[], materialId: string, locationId?: string) {
  return roundQty(
    stocks
      .filter((row) => row.materialId === materialId && (!locationId || row.locationId === locationId))
      .reduce((sum, row) => sum + row.qty, 0),
  )
}

export function syncMaterials(materials: Material[], stocks: Stock[]) {
  return materials.map((material) => ({
    ...material,
    qty: onHand(stocks, material.id),
  }))
}

export function audit(state: AppState, actor: Actor | undefined, action: string, detail: string) {
  return [
    {
      id: nextId("AUD", state.audit),
      at: `${TODAY} ${new Date().toTimeString().slice(0, 5)}`,
      actor: actor?.name || "Sistem",
      role: actor?.role || "",
      action,
      detail,
    },
    ...state.audit,
  ]
}

export function fail(error: string): OpResult {
  return { error }
}

export function addStock(stocks: Stock[], materialId: string, locationId: string, qty: number): Stock[] {
  const next = stocks.map((row) => ({ ...row }))
  const row = next.find((item) => item.materialId === materialId && item.locationId === locationId)
  if (row) row.qty = roundQty(row.qty + qty)
  else next.push({ materialId, locationId, qty: roundQty(qty) })
  return next.filter((item) => item.qty > 0)
}

function takeStock(stocks: Stock[], materialId: string, locationId: string, qty: number): { error?: string; stocks: Stock[] } {
  const have = onHand(stocks, materialId, locationId)
  if (have + 1e-9 < qty) return { error: "Bu anbarda kifayət qədər qalıq yoxdur.", stocks }
  return { stocks: addStock(stocks, materialId, locationId, -qty) }
}

function spend(state: Pick<AppState, "expenses" | "projects">, expense: Omit<Expense, "id" | "date">) {
  return {
    expenses: [{ ...expense, id: nextId("EXP", state.expenses), date: TODAY }, ...state.expenses],
    projects: state.projects.map((project) =>
      project.name === expense.project ? { ...project, spent: project.spent + expense.amount } : project,
    ),
  }
}

function applyProgress(projects: Project[], smetas: Smeta[]) {
  return projects.map((project) => {
    const smeta = smetas.find((item) => item.id === project.smetaId)
    if (!smeta) return project
    return { ...project, progress: smetaProgress(smeta) }
  })
}

export function issueStock(state: AppState, form: StockForm, actor: Actor): OpResult {
  const qty = roundQty(form.qty)
  if (!form.materialId || !(qty > 0)) return fail("Material və miqdar vacibdir.")
  const material = state.materials.find((item) => item.id === form.materialId)
  if (!material) return fail("Material tapılmadı.")
  const locationId = form.locationId || "LOC-MERKEZ"
  const taken = takeStock(state.stocks, material.id, locationId, qty)
  if (taken.error) return fail(taken.error)
  const project = state.projects.find((item) => item.name === form.project || item.id === form.projectId)
  const amount = roundMoney(qty * material.price)
  const place = state.locations.find((item) => item.id === locationId)?.name || ""
  const movement: Movement = {
    id: nextId("MV", state.movements),
    material: material.name,
    materialId: material.id,
    type: "mexaric",
    qty,
    unit: material.unit,
    project: project?.name || form.project || "—",
    locationId,
    smetaLineId: form.smetaLineId || "",
    date: TODAY,
    by: actor.name,
    note: form.note?.trim() || `${place || "Anbar"}: ${material.name} məxaric olundu${project ? `, ${project.name}` : ""}.`,
  }
  let expenses = state.expenses
  let projects = state.projects
  if (project && amount > 0) {
    const spent = spend({ ...state, expenses, projects }, {
      category: "Material",
      vendor: "Anbar",
      project: project.name,
      amount,
      smetaLineId: form.smetaLineId || "",
    })
    expenses = spent.expenses
    projects = spent.projects
  }
  const stocks = taken.stocks
  return {
    patch: {
      stocks,
      materials: syncMaterials(state.materials, stocks),
      movements: [movement, ...state.movements],
      expenses,
      projects,
      audit: audit(state, actor, "Anbar məxarici", `${material.name} · ${qty} ${material.unit}`),
    },
  }
}

export function receiveManual(state: AppState, form: StockForm, actor: Actor): OpResult {
  const qty = roundQty(form.qty)
  if (!form.materialId || !(qty > 0)) return fail("Material və miqdar vacibdir.")
  const material = state.materials.find((item) => item.id === form.materialId)
  if (!material) return fail("Material tapılmadı.")
  const locationId = form.locationId || "LOC-MERKEZ"
  const place = state.locations.find((item) => item.id === locationId)?.name || ""
  const stocks = addStock(state.stocks, material.id, locationId, qty)
  return {
    patch: {
      stocks,
      materials: syncMaterials(state.materials, stocks),
      movements: [
        {
          id: nextId("MV", state.movements),
          material: material.name,
          materialId: material.id,
          type: "medaxil",
          qty,
          unit: material.unit,
          project: "—",
          locationId,
          date: TODAY,
          by: actor.name,
          note: form.note?.trim() || `${place || "Anbar"}: ${material.name} qəbul olundu.`,
        },
        ...state.movements,
      ],
      audit: audit(state, actor, "Anbar mədaxili", `${material.name} · ${qty} ${material.unit}`),
    },
  }
}

export function transferStock(state: AppState, form: TransferForm, actor: Actor): OpResult {
  const qty = roundQty(form.qty)
  if (!form.materialId || !form.from || !form.to || !(qty > 0)) return fail("Anbar, material və miqdar vacibdir.")
  if (form.from === form.to) return fail("Eyni anbar seçilib.")
  const material = state.materials.find((item) => item.id === form.materialId)
  if (!material) return fail("Material tapılmadı.")
  const taken = takeStock(state.stocks, material.id, form.from, qty)
  if (taken.error) return fail(taken.error)
  const stocks = addStock(taken.stocks, material.id, form.to, qty)
  return {
    patch: {
      stocks,
      materials: syncMaterials(state.materials, stocks),
      movements: [
        {
          id: nextId("MV", state.movements),
          material: material.name,
          materialId: material.id,
          type: "transfer",
          qty,
          unit: material.unit,
          project: "—",
          locationId: form.to,
          from: form.from,
          date: TODAY,
          by: actor.name,
        },
        ...state.movements,
      ],
      audit: audit(state, actor, "Anbar köçürməsi", `${material.name} · ${qty} ${material.unit}`),
    },
  }
}

export function createShipment(state: AppState, form: ShipmentForm, actor: Actor): OpResult {
  const stops = form.stops.filter(Boolean)
  if (stops.length < 2) return fail("Marşrutda zavoddan sonra ən azı bir dayanacaq olmalıdır.")
  for (let index = 0; index < stops.length; index += 1) {
    if (!state.locations.some((item) => item.id === stops[index])) return fail("Dayanacaq tapılmadı.")
    if (index > 0 && stops[index] === stops[index - 1]) return fail("Eyni dayanacaq ardıcıl seçilib.")
  }
  if (!form.lines.length) return fail("Ən azı bir material yazın.")
  const seen = new Set<string>()
  const lines: ShipmentLine[] = []
  for (const line of form.lines) {
    const qty = roundQty(line.qty)
    const material = state.materials.find((item) => item.id === line.materialId)
    if (!material || !(qty > 0)) return fail("Hər sətirdə material və miqdar vacibdir.")
    if (seen.has(material.id)) return fail("Hər material yalnız bir dəfə yazıla bilər.")
    seen.add(material.id)
    const have = onHand(state.stocks, material.id, stops[0])
    if (have + 1e-9 < qty) return fail(`${material.name} çıxış anbarında çatmır.`)
    const price = line.price === undefined || line.price === "" ? material.price : roundMoney(line.price)
    if (price < 0) return fail("Qiymət mənfi ola bilməz.")
    lines.push({ materialId: material.id, material: material.name, qty, unit: material.unit, price, amount: roundMoney(qty * price) })
  }
  const shipment = {
    id: nextId("TR", state.shipments),
    stops,
    step: 0,
    lines,
    date: TODAY,
    by: actor.name,
    note: form.note?.trim() || undefined,
  }
  return {
    patch: {
      shipments: [shipment, ...state.shipments],
      audit: audit(state, actor, "Transfer marşrutu yazıldı", `${shipment.id} · ${lines.length} material`),
    },
  }
}

export function advanceShipment(state: AppState, shipmentId: string, actor: Actor): OpResult {
  const shipment = state.shipments.find((item) => item.id === shipmentId)
  if (!shipment) return fail("Transfer tapılmadı.")
  if (shipment.step >= shipment.stops.length - 1) return fail("Marşrut başa çatıb.")
  const from = shipment.stops[shipment.step]
  const to = shipment.stops[shipment.step + 1]
  const place = state.locations.find((item) => item.id === to)?.name || to
  const left = state.locations.find((item) => item.id === from)?.name || from
  let stocks = state.stocks
  let movements = state.movements
  for (const line of shipment.lines) {
    const taken = takeStock(stocks, line.materialId, from, line.qty)
    if (taken.error) return fail(`${line.material}: ${taken.error}`)
    stocks = addStock(taken.stocks, line.materialId, to, line.qty)
    movements = [
      {
        id: nextId("MV", movements),
        material: line.material,
        materialId: line.materialId,
        type: "transfer" as const,
        qty: line.qty,
        unit: line.unit,
        project: "—",
        locationId: to,
        from,
        date: TODAY,
        by: actor.name,
        note: shipment.note || `${line.material}: ${left} → ${place}.`,
      },
      ...movements,
    ]
  }
  return {
    patch: {
      stocks,
      materials: syncMaterials(state.materials, stocks),
      movements,
      shipments: state.shipments.map((item) => (item.id === shipmentId ? { ...item, step: item.step + 1 } : item)),
      audit: audit(state, actor, "Transfer irəlilədi", `${shipment.id} · ${place}`),
    },
  }
}

export function receivePurchase(state: AppState, form: PurchaseReceiveForm, actor: Actor): OpResult {
  const order = state.purchaseOrders.find((item) => item.id === form.poId)
  if (!order) return fail("Sifariş tapılmadı.")
  if (!order.materialId) return fail("Sifariş material kartına bağlı deyil.")
  if (order.status === "qebul") return fail("Sifariş artıq tam qəbul edilib.")
  const qty = roundQty(form.qty || order.qty - (order.receivedQty ?? 0))
  const left = roundQty(order.qty - (order.receivedQty ?? 0))
  if (!(qty > 0) || qty > left + 1e-9) return fail(`Qəbul miqdarı 0 ilə ${left} arasında olmalıdır.`)
  const material = state.materials.find((item) => item.id === order.materialId)
  if (!material) return fail("Material tapılmadı.")
  const locationId = form.locationId || "LOC-MERKEZ"
  const unitCost = order.qty ? order.amount / order.qty : material.price
  const oldQty = onHand(state.stocks, material.id)
  const price = oldQty + qty === 0 ? unitCost : (oldQty * material.price + qty * unitCost) / (oldQty + qty)
  const stocks = addStock(state.stocks, material.id, locationId, qty)
  const materials = syncMaterials(
    state.materials.map((item) => (item.id === material.id ? { ...item, price: Math.round(price * 100) / 100 } : item)),
    stocks,
  )
  const receivedQty = roundQty((order.receivedQty ?? 0) + qty)
  return {
    patch: {
      stocks,
      materials,
      purchaseOrders: state.purchaseOrders.map((item) =>
        item.id === order.id
          ? { ...item, receivedQty, status: receivedQty + 1e-9 >= item.qty ? "qebul" : "yoldadir" }
          : item,
      ),
      movements: [
        {
          id: nextId("MV", state.movements),
          material: material.name,
          materialId: material.id,
          type: "medaxil",
          qty,
          unit: material.unit,
          project: order.id,
          locationId,
          date: TODAY,
          by: actor.name,
        },
        ...state.movements,
      ],
      payables: [
        {
          id: nextId("BRC", state.payables),
          supplier: order.supplier,
          poId: order.id,
          amount: roundMoney(qty * unitCost),
          status: "acik",
          date: TODAY,
        } satisfies Payable,
        ...state.payables,
      ],
      audit: audit(state, actor, "Satınalma qəbulu", `${order.id} · ${qty} ${material.unit}`),
    },
  }
}

export function saveReport(state: AppState, form: ReportForm, actor: Actor): OpResult {
  if (!form.projectId) return fail("Layihə seçin.")
  if (form.id && state.reports.some(report => report.id === form.id && report.status === "tesdiq")) return fail("Təsdiqlənmiş gündəlik donub.")
  const project = state.projects.find(project => project.id === form.projectId)
  if (!project) return fail("Layihə tapılmadı.")
  const smeta = state.smetas.find(smeta => smeta.projectId === form.projectId)
  const rawLines = form.lines || []
  if (rawLines.some(line => !Number.isFinite(Number(line.qty)) || Number(line.qty) < 0 || !smeta?.lines.some(source => source.id === line.smetaLineId && (source.kind || "work") === "work"))) return fail("İş həcmi və layihənin smeta sətirlərini yoxlayın.")
  if (new Set(rawLines.map(line => line.smetaLineId)).size !== rawLines.length) return fail("Eyni iş sətri gündəlikdə təkrarlanır.")
  const attendance = form.attendance || []
  if (attendance.some(row => !state.people.some(person => person.id === row.personId) || !Number.isFinite(Number(row.hours)) || Number(row.hours) <= 0 || Number(row.hours) > 24) || new Set(attendance.map(row => row.personId)).size !== attendance.length) return fail("HR işçi seçimini və 0–24 saat aralığını yoxlayın.")
  if ((form.machines || []).some(row => !state.assets.some(asset => asset.id === row.assetId) || !Number.isFinite(Number(row.hours)) || Number(row.hours) <= 0 || Number(row.hours) > 24)) return fail("Texnika və moto-saatı yoxlayın.")
  if ((form.photos || []).length > 30) return fail("Bir gündəliyə ən çox 30 şəkil əlavə olunur.")
  const lines = (form.lines || []).filter((line) => Number(line.qty) > 0)
  if (!lines.length) return fail("Ən azı bir smeta sətrinə həcm yazın.")
  const report: DailyReport = {
    id: form.id || nextId("DR", state.reports),
    projectId: form.projectId,
    date: form.date || TODAY,
    weather: form.weather || "gunesli",
    note: (form.note || "").trim(),
    crew: Number(form.crew) || 0,
    lines: lines.map((line) => ({ smetaLineId: line.smetaLineId, qty: roundQty(line.qty) })),
    machines: (form.machines || [])
      .filter((row) => row.assetId && Number(row.hours) > 0)
      .map((row) => ({ assetId: row.assetId, hours: roundQty(row.hours) })),
    attendance: (form.attendance || [])
      .filter((row) => row.personId && Number(row.hours) > 0)
      .map((row) => ({ personId: row.personId, hours: roundQty(row.hours) })),
    status: form.submit ? "gonderilib" : "qaralama",
    author: actor.name,
    photos: [...new Set(form.photos || [])],
    measuredAt: "",
    measuredBy: "",
  }
  if (report.attendance?.length) report.crew = report.attendance.length
  const current = state.reports.find((item) => item.id === report.id)
  if (current?.status === "tesdiq") return fail("Təsdiqlənmiş gündəlik donub.")
  if (current && current.status !== "qaralama" && current.status !== "duzelis") {
    return fail("Bu gündəlik artıq göndərilib.")
  }
  report.author = current?.author || actor.name
  if (!form.submit && current?.status === "duzelis") report.status = "duzelis"
  return {
    patch: {
      reports: current ? state.reports.map((item) => (item.id === report.id ? report : item)) : [report, ...state.reports],
      audit: audit(state, actor, report.status === "gonderilib" ? "Gündəlik göndərildi" : "Gündəlik saxlandı", report.id),
    },
  }
}

export function submitReport(state: AppState, reportId: string, actor: Actor): OpResult {
  const report = state.reports.find((item) => item.id === reportId)
  if (!report) return fail("Gündəlik tapılmadı.")
  if (report.status !== "qaralama" && report.status !== "duzelis") return fail("Bu gündəlik artıq göndərilib.")
  return {
    patch: {
      reports: state.reports.map((item) => (item.id === reportId ? { ...item, status: "gonderilib" } : item)),
      audit: audit(state, actor, "Gündəlik göndərildi", reportId),
    },
  }
}

export function returnReport(state: AppState, reportId: string, actor: Actor): OpResult {
  const report = state.reports.find((item) => item.id === reportId)
  if (!report || report.status !== "gonderilib") return fail("Yalnız göndərilmiş gündəlik geri qaytarılır.")
  return {
    patch: {
      reports: state.reports.map((item) => (item.id === reportId ? { ...item, status: "duzelis" } : item)),
      audit: audit(state, actor, "Gündəlik geri qaytarıldı", reportId),
    },
  }
}

export function deleteReport(state: AppState, reportId: string, actor: Actor): OpResult {
  const report = state.reports.find((item) => item.id === reportId)
  if (!report) return fail("Gündəlik tapılmadı.")
  if (report.status === "tesdiq") return fail("Təsdiqlənmiş gündəlik silinmir.")
  if (report.status === "gonderilib") return fail("Əvvəl gündəliyi düzəlişə qaytarın.")
  return {
    patch: {
      reports: state.reports.filter((item) => item.id !== reportId),
      audit: audit(state, actor, "Gündəlik silindi", reportId),
    },
  }
}

export function approveReport(state: AppState, reportId: string, actor: Actor): OpResult {
  const report = state.reports.find(item => item.id === reportId)
  if (!report || report.status !== "gonderilib") return fail("Yalnız göndərilmiş gündəlik təsdiqlənir.")
  if (!["director", "pm"].includes(actor.role)) return fail("Gündəlik təsdiqi üçün rəhbər səlahiyyəti tələb olunur.")
  return { patch: { reports: state.reports.map(item => item.id === reportId ? { ...item, status: "tesdiq", measuredAt: "", measuredBy: "" } : item), audit: audit(state, actor, "Gündəlik təsdiqi", `${reportId} · ölçmə gözləyir`) } }
}

export function measureReport(state: AppState, reportId: string, actor: Actor): OpResult {
  const report = state.reports.find((item) => item.id === reportId)
  if (!report || report.status !== "tesdiq" || report.measuredAt !== "") return fail("Yalnız təsdiqlənmiş və ölçülməmiş gündəlik ölçülür.")
  if (!["director", "pm"].includes(actor.role)) return fail("Ölçmə üçün rəhbər səlahiyyəti tələb olunur.")
  const project = state.projects.find((item) => item.id === report.projectId)
  const smeta = state.smetas.find((item) => item.id === project?.smetaId)
  if (!project || !smeta) return fail("Layihənin smetası yoxdur.")

  let smetaNext = {
    ...smeta,
    lines: smeta.lines.map((line) => ({ ...line })),
  }
  let laborHours = 0
  for (const entry of report.lines) {
    const line = smetaNext.lines.find((item) => item.id === entry.smetaLineId)
    if (!line) return fail("Smeta sətri tapılmadı.")
    if (line.doneQty + entry.qty > line.qty + 1e-9) {
      return fail(`${line.name} üzrə qalıq həcm ${roundQty(line.qty - line.doneQty)} ${line.unit}-dir.`)
    }
    line.doneQty = roundQty(line.doneQty + entry.qty)
    laborHours += entry.qty * (line.laborHours || 0)
  }

  let stocks = state.stocks.map((row) => ({ ...row }))
  let assets = state.assets.map((item) => ({ ...item }))
  let movements = state.movements
  let machineCost = 0
    const site = state.locations.find((item) => item.projectId === project.id)
  for (const row of report.machines) {
    const asset = assets.find((item) => item.id === row.assetId)
    if (!asset) return fail("Texnika tapılmadı.")
    const fuel = roundQty(row.hours * (asset.fuelPerHour || 0))
    if (fuel > 0) {
      const locationId = site?.id && onHand(stocks, "MAT-DSL", site.id) >= fuel ? site.id : "LOC-MERKEZ"
      const taken = takeStock(stocks, "MAT-DSL", locationId, fuel)
      if (taken.error) return fail("Dizel qalığı moto-saatı örtmür.")
      stocks = taken.stocks
      movements = [
        {
          id: nextId("MV", movements),
          material: "Dizel",
          materialId: "MAT-DSL",
          type: "mexaric",
          qty: fuel,
          unit: "litr",
          project: project.name,
          locationId,
          date: TODAY,
          by: actor.name,
        },
        ...movements,
      ]
    }
    asset.hours = roundQty(asset.hours + row.hours)
    machineCost += roundMoney(row.hours * (asset.rate || 0))
  }

  const attended = (report.attendance || []).filter((row) => row.hours > 0)
  const laborCost = attended.length
    ? roundMoney(attended.reduce((sum, row) => sum + row.hours * LABOR_RATE, 0))
    : roundMoney(laborHours * LABOR_RATE)
  let expenses = state.expenses
  let projects = state.projects
  if (laborCost > 0) {
    const spent = spend({ ...state, expenses, projects }, { category: "Əmək haqqı", vendor: attended.length ? "Tabel" : "İşəmuzd", project: project.name, amount: laborCost })
    expenses = spent.expenses
    projects = spent.projects
  }
  if (machineCost > 0) {
    const spent = spend({ ...state, expenses, projects }, { category: "Texnika", vendor: "Daxili park", project: project.name, amount: machineCost })
    expenses = spent.expenses
    projects = spent.projects
  }

  const smetas = state.smetas.map((item) => (item.id === smetaNext.id ? smetaNext : item))
  projects = applyProgress(
    projects.map((item) => (item.id === project.id ? item : item)),
    smetas,
  )

  return {
    patch: {
      smetas,
      projects,
      stocks,
      materials: syncMaterials(state.materials, stocks),
      assets,
      movements,
      expenses,
      reports: state.reports.map((item) =>
        item.id === report.id ? { ...item, measuredAt: new Date().toISOString(), measuredBy: actor.name, laborCost, machineCost } : item,
      ),
      journal: [
        { id: nextId("QEYD", state.journal), time: new Date().toTimeString().slice(0, 5), site: project.name, text: report.note || "Gündəlik təsdiqləndi və smetaya yazıldı." },
        ...state.journal,
      ],
      audit: audit(state, actor, "Gündəlik təsdiqi", `${report.id} · ${project.name}`),
    },
  }
}

export function createAct(state: AppState, projectId: string, actor: Actor, options: { period?: string; houses?: string[] } = {}): OpResult {
  const project = state.projects.find((item) => item.id === projectId)
  const smeta = state.smetas.find((item) => item.id === project?.smetaId)
  if (!project || !smeta) return fail("Smeta tapılmadı.")
  if (state.acts.some((act) => act.projectId === projectId && act.status === "qaralama")) {
    return fail("Bu layihədə açıq Forma-2 var.")
  }
  if (options.period && !/^\d{4}-(0[1-9]|1[0-2])$/.test(options.period)) return fail("Hesabat dövrünü düzgün seçin.")
  const houses = options.houses?.length ? new Set(options.houses) : null
  const workLines = smeta.lines.filter((line) => (line.kind || "work") === "work" && (!houses || houses.has(line.houseNo || "")))
  const lines = workLines
    .map((line) => {
      const qty = roundQty(line.doneQty - line.billedQty)
      return {
        smetaLineId: line.id,
        code: line.code,
        name: line.name,
        unit: line.unit,
        unitPrice: line.unitPrice,
        qty,
        cumulativeQty: roundQty(line.billedQty + qty),
      }
    })
    .filter((line) => line.qty > 0)
  if (!lines.length) {
    const done = workLines.some((line) => line.doneQty > 0)
    const fullyBilled = done && workLines.every((line) => roundQty(line.doneQty - line.billedQty) <= 0)
    if (fullyBilled) return fail("Bu həcmlər artıq aktlaşdırılıb. Eyni həcm ikinci dəfə Forma-2-yə düşmür.")
    return fail("Forma-2 üçün təsdiqlənmiş, hələ bağlanmamış həcm yoxdur.")
  }
  const net = roundMoney(lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0))
  const vat = roundMoney(net * VAT)
  const period = options.period || TODAY.slice(0, 7)
  const contract = state.contracts.find((item) => item.projectId === projectId)
  const seq = state.acts.filter((item) => item.projectId === projectId).length + 1
  const act: Act = {
    id: nextId("AKT", state.acts),
    number: `F2-${project.id.slice(4)}-${period.replace("-", "")}-${String(seq).padStart(2, "0")}`,
    projectId,
    project: project.name,
    client: project.client,
    contractNumber: contract?.number || "",
    period,
    date: TODAY,
    lines,
    net,
    vat,
    gross: net + vat,
    status: "qaralama",
  }
  const smetas = state.smetas.map((item) => {
    if (item.id !== smeta.id) return item
    return {
      ...item,
      lines: item.lines.map((line) => {
        const used = lines.find((entry) => entry.smetaLineId === line.id)
        return used ? { ...line, billedQty: roundQty(line.billedQty + used.qty) } : line
      }),
    }
  })
  return {
    patch: {
      acts: [act, ...state.acts],
      smetas,
      audit: audit(state, actor, "Forma-2 açıldı", `${act.number} · ${project.name} · ${period}`),
    },
  }
}

export function approveAct(state: AppState, actId: string, actor: Actor): OpResult {
  const act = state.acts.find((item) => item.id === actId)
  if (!act || act.status !== "qaralama") return fail("Qaralama Forma-2 təsdiqlənir.")
  return {
    patch: {
      acts: state.acts.map((item) => (item.id === actId ? { ...item, status: "tesdiq" } : item)),
      audit: audit(state, actor, "Forma-2 təsdiqi", act.number),
    },
  }
}

export function returnAct(state: AppState, actId: string, actor: Actor): OpResult {
  const act = state.acts.find((item) => item.id === actId)
  if (!act) return fail("Forma-2 tapılmadı.")
  if (act.status === "faktura") return fail("Fakturalanmış akt geri qayıtmır.")
  if (act.status !== "tesdiq") return fail("Təsdiqlənmiş akt qaralamaya qayıdır.")
  return {
    patch: {
      acts: state.acts.map((item) => (item.id === actId ? { ...item, status: "qaralama" } : item)),
      audit: audit(state, actor, "Forma-2 qaralamaya qaytarıldı", act.number),
    },
  }
}

export function updateAct(state: AppState, actId: string, form: { smetaLineId: string; qty: number | string }[], actor: Actor): OpResult {
  const act = state.acts.find((item) => item.id === actId)
  if (!act) return fail("Forma-2 tapılmadı.")
  if (act.status !== "qaralama") return fail("Yalnız qaralama akt redaktə olunur.")
  const project = state.projects.find((item) => item.id === act.projectId)
  const smeta = state.smetas.find((item) => item.id === project?.smetaId)
  if (!project || !smeta) return fail("Smeta tapılmadı.")
  const seen = new Set<string>()
  const nextLines: Act["lines"] = []
  for (const row of form) {
    const qty = roundQty(row.qty)
    if (qty < 0) return fail("Miqdar mənfi ola bilməz.")
    const line = smeta.lines.find((item) => item.id === row.smetaLineId)
    if (!line) return fail("Smeta sətri tapılmadı.")
    if ((line.kind || "work") !== "work") return fail("Ev/bölmə sətirləri akta yazılmır.")
    if (seen.has(line.id)) return fail("Hər iş yalnız bir dəfə yazıla bilər.")
    seen.add(line.id)
    const old = act.lines.find((item) => item.smetaLineId === line.id)?.qty || 0
    const room = roundQty(line.doneQty - line.billedQty + old)
    if (qty > room + 1e-9) {
      return fail(`${line.name}: bu həcm artıq aktlaşdırılıb (ən çox ${room} ${line.unit}).`)
    }
    if (!(qty > 0)) continue
    nextLines.push({
      smetaLineId: line.id,
      code: line.code,
      name: line.name,
      unit: line.unit,
      unitPrice: line.unitPrice,
      qty,
      cumulativeQty: roundQty(line.billedQty - old + qty),
    })
  }
  if (!nextLines.length) return fail("Aktda ən azı bir iş qalmalıdır.")
  const net = roundMoney(nextLines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0))
  const vat = roundMoney(net * VAT)
  const smetas = state.smetas.map((item) => {
    if (item.id !== smeta.id) return item
    return {
      ...item,
      lines: item.lines.map((line) => {
        const old = act.lines.find((entry) => entry.smetaLineId === line.id)?.qty || 0
        const next = nextLines.find((entry) => entry.smetaLineId === line.id)?.qty || 0
        if (old === next) return line
        return { ...line, billedQty: roundQty(line.billedQty - old + next) }
      }),
    }
  })
  return {
    patch: {
      acts: state.acts.map((item) => (item.id === actId ? { ...item, lines: nextLines, net, vat, gross: net + vat } : item)),
      smetas,
      audit: audit(state, actor, "Forma-2 redaktə olundu", act.number),
    },
  }
}

export function deleteAct(state: AppState, actId: string, actor: Actor): OpResult {
  const act = state.acts.find((item) => item.id === actId)
  if (!act) return fail("Forma-2 tapılmadı.")
  if (act.status === "faktura") return fail("Fakturalanmış akt silinmir.")
  if (act.status === "tesdiq") return fail("Əvvəl aktı qaralamaya qaytarın.")
  const project = state.projects.find((item) => item.id === act.projectId)
  const smeta = state.smetas.find((item) => item.id === project?.smetaId)
  if (!smeta) return fail("Smeta tapılmadı.")
  const smetas = state.smetas.map((item) => {
    if (item.id !== smeta.id) return item
    return {
      ...item,
      lines: item.lines.map((line) => {
        const old = act.lines.find((entry) => entry.smetaLineId === line.id)?.qty || 0
        return old ? { ...line, billedQty: roundQty(line.billedQty - old) } : line
      }),
    }
  })
  return {
    patch: {
      acts: state.acts.filter((item) => item.id !== actId),
      smetas,
      audit: audit(state, actor, "Forma-2 silindi", act.number),
    },
  }
}

export function actSettlement(state: Pick<AppState, "contracts" | "invoices">, act: Act) {
  const contract = state.contracts.find((item) => item.projectId === act.projectId)
  const advancePct = contract?.advancePct ?? 0
  const retentionPct = contract?.retentionPct ?? 0
  const advancePaid = contract?.schedule.some((row) => row.title === "Avans" && row.status === "odenilib") ?? false
  const advancePool = contract ? roundMoney(contract.value * (advancePct / 100)) : 0
  const recovered = state.invoices
    .filter((item) => item.project === act.project && item.actId)
    .reduce((sum, item) => sum + (item.advance ?? 0), 0)
  const retention = roundMoney(act.net * (retentionPct / 100))
  const advance = advancePaid ? Math.min(Math.max(0, advancePool - recovered), roundMoney(act.net * (advancePct / 100))) : 0
  const net = Math.max(0, act.net - retention - advance)
  const vat = roundMoney(net * (contract?.vat ?? VAT))
  return { contract, advancePct, retentionPct, advance, retention, net, vat, payable: net + vat }
}

export function invoiceAct(state: AppState, actId: string, actor: Actor): OpResult {
  const act = state.acts.find((item) => item.id === actId)
  if (!act || act.status !== "tesdiq") return fail("Faktura yalnız təsdiqlənmiş aktdan açılır.")
  const { advance, retention, net, vat } = actSettlement(state, act)
  const invoice: Invoice = {
    id: nextId("INV", state.invoices),
    client: act.client,
    project: act.project,
    amount: net + vat,
    net,
    vat,
    advance,
    retention,
    workNet: act.net,
    actId: act.id,
    issued: TODAY,
    due: "2026-10-23",
    status: "gonderilib",
  }
  const contracts = state.contracts.map((item) => {
    if (item.projectId !== act.projectId) return item
    if (item.schedule.some((row) => row.status === "gonderilib")) return item
    let marked = false
    return {
      ...item,
      schedule: item.schedule.map((row) => {
        if (!marked && row.status === "gozleyir") {
          marked = true
          return { ...row, status: "gonderilib" as const }
        }
        return row
      }),
    }
  })
  return {
    patch: {
      invoices: [invoice, ...state.invoices],
      acts: state.acts.map((item) => (item.id === actId ? { ...item, status: "faktura", invoiceId: invoice.id } : item)),
      contracts,
      audit: audit(state, actor, "Faktura aktdan açıldı", `${invoice.id} · avans ${advance} · saxlanc ${retention}`),
    },
  }
}

function approvedActs(state: AppState, projectId: string) {
  return state.acts.filter((act) => act.projectId === projectId && (act.status === "tesdiq" || act.status === "faktura"))
}

function qtyIn(acts: Act[], lineId: string) {
  return roundQty(
    acts.reduce((sum, act) => sum + (act.lines.find((line) => line.smetaLineId === lineId)?.qty ?? 0), 0),
  )
}

export function createForma3(state: AppState, projectId: string, kind: Forma3Kind, actor: Actor): OpResult {
  const project = state.projects.find((item) => item.id === projectId)
  const smeta = state.smetas.find((item) => item.id === project?.smetaId)
  const contract = state.contracts.find((item) => item.projectId === projectId)
  if (!project || !smeta) return fail("Smeta tapılmadı.")
  const approved = approvedActs(state, projectId)
  if (!approved.length) return fail("Təsdiqlənmiş Forma-2 yoxdur.")
  const draft = state.acts.some((act) => act.projectId === projectId && act.status === "qaralama")
  const openQty = smeta.lines.some((line) => roundQty(line.qty - line.billedQty) > 0 || roundQty(line.doneQty - line.billedQty) > 0)
  if (kind === "yekun" && draft) return fail("Açıq Forma-2 qaralaması var.")
  if (kind === "yekun" && openQty) return fail("Smetada bağlanmamış həcm qalıb.")
  if (kind === "yekun" && state.forma3s.some((item) => item.projectId === projectId && item.kind === "yekun")) {
    return fail("Yekun akt artıq açılıb.")
  }
  const period = approved.reduce((max, act) => (act.period > max ? act.period : max), approved[0]?.period || TODAY.slice(0, 7))
  const same = state.forma3s.find((item) => item.projectId === projectId && item.kind === kind && item.period === period)
  if (same?.status === "qaralama") return fail("Bu dövrün açıq icmalı var.")
  if (same?.status === "tesdiq") return fail("Bu dövrün icmalı artıq təsdiqlənib.")
  const priorActs = approved.filter((act) => act.period < period)
  const periodActs = approved.filter((act) => act.period === period)
  const lines: Forma3Line[] = smeta.lines.map((line) => {
    const priorQty = qtyIn(priorActs, line.id)
    const periodQty = qtyIn(periodActs, line.id)
    const cumulativeQty = roundQty(priorQty + periodQty)
    const remainQty = roundQty(Math.max(0, line.qty - cumulativeQty))
    return {
      smetaLineId: line.id,
      code: line.code,
      name: line.name,
      unit: line.unit,
      smetaQty: line.qty,
      smetaValue: roundMoney(line.qty * line.unitPrice),
      priorQty,
      priorValue: roundMoney(priorQty * line.unitPrice),
      periodQty,
      periodValue: roundMoney(periodQty * line.unitPrice),
      cumulativeQty,
      cumulativeValue: roundMoney(cumulativeQty * line.unitPrice),
      remainQty,
      remainValue: roundMoney(remainQty * line.unitPrice),
    }
  })
  const smetaValue = roundMoney(lines.reduce((sum, line) => sum + line.smetaValue, 0))
  const priorValue = roundMoney(lines.reduce((sum, line) => sum + line.priorValue, 0))
  const periodValue = roundMoney(lines.reduce((sum, line) => sum + line.periodValue, 0))
  const cumulativeValue = roundMoney(lines.reduce((sum, line) => sum + line.cumulativeValue, 0))
  const remainValue = roundMoney(lines.reduce((sum, line) => sum + line.remainValue, 0))
  const advancePct = contract?.advancePct ?? 0
  const retentionPct = contract?.retentionPct ?? 0
  const vatRate = contract?.vat ?? VAT
  const advancePool = contract ? roundMoney(contract.value * (advancePct / 100)) : 0
  const recovered = state.invoices
    .filter((item) => item.project === project.name && item.actId)
    .reduce((sum, item) => sum + (item.advance ?? 0), 0)
  const retention = roundMoney(cumulativeValue * (retentionPct / 100))
  const advanceBalance = roundMoney(Math.max(0, advancePool - recovered))
  const vat = roundMoney(cumulativeValue * vatRate)
  const payable = roundMoney(Math.max(0, cumulativeValue + vat - recovered - retention))
  const prefix = kind === "yekun" ? "F3Y" : "F3"
  const doc: Forma3 = {
    id: nextId(prefix, state.forma3s),
    number: `${kind === "yekun" ? "F3Y" : "F3"}-${project.id.slice(4)}-${period.replace("-", "")}`,
    projectId,
    project: project.name,
    client: project.client,
    contractNumber: contract?.number || "",
    kind,
    period,
    date: TODAY,
    lines,
    smetaValue,
    priorValue,
    periodValue,
    cumulativeValue,
    remainValue,
    advanceBalance,
    retention,
    vat,
    payable,
    status: "qaralama",
  }
  return {
    patch: {
      forma3s: [doc, ...state.forma3s],
      audit: audit(state, actor, kind === "yekun" ? "Forma-3 yekun açıldı" : "Forma-3 aralıq açıldı", `${doc.number} · ${project.name}`),
    },
  }
}

export function approveForma3(state: AppState, id: string, actor: Actor): OpResult {
  const doc = state.forma3s.find((item) => item.id === id)
  if (!doc || doc.status !== "qaralama") return fail("Qaralama icmal təsdiqlənir.")
  return {
    patch: {
      forma3s: state.forma3s.map((item) => (item.id === id ? { ...item, status: "tesdiq" } : item)),
      audit: audit(state, actor, "Forma-3 təsdiqi", doc.number),
    },
  }
}

export function returnForma3(state: AppState, id: string, actor: Actor): OpResult {
  const doc = state.forma3s.find((item) => item.id === id)
  if (!doc) return fail("Forma-3 tapılmadı.")
  if (doc.status !== "tesdiq") return fail("Təsdiqlənmiş icmal qaralamaya qayıdır.")
  return {
    patch: {
      forma3s: state.forma3s.map((item) => (item.id === id ? { ...item, status: "qaralama" } : item)),
      audit: audit(state, actor, "Forma-3 qaralamaya qaytarıldı", doc.number),
    },
  }
}

export function deleteForma3(state: AppState, id: string, actor: Actor): OpResult {
  const doc = state.forma3s.find((item) => item.id === id)
  if (!doc) return fail("Forma-3 tapılmadı.")
  if (doc.status === "tesdiq") return fail("Əvvəl icmalı qaralamaya qaytarın.")
  return {
    patch: {
      forma3s: state.forma3s.filter((item) => item.id !== id),
      audit: audit(state, actor, "Forma-3 silindi", doc.number),
    },
  }
}

export function refreshForma3(state: AppState, id: string, actor: Actor): OpResult {
  const doc = state.forma3s.find((item) => item.id === id)
  if (!doc) return fail("Forma-3 tapılmadı.")
  if (doc.status !== "qaralama") return fail("Təsdiqlənmiş icmal donub.")
  const stripped = { ...state, forma3s: state.forma3s.filter((item) => item.id !== id) }
  const created = createForma3(stripped, doc.projectId, doc.kind, actor)
  const fresh = created.patch?.forma3s?.[0]
  if (created.error || !fresh) return created.error ? created : fail("Forma-3 yenilənmədi.")
  const next = { ...fresh, id: doc.id, number: doc.number, date: doc.date }
  return {
    patch: {
      forma3s: state.forma3s.map((item) => (item.id === id ? next : item)),
      audit: audit(state, actor, "Forma-3 yeniləndi", doc.number),
    },
  }
}

function saleSchedule(price: number, credit: CreditKind): SaleScheduleRow[] {
  if (credit === "nagd") {
    return [{ id: "1", title: "Tam ödəniş", due: "2026-10-01", amount: price, status: "gozleyir" }]
  }
  if (credit === "ipoteka") {
    const down = roundMoney(price * 0.2)
    return [
      { id: "1", title: "İlkin ödəniş", due: "2026-10-01", amount: down, status: "gozleyir" },
      { id: "2", title: "Bank ipotekası", due: "2026-11-01", amount: roundMoney(price - down), status: "gozleyir" },
    ]
  }
  const first = roundMoney(price * 0.3)
  const second = roundMoney(price * 0.4)
  return [
    { id: "1", title: "İlkin", due: "2026-10-01", amount: first, status: "gozleyir" },
    { id: "2", title: "Aralıq", due: "2027-01-01", amount: second, status: "gozleyir" },
    { id: "3", title: "Təhvil", due: "2027-06-01", amount: roundMoney(price - first - second), status: "gozleyir" },
  ]
}

export function reserveUnit(state: AppState, unitId: string, buyerId: string, actor: Actor): OpResult {
  const unit = state.units.find((item) => item.id === unitId)
  const buyer = state.buyers.find((item) => item.id === buyerId)
  if (!unit || !buyer) return fail("Mənzil və ya alıcı tapılmadı.")
  if (unit.status !== "bos") return fail("Bron yalnız boş vahidə yazılır.")
  return {
    patch: {
      units: state.units.map((item) => (item.id === unitId ? { ...item, status: "bron", buyerId } : item)),
      audit: audit(state, actor, "Bron", `${unit.number} · ${buyer.name}`),
    },
  }
}

export function openSale(state: AppState, unitId: string, buyerId: string, credit: CreditKind, actor: Actor): OpResult {
  const unit = state.units.find((item) => item.id === unitId)
  const buyer = state.buyers.find((item) => item.id === buyerId)
  if (!unit || !buyer) return fail("Mənzil və ya alıcı tapılmadı.")
  if (unit.status !== "bos" && unit.status !== "bron") return fail("Satış yalnız boş və ya bron vahiddən açılır.")
  if (state.saleContracts.some((item) => item.unitId === unitId && item.status === "aktiv")) {
    return fail("Bu vahidin açıq müqaviləsi var.")
  }
  const contract: SaleContract = {
    id: nextId("SMQ", state.saleContracts),
    number: `SMQ-${unit.number}`,
    unitId,
    buyerId,
    date: TODAY,
    price: unit.price,
    credit,
    status: "aktiv",
    schedule: saleSchedule(unit.price, credit),
  }
  return {
    patch: {
      saleContracts: [contract, ...state.saleContracts],
      units: state.units.map((item) => (item.id === unitId ? { ...item, status: "muqavile", buyerId } : item)),
      audit: audit(state, actor, "Satış müqaviləsi", `${contract.number} · ${buyer.name}`),
    },
  }
}

export function paySale(state: AppState, contractId: string, rowId: string, actor: Actor): OpResult {
  const contract = state.saleContracts.find((item) => item.id === contractId)
  if (!contract || contract.status !== "aktiv") return fail("Aktiv müqavilə tapılmadı.")
  const row = contract.schedule.find((item) => item.id === rowId)
  if (!row) return fail("Ödəniş sətri tapılmadı.")
  if (row.status === "odenilib") return fail("Bu ödəniş artıq yazılıb.")
  const schedule = contract.schedule.map((item) => (item.id === rowId ? { ...item, status: "odenilib" as const, paidOn: TODAY } : item))
  const settled = schedule.every((item) => item.status === "odenilib")
  return {
    patch: {
      saleContracts: state.saleContracts.map((item) => (item.id === contractId ? { ...item, schedule } : item)),
      units: settled
        ? state.units.map((item) => (item.id === contract.unitId ? { ...item, status: "satilib" } : item))
        : state.units,
      audit: audit(state, actor, "Satış ödənişi", `${contract.number} · ${row.title}`),
    },
  }
}

export function handoverSale(state: AppState, contractId: string, actor: Actor): OpResult {
  const contract = state.saleContracts.find((item) => item.id === contractId)
  if (!contract || contract.status !== "aktiv") return fail("Aktiv müqavilə tapılmadı.")
  if (contract.schedule.some((item) => item.status !== "odenilib")) return fail("Açar bütün ödənişlər bağlanandan sonra verilir.")
  return {
    patch: {
      saleContracts: state.saleContracts.map((item) => (item.id === contractId ? { ...item, status: "acar" } : item)),
      units: state.units.map((item) => (item.id === contract.unitId ? { ...item, status: "acar" } : item)),
      audit: audit(state, actor, "Açar təhvili", contract.number),
    },
  }
}

function periodClosed(state: AppState, iso: string) {
  return state.closedPeriods.includes(iso.slice(0, 7))
}

function shiftSpent(projects: AppState["projects"], project: string, delta: number) {
  if (!delta) return projects
  return projects.map((item) => (item.name === project ? { ...item, spent: roundMoney(item.spent + delta) } : item))
}

function expensePosted(expense: Expense) {
  return expense.status !== "qaralama"
}

export function createInvoice(state: AppState, form: InvoiceForm, actor: Actor): OpResult {
  if (!form.client.trim() || !form.project.trim() || !(Number(form.amount) > 0)) return fail("Sifarişçi, layihə və məbləğ vacibdir.")
  if (periodClosed(state, TODAY)) return fail("Bağlı dövrə qaimə yazılmır.")
  const amount = roundMoney(Number(form.amount))
  const invoice: Invoice = {
    id: nextId("INV", state.invoices),
    client: form.client.trim(),
    project: form.project.trim(),
    amount,
    net: amount,
    vat: 0,
    actId: "",
    issued: TODAY,
    due: form.due || "2026-10-23",
    status: "qaralama",
  }
  return {
    patch: {
      invoices: [invoice, ...state.invoices],
      audit: audit(state, actor, "Qaimə açıldı", invoice.id),
    },
  }
}

export function updateInvoice(state: AppState, id: string, form: InvoiceForm, actor: Actor): OpResult {
  const invoice = state.invoices.find((item) => item.id === id)
  if (!invoice) return fail("Qaimə tapılmadı.")
  if (invoice.actId) return fail("Forma-2 fakturası buradan redaktə olunmur.")
  if (invoice.status !== "qaralama") return fail("Yalnız qaralama qaimə redaktə olunur.")
  if (periodClosed(state, invoice.issued)) return fail("Bağlı dövrün qaiməsi redaktə olunmur.")
  if (!form.client.trim() || !form.project.trim() || !(Number(form.amount) > 0) || !form.due) return fail("Sifarişçi, layihə, məbləğ və son tarix vacibdir.")
  const amount = roundMoney(Number(form.amount))
  return {
    patch: {
      invoices: state.invoices.map((item) =>
        item.id === id ? { ...item, client: form.client.trim(), project: form.project.trim(), amount, net: amount, vat: 0, due: form.due } : item,
      ),
      audit: audit(state, actor, "Qaimə yazıldı", id),
    },
  }
}

export function deleteInvoice(state: AppState, id: string, actor: Actor): OpResult {
  const invoice = state.invoices.find((item) => item.id === id)
  if (!invoice) return fail("Qaimə tapılmadı.")
  if (invoice.actId) return fail("Forma-2 fakturası silinmir.")
  if (invoice.status !== "qaralama") return fail("Göndərilmiş qaimə silinmir.")
  if (periodClosed(state, invoice.issued)) return fail("Bağlı dövrün qaiməsi silinmir.")
  return {
    patch: {
      invoices: state.invoices.filter((item) => item.id !== id),
      audit: audit(state, actor, "Qaimə silindi", id),
    },
  }
}

export function sendInvoice(state: AppState, id: string, actor: Actor): OpResult {
  const invoice = state.invoices.find((item) => item.id === id)
  if (!invoice) return fail("Qaimə tapılmadı.")
  if (invoice.status !== "qaralama") return fail("Qaralama qaimə seçin.")
  if (periodClosed(state, invoice.issued)) return fail("Bağlı dövrün qaiməsi göndərilmir.")
  const status = invoice.due < TODAY ? "gecikir" : "gonderilib"
  return {
    patch: {
      invoices: state.invoices.map((item) => (item.id === id ? { ...item, status } : item)),
      audit: audit(state, actor, "Qaimə göndərildi", id),
    },
  }
}

export function returnInvoice(state: AppState, id: string, actor: Actor): OpResult {
  const invoice = state.invoices.find((item) => item.id === id)
  if (!invoice) return fail("Qaimə tapılmadı.")
  if (invoice.actId) return fail("Forma-2 fakturası geri alınmır.")
  if (invoice.status !== "gonderilib" && invoice.status !== "gecikir") return fail("Göndərilmiş qaimə seçin.")
  if (periodClosed(state, invoice.issued)) return fail("Bağlı dövrün qaiməsi geri alınmır.")
  return {
    patch: {
      invoices: state.invoices.map((item) => (item.id === id ? { ...item, status: "qaralama" } : item)),
      audit: audit(state, actor, "Qaimə qaralamaya qayıtdı", id),
    },
  }
}

export function saveExpense(state: AppState, form: ExpenseForm, actor: Actor): OpResult {
  const amount = roundMoney(Number(form.amount))
  if (!form.category.trim() || !form.vendor.trim() || !form.project.trim() || !(amount > 0) || !form.date) {
    return fail("Kateqoriya, tərəf, layihə, məbləğ və tarix vacibdir.")
  }
  const existing = form.id ? state.expenses.find((item) => item.id === form.id) : undefined
  if (form.id && !existing) return fail("Xərc tapılmadı.")
  if (existing?.smetaLineId) return fail("Sahə təsdiqindən düşən xərc redaktə olunmur.")
  if (existing && periodClosed(state, existing.date)) return fail("Bağlı dövrün xərci redaktə olunmur.")
  if (periodClosed(state, form.date)) return fail("Bağlı dövrə xərc yazılmır.")
  const row: Expense = {
    id: existing?.id || nextId("EXP", state.expenses),
    category: form.category.trim(),
    vendor: form.vendor.trim(),
    project: form.project.trim(),
    amount,
    date: form.date,
    status: existing?.status ?? "qaralama",
    smetaLineId: existing?.smetaLineId,
  }
  let projects = state.projects
  if (existing && expensePosted(existing)) {
    projects = shiftSpent(projects, existing.project, -existing.amount)
    projects = shiftSpent(projects, row.project, row.amount)
  }
  return {
    patch: {
      expenses: existing ? state.expenses.map((item) => (item.id === row.id ? row : item)) : [row, ...state.expenses],
      projects,
      audit: audit(state, actor, existing ? "Xərc yazıldı" : "Xərc qaralaması açıldı", row.id),
    },
  }
}

export function confirmExpense(state: AppState, id: string, actor: Actor): OpResult {
  const expense = state.expenses.find((item) => item.id === id)
  if (!expense || expense.status !== "qaralama") return fail("Qaralama xərc seçin.")
  if (periodClosed(state, expense.date)) return fail("Bağlı dövrün xərci təsdiqlənmir.")
  return {
    patch: {
      expenses: state.expenses.map((item) => (item.id === id ? { ...item, status: "tesdiq" } : item)),
      projects: shiftSpent(state.projects, expense.project, expense.amount),
      audit: audit(state, actor, "Xərc təsdiqləndi", id),
    },
  }
}

export function returnExpense(state: AppState, id: string, actor: Actor): OpResult {
  const expense = state.expenses.find((item) => item.id === id)
  if (!expense || !expensePosted(expense)) return fail("Təsdiqli xərc seçin.")
  if (expense.smetaLineId) return fail("Sahə təsdiqindən düşən xərc geri alınmır.")
  if (periodClosed(state, expense.date)) return fail("Bağlı dövrün xərci geri alınmır.")
  return {
    patch: {
      expenses: state.expenses.map((item) => (item.id === id ? { ...item, status: "qaralama" } : item)),
      projects: shiftSpent(state.projects, expense.project, -expense.amount),
      audit: audit(state, actor, "Xərc qaralamaya qayıtdı", id),
    },
  }
}

export function deleteExpense(state: AppState, id: string, actor: Actor): OpResult {
  const expense = state.expenses.find((item) => item.id === id)
  if (!expense) return fail("Xərc tapılmadı.")
  if (expense.smetaLineId) return fail("Sahə təsdiqindən düşən xərc silinmir.")
  if (periodClosed(state, expense.date)) return fail("Bağlı dövrün xərci silinmir.")
  return {
    patch: {
      expenses: state.expenses.filter((item) => item.id !== id),
      projects: expensePosted(expense) ? shiftSpent(state.projects, expense.project, -expense.amount) : state.projects,
      audit: audit(state, actor, "Xərc silindi", id),
    },
  }
}

export function updatePayable(state: AppState, id: string, form: PayableForm, actor: Actor): OpResult {
  const row = state.payables.find((item) => item.id === id)
  if (!row) return fail("Borc tapılmadı.")
  if (row.status !== "acik") return fail("Ödənmiş borc redaktə olunmur.")
  if (periodClosed(state, row.date) || periodClosed(state, form.date)) return fail("Bağlı dövrün borcu redaktə olunmur.")
  const amount = roundMoney(Number(form.amount))
  if (!form.supplier.trim() || !(amount > 0) || !form.date) return fail("Təchizatçı, məbləğ və tarix vacibdir.")
  return {
    patch: {
      payables: state.payables.map((item) => (item.id === id ? { ...item, supplier: form.supplier.trim(), amount, date: form.date } : item)),
      audit: audit(state, actor, "Təchizat borcu yazıldı", id),
    },
  }
}

export function deletePayable(state: AppState, id: string, actor: Actor): OpResult {
  const row = state.payables.find((item) => item.id === id)
  if (!row) return fail("Borc tapılmadı.")
  if (row.status !== "acik") return fail("Ödənmiş borc silinmir.")
  if (periodClosed(state, row.date)) return fail("Bağlı dövrün borcu silinmir.")
  return {
    patch: {
      payables: state.payables.filter((item) => item.id !== id),
      audit: audit(state, actor, "Təchizat borcu silindi", id),
    },
  }
}

export function payPayroll(state: AppState, id: string, actor: Actor): OpResult {
  const row = state.payrolls.find((item) => item.id === id)
  if (!row || row.status !== "acik") return fail("Açıq əmək haqqı cədvəli seçin.")
  if (periodClosed(state, row.date)) return fail("Bağlı dövrün əmək haqqı ödənilmir.")
  return {
    patch: {
      payrolls: state.payrolls.map((item) => (item.id === id ? { ...item, status: "odenilib" } : item)),
      audit: audit(state, actor, "Əmək haqqı ödənildi", id),
    },
  }
}

export function deletePayroll(state: AppState, id: string, actor: Actor): OpResult {
  const row = state.payrolls.find((item) => item.id === id)
  if (!row) return fail("Cədvəl tapılmadı.")
  if (row.status !== "acik") return fail("Ödənmiş cədvəl silinmir.")
  if (periodClosed(state, row.date)) return fail("Bağlı dövrün cədvəli silinmir.")
  return {
    patch: {
      payrolls: state.payrolls.filter((item) => item.id !== id),
      reports: state.reports.map((item) => (item.payrollId === id ? { ...item, payrollId: undefined } : item)),
      audit: audit(state, actor, "Əmək haqqı cədvəli silindi", id),
    },
  }
}

export function closePeriod(state: AppState, month: string, actor: Actor): OpResult {
  if (!/^\d{4}-\d{2}$/.test(month)) return fail("Dövr seçin.")
  if (state.closedPeriods.includes(month)) return fail("Dövr artıq bağlıdır.")
  if (month > TODAY.slice(0, 7)) return fail("Gələcək dövr bağlanmır.")
  return {
    patch: {
      closedPeriods: [...state.closedPeriods, month].sort(),
      audit: audit(state, actor, "Dövr bağlandı", month),
    },
  }
}

export function openPeriod(state: AppState, month: string, actor: Actor): OpResult {
  if (!state.closedPeriods.includes(month)) return fail("Dövr bağlı deyil.")
  return {
    patch: {
      closedPeriods: state.closedPeriods.filter((item) => item !== month),
      audit: audit(state, actor, "Dövr açıldı", month),
    },
  }
}

export function settleInvoice(state: AppState, invoiceId: string, actor: Actor): OpResult {
  const invoice = state.invoices.find((item) => item.id === invoiceId)
  if (!invoice) return fail("Faktura tapılmadı.")
  if (invoice.status === "odenilib") return fail("Faktura artıq ödənilib.")
  if (invoice.status === "qaralama") return fail("Qaralama faktura ödənilmir.")
  if (periodClosed(state, invoice.due)) return fail("Bağlı dövrün qaiməsi ödənilmir.")
  const project = state.projects.find((item) => item.name === invoice.project)
  return {
    patch: {
      invoices: state.invoices.map((item) => (item.id === invoiceId ? { ...item, status: "odenilib" } : item)),
      contracts: state.contracts.map((item) => {
        if (item.projectId !== project?.id) return item
        let marked = false
        return {
          ...item,
          schedule: item.schedule.map((row) => {
            if (!marked && row.status === "gonderilib") {
              marked = true
              return { ...row, status: "odenilib" as const }
            }
            return row
          }),
        }
      }),
      audit: audit(state, actor, "Faktura ödəndi", invoiceId),
    },
  }
}

export function projectEconomics(state: AppState, projectId: string) {
  const project = state.projects.find((item) => item.id === projectId)
  const smeta = state.smetas.find((item) => item.id === project?.smetaId)
  const planned = smetaValue(smeta)
  const earned = smetaDoneValue(smeta)
  const billed = smeta ? roundMoney(smeta.lines.reduce((sum, line) => sum + line.billedQty * line.unitPrice, 0)) : 0
  const spent = state.expenses.filter((item) => item.project === project?.name).reduce((sum, item) => sum + item.amount, 0)
  const requestIds = new Set(state.requests.filter((item) => item.projectId === projectId).map((item) => item.id))
  const committed = roundMoney(
    state.purchaseOrders
      .filter((order) => order.requestId && requestIds.has(order.requestId) && order.status !== "qebul")
      .reduce((sum, order) => {
        const left = order.qty > 0 ? Math.max(0, order.qty - (order.receivedQty ?? 0)) / order.qty : 0
        return sum + order.amount * left
      }, 0),
  )
  return { planned, earned, billed, spent, committed }
}

function plantLocation(state: AppState, plantName: string) {
  return state.plants.find((item) => item.name === plantName)?.locationId || "LOC-ZAVOD"
}

function missingMaterial(state: AppState, order: WorkOrder, actor: Actor): OpResult | null {
  const recipe = state.recipes.find((item) => item.product === order.product)
  if (!recipe) return null
  const locationId = plantLocation(state, order.plant)
  const place = state.locations.find((item) => item.id === locationId)?.name || "anbar"
  const project = state.projects.find((item) => item.name === order.project)
  for (const item of recipe.items) {
    const need = roundQty(item.qty * order.qty)
    const have = onHand(state.stocks, item.materialId, locationId)
    if (have + 1e-9 >= need) continue
    const material = state.materials.find((row) => row.id === item.materialId)
    const short = roundQty(need - have)
    const open = state.requests.some(
      (row) => row.materialId === item.materialId && row.project === order.project && (row.status === "gozleyir" || row.status === "teklif"),
    )
    const request: MaterialRequest | null = open || !(short > 0)
      ? null
      : {
          id: nextId("TLB", state.requests),
          projectId: project?.id || "",
          project: order.project,
          materialId: item.materialId,
          material: material?.name || item.materialId,
          qty: short,
          unit: material?.unit || "",
          status: "gozleyir",
          author: actor.name,
          date: TODAY,
        }
    return {
      error: `${material?.name || "Material"} ${place} anbarında çatmır (${need}).${request ? ` Tələbnamə ${request.id} açıldı.` : ""}`,
      patch: {
        requests: request ? [request, ...state.requests] : state.requests,
        audit: audit(state, actor, "İstehsal dayandı", `${order.id} · çatışmazlıq ${short}`),
      },
    }
  }
  return null
}

export function openWorkOrder(state: AppState, form: WorkOrderForm, actor: Actor): OpResult {
  const plant = state.plants.find((item) => item.id === form.plantId)
  if (!plant) return fail("Sex və ya zavod tapılmadı.")
  const recipe = state.recipes.find((item) => item.id === form.recipeId)
  if (!recipe || recipe.plantId !== plant.id) return fail("Bu məhsul bu sexə aid deyil.")
  const qty = roundQty(form.qty)
  if (!(qty > 0)) return fail("Miqdar vacibdir.")
  const project = state.projects.find((item) => item.name === form.project || item.id === form.project)
  if (!project) return fail("Layihə seçin.")
  const order: WorkOrder = {
    id: nextId("WO", state.orders),
    plant: plant.name,
    product: recipe.product,
    project: project.name,
    qty,
    unit: recipe.unit,
    status: "novbede",
    due: form.due || TODAY,
  }
  return {
    patch: {
      orders: [order, ...state.orders],
      audit: audit(state, actor, "İş əmri açıldı", `${order.id} · ${order.product} · ${order.plant}`),
    },
  }
}

export function startWorkOrder(state: AppState, orderId: string, actor: Actor): OpResult {
  const order = state.orders.find((item) => item.id === orderId)
  if (!order) return fail("İş əmri tapılmadı.")
  if (order.status !== "novbede") return fail("Yalnız növbədəki əmr işə düşür.")
  const missing = missingMaterial(state, order, actor)
  if (missing) return missing
  return {
    patch: {
      orders: state.orders.map((item) => (item.id === orderId ? { ...item, status: "gedir", startedBy: actor.name } : item)),
      audit: audit(state, actor, "İstehsal başladı", `${order.id} · ${order.product}`),
    },
  }
}

export function advancePlantQueue(state: AppState, plantId: string, actor: Actor): OpResult {
  const plant = state.plants.find((item) => item.id === plantId)
  if (!plant) return fail("Sex və ya zavod tapılmadı.")
  const queued = state.orders.filter((item) => item.plant === plant.name && item.status === "novbede")
  if (!queued.length) return fail("Növbədə avtomatik keçəcək əmr yoxdur.")
  let current = state
  const started: string[] = []
  const stopped: string[] = []
  for (const order of queued) {
    const result = startWorkOrder(current, order.id, actor)
    if (result.patch) current = { ...current, ...result.patch }
    if (result.error) stopped.push(`${order.id}: ${result.error}`)
    else started.push(order.id)
  }
  const detail = [started.length ? `${started.join(", ")} işə düşdü` : "", stopped.join(" · ")].filter(Boolean).join(". ")
  if (!started.length) return { error: detail, patch: current === state ? undefined : { orders: current.orders, requests: current.requests, audit: current.audit } }
  return {
    patch: {
      orders: current.orders,
      requests: current.requests,
      audit: audit(current, actor, "Avtomatik keçid", detail),
    },
  }
}

export function completeWorkOrder(state: AppState, orderId: string, actor: Actor): OpResult {
  const order = state.orders.find((item) => item.id === orderId)
  if (!order) return fail("İş əmri tapılmadı.")
  if (order.status === "hazir") return fail("İş əmri artıq bağlanıb.")
  if (order.status !== "gedir") return fail("Əvvəlcə əmri işə salın.")
  const recipe = state.recipes.find((item) => item.product === order.product)
  const locationId = plantLocation(state, order.plant)
  let stocks = state.stocks.map((row) => ({ ...row }))
  let movements = state.movements
  const project = state.projects.find((item) => item.name === order.project)
  const missing = missingMaterial(state, order, actor)
  if (missing) return missing
  if (recipe) {
    for (const item of recipe.items) {
      const need = roundQty(item.qty * order.qty)
      const material = state.materials.find((row) => row.id === item.materialId)
      const taken = takeStock(stocks, item.materialId, locationId, need)
      if (taken.error) return fail(taken.error)
      stocks = taken.stocks
      movements = [
        {
          id: nextId("MV", movements),
          material: material?.name || item.materialId,
          materialId: item.materialId,
          type: "mexaric",
          qty: need,
          unit: material?.unit || "",
          project: order.project,
          locationId,
          date: TODAY,
          by: actor.name,
        },
        ...movements,
      ]
    }
  }
  let expenses = state.expenses
  let projects = state.projects
  const issued = (recipe?.items || []).map((item) => {
    const material = state.materials.find((row) => row.id === item.materialId)
    const qty = roundQty(item.qty * order.qty)
    const price = material?.price || 0
    return {
      materialId: item.materialId,
      name: material?.name || item.materialId,
      qty,
      unit: material?.unit || "",
      amount: roundMoney(qty * price),
    }
  })
  const amount = roundMoney(issued.reduce((sum, item) => sum + item.amount, 0))
  if (recipe && project && amount > 0) {
    const spent = spend({ ...state, expenses, projects }, { category: "Material", vendor: order.plant, project: project.name, amount })
    expenses = spent.expenses
    projects = spent.projects
  }
  return {
    patch: {
      stocks,
      materials: syncMaterials(state.materials, stocks),
      movements,
      expenses,
      projects,
      orders: state.orders.map((item) =>
        item.id === orderId ? { ...item, status: "hazir", closedBy: actor.name, cost: amount, issued } : item,
      ),
      plants: state.plants.map((plant) =>
        plant.name === order.plant ? { ...plant, fact: roundQty(plant.fact + order.qty) } : plant,
      ),
      audit: audit(state, actor, "İstehsal bağlandı", `${order.id} · ${order.product}`),
    },
  }
}

export function cancelWorkOrder(state: AppState, orderId: string, actor: Actor): OpResult {
  const order = state.orders.find((item) => item.id === orderId)
  if (!order) return fail("İş əmri tapılmadı.")
  if (order.status !== "novbede") return fail("Yalnız növbədəki əmr ləğv olunur.")
  return {
    patch: {
      orders: state.orders.map((item) => (item.id === orderId ? { ...item, status: "legv", cancelledBy: actor.name } : item)),
      audit: audit(state, actor, "İş əmri ləğv olundu", `${order.id} · ${order.product}`),
    },
  }
}

export function returnWorkOrder(state: AppState, orderId: string, actor: Actor): OpResult {
  const order = state.orders.find((item) => item.id === orderId)
  if (!order) return fail("İş əmri tapılmadı.")
  if (order.status !== "gedir") return fail("Yalnız işdəki əmr növbəyə qaytarılır.")
  return {
    patch: {
      orders: state.orders.map((item) => (item.id === orderId ? { ...item, status: "novbede", startedBy: undefined } : item)),
      audit: audit(state, actor, "İş əmri növbəyə qaytarıldı", `${order.id} · ${order.product}`),
    },
  }
}

export function dispatchWorkOrder(state: AppState, orderId: string, actor: Actor, ticket?: DispatchTicket): OpResult {
  const order = state.orders.find((item) => item.id === orderId)
  if (!order) return fail("İş əmri tapılmadı.")
  if (order.status !== "hazir") return fail("Sahəyə yalnız bağlanmış əmr gedir.")
  const vehicle = ticket?.vehicle?.trim() || ""
  const note = ticket?.note?.trim() || ""
  return {
    patch: {
      orders: state.orders.map((item) =>
        item.id === orderId ? { ...item, status: "gonderildi", sentBy: actor.name, vehicle, note } : item,
      ),
      audit: audit(state, actor, "Məhsul sahəyə getdi", `${order.id} · ${order.project}${vehicle ? ` · ${vehicle}` : ""}`),
    },
  }
}

export function writeWaste(state: AppState, form: WasteForm, actor: Actor): OpResult {
  const qty = roundQty(form.qty)
  const reason = form.reason.trim()
  if (!reason) return fail("İtki səbəbi vacibdir.")
  if (!(qty > 0)) return fail("Miqdar vacibdir.")
  const material = state.materials.find((item) => item.id === form.materialId)
  if (!material) return fail("Material tapılmadı.")
  const location = state.locations.find((item) => item.id === form.locationId)
  if (!location) return fail("Anbar tapılmadı.")
  const taken = takeStock(state.stocks, material.id, location.id, qty)
  if (taken.error) return fail(taken.error)
  const project = state.projects.find((item) => item.name === form.project)
  const amount = roundMoney(qty * material.price)
  const movement: Movement = {
    id: nextId("MV", state.movements),
    material: material.name,
    materialId: material.id,
    type: "mexaric",
    qty,
    unit: material.unit,
    project: project?.name || "İtki",
    locationId: location.id,
    date: TODAY,
    by: actor.name,
    note: reason,
  }
  let expenses = state.expenses
  let projects = state.projects
  if (project && amount > 0) {
    const spent = spend({ ...state, expenses, projects }, { category: "İtki", vendor: location.name, project: project.name, amount })
    expenses = spent.expenses
    projects = spent.projects
  }
  return {
    patch: {
      stocks: taken.stocks,
      materials: syncMaterials(state.materials, taken.stocks),
      movements: [movement, ...state.movements],
      expenses,
      projects,
      audit: audit(state, actor, "İtki yazıldı", `${material.name} · ${qty} ${material.unit} · ${reason}`),
    },
  }
}

export function setPlantPlan(state: AppState, plantId: string, planRaw: string | number, actor: Actor): OpResult {
  const plant = state.plants.find((item) => item.id === plantId)
  if (!plant) return fail("Sex və ya zavod tapılmadı.")
  const plan = roundQty(planRaw)
  if (!(plan > 0)) return fail("Plan sıfırdan böyük olmalıdır.")
  return {
    patch: {
      plants: state.plants.map((item) => (item.id === plantId ? { ...item, plan, planStatus: "qaralama", planBy: undefined } : item)),
      audit: audit(state, actor, "Növbə planı dəyişdi", `${plant.name} · ${plan} ${plant.unit}`),
    },
  }
}

export function confirmPlantPlan(state: AppState, plantId: string, actor: Actor): OpResult {
  const plant = state.plants.find((item) => item.id === plantId)
  if (!plant) return fail("Sex və ya zavod tapılmadı.")
  if (!(plant.plan > 0)) return fail("Əvvəlcə planı yazın.")
  if (plant.planStatus === "tesdiq") return fail("Plan artıq təsdiqlənib.")
  return {
    patch: {
      plants: state.plants.map((item) => (item.id === plantId ? { ...item, planStatus: "tesdiq", planBy: actor.name } : item)),
      audit: audit(state, actor, "Növbə planı təsdiqləndi", `${plant.name} · ${plant.plan} ${plant.unit}`),
    },
  }
}

export function addPlantProduct(state: AppState, form: ProductForm, actor: Actor): OpResult {
  const plant = state.plants.find((item) => item.id === form.plantId)
  if (!plant) return fail("Sex və ya zavod tapılmadı.")
  const name = form.name.trim()
  const unit = form.unit.trim()
  if (!name || !unit) return fail("Məhsul adı və vahid vacibdir.")
  if (state.recipes.some((item) => item.plantId === plant.id && item.product.toLowerCase() === name.toLowerCase())) {
    return fail("Bu məhsul artıq var.")
  }
  const recipe: Recipe = { id: nextId("RCP", state.recipes), product: name, unit, plantId: plant.id, items: [] }
  return {
    patch: {
      recipes: [...state.recipes, recipe],
      audit: audit(state, actor, "Məhsul açıldı", `${recipe.product} · ${plant.name}`),
    },
  }
}

export function updatePlantProduct(state: AppState, recipeId: string, form: RecipeEdit, actor: Actor): OpResult {
  const recipe = state.recipes.find((item) => item.id === recipeId)
  if (!recipe) return fail("Məhsul tapılmadı.")
  const plant = state.plants.find((item) => item.id === recipe.plantId)
  if (!plant) return fail("Sex və ya zavod tapılmadı.")
  const name = form.name.trim()
  const unit = form.unit.trim()
  if (!name || !unit) return fail("Məhsul adı və vahid vacibdir.")
  if (state.recipes.some((item) => item.id !== recipe.id && item.plantId === plant.id && item.product.toLowerCase() === name.toLowerCase())) {
    return fail("Bu məhsul artıq var.")
  }
  let items = recipe.items
  if (form.lines.length > 0) {
    const seen = new Set<string>()
    items = []
    for (const line of form.lines) {
      const qty = roundQty(line.qty)
      if (!line.materialId || !(qty > 0)) return fail("Hər sətirdə material və miqdar vacibdir.")
      if (seen.has(line.materialId)) return fail("Hər xammal yalnız bir dəfə yazıla bilər.")
      if (!state.materials.some((item) => item.id === line.materialId)) return fail("Material tapılmadı.")
      seen.add(line.materialId)
      items.push({ materialId: line.materialId, qty })
    }
  } else if (recipe.items.length > 0) {
    return fail("Ən azı bir xammal saxlanılmalıdır.")
  }
  return {
    patch: {
      recipes: state.recipes.map((item) => (item.id === recipe.id ? { ...item, product: name, unit, items } : item)),
      orders: state.orders.map((item) => (item.plant === plant.name && item.product === recipe.product ? { ...item, product: name, unit } : item)),
      audit: audit(state, actor, "Resept yazıldı", `${name} · ${plant.name}`),
    },
  }
}

export function deletePlantProduct(state: AppState, recipeId: string, actor: Actor): OpResult {
  const recipe = state.recipes.find((item) => item.id === recipeId)
  if (!recipe) return fail("Məhsul tapılmadı.")
  const plant = state.plants.find((item) => item.id === recipe.plantId)
  const live = state.orders.some((item) => item.plant === plant?.name && item.product === recipe.product && (item.status === "novbede" || item.status === "gedir" || item.status === "hazir"))
  if (live) return fail("Açıq iş əmri olan məhsul silinmir.")
  return {
    patch: {
      recipes: state.recipes.filter((item) => item.id !== recipe.id),
      audit: audit(state, actor, "Məhsul silindi", `${recipe.product} · ${plant?.name || ""}`),
    },
  }
}

export function saveFormula(state: AppState, recipeId: string, lines: FormulaLine[], actor: Actor): OpResult {
  const recipe = state.recipes.find((item) => item.id === recipeId)
  if (!recipe) return fail("Formul tapılmadı.")
  if (lines.length === 0) return fail("Formulun ən azı bir xammalı olmalıdır.")
  const seen = new Set<string>()
  const items: RecipeItem[] = []
  for (const line of lines) {
    const qty = roundQty(line.qty)
    if (!line.materialId || !(qty > 0)) return fail("Hər sətirdə material və miqdar vacibdir.")
    if (seen.has(line.materialId)) return fail("Hər xammal yalnız bir dəfə yazıla bilər.")
    if (!state.materials.some((item) => item.id === line.materialId)) return fail("Material tapılmadı.")
    seen.add(line.materialId)
    items.push({ materialId: line.materialId, qty })
  }
  return {
    patch: {
      recipes: state.recipes.map((item) => (item.id === recipeId ? { ...item, items } : item)),
      audit: audit(state, actor, "Formul yazıldı", `${recipe.product} · ${items.length} xammal`),
    },
  }
}

export function rejectRequest(state: AppState, requestId: string, reason: string, actor: Actor): OpResult {
  const request = state.requests.find((item) => item.id === requestId)
  if (!request || (request.status !== "gozleyir" && request.status !== "teklif")) return fail("Açıq tələbnamə seçin.")
  const decision = reason.trim()
  if (!decision) return fail("Rədd səbəbi vacibdir.")
  return {
    patch: {
      requests: state.requests.map((item) =>
        item.id === requestId ? { ...item, status: "redd", decidedBy: actor.name, decision } : item,
      ),
      audit: audit(state, actor, "Tələbnamə rədd edildi", `${request.id} · ${decision}`),
    },
  }
}

export function addShiftNote(state: AppState, site: string, text: string, actor: Actor): OpResult {
  const note = text.trim()
  if (!site.trim()) return fail("Obyekt seçin.")
  if (!note) return fail("Qeyd vacibdir.")
  return {
    patch: {
      journal: [{ id: nextId("QEYD", state.journal), time: new Date().toTimeString().slice(0, 5), site, text: note }, ...state.journal],
      audit: audit(state, actor, "Növbə qeydi", `${site} · ${note}`),
    },
  }
}

export function updateJournal(state: AppState, id: string, text: string, actor: Actor): OpResult {
  const note = text.trim()
  if (!state.journal.some((item) => item.id === id)) return fail("Qeyd tapılmadı.")
  if (!note) return fail("Qeyd vacibdir.")
  return {
    patch: {
      journal: state.journal.map((item) => (item.id === id ? { ...item, text: note } : item)),
      audit: audit(state, actor, "Qeyd yazıldı", id),
    },
  }
}

export function deleteJournal(state: AppState, id: string, actor: Actor): OpResult {
  if (!state.journal.some((item) => item.id === id)) return fail("Qeyd tapılmadı.")
  return {
    patch: {
      journal: state.journal.filter((item) => item.id !== id),
      audit: audit(state, actor, "Qeyd silindi", id),
    },
  }
}

function personFrom(form: PersonForm, site: string, id: string, placeKind: HrPlace, current?: Person): Person {
  return {
    id,
    name: form.name.trim(),
    role: form.role.trim(),
    crew: form.crew.trim() || "—",
    site,
    placeKind,
    status: form.status || current?.status || "sahede",
    phone: form.phone.trim() || "—",
    email: form.email !== undefined ? form.email.trim() || "—" : current?.email || "—",
    departmentId: form.departmentId !== undefined ? form.departmentId : current?.departmentId || "",
    pin: form.pin !== undefined ? form.pin.trim() : current?.pin || "",
    hired: form.hired !== undefined ? form.hired : current?.hired || "",
    salary: form.salary !== undefined ? Math.round(Number(form.salary) || 0) : current?.salary || 0,
    card: form.card !== undefined ? form.card.trim() : current?.card || "",
  }
}

export function addPerson(state: AppState, site: string, form: PersonForm, actor: Actor): OpResult {
  const name = form.name.trim()
  if (!site.trim()) return fail("Obyekt seçin.")
  if (!name || !form.role.trim()) return fail("Ad və vəzifə vacibdir.")
  if (state.people.some((item) => sameParty(item.name, name))) return fail("Bu adda işçi var.")
  const person = personFrom(form, site, nextId("HR", state.people), placeKindOf(state, site))
  return {
    patch: {
      people: [person, ...state.people],
      audit: audit(state, actor, "İşçi əlavə olundu", `${person.id} · ${site}`),
    },
  }
}

export function updatePerson(state: AppState, id: string, site: string, form: PersonForm, actor: Actor): OpResult {
  const current = state.people.find((item) => item.id === id)
  if (!current) return fail("İşçi tapılmadı.")
  const name = form.name.trim()
  if (!name || !form.role.trim()) return fail("Ad və vəzifə vacibdir.")
  if (state.people.some((item) => item.id !== id && sameParty(item.name, name))) return fail("Bu adda işçi var.")
  return {
    patch: {
      people: state.people.map((item) => (item.id === id ? personFrom(form, site || current.site, id, placeKindOf(state, site || current.site), current) : item)),
      audit: audit(state, actor, "İşçi yazıldı", id),
    },
  }
}

export function deletePerson(state: AppState, id: string, actor: Actor): OpResult {
  if (!state.people.some((item) => item.id === id)) return fail("İşçi tapılmadı.")
  if (state.reports.some((report) => report.attendance?.some((row) => row.personId === id))) return fail("Bu işçinin tabeli var.")
  if (state.payrolls.some((payroll) => payroll.lines.some((line) => line.personId === id))) return fail("Bu işçinin əmək haqqı cədvəli var.")
  if (state.departments.some((item) => item.leadId === id)) return fail("Bu işçi şöbə rəhbəridir.")
  if (state.attendance.some((item) => item.personId === id)) return fail("Bu işçinin davamiyyəti var.")
  if (state.leaves.some((item) => item.personId === id)) return fail("Bu işçinin məzuniyyəti var.")
  if (state.hrPayments.some((item) => item.personId === id)) return fail("Bu işçinin ödənişi var.")
  if (state.moves.some((item) => item.personId === id)) return fail("Bu işçinin köçürməsi var.")
  return {
    patch: {
      people: state.people.filter((item) => item.id !== id),
      audit: audit(state, actor, "İşçi silindi", id),
    },
  }
}

export function assignPerson(state: AppState, id: string, site: string, crew: string, actor: Actor): OpResult {
  const person = state.people.find((item) => item.id === id)
  if (!person) return fail("İşçi tapılmadı.")
  if (!site.trim()) return fail("Obyekt seçin.")
  if (person.site === site) return fail("Bu işçi artıq bu sahədədir.")
  if (isAway(person.status)) return fail("Bu statusda işçi sahəyə təyin olunmur.")
  return {
    patch: {
      people: state.people.map((item) =>
        item.id === id ? { ...item, site, crew: crew.trim() || item.crew, placeKind: "sahe" as const, status: "sahede" as const } : item,
      ),
      audit: audit(state, actor, "İşçi sahəyə təyin olundu", `${person.name} · ${site}`),
    },
  }
}

export function releasePerson(state: AppState, id: string, actor: Actor): OpResult {
  const person = state.people.find((item) => item.id === id)
  if (!person) return fail("İşçi tapılmadı.")
  const home = state.departments.find((item) => item.id === person.departmentId)?.site || "Baş ofis"
  if (person.site === home) return fail("İşçi artıq şöbə yerindədir.")
  const placeKind = placeKindOf(state, home)
  return {
    patch: {
      people: state.people.map((item) =>
        item.id === id ? { ...item, site: home, placeKind, status: PLACE_STATUS[placeKind] } : item,
      ),
      audit: audit(state, actor, "İşçi sahədən çıxdı", person.name),
    },
  }
}

export function assignAsset(state: AppState, assetId: string, site: string, actor: Actor): OpResult {
  const asset = state.assets.find((item) => item.id === assetId)
  if (!asset) return fail("Texnika tapılmadı.")
  if (!site.trim()) return fail("Obyekt seçin.")
  if (asset.site === site) return fail("Bu texnika artıq bu sahədədir.")
  if (asset.status === "servis") return fail("Servisdəki texnika cəlb olunmur.")
  if (state.trips.some((item) => item.assetId === asset.id && (item.status === "plan" || item.status === "yolda"))) {
    return fail("Açıq reysi olan texnika köçürülmür.")
  }
  const status = asset.status === "icarede" ? "icarede" : "sahede"
  return {
    patch: {
      assets: state.assets.map((item) => (item.id === assetId ? { ...item, site, status } : item)),
      audit: audit(state, actor, "Texnika cəlb olundu", `${asset.id} · ${site}`),
    },
  }
}

export function updateAsset(state: AppState, id: string, form: AssetEdit, actor: Actor): OpResult {
  const asset = state.assets.find((item) => item.id === id)
  if (!asset) return fail("Texnika tapılmadı.")
  const name = form.name.trim()
  const type = form.type.trim()
  if (!name || !type) return fail("Ad və növ vacibdir.")
  const hours = Number(form.hours)
  const utilization = Number(form.utilization)
  if (!(hours >= 0)) return fail("Moto-saat mənfi ola bilməz.")
  if (!(utilization >= 0) || utilization > 100) return fail("Yüklənmə 0 ilə 100 arasında olmalıdır.")
  return {
    patch: {
      assets: state.assets.map((item) => item.id === id ? {
        ...item,
        name,
        type,
        hours: Math.round(hours),
        utilization: Math.round(utilization),
        nextService: form.nextService || item.nextService,
      } : item),
      audit: audit(state, actor, "Texnika yazıldı", id),
    },
  }
}

export function releaseAsset(state: AppState, id: string, actor: Actor): OpResult {
  const asset = state.assets.find((item) => item.id === id)
  if (!asset) return fail("Texnika tapılmadı.")
  if (asset.status === "servis" || state.services.some((item) => item.assetId === id && item.status === "acik")) {
    return fail("Servisdəki texnika silinmir.")
  }
  if (state.trips.some((item) => item.assetId === id && (item.status === "plan" || item.status === "yolda"))) {
    return fail("Açıq reysi olan texnika park olunmur.")
  }
  const status = asset.status === "icarede" ? "icarede" : "bos"
  return {
    patch: {
      assets: state.assets.map((item) => (item.id === id ? { ...item, site: "Mərkəzi anbar", status } : item)),
      audit: audit(state, actor, "Texnika sahədən çıxdı", id),
    },
  }
}

function sameParty(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}

export function updateClient(state: AppState, id: string, form: ClientForm, actor: Actor): OpResult {
  const client = state.clients.find((item) => item.id === id)
  if (!client) return fail("Sifarişçi tapılmadı.")
  const name = form.name.trim()
  if (!name || !form.contact.trim()) return fail("Şirkət adı və əlaqə şəxsi vacibdir.")
  if (state.clients.some((item) => item.id !== id && sameParty(item.name, name))) return fail("Bu adda sifarişçi var.")
  const amount = Number(form.value)
  if (form.value.trim() && !(amount >= 0)) return fail("Dəyər mənfi ola bilməz.")
  const nextName = name
  const renamed = <T extends { client: string }>(rows: T[]) => rows.map((row) => (row.client === client.name ? { ...row, client: nextName } : row))
  return {
    patch: {
      clients: state.clients.map((item) => item.id === id ? {
        ...item,
        name: nextName,
        sector: form.sector,
        contact: form.contact.trim(),
        phone: form.phone.trim() || "—",
        email: form.email.trim() || "—",
        city: form.city.trim() || "Bakı",
        value: form.value.trim() ? Math.round(amount) : item.value,
        projects: state.projects.filter((project) => project.client === client.name).length,
      } : item),
      projects: renamed(state.projects),
      deals: renamed(state.deals),
      invoices: renamed(state.invoices),
      contracts: renamed(state.contracts),
      acts: renamed(state.acts),
      forma3s: renamed(state.forma3s),
      leads: state.leads.map((lead) => (lead.company === client.name ? { ...lead, company: nextName } : lead)),
      tasks: renamed(state.tasks),
      files: renamed(state.files),
      activities: renamed(state.activities),
      audit: audit(state, actor, "Sifarişçi yazıldı", nextName),
    },
  }
}

export function deleteClient(state: AppState, id: string, actor: Actor): OpResult {
  const client = state.clients.find((item) => item.id === id)
  if (!client) return fail("Sifarişçi tapılmadı.")
  if (state.projects.some((item) => item.client === client.name)) return fail("Bu sifarişçinin layihəsi var.")
  if (state.deals.some((item) => item.client === client.name)) return fail("Bu sifarişçinin sövdəsi var.")
  if (state.invoices.some((item) => item.client === client.name)) return fail("Bu sifarişçinin fakturası var.")
  if (state.acts.some((item) => item.client === client.name)) return fail("Bu sifarişçinin aktı var.")
  if (state.tasks.some((item) => item.client === client.name)) return fail("Bu sifarişçinin tapşırığı var.")
  if (state.files.some((item) => item.client === client.name)) return fail("Bu sifarişçinin sənədi var.")
  return {
    patch: {
      clients: state.clients.filter((item) => item.id !== id),
      audit: audit(state, actor, "Sifarişçi silindi", client.name),
    },
  }
}

export function updateLead(state: AppState, id: string, form: LeadForm, actor: Actor): OpResult {
  const lead = state.leads.find((item) => item.id === id)
  if (!lead) return fail("Potensial tapılmadı.")
  if (!form.name.trim() || !form.company.trim()) return fail("Fürsət və şirkət adı vacibdir.")
  const amount = Number(form.value)
  if (form.value.trim() && !(amount >= 0)) return fail("Dəyər mənfi ola bilməz.")
  return {
    patch: {
      leads: state.leads.map((item) => item.id === id ? {
        ...item,
        name: form.name.trim(),
        company: form.company.trim(),
        value: form.value.trim() ? Math.round(amount) : item.value,
        heat: form.heat,
        source: form.source.trim() || "Manual",
        next: form.next || item.next,
      } : item),
      audit: audit(state, actor, "Potensial yazıldı", form.name.trim()),
    },
  }
}

export function deleteLead(state: AppState, id: string, actor: Actor): OpResult {
  const lead = state.leads.find((item) => item.id === id)
  if (!lead) return fail("Potensial tapılmadı.")
  if (state.tasks.some((item) => item.leadId === id && item.status !== "bitdi")) return fail("Bu potensialın açıq tapşırığı var.")
  return {
    patch: {
      leads: state.leads.filter((item) => item.id !== id),
      audit: audit(state, actor, "Potensial silindi", lead.name),
    },
  }
}

export function promoteLead(state: AppState, id: string, actor: Actor): OpResult {
  const lead = state.leads.find((item) => item.id === id)
  if (!lead) return fail("Potensial tapılmadı.")
  if (state.deals.some((item) => item.title === lead.name && item.client === lead.company)) return fail("Bu fürsət artıq sövdədir.")
  const dealId = nextId("DL", state.deals)
  const carry = <T extends { leadId: string; dealId: string; client: string }>(rows: T[]) => rows.map((row) => (
    row.leadId === id ? { ...row, leadId: "", dealId, client: row.client || lead.company } : row
  ))
  return {
    patch: {
      leads: state.leads.filter((item) => item.id !== id),
      deals: [{ id: dealId, title: lead.name, client: lead.company, value: lead.value, stage: "ilkin" as const, owner: lead.owner, close: lead.next, projectId: "" }, ...state.deals],
      tasks: carry(state.tasks),
      activities: carry(state.activities),
      audit: audit(state, actor, "Potensial sövdəyə keçdi", lead.name),
    },
  }
}

export function updateDeal(state: AppState, id: string, form: { title: string; value: string; close: string }, actor: Actor): OpResult {
  const deal = state.deals.find((item) => item.id === id)
  if (!deal) return fail("Sövdə tapılmadı.")
  if (!form.title.trim()) return fail("Sövdənin adı vacibdir.")
  const amount = Number(form.value)
  if (!(amount > 0)) return fail("Sövdənin dəyəri yazılmalıdır.")
  if (!form.close) return fail("Bağlanış tarixi vacibdir.")
  return {
    patch: {
      deals: state.deals.map((item) => item.id === id ? { ...item, title: form.title.trim(), value: Math.round(amount), close: form.close } : item),
      audit: audit(state, actor, "Sövdə yazıldı", form.title.trim()),
    },
  }
}

export function deleteDeal(state: AppState, id: string, actor: Actor): OpResult {
  const deal = state.deals.find((item) => item.id === id)
  if (!deal) return fail("Sövdə tapılmadı.")
  if (deal.projectId) return fail("Bu sövdədən layihə açılıb.")
  if (state.tasks.some((item) => item.dealId === id && item.status !== "bitdi")) return fail("Bu sövdənin açıq tapşırığı var.")
  if (state.files.some((item) => item.dealId === id && item.status !== "arxiv")) return fail("Bu sövdənin sənədi var.")
  return {
    patch: {
      deals: state.deals.filter((item) => item.id !== id),
      audit: audit(state, actor, "Sövdə silindi", deal.title),
    },
  }
}

export function openProjectFromDeal(state: AppState, dealId: string, actor: Actor): OpResult {
  const deal = state.deals.find((item) => item.id === dealId)
  if (!deal) return fail("Sövdə tapılmadı.")
  if (deal.stage !== "muqavile") return fail("Layihə yalnız müqavilə mərhələsindən açılır.")
  if (deal.projectId) return fail("Bu sövdənin layihəsi artıq var.")
  const id = nextId("PRJ", state.projects)
  const smetaId = `SM-${id}`
  const shares = [
    { code: "02", name: "Əsas konstruksiya", unit: "m³", share: 0.55, laborHours: 1.2, recipe: "b25" },
    { code: "04", name: "Fasad", unit: "m²", share: 0.25, laborHours: 0.6, recipe: "" },
    { code: "05", name: "Tamamlama", unit: "m²", share: 0.2, laborHours: 0.8, recipe: "" },
  ]
  let used = 0
  const lines = shares.map((part, index) => {
    const amount = index === shares.length - 1 ? deal.value - used : Math.round(deal.value * part.share)
    used += amount
    const unitPrice = part.unit === "m³" ? 96 : 70
    const qty = Math.max(1, Math.round(amount / unitPrice))
    return {
      id: `SL-${id}-${part.code}`,
      code: part.code,
      name: part.name,
      unit: part.unit,
      qty,
      unitPrice: Math.round(amount / qty),
      doneQty: 0,
      billedQty: 0,
      laborHours: part.laborHours,
      recipe: part.recipe || "",
    }
  })
  const project: Project = {
    id,
    name: deal.title,
    client: deal.client,
    district: "Bakı",
    city: "Bakı",
    address: "Ünvan təsdiqdən sonra",
    phase: "Torpaq",
    progress: 0,
    budget: deal.value,
    spent: 0,
    start: TODAY,
    end: deal.close,
    manager: deal.owner,
    crew: 12,
    status: "plan",
    type: "Yeni müqavilə",
    floors: 0,
    area: 0,
    smetaId,
    phases: [
      { name: "Torpaq", current: true },
      { name: "Bünövrə" },
      { name: "Karkas" },
      { name: "Fasad" },
      { name: "Tamamlama" },
      { name: "Təhvil" },
    ],
    notes: [{ id: nextId("PN", state.projects.flatMap((item) => item.notes)), date: TODAY, text: `${deal.id} sövdəsindən açıldı.` }],
  }
  const contract: Contract = {
    id: nextId("MQ", state.contracts),
    projectId: id,
    client: deal.client,
    number: `MQ-${id.slice(4)}`,
    signed: TODAY,
    value: lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0),
    advancePct: 20,
    retentionPct: 5,
    vat: VAT,
    schedule: [
      { id: "1", title: "Avans", due: TODAY, share: 0.2, status: "gozleyir" },
      { id: "2", title: "Karkas aktı", due: "2026-12-15", share: 0.5, status: "gozleyir" },
      { id: "3", title: "Təhvil", due: deal.close, share: 0.3, status: "gozleyir" },
    ],
  }
  return {
    patch: {
      projects: [project, ...state.projects],
      smetas: [{ id: smetaId, projectId: id, version: 1, status: "razilasma", lines }, ...state.smetas],
      contracts: [contract, ...state.contracts],
      locations: [...state.locations, { id: `LOC-${id}`, name: `${deal.title} sahə anbarı`, kind: "sahe", projectId: id }],
      deals: state.deals.map((item) => (item.id === dealId ? { ...item, projectId: id } : item)),
      audit: audit(state, actor, "Layihə açıldı", `${id} · ${deal.title}`),
    },
    projectId: id,
  }
}

const PROJECT_STATUS: ProjectStatus[] = ["aktiv", "gecikir", "tehvil", "plan"]
const SITE_PHASES = ["Torpaq", "Bünövrə", "Karkas", "Fasad", "Tamamlama", "Təhvil"]

export function addProject(state: AppState, form: NewProjectForm, actor: Actor): OpResult {
  const name = form.name.trim()
  const client = form.client.trim()
  const address = form.address.trim()
  const district = form.district.trim()
  const city = form.city.trim()
  const type = form.type.trim()
  const typedPhase = form.phase.trim()
  const manager = form.manager.trim() || actor.name || "—"
  const floors = Math.round(Number(form.floors) || 0)
  const area = Math.round(Number(form.area) || 0)
  const budget = Math.round(Number(form.budget) || 0)
  if (!name) return fail("Ad vacibdir.")
  if (!client) return fail("Sifarişçi vacibdir.")
  if (!address || !district || !city) return fail("Ünvan, rayon və şəhər vacibdir.")
  if (!type || !typedPhase) return fail("Növ və mərhələ vacibdir.")
  if (!PROJECT_STATUS.includes(form.status)) return fail("Status seçin.")
  if (floors < 0 || area < 0 || budget < 0) return fail("Mərtəbə, sahə və büdcə mənfi ola bilməz.")
  if (!form.start || !form.end) return fail("Başlanğıc və təhvil vacibdir.")
  if (form.end < form.start) return fail("Təhvil başlanğıcdan əvvəl ola bilməz.")
  if (state.projects.some((item) => item.name.toLowerCase() === name.toLowerCase())) return fail("Bu adda layihə var.")
  const phase = SITE_PHASES.find((item) => item.toLowerCase() === typedPhase.toLowerCase()) || typedPhase
  const names = SITE_PHASES.includes(phase) ? SITE_PHASES : [phase, ...SITE_PHASES]
  const at = names.indexOf(phase)
  const id = nextId("PRJ", state.projects)
  const project: Project = {
    id,
    name,
    client,
    district,
    city,
    address,
    phase,
    progress: 0,
    budget,
    spent: 0,
    start: form.start,
    end: form.end,
    manager,
    crew: 0,
    status: form.status,
    type,
    floors,
    area,
    phases: names.map((item, index) => ({ name: item, done: index < at || undefined, current: index === at || undefined })),
    notes: [{ id: nextId("PN", state.projects.flatMap((item) => item.notes)), date: TODAY, text: "Layihə açıldı." }],
  }
  return {
    projectId: id,
    patch: {
      projects: [project, ...state.projects],
      locations: [...state.locations, { id: `LOC-${id}`, name: `${name} sahəsi`, kind: "sahe", projectId: id }],
      clients: state.clients.map((item) => (item.name.toLowerCase() === client.toLowerCase() ? { ...item, projects: item.projects + 1 } : item)),
      audit: audit(state, actor, "Layihə açıldı", `${id} · ${name}`),
    },
  }
}

function retitle<T extends { project: string }>(rows: T[], from: string, to: string) {
  if (from === to) return rows
  return rows.map((item) => (item.project === from ? { ...item, project: to } : item))
}

function resite<T extends { site: string }>(rows: T[], from: string, to: string) {
  if (from === to) return rows
  return rows.map((item) => (item.site === from ? { ...item, site: to } : item))
}

export function updateProject(state: AppState, id: string, form: ProjectForm, actor: Actor): OpResult {
  const project = state.projects.find((item) => item.id === id)
  if (!project) return fail("Layihə tapılmadı.")
  const name = form.name.trim()
  const address = form.address.trim()
  const district = form.district.trim()
  const city = form.city.trim()
  const type = form.type.trim()
  const phase = form.phase.trim()
  const manager = form.manager.trim() || "—"
  const floors = Math.round(Number(form.floors) || 0)
  const area = Math.round(Number(form.area) || 0)
  if (!name) return fail("Ad vacibdir.")
  if (!address || !district || !city) return fail("Ünvan, rayon və şəhər vacibdir.")
  if (!type || !phase) return fail("Növ və mərhələ vacibdir.")
  if (!PROJECT_STATUS.includes(form.status)) return fail("Status seçin.")
  if (floors < 0 || area < 0) return fail("Mərtəbə və sahə mənfi ola bilməz.")
  if (form.start && form.end && form.end < form.start) return fail("Təhvil başlanğıcdan əvvəl ola bilməz.")
  if (state.projects.some((item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase())) return fail("Bu adda layihə var.")
  const at = project.phases.findIndex((item) => item.name === phase)
  const phases = at < 0 ? project.phases : project.phases.map((item, index) => ({ name: item.name, done: index < at || undefined, current: index === at || undefined }))
  const old = project.name
  return {
    patch: {
      projects: state.projects.map((item) => (item.id === id ? { ...item, name, address, district, city, type, phase, manager, floors, area, start: form.start, end: form.end, status: form.status, phases } : item)),
      invoices: retitle(state.invoices, old, name),
      expenses: retitle(state.expenses, old, name),
      movements: retitle(state.movements, old, name),
      requests: retitle(state.requests, old, name),
      orders: retitle(state.orders, old, name),
      acts: retitle(state.acts, old, name),
      forma3s: retitle(state.forma3s, old, name),
      services: retitle(state.services, old, name),
      assets: resite(state.assets, old, name),
      people: resite(state.people, old, name),
      journal: resite(state.journal, old, name),
      gear: state.gear.map((item) => (item.place === old ? { ...item, place: name } : item)),
      locations: state.locations.map((item) => (item.projectId === id && item.name.includes(old) ? { ...item, name: item.name.replace(old, name) } : item)),
      audit: audit(state, actor, "Layihə yazıldı", `${id} · ${name}`),
    },
  }
}

export function deleteProject(state: AppState, id: string, actor: Actor): OpResult {
  const project = state.projects.find((item) => item.id === id)
  if (!project) return fail("Layihə tapılmadı.")
  if (state.smetas.some((item) => item.projectId === id)) return fail("Bu layihənin smetası var.")
  if (state.contracts.some((item) => item.projectId === id)) return fail("Bu layihənin müqaviləsi var.")
  if (state.acts.some((item) => item.projectId === id)) return fail("Bu layihənin aktı var.")
  if (state.reports.some((item) => item.projectId === id)) return fail("Bu layihənin gündəliyi var.")
  if (state.requests.some((item) => item.projectId === id)) return fail("Bu layihənin tələbnaməsi var.")
  return {
    patch: {
      projects: state.projects.filter((item) => item.id !== id),
      documents: state.documents.filter((item) => item.projectId !== id),
      files: state.files.map((item) => (item.projectId === id ? { ...item, projectId: "" } : item)),
      locations: state.locations.filter((item) => item.projectId !== id),
      audit: audit(state, actor, "Layihə silindi", project.name),
    },
  }
}

export function addProjectNote(state: AppState, projectId: string, text: string, actor: Actor): OpResult {
  const body = text.trim()
  if (!body) return fail("Qeyd vacibdir.")
  const project = state.projects.find((item) => item.id === projectId)
  if (!project) return fail("Layihə tapılmadı.")
  const note = { id: nextId("PN", state.projects.flatMap((item) => item.notes)), date: TODAY, text: body }
  return {
    patch: {
      projects: state.projects.map((item) => (item.id === projectId ? { ...item, notes: [note, ...item.notes] } : item)),
      audit: audit(state, actor, "Layihə qeydi", `${project.name} · ${body}`),
    },
  }
}

export function updateProjectNote(state: AppState, projectId: string, noteId: string, text: string, actor: Actor): OpResult {
  const body = text.trim()
  if (!body) return fail("Qeyd vacibdir.")
  const project = state.projects.find((item) => item.id === projectId)
  if (!project?.notes.some((item) => item.id === noteId)) return fail("Qeyd tapılmadı.")
  return {
    patch: {
      projects: state.projects.map((item) => (item.id === projectId ? { ...item, notes: item.notes.map((note) => (note.id === noteId ? { ...note, text: body } : note)) } : item)),
      audit: audit(state, actor, "Layihə qeydi", project.name),
    },
  }
}

export function deleteProjectNote(state: AppState, projectId: string, noteId: string, actor: Actor): OpResult {
  const project = state.projects.find((item) => item.id === projectId)
  if (!project?.notes.some((item) => item.id === noteId)) return fail("Qeyd tapılmadı.")
  return {
    patch: {
      projects: state.projects.map((item) => (item.id === projectId ? { ...item, notes: item.notes.filter((note) => note.id !== noteId) } : item)),
      audit: audit(state, actor, "Layihə qeydi silindi", project.name),
    },
  }
}

export function addDocument(state: AppState, form: DocumentForm, actor: Actor): OpResult {
  const title = form.title.trim()
  const kind = form.kind.trim()
  if (!form.projectId || !title || !kind) return fail("Layihə, başlıq və növ vacibdir.")
  if (!state.projects.some((item) => item.id === form.projectId)) return fail("Layihə tapılmadı.")
  const doc = { id: nextId("DOC", state.documents), projectId: form.projectId, title, kind, status: "gozleyir" as const, date: form.date || TODAY }
  return {
    patch: {
      documents: [doc, ...state.documents],
      audit: audit(state, actor, "Sənəd açıldı", `${doc.id} · ${title}`),
    },
  }
}

export function updateDocument(state: AppState, id: string, form: DocumentForm, actor: Actor): OpResult {
  const doc = state.documents.find((item) => item.id === id)
  if (!doc) return fail("Sənəd tapılmadı.")
  if (doc.status === "tesdiq") return fail("Təsdiqlənmiş sənəd donub.")
  const title = form.title.trim()
  const kind = form.kind.trim()
  if (!title || !kind) return fail("Başlıq və növ vacibdir.")
  return {
    patch: {
      documents: state.documents.map((item) => (item.id === id ? { ...item, title, kind, date: form.date || item.date, projectId: form.projectId || item.projectId } : item)),
      audit: audit(state, actor, "Sənəd yazıldı", `${id} · ${title}`),
    },
  }
}

export function deleteDocument(state: AppState, id: string, actor: Actor): OpResult {
  const doc = state.documents.find((item) => item.id === id)
  if (!doc) return fail("Sənəd tapılmadı.")
  if (doc.status === "tesdiq") return fail("Təsdiqlənmiş sənəd silinmir.")
  return {
    patch: {
      documents: state.documents.filter((item) => item.id !== id),
      audit: audit(state, actor, "Sənəd silindi", doc.title),
    },
  }
}

export function decideDocument(state: AppState, docId: string, status: DocStatus, actor: Actor): OpResult {
  const doc = state.documents.find((item) => item.id === docId)
  if (!doc) return fail("Sənəd tapılmadı.")
  return {
    patch: {
      documents: state.documents.map((item) => (item.id === docId ? { ...item, status } : item)),
      audit: audit(state, actor, "Sənəd statusu", `${doc.title} · ${status}`),
    },
  }
}

export function createRequest(state: AppState, form: RequestForm, actor: Actor): OpResult {
  const qty = roundQty(form.qty)
  if (!form.projectId || !form.materialId || !(qty > 0)) return fail("Layihə, material və miqdar vacibdir.")
  const material = state.materials.find((item) => item.id === form.materialId)
  const project = state.projects.find((item) => item.id === form.projectId)
  const request: MaterialRequest = {
    id: nextId("TLB", state.requests),
    projectId: form.projectId,
    project: project?.name || "",
    materialId: form.materialId,
    material: material?.name || "",
    qty,
    unit: material?.unit || "",
    status: "gozleyir",
    author: actor.name,
    date: TODAY,
  }
  return {
    patch: {
      requests: [request, ...state.requests],
      audit: audit(state, actor, "Tələbnamə", `${request.id} · ${request.material}`),
    },
  }
}

export function convertRequest(state: AppState, requestId: string, actor: Actor): OpResult {
  const request = state.requests.find((item) => item.id === requestId)
  if (!request || request.status !== "gozleyir") return fail("Açıq tələbnamə seçin.")
  const material = state.materials.find((item) => item.id === request.materialId)
  const amount = roundMoney(request.qty * (material?.price || 0))
  const order: PurchaseOrder = {
    id: nextId("PO", state.purchaseOrders),
    supplier: "Təchizatçı seçilməyib",
    item: request.material,
    materialId: request.materialId,
    qty: request.qty,
    unit: request.unit,
    amount,
    status: "tesdiq",
    eta: "2026-10-02",
    receivedQty: 0,
    requestId: request.id,
  }
  return {
    patch: {
      purchaseOrders: [order, ...state.purchaseOrders],
      requests: state.requests.map((item) => (item.id === requestId ? { ...item, status: "sifaris", poId: order.id } : item)),
      audit: audit(state, actor, "Tələbnamə sifariş oldu", `${request.id} → ${order.id}`),
    },
  }
}

export function proposeChange(state: AppState, form: ChangeForm, actor: Actor): OpResult {
  const qty = roundQty(form.qty)
  const unitPrice = roundMoney(form.unitPrice)
  if (!form.projectId || !form.title.trim() || !form.name.trim() || !(qty > 0) || !(unitPrice > 0)) {
    return fail("Layihə, ad, həcm və qiymət vacibdir.")
  }
  const project = state.projects.find((item) => item.id === form.projectId)
  if (!project) return fail("Layihə tapılmadı.")
  const change: ChangeOrder = {
    id: nextId("ELV", state.changes),
    projectId: form.projectId,
    title: form.title.trim(),
    reason: form.reason.trim() || "Əlavə iş",
    status: "qaralama",
    lines: [{ name: form.name.trim(), unit: form.unit.trim() || "ədəd", qty, unitPrice, laborHours: 1, recipe: "" }],
    author: actor.name,
    date: TODAY,
  }
  return {
    patch: {
      changes: [change, ...state.changes],
      audit: audit(state, actor, "Əlavə iş açıldı", `${change.id} · ${change.title}`),
    },
  }
}

export function approveChange(state: AppState, changeId: string, actor: Actor): OpResult {
  const change = state.changes.find((item) => item.id === changeId)
  if (!change || change.status !== "qaralama") return fail("Qaralama əlavə iş təsdiqlənir.")
  const project = state.projects.find((item) => item.id === change.projectId)
  const smeta = state.smetas.find((item) => item.id === project?.smetaId)
  const contract = state.contracts.find((item) => item.projectId === change.projectId)
  if (!project || !smeta || !contract) return fail("Smeta və ya müqavilə tapılmadı.")
  const used = new Set(smeta.lines.map((line) => line.code))
  let cursor = smeta.lines.length + 1
  const added = change.lines.map((line) => {
    let code = String(cursor).padStart(2, "0")
    while (used.has(code)) {
      cursor += 1
      code = String(cursor).padStart(2, "0")
    }
    used.add(code)
    cursor += 1
    return {
      id: `SL-${project.id}-${code}`,
      code,
      name: line.name,
      unit: line.unit,
      qty: line.qty,
      unitPrice: line.unitPrice,
      doneQty: 0,
      billedQty: 0,
      laborHours: line.laborHours,
      recipe: line.recipe,
    }
  })
  const extra = roundMoney(added.reduce((sum, line) => sum + line.qty * line.unitPrice, 0))
  const version = smeta.version + 1
  return {
    patch: {
      smetas: state.smetas.map((item) => (item.id === smeta.id ? { ...item, version, lines: [...item.lines, ...added] } : item)),
      contracts: state.contracts.map((item) => (item.id === contract.id ? { ...item, value: item.value + extra } : item)),
      projects: state.projects.map((item) => (item.id === project.id ? { ...item, budget: item.budget + extra } : item)),
      changes: state.changes.map((item) => (item.id === changeId ? { ...item, status: "tesdiq", smetaVersion: version } : item)),
      audit: audit(state, actor, "Əlavə iş təsdiqi", `${change.id} · smeta v${version} · +${extra}`),
    },
  }
}

export function coverRequest(state: AppState, requestId: string, actor: Actor): OpResult {
  const request = state.requests.find((item) => item.id === requestId)
  if (!request || (request.status !== "gozleyir" && request.status !== "teklif")) return fail("Açıq tələbnamə seçin.")
  const siteId = `LOC-${request.projectId}`
  const piles = state.stocks
    .filter((row) => row.materialId === request.materialId && row.locationId !== siteId && row.qty > 0)
    .slice()
    .sort((a, b) => b.qty - a.qty)
  const away = roundQty(piles.reduce((sum, row) => sum + row.qty, 0))
  if (away + 1e-9 < request.qty) return fail(`Anbar qalığı ${away} ${request.unit}-dir. Təklif toplanmalıdır.`)
  let stocks = state.stocks.map((row) => ({ ...row }))
  let movements = state.movements
  let left = request.qty
  for (const pile of piles) {
    if (!(left > 0)) break
    const take = roundQty(Math.min(left, onHand(stocks, request.materialId, pile.locationId)))
    if (!(take > 0)) continue
    const taken = takeStock(stocks, request.materialId, pile.locationId, take)
    if (taken.error) return fail(taken.error)
    stocks = addStock(taken.stocks, request.materialId, siteId, take)
    movements = [
      {
        id: nextId("MV", movements),
        material: request.material,
        materialId: request.materialId,
        type: "transfer",
        qty: take,
        unit: request.unit,
        project: request.project,
        locationId: siteId,
        from: pile.locationId,
        date: TODAY,
        by: actor.name,
      },
      ...movements,
    ]
    left = roundQty(left - take)
  }
  return {
    patch: {
      stocks,
      materials: syncMaterials(state.materials, stocks),
      movements,
      requests: state.requests.map((item) => (item.id === requestId ? { ...item, status: "anbar" } : item)),
      audit: audit(state, actor, "Tələb anbardan ödənildi", `${request.id} · ${request.qty} ${request.unit}`),
    },
  }
}

export function addQuote(state: AppState, form: QuoteForm, actor: Actor): OpResult {
  const amount = roundMoney(form.amount)
  const days = Math.round(Number(form.days) || 0)
  if (!form.requestId || !form.supplier.trim() || !(amount > 0)) return fail("Tələb, təchizatçı və məbləğ vacibdir.")
  const request = state.requests.find((item) => item.id === form.requestId)
  if (!request || (request.status !== "gozleyir" && request.status !== "teklif")) return fail("Bu tələbə təklif yazılmır.")
  const quote: Quote = {
    id: nextId("TKL", state.quotes),
    requestId: form.requestId,
    supplier: form.supplier.trim(),
    amount,
    days: days > 0 ? days : 7,
    status: "acik",
  }
  return {
    patch: {
      quotes: [quote, ...state.quotes],
      requests: state.requests.map((item) => (item.id === form.requestId ? { ...item, status: "teklif" } : item)),
      audit: audit(state, actor, "Təklif yazıldı", `${quote.id} · ${quote.supplier}`),
    },
  }
}

export function awardQuote(state: AppState, quoteId: string, actor: Actor): OpResult {
  const quote = state.quotes.find((item) => item.id === quoteId)
  if (!quote || quote.status !== "acik") return fail("Açıq təklif seçin.")
  const request = state.requests.find((item) => item.id === quote.requestId)
  if (!request || request.status === "sifaris" || request.status === "anbar") return fail("Tələb artıq bağlanıb.")
  const order: PurchaseOrder = {
    id: nextId("PO", state.purchaseOrders),
    supplier: quote.supplier,
    item: request.material,
    materialId: request.materialId,
    qty: request.qty,
    unit: request.unit,
    amount: quote.amount,
    status: "tesdiq",
    eta: "2026-10-02",
    receivedQty: 0,
    requestId: request.id,
  }
  return {
    patch: {
      purchaseOrders: [order, ...state.purchaseOrders],
      requests: state.requests.map((item) => (item.id === request.id ? { ...item, status: "sifaris", poId: order.id } : item)),
      quotes: state.quotes.map((item) => {
        if (item.requestId !== quote.requestId) return item
        return { ...item, status: item.id === quote.id ? "secildi" : "redd" }
      }),
      audit: audit(state, actor, "Təklif seçildi", `${quote.supplier} → ${order.id}`),
    },
  }
}

export function payPayable(state: AppState, payableId: string, actor: Actor): OpResult {
  const row = state.payables.find((item) => item.id === payableId)
  if (!row || row.status !== "acik") return fail("Açıq borc seçin.")
  if (periodClosed(state, row.date)) return fail("Bağlı dövrün borcu bağlanmır.")
  return {
    patch: {
      payables: state.payables.map((item) => (item.id === payableId ? { ...item, status: "odenilib" } : item)),
      audit: audit(state, actor, "Təchizatçı ödənişi", `${row.id} · ${row.supplier}`),
    },
  }
}

export function runPayroll(state: AppState, actor: Actor): OpResult {
  const open = state.reports.filter((item) => item.status === "tesdiq" && !item.payrollId && (item.attendance?.length || 0) > 0)
  if (!open.length) return fail("Tabeli bağlanmamış gündəlik yoxdur.")
  const hours = new Map<string, number>()
  for (const report of open) {
    for (const row of report.attendance || []) {
      hours.set(row.personId, roundQty((hours.get(row.personId) || 0) + row.hours))
    }
  }
  const lines = [...hours.entries()].map(([personId, worked]) => {
    const person = state.people.find((item) => item.id === personId)
    return { personId, name: person?.name || personId, hours: worked, amount: roundMoney(worked * LABOR_RATE) }
  })
  const payroll = {
    id: nextId("MH", state.payrolls),
    date: TODAY,
    lines,
    total: lines.reduce((sum, line) => sum + line.amount, 0),
    status: "acik" as const,
  }
  const ids = new Set(open.map((item) => item.id))
  return {
    patch: {
      payrolls: [payroll, ...state.payrolls],
      reports: state.reports.map((item) => (ids.has(item.id) ? { ...item, payrollId: payroll.id } : item)),
      audit: audit(state, actor, "Əmək haqqı hesablandı", `${payroll.id} · ${payroll.total}`),
    },
  }
}

export function openService(state: AppState, form: ServiceForm, actor: Actor): OpResult {
  const asset = state.assets.find((item) => item.id === form.assetId)
  if (!asset) return fail("Texnika tapılmadı.")
  if (asset.status === "servis") return fail("Texnika artıq servisdədir.")
  const qty = roundQty(form.qty || 0)
  const material = form.materialId ? state.materials.find((item) => item.id === form.materialId) : undefined
  let stocks = state.stocks
  let movements = state.movements
  let expenses = state.expenses
  let projects = state.projects
  let cost = 0
  if (material && qty > 0) {
    const taken = takeStock(stocks, material.id, "LOC-MERKEZ", qty)
    if (taken.error) return fail(taken.error)
    stocks = taken.stocks
    cost = roundMoney(qty * material.price)
    movements = [
      {
        id: nextId("MV", movements),
        material: material.name,
        materialId: material.id,
        type: "mexaric",
        qty,
        unit: material.unit,
        project: asset.site,
        locationId: "LOC-MERKEZ",
        date: TODAY,
        by: actor.name,
      },
      ...movements,
    ]
    const project = state.projects.find((item) => item.name === asset.site)
    if (project && cost > 0) {
      const spent = spend({ ...state, expenses, projects }, { category: "Texnika", vendor: "Servis", project: project.name, amount: cost })
      expenses = spent.expenses
      projects = spent.projects
    }
  }
  const job: ServiceJob = {
    id: nextId("SRV", state.services),
    assetId: asset.id,
    asset: asset.name,
    project: asset.site,
    status: "acik",
    opened: TODAY,
    note: (form.note || "").trim() || "Planlı servis",
    materialId: material?.id,
    qty: qty > 0 ? qty : undefined,
    cost,
  }
  return {
    patch: {
      services: [job, ...state.services],
      assets: state.assets.map((item) => (item.id === asset.id ? { ...item, status: "servis" } : item)),
      stocks,
      materials: syncMaterials(state.materials, stocks),
      movements,
      expenses,
      projects,
      audit: audit(state, actor, "Servis açıldı", `${asset.name} · ${job.id}`),
    },
  }
}

function dated(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function driverHold(state: AppState, driverId: string, assetId?: string) {
  if (!driverId) return ""
  const driver = state.drivers.find((item) => item.id === driverId)
  if (!driver) return "Sürücü tapılmadı."
  if (driver.status !== "aktiv") return "Yalnız aktiv sürücü təyin olunur."
  if (driver.expires < TODAY) return "Sürücünün vəsiqəsinin vaxtı bitib."
  const other = state.assets.find((item) => item.driverId === driverId && item.id !== assetId)
  if (other) return "Sürücü artıq başqa texnikadadır."
  return ""
}

function vehicleFields(form: VehicleForm): { error: string; fields?: undefined } | { error?: undefined; fields: Omit<Asset, "id" | "status" | "utilization"> } {
  const name = form.name.trim()
  const type = form.type.trim()
  const site = form.site.trim()
  if (!name || !type || !site) return { error: "Ad, növ və yer vacibdir." }
  if (!dated(form.nextService)) return { error: "Servis tarixi vacibdir." }
  const year = Number(form.year)
  if (form.year && (!Number.isInteger(year) || year < 1980 || year > 2035)) return { error: "İl düzgün deyil." }
  const hours = roundQty(form.hours || 0)
  const odometer = roundQty(form.odometer || 0)
  if (hours < 0 || odometer < 0) return { error: "Göstərici mənfi ola bilməz." }
  return {
    fields: {
      name,
      type,
      site,
      hours,
      nextService: form.nextService,
      rate: roundMoney(form.rate || 0),
      fuelPerHour: roundQty(form.fuelPerHour || 0),
      plate: form.plate.trim() || undefined,
      year: form.year ? year : undefined,
      ownership: form.ownership,
      fuel: form.fuel,
      meter: form.meter,
      odometer,
      driverId: form.driverId || undefined,
    },
  }
}

export function saveVehicle(state: AppState, form: VehicleForm, actor: Actor): OpResult {
  const built = vehicleFields(form)
  if (built.error || !built.fields) return fail(built.error || "Texnika yazılmadı.")
  const held = driverHold(state, form.driverId, form.id)
  if (held) return fail(held)
  if (form.id) {
    const current = state.assets.find((item) => item.id === form.id)
    if (!current) return fail("Texnika tapılmadı.")
    return {
      patch: {
        assets: state.assets.map((item) => (item.id === form.id ? { ...item, ...built.fields } : item)),
        audit: audit(state, actor, "Texnika yazıldı", `${current.id} · ${built.fields.name}`),
      },
    }
  }
  const created: AppState["assets"][number] = {
    id: nextId("AST", state.assets),
    status: "bos",
    utilization: 0,
    ...built.fields,
  }
  return {
    patch: {
      assets: [created, ...state.assets],
      audit: audit(state, actor, "Texnika açıldı", `${created.id} · ${created.name}`),
    },
  }
}

export function assignVehicle(state: AppState, form: AssignForm, actor: Actor): OpResult {
  const asset = state.assets.find((item) => item.id === form.assetId)
  if (!asset) return fail("Texnika tapılmadı.")
  if (asset.status === "servis") return fail("Servisdə olan texnika əvvəl bağlanmalıdır.")
  if (form.status === "servis") return fail("Servis ayrıca açılır.")
  if (state.trips.some((item) => item.assetId === asset.id && item.status === "yolda") && (form.site.trim() !== asset.site || form.status === "bos")) {
    return fail("Yolda olan texnikanın yeri dəyişmir.")
  }
  if (form.status === "bos" && state.trips.some((item) => item.assetId === asset.id && (item.status === "plan" || item.status === "yolda"))) {
    return fail("Açıq reysi olan texnika park olunmur.")
  }
  const site = form.site.trim()
  if (!site) return fail("Yer vacibdir.")
  const held = driverHold(state, form.driverId, asset.id)
  if (held) return fail(held)
  return {
    patch: {
      assets: state.assets.map((item) =>
        item.id === asset.id ? { ...item, site, status: form.status, driverId: form.driverId || undefined } : item,
      ),
      audit: audit(state, actor, "Texnika təyin olundu", `${asset.name} · ${site}`),
    },
  }
}

export function saveDriver(state: AppState, form: DriverForm, actor: Actor): OpResult {
  const name = form.name.trim()
  const license = form.license.trim()
  const category = form.category.trim()
  const phone = form.phone.trim()
  if (!name || !license || !category || !phone) return fail("Ad, telefon, vəsiqə və kateqoriya vacibdir.")
  if (!dated(form.expires)) return fail("Vəsiqə tarixi vacibdir.")
  if (form.id) {
    const current = state.drivers.find((item) => item.id === form.id)
    if (!current) return fail("Sürücü tapılmadı.")
    const open = state.trips.some((item) => item.driverId === current.id && (item.status === "plan" || item.status === "yolda"))
    if (form.status !== "aktiv" && open) return fail("Açıq reysi olan sürücü dayandırıla bilməz.")
    const next: Driver = { ...current, name, phone, license, category, expires: form.expires, status: form.status }
    return {
      patch: {
        drivers: state.drivers.map((item) => (item.id === current.id ? next : item)),
        assets:
          form.status === "aktiv"
            ? state.assets
            : state.assets.map((item) => (item.driverId === current.id ? { ...item, driverId: undefined } : item)),
        audit: audit(state, actor, "Sürücü yazıldı", `${current.id} · ${name}`),
      },
    }
  }
  const created: Driver = {
    id: nextId("DRV", state.drivers),
    name,
    phone,
    license,
    category,
    expires: form.expires,
    status: form.status,
  }
  return {
    patch: {
      drivers: [created, ...state.drivers],
      audit: audit(state, actor, "Sürücü açıldı", `${created.id} · ${name}`),
    },
  }
}

function tripOpen(trip: Trip) {
  return trip.status === "plan" || trip.status === "yolda"
}

export function openTrip(state: AppState, form: TripForm, actor: Actor): OpResult {
  const asset = state.assets.find((item) => item.id === form.assetId)
  const driver = state.drivers.find((item) => item.id === form.driverId)
  const project = state.projects.find((item) => item.name === form.project.trim())
  if (!asset) return fail("Texnika tapılmadı.")
  if (asset.status === "servis") return fail("Servisdə olan texnika reysə çıxmır.")
  if (!driver) return fail("Sürücü tapılmadı.")
  if (driver.status !== "aktiv") return fail("Yalnız aktiv sürücü reysə çıxır.")
  if (driver.expires < TODAY) return fail("Sürücünün vəsiqəsinin vaxtı bitib.")
  if (!project) return fail("Layihə tapılmadı.")
  const from = form.from.trim()
  const to = form.to.trim()
  const cargo = form.cargo.trim()
  const km = roundQty(form.km)
  if (!from || !to || !cargo || !(km > 0)) return fail("Marşrut, yük və yürüş vacibdir.")
  if (state.trips.some((item) => item.assetId === asset.id && tripOpen(item))) return fail("Bu texnikanın açıq reysi var.")
  if (state.trips.some((item) => item.driverId === driver.id && tripOpen(item))) return fail("Bu sürücünün açıq reysi var.")
  const trip: Trip = {
    id: nextId("TRP", state.trips),
    assetId: asset.id,
    driverId: driver.id,
    project: project.name,
    from,
    to,
    cargo,
    km,
    date: TODAY,
    status: "plan",
    note: form.note.trim(),
  }
  return {
    patch: {
      trips: [trip, ...state.trips],
      audit: audit(state, actor, "Reys açıldı", `${trip.id} · ${asset.name}`),
    },
  }
}

export function departTrip(state: AppState, tripId: string, actor: Actor): OpResult {
  const trip = state.trips.find((item) => item.id === tripId)
  if (!trip || trip.status !== "plan") return fail("Planlı reys seçin.")
  const asset = state.assets.find((item) => item.id === trip.assetId)
  const driver = state.drivers.find((item) => item.id === trip.driverId)
  if (!asset || asset.status === "servis") return fail("Servisdə olan texnika yola düşmür.")
  if (!driver || driver.status !== "aktiv") return fail("Sürücü aktiv deyil.")
  if (driver.expires < TODAY) return fail("Sürücünün vəsiqəsinin vaxtı bitib.")
  return {
    patch: {
      trips: state.trips.map((item) => (item.id === trip.id ? { ...item, status: "yolda" } : item)),
      assets: state.assets.map((item) => (item.id === asset.id && item.status === "bos" ? { ...item, status: "sahede" } : item)),
      audit: audit(state, actor, "Reys yola düşdü", `${trip.id} · ${asset.name}`),
    },
  }
}

export function arriveTrip(state: AppState, tripId: string, actor: Actor): OpResult {
  const trip = state.trips.find((item) => item.id === tripId)
  if (!trip || trip.status !== "yolda") return fail("Yolda olan reys seçin.")
  const asset = state.assets.find((item) => item.id === trip.assetId)
  if (!asset) return fail("Texnika tapılmadı.")
  return {
    patch: {
      trips: state.trips.map((item) => (item.id === trip.id ? { ...item, status: "catdi" } : item)),
      assets: state.assets.map((item) =>
        item.id === asset.id ? { ...item, odometer: roundQty((item.odometer || 0) + trip.km) } : item,
      ),
      audit: audit(state, actor, "Reys çatdı", `${trip.id} · ${trip.km} km`),
    },
  }
}

export function cancelTrip(state: AppState, tripId: string, actor: Actor): OpResult {
  const trip = state.trips.find((item) => item.id === tripId)
  if (!trip || !tripOpen(trip)) return fail("Bağlanmış reys ləğv olunmur.")
  return {
    patch: {
      trips: state.trips.map((item) => (item.id === trip.id ? { ...item, status: "legv" } : item)),
      audit: audit(state, actor, "Reys ləğv olundu", trip.id),
    },
  }
}

function takeDiesel(stocks: AppState["stocks"], liters: number) {
  const rows = stocks.filter((row) => row.materialId === "MAT-DSL" && row.qty + 1e-9 >= liters)
  const place = rows.find((row) => row.locationId === "LOC-MERKEZ") || rows.find((row) => row.locationId === "LOC-ZAVOD") || rows[0]
  if (!place) return { error: "Dizel anbarda çatmır.", stocks, locationId: "" }
  const taken = takeStock(stocks, "MAT-DSL", place.locationId, liters)
  if (taken.error) return { error: taken.error, stocks, locationId: place.locationId }
  return { stocks: taken.stocks, locationId: place.locationId }
}

export function logFuel(state: AppState, form: FuelForm, actor: Actor): OpResult {
  const asset = state.assets.find((item) => item.id === form.assetId)
  const project = state.projects.find((item) => item.name === form.project.trim())
  const liters = roundQty(form.liters)
  if (!asset) return fail("Texnika tapılmadı.")
  if (!project) return fail("Layihə tapılmadı.")
  if (!(liters > 0)) return fail("Litr vacibdir.")
  const reading = roundQty(form.reading || 0)
  if (reading > 0) {
    const current = asset.meter === "km" ? asset.odometer || 0 : asset.hours
    if (reading + 1e-9 < current) return fail("Göstərici əvvəlkindən kiçikdir.")
  }
  let stocks = state.stocks
  let movements = state.movements
  let amount = 0
  if ((asset.fuel || "dizel") === "benzin") {
    amount = roundMoney(liters * 1.4)
  } else {
    const material = state.materials.find((item) => item.id === "MAT-DSL")
    if (!material) return fail("Dizel materialı tapılmadı.")
    const taken = takeDiesel(stocks, liters)
    if (taken.error) return fail(taken.error)
    stocks = taken.stocks
    amount = roundMoney(liters * material.price)
    const place = state.locations.find((item) => item.id === taken.locationId)?.name || ""
    movements = [
      {
        id: nextId("MV", movements),
        material: material.name,
        materialId: material.id,
        type: "mexaric",
        qty: liters,
        unit: material.unit,
        project: project.name,
        locationId: taken.locationId,
        date: TODAY,
        by: actor.name,
        note: `${asset.name} yanacağı${place ? ` · ${place}` : ""}`,
      },
      ...movements,
    ]
  }
  const spent = spend({ expenses: state.expenses, projects: state.projects }, {
    category: "Yanacaq",
    vendor: "Yanacaq anbarı",
    project: project.name,
    amount,
  })
  const fill: FuelFill = {
    id: nextId("YNC", state.fuels),
    assetId: asset.id,
    liters,
    reading,
    amount,
    project: project.name,
    date: TODAY,
    by: actor.name,
    note: form.note.trim(),
  }
  return {
    patch: {
      fuels: [fill, ...state.fuels],
      assets: state.assets.map((item) => {
        if (item.id !== asset.id || !(reading > 0)) return item
        return item.meter === "km" ? { ...item, odometer: reading } : { ...item, hours: reading }
      }),
      stocks,
      materials: syncMaterials(state.materials, stocks),
      movements,
      expenses: spent.expenses,
      projects: spent.projects,
      audit: audit(state, actor, "Yanacaq yazıldı", `${asset.name} · ${liters} litr`),
    },
  }
}

export function saveFleetDoc(state: AppState, form: FleetDocForm, actor: Actor): OpResult {
  const asset = state.assets.find((item) => item.id === form.assetId)
  const number = form.number.trim()
  const issuer = form.issuer.trim()
  if (!asset) return fail("Texnika tapılmadı.")
  if (!number || !issuer || !dated(form.expires)) return fail("Nömrə, verən və bitmə tarixi vacibdir.")
  const doc: FleetDoc = {
    id: nextId("SDN", state.fleetDocs),
    assetId: asset.id,
    kind: form.kind,
    number,
    issuer,
    expires: form.expires,
  }
  return {
    patch: {
      fleetDocs: [doc, ...state.fleetDocs],
      audit: audit(state, actor, "Park sənədi yazıldı", `${asset.name} · ${number}`),
    },
  }
}

export function closeService(state: AppState, assetId: string, actor: Actor): OpResult {
  const asset = state.assets.find((item) => item.id === assetId)
  const job = state.services.find((item) => item.assetId === assetId && item.status === "acik")
  if (!asset || asset.status !== "servis") return fail("Servisdə olan texnika seçin.")
  return {
    patch: {
      assets: state.assets.map((item) => (item.id === assetId ? { ...item, status: "sahede" } : item)),
      services: state.services.map((item) => (item.id === job?.id ? { ...item, status: "bagli", closed: TODAY } : item)),
      audit: audit(state, actor, "Servis bağlandı", asset.name),
    },
  }
}

function gearNote(note: string) {
  const text = note.trim()
  if (!text) return ""
  return text
}

function gearPatch(state: AppState, gear: Gear, status: GearStatus, kind: GearEvent["kind"], note: string, actor: Actor, action: string, nextCheck?: string): OpResult {
  const event: GearEvent = {
    id: nextId("GV", state.gearEvents),
    gearId: gear.id,
    kind,
    note,
    by: actor.name,
    date: TODAY,
    status,
  }
  return {
    patch: {
      gear: state.gear.map((item) => (item.id === gear.id ? { ...item, status, home: status === "istifade" || status === "anbarda" ? status : gear.home, nextCheck: nextCheck || item.nextCheck } : item)),
      gearEvents: [event, ...state.gearEvents],
      audit: audit(state, actor, action, `${gear.name} · ${note}`),
    },
  }
}

export function addGear(state: AppState, form: GearForm, actor: Actor): OpResult {
  const name = form.name.trim()
  const place = form.place.trim()
  const unit = form.unit.trim()
  const qty = roundQty(form.qty)
  if (!name || !place || !unit || !(qty > 0) || !form.nextCheck) return fail("Ad, yer, vahid, say və yoxlama tarixi vacibdir.")
  const gear: Gear = {
    id: nextId("GR", state.gear),
    name,
    category: form.category,
    place,
    qty,
    unit,
    status: "anbarda",
    home: "anbarda",
    nextCheck: form.nextCheck,
  }
  const event: GearEvent = { id: nextId("GV", state.gearEvents), gearId: gear.id, kind: "acilis", note: "Reyestrə yazıldı.", by: actor.name, date: TODAY, status: "anbarda" }
  return {
    patch: {
      gear: [gear, ...state.gear],
      gearEvents: [event, ...state.gearEvents],
      audit: audit(state, actor, "Təchizat açıldı", `${gear.name} · ${gear.place}`),
    },
  }
}

export function sendGearCheck(state: AppState, id: string, note: string, actor: Actor): OpResult {
  const gear = state.gear.find((item) => item.id === id)
  const text = gearNote(note)
  if (!gear) return fail("Təchizat tapılmadı.")
  if (!text) return fail("Yoxlama qeydi vacibdir.")
  if (gear.status === "kohnelmis" || gear.status === "itki") return fail("Dövriyyədən çıxmış təchizat yoxlamaya getmir.")
  if (gear.status === "gonderildi" || gear.status === "yoxlamada" || gear.status === "tesdiq") return fail("Təchizat artıq yoxlama prosesindədir.")
  if (gear.status === "deyisme") return fail("Əvvəl dəyişməni qəbul edin.")
  return gearPatch(state, { ...gear, home: gear.status === "anbarda" ? "anbarda" : "istifade" }, "gonderildi", "yoxlama", text, actor, "Yoxlamaya göndərildi")
}

export function startGearCheck(state: AppState, id: string, note: string, actor: Actor): OpResult {
  const gear = state.gear.find((item) => item.id === id)
  const text = gearNote(note)
  if (!gear) return fail("Təchizat tapılmadı.")
  if (gear.status !== "gonderildi") return fail("Əvvəl təchizatı yoxlamaya göndərin.")
  if (!text) return fail("Yoxlama qeydi vacibdir.")
  return gearPatch(state, gear, "yoxlamada", "baslama", text, actor, "Yoxlama açıldı")
}

export function confirmGearCheck(state: AppState, id: string, note: string, actor: Actor): OpResult {
  const gear = state.gear.find((item) => item.id === id)
  const text = gearNote(note)
  if (!gear) return fail("Təchizat tapılmadı.")
  if (gear.status !== "yoxlamada") return fail("Yoxlamada olan təchizat seçin.")
  if (!text) return fail("Təsdiq qeydi vacibdir.")
  return gearPatch(state, gear, "tesdiq", "tesdiq", text, actor, "Yoxlama təsdiqləndi")
}

export function finishGearCheck(state: AppState, id: string, note: string, actor: Actor): OpResult {
  const gear = state.gear.find((item) => item.id === id)
  const text = gearNote(note)
  if (!gear) return fail("Təchizat tapılmadı.")
  if (gear.status !== "tesdiq") return fail("Əvvəl yoxlamanın nəticəsini təsdiqləyin.")
  if (!text) return fail("Bitmə qeydi vacibdir.")
  return gearPatch(state, gear, gear.home, "bitdi", text, actor, "Yoxlama bitdi", "2026-12-23")
}

export function returnGearCheck(state: AppState, id: string, note: string, actor: Actor): OpResult {
  const gear = state.gear.find((item) => item.id === id)
  const text = gearNote(note)
  if (!gear) return fail("Təchizat tapılmadı.")
  if (gear.status !== "gonderildi" && gear.status !== "yoxlamada" && gear.status !== "tesdiq") return fail("Yoxlama prosesində olan təchizat seçin.")
  if (!text) return fail("Qaytarma qeydi vacibdir.")
  return gearPatch(state, gear, gear.home, "qaytarma", text, actor, "Yoxlamadan qaytarıldı")
}

export function replaceGear(state: AppState, id: string, note: string, actor: Actor): OpResult {
  const gear = state.gear.find((item) => item.id === id)
  const text = gearNote(note)
  if (!gear) return fail("Təchizat tapılmadı.")
  if (gear.status === "kohnelmis" || gear.status === "itki") return fail("Dövriyyədən çıxmış təchizat dəyişilmir.")
  if (gear.status === "deyisme") return fail("Dəyişmə artıq açıqdır.")
  if (!text) return fail("Dəyişmə səbəbi vacibdir.")
  return gearPatch(state, gear, "deyisme", "deyisme", text, actor, "Dəyişməyə yazıldı")
}

export function acceptGear(state: AppState, id: string, note: string, actor: Actor): OpResult {
  const gear = state.gear.find((item) => item.id === id)
  const text = gearNote(note)
  if (!gear) return fail("Təchizat tapılmadı.")
  if (gear.status !== "deyisme") return fail("Dəyişmədə olan təchizat seçin.")
  if (!text) return fail("Qəbul qeydi vacibdir.")
  return gearPatch(state, gear, gear.home, "qebul", text, actor, "Yeni təchizat qəbul edildi", "2026-12-23")
}

export function obsoleteGear(state: AppState, id: string, note: string, actor: Actor): OpResult {
  const gear = state.gear.find((item) => item.id === id)
  const text = gearNote(note)
  if (!gear) return fail("Təchizat tapılmadı.")
  if (gear.status === "itki" || gear.status === "kohnelmis") return fail("Bu təchizat artıq dövriyyədən çıxıb.")
  if (!text) return fail("Köhnəlmə qeydi vacibdir.")
  return gearPatch(state, gear, "kohnelmis", "kohnelme", text, actor, "Köhnəlmiş yazılıb")
}

const PLACE_KINDS: LocationKind[] = ["merkez", "zavod", "sex", "sahe"]

function sameName(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}

function placeTaken(state: AppState, id: string, ignorePlantId = "") {
  if (state.locations.find((item) => item.id === id)?.projectId) return "Bu anbar layihə sahəsinə bağlıdır."
  if (state.plants.some((item) => item.locationId === id && item.id !== ignorePlantId)) return "Bu anbar zavoda və ya sexə bağlıdır."
  if (state.stocks.some((row) => row.locationId === id && row.qty > 0)) return "Bu anbarda qalıq var."
  if (state.shipments.some((item) => item.stops.includes(id))) return "Bu anbar marşrutdadır."
  if (state.movements.some((item) => item.locationId === id || item.from === id)) return "Bu anbarda hərəkət yazılıb."
  return ""
}

export function addLocation(state: AppState, form: LocationForm, actor: Actor): OpResult {
  const name = form.name.trim()
  if (!name) return fail("Anbar adı vacibdir.")
  if (!PLACE_KINDS.includes(form.kind)) return fail("Anbar növü vacibdir.")
  if (state.locations.some((item) => sameName(item.name, name))) return fail("Bu adda anbar var.")
  const location: Location = { id: nextId("ANB", state.locations.filter((item) => item.id.startsWith("ANB-"))), name, kind: form.kind }
  return {
    patch: {
      locations: [...state.locations, location],
      audit: audit(state, actor, "Anbar açıldı", location.name),
    },
  }
}

export function updateLocation(state: AppState, id: string, form: LocationForm, actor: Actor): OpResult {
  const current = state.locations.find((item) => item.id === id)
  const name = form.name.trim()
  if (!current) return fail("Anbar tapılmadı.")
  if (!name) return fail("Anbar adı vacibdir.")
  if (!PLACE_KINDS.includes(form.kind)) return fail("Anbar növü vacibdir.")
  if (state.locations.some((item) => item.id !== id && sameName(item.name, name))) return fail("Bu adda anbar var.")
  return {
    patch: {
      locations: state.locations.map((item) => (item.id === id ? { ...item, name, kind: form.kind } : item)),
      audit: audit(state, actor, "Anbar yeniləndi", name),
    },
  }
}

export function deleteLocation(state: AppState, id: string, actor: Actor): OpResult {
  const current = state.locations.find((item) => item.id === id)
  if (!current) return fail("Anbar tapılmadı.")
  const taken = placeTaken(state, id)
  if (taken) return fail(taken)
  return {
    patch: {
      locations: state.locations.filter((item) => item.id !== id),
      audit: audit(state, actor, "Anbar silindi", current.name),
    },
  }
}

export function addShop(state: AppState, form: ShopForm, actor: Actor): OpResult {
  const name = form.name.trim()
  const place = form.place.trim()
  const unit = form.unit.trim()
  const shift = form.shift.trim() || "Gündüz növbəsi"
  const plan = Number(form.plan)
  if (!name || !place || !unit) return fail("Ad, yer və vahid vacibdir.")
  if (!Number.isFinite(plan) || plan < 0) return fail("Plan mənfi ola bilməz.")
  if (state.plants.some((item) => item.kind === "sex" && sameName(item.name, name))) return fail("Bu adda sex var.")
  if (state.locations.some((item) => sameName(item.name, name))) return fail("Bu adda anbar var.")
  const id = nextId("SEX", state.plants.filter((item) => item.id.startsWith("SEX-")))
  const location: Location = { id: `LOC-${id}`, name, kind: "sex" }
  return {
    patch: {
      plants: [...state.plants, { id, name, place, shift, plan, fact: 0, unit, kind: "sex", locationId: location.id, planStatus: "tesdiq", planBy: actor.name }],
      locations: [...state.locations, location],
      audit: audit(state, actor, "Sex açıldı", name),
    },
  }
}

export function updateShop(state: AppState, id: string, form: ShopForm, actor: Actor): OpResult {
  const current = state.plants.find((item) => item.id === id && item.kind === "sex")
  const name = form.name.trim()
  const place = form.place.trim()
  const unit = form.unit.trim()
  const shift = form.shift.trim() || "Gündüz növbəsi"
  const plan = Number(form.plan)
  if (!current) return fail("Sex tapılmadı.")
  if (!name || !place || !unit) return fail("Ad, yer və vahid vacibdir.")
  if (!Number.isFinite(plan) || plan < 0) return fail("Plan mənfi ola bilməz.")
  if (state.plants.some((item) => item.id !== id && item.kind === "sex" && sameName(item.name, name))) return fail("Bu adda sex var.")
  if (state.locations.some((item) => item.id !== current.locationId && sameName(item.name, name))) return fail("Bu adda anbar var.")
  const sole = state.plants.filter((item) => item.locationId === current.locationId).length === 1
  return {
    patch: {
      plants: state.plants.map((item) => (item.id === id ? { ...item, name, place, shift, unit, plan } : item)),
      locations: sole ? state.locations.map((item) => (item.id === current.locationId ? { ...item, name } : item)) : state.locations,
      orders: state.orders.map((item) => (item.plant === current.name ? { ...item, plant: name } : item)),
      assets: state.assets.map((item) => (item.site === current.name ? { ...item, site: name } : item)),
      people: state.people.map((item) => (item.site === current.name ? { ...item, site: name } : item)),
      journal: state.journal.map((item) => (item.site === current.name ? { ...item, site: name } : item)),
      audit: audit(state, actor, "Sex yeniləndi", name),
    },
  }
}

export function deleteShop(state: AppState, id: string, actor: Actor): OpResult {
  const current = state.plants.find((item) => item.id === id && item.kind === "sex")
  if (!current) return fail("Sex tapılmadı.")
  if (state.orders.some((item) => item.plant === current.name)) return fail("Bu sexin iş əmri var.")
  if (state.recipes.some((item) => item.plantId === id)) return fail("Bu sexin resepti var.")
  const shared = state.plants.some((item) => item.id !== id && item.locationId === current.locationId)
  if (!shared) {
    const taken = placeTaken(state, current.locationId, id)
    if (taken) return fail(taken)
  }
  return {
    patch: {
      plants: state.plants.filter((item) => item.id !== id),
      locations: shared ? state.locations : state.locations.filter((item) => item.id !== current.locationId),
      audit: audit(state, actor, "Sex silindi", current.name),
    },
  }
}

export function loseGear(state: AppState, id: string, note: string, actor: Actor): OpResult {
  const gear = state.gear.find((item) => item.id === id)
  const text = gearNote(note)
  if (!gear) return fail("Təchizat tapılmadı.")
  if (gear.status === "itki" || gear.status === "kohnelmis") return fail("Bu təchizat artıq dövriyyədən çıxıb.")
  if (!text) return fail("İtki qeydi vacibdir.")
  return gearPatch(state, gear, "itki", "itki", text, actor, "İtki yazıldı")
}
