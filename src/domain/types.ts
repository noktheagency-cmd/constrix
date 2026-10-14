export type Role = "director" | "pm" | "site" | "warehouse" | "procurement" | "accountant" | "sales"

export type Area =
  | "dashboard"
  | "projects"
  | "reports"
  | "site"
  | "assets"
  | "production"
  | "people"
  | "finance"
  | "audit"
  | "warehouse"
  | "supply"
  | "crm"
  | "clients"
  | "acts"
  | "tender"
  | "boq"
  | "spec"
  | "weather"
  | "guarantee"
  | "club"
  | "procure"

export type ProjectStatus = "aktiv" | "gecikir" | "tehvil" | "plan"
export type InvoiceStatus = "gecikir" | "gonderilib" | "odenilib" | "qaralama"
export type AssetStatus = "sahede" | "servis" | "bos" | "icarede"
export type Ownership = "oz" | "icare"
export type FuelKind = "dizel" | "benzin"
export type MeterKind = "saat" | "km"
export type DriverStatus = "aktiv" | "mezuniyyet" | "dayandirilib"
export type TripStatus = "plan" | "yolda" | "catdi" | "legv"
export type FleetDocKind = "sigorta" | "baxis" | "qeydiyyat" | "icaze"
export type GearCategory = "masin" | "avadanliq" | "levazimat" | "geyim" | "alet" | "sair"
export type GearStatus = "istifade" | "anbarda" | "gonderildi" | "yoxlamada" | "tesdiq" | "deyisme" | "kohnelmis" | "itki"
export type GearEventKind = "yoxlama" | "baslama" | "tesdiq" | "bitdi" | "qaytarma" | "deyisme" | "qebul" | "kohnelme" | "itki" | "acilis"
export type OrderStatus = "gedir" | "novbede" | "hazir" | "gonderildi" | "legv"
export type PoStatus = "yoldadir" | "tesdiq" | "qebul"
export type Heat = "isti" | "ilik" | "soyuq"
export type HrPlace = "sahe" | "ofis" | "istehsal"
export type PersonStatus = "sahede" | "ofisde" | "istehsalda" | "ezamiyyetde" | "mezuniyyet" | "xestelik" | "telim" | "dayandirilib" | "cixis"
export type MovementType = "medaxil" | "mexaric" | "transfer"
export type ActStatus = "qaralama" | "tesdiq" | "faktura"
export type ReportStatus = "qaralama" | "gonderilib" | "duzelis" | "tesdiq"
export type DealStage = "ilkin" | "teklif" | "danisiq" | "muqavile" | "uduzulub"
export type DocStatus = "gozleyir" | "tesdiq"
export type RequestStatus = "gozleyir" | "sifaris" | "anbar" | "teklif" | "redd"
export type ChangeStatus = "qaralama" | "tesdiq" | "redd"
export type QuoteStatus = "acik" | "secildi" | "redd"
export type PayableStatus = "acik" | "odenilib"
export type ExpenseStatus = "qaralama" | "tesdiq"
export type PayrollStatus = "acik" | "odenilib"
export type ServiceStatus = "acik" | "bagli"
export type Weather = "gunesli" | "buludlu" | "yagis" | "kulek"
export type ScheduleStatus = "odenilib" | "gonderilib" | "gozleyir"
export type SmetaStatus = "razilasma"
export type LocationKind = "merkez" | "zavod" | "sex" | "sahe"
export type PlantKind = "zavod" | "sex"

export interface Phase {
  name: string
  done?: boolean
  current?: boolean
}

export interface ProjectNote {
  id: string
  date: string
  text: string
}

export interface ProjectForm {
  name: string
  address: string
  district: string
  city: string
  type: string
  phase: string
  manager: string
  floors: string
  area: string
  start: string
  end: string
  status: ProjectStatus
}

export interface NewProjectForm extends ProjectForm {
  client: string
  budget: string
}

export interface DocumentForm {
  projectId: string
  title: string
  kind: string
  date: string
}

export interface Project {
  id: string
  name: string
  client: string
  district: string
  city: string
  address: string
  phase: string
  progress: number
  budget: number
  spent: number
  start: string
  end: string
  manager: string
  crew: number
  status: ProjectStatus
  type: string
  floors: number
  area: number
  phases: Phase[]
  notes: ProjectNote[]
  note?: string
  smetaId?: string
}

export interface Client {
  id: string
  name: string
  sector: string
  contact: string
  phone: string
  email: string
  city: string
  projects: number
  value: number
  since: string
}

export interface Lead {
  id: string
  name: string
  company: string
  value: number
  owner: string
  heat: Heat
  source: string
  next: string
}

export interface Deal {
  id: string
  title: string
  client: string
  value: number
  stage: DealStage
  owner: string
  close: string
  projectId?: string
}

export interface Invoice {
  id: string
  client: string
  project: string
  amount: number
  issued: string
  due: string
  status: InvoiceStatus
  net?: number
  vat?: number
  actId?: string
  advance?: number
  retention?: number
  workNet?: number
}

export interface Expense {
  id: string
  category: string
  vendor: string
  project: string
  amount: number
  date: string
  status?: ExpenseStatus
  smetaLineId?: string
}

export interface CashPoint {
  label: string
  value: number
}

export interface RevenuePoint {
  value: number
  delta: number
  label: string
}

export interface Asset {
  id: string
  name: string
  type: string
  site: string
  status: AssetStatus
  hours: number
  nextService: string
  utilization: number
  rate?: number
  fuelPerHour?: number
  plate?: string
  year?: number
  ownership?: Ownership
  fuel?: FuelKind
  meter?: MeterKind
  odometer?: number
  driverId?: string
}

export interface Driver {
  id: string
  name: string
  phone: string
  license: string
  category: string
  expires: string
  status: DriverStatus
}

export interface Trip {
  id: string
  assetId: string
  driverId: string
  project: string
  from: string
  to: string
  cargo: string
  km: number
  date: string
  status: TripStatus
  note: string
}

export interface FuelFill {
  id: string
  assetId: string
  liters: number
  reading: number
  amount: number
  project: string
  date: string
  by: string
  note: string
}

export interface FleetDoc {
  id: string
  assetId: string
  kind: FleetDocKind
  number: string
  issuer: string
  expires: string
}

export interface Gear {
  id: string
  name: string
  category: GearCategory
  place: string
  qty: number
  unit: string
  status: GearStatus
  home: "istifade" | "anbarda"
  nextCheck: string
}

export interface GearEvent {
  id: string
  gearId: string
  kind: GearEventKind
  note: string
  by: string
  date: string
  status: GearStatus
}

export interface GearForm {
  name: string
  category: GearCategory
  place: string
  qty: string
  unit: string
  nextCheck: string
}

export interface Plant {
  id: string
  name: string
  place: string
  shift: string
  plan: number
  fact: number
  unit: string
  kind: PlantKind
  locationId: string
  planStatus?: "qaralama" | "tesdiq"
  planBy?: string
}

export interface WorkIssue {
  materialId: string
  name: string
  qty: number
  unit: string
  amount: number
}

export interface WorkOrder {
  id: string
  plant: string
  product: string
  project: string
  qty: number
  unit: string
  status: OrderStatus
  due: string
  startedBy?: string
  closedBy?: string
  sentBy?: string
  cancelledBy?: string
  vehicle?: string
  note?: string
  cost?: number
  issued?: WorkIssue[]
}

export interface Material {
  id: string
  name: string
  unit: string
  qty: number
  min: number
  location: string
  price: number
}

export interface Movement {
  id: string
  material: string
  type: MovementType
  qty: number
  unit: string
  project: string
  date: string
  by: string
  materialId?: string
  locationId?: string
  smetaLineId?: string
  from?: string
  note?: string
}

export interface ShipmentLine {
  materialId: string
  material: string
  qty: number
  unit: string
  price: number
  amount: number
}

export interface Shipment {
  id: string
  stops: string[]
  step: number
  lines: ShipmentLine[]
  date: string
  by: string
  note?: string
}

export interface ShipmentForm {
  stops: string[]
  lines: { materialId: string; qty: string | number; price?: string | number }[]
  note?: string
}

export interface Supplier {
  id: string
  name: string
  category: string
  city: string
  rating: string
  terms: string
  contact: string
}

export interface PurchaseOrder {
  id: string
  supplier: string
  item: string
  qty: number
  unit: string
  amount: number
  status: PoStatus
  eta: string
  materialId?: string
  receivedQty?: number
  requestId?: string
}

export type AttendanceMark = "geldi" | "gec" | "gelmedi" | "mezuniyyet" | "ezamiyyet"
export type TerminalStatus = "online" | "offline"
export type LeaveKind = "illik" | "xestelik" | "odenissiz" | "ezamiyyet"
export type LeaveStatus = "gozleyir" | "tesdiq" | "redd"
export type HrPayKind = "maas" | "avans" | "mukafat" | "cerime"
export type HrPayStatus = "gozleyir" | "odenilib"
export type HrMoveKind = "zavod" | "tikinti" | "ofis"

export interface Person {
  id: string
  name: string
  role: string
  crew: string
  site: string
  placeKind: HrPlace
  status: PersonStatus
  phone: string
  email: string
  departmentId: string
  pin: string
  hired: string
  salary: number
  card: string
}

export interface PersonForm {
  name: string
  role: string
  crew: string
  phone: string
  status: PersonStatus
  email?: string
  departmentId?: string
  pin?: string
  hired?: string
  salary?: string
  card?: string
}

export interface Office {
  id: string
  name: string
  city: string
  address: string
}

export interface OfficeForm {
  name: string
  city: string
  address: string
}

export interface Department {
  id: string
  name: string
  code: string
  leadId: string
  site: string
}

export interface Terminal {
  id: string
  name: string
  code: string
  site: string
  status: TerminalStatus
  lastSeen: string
}

export interface AttendanceRow {
  id: string
  personId: string
  date: string
  inAt: string
  outAt: string
  mark: AttendanceMark
  terminalId: string
  hours: number
  note: string
}

export interface LeaveRequest {
  id: string
  personId: string
  kind: LeaveKind
  from: string
  to: string
  days: number
  status: LeaveStatus
  note: string
}

export interface HrPayment {
  id: string
  personId: string
  kind: HrPayKind
  amount: number
  date: string
  status: HrPayStatus
  note: string
  expenseId: string
}

export interface StaffForm {
  name: string
  role: string
  crew: string
  phone: string
  email: string
  status: PersonStatus
  departmentId: string
  pin: string
  hired: string
  salary: string
  card: string
  placeKind: HrPlace
  site: string
}

export interface DepartmentForm {
  name: string
  code: string
  leadId: string
  site: string
}

export interface TerminalForm {
  name: string
  code: string
  site: string
  status: TerminalStatus
}

export interface AttendanceForm {
  personId: string
  date: string
  inAt: string
  outAt: string
  mark: AttendanceMark
  terminalId: string
  note: string
}

export interface LeaveForm {
  personId: string
  kind: LeaveKind
  from: string
  to: string
  note: string
}

export interface HrPayForm {
  personId: string
  kind: HrPayKind
  amount: string
  date: string
  note: string
}

export interface HrMove {
  id: string
  personId: string
  date: string
  kind: HrMoveKind
  fromSite: string
  fromDepartmentId: string
  toSite: string
  toDepartmentId: string
  note: string
}

export interface HrMoveForm {
  personId: string
  date: string
  kind: HrMoveKind
  site: string
  departmentId: string
  note: string
}

export interface AssetEdit {
  name: string
  type: string
  hours: string
  nextService: string
  utilization: string
}

export interface Crew {
  name: string
  site: string
  size: number
  lead: string
  present: number
}

export interface JournalEntry {
  id: string
  time: string
  site: string
  text: string
}

export interface User {
  id: string
  name: string
  role: Role
  title: string
  initials: string
}

export interface Actor {
  name: string
  role: string
}

export interface RecipeItem {
  materialId: string
  qty: number
}

export interface Recipe {
  id: string
  product: string
  unit: string
  plantId: string
  items: RecipeItem[]
}

export interface WorkOrderForm {
  plantId: string
  recipeId: string
  project: string
  qty: string
  due: string
}

export interface DispatchTicket {
  vehicle?: string
  note?: string
}

export interface WasteForm {
  locationId: string
  materialId: string
  qty: string | number
  project: string
  reason: string
}

export interface ProductForm {
  plantId: string
  name: string
  unit: string
}

export interface RecipeEdit {
  name: string
  unit: string
  lines: FormulaLine[]
}

export interface FormulaLine {
  materialId: string
  qty: string | number
}

export interface SmetaLine {
  id: string
  code: string
  name: string
  unit: string
  qty: number
  unitPrice: number
  doneQty: number
  billedQty: number
  laborHours: number
  recipe: string
}

export interface Smeta {
  id: string
  projectId: string
  version: number
  status: SmetaStatus
  lines: SmetaLine[]
}

export interface ScheduleRow {
  id: string
  title: string
  due: string
  share: number
  status: ScheduleStatus
}

export interface Contract {
  id: string
  projectId: string
  client: string
  number: string
  signed: string
  value: number
  advancePct: number
  retentionPct: number
  vat: number
  schedule: ScheduleRow[]
}

export interface ActLine {
  smetaLineId: string
  code: string
  name: string
  unit: string
  unitPrice: number
  qty: number
  cumulativeQty: number
}

export interface Act {
  id: string
  number: string
  projectId: string
  project: string
  client: string
  contractNumber: string
  period: string
  date: string
  lines: ActLine[]
  net: number
  vat: number
  gross: number
  status: ActStatus
  invoiceId?: string
}

export type Forma3Kind = "araliq" | "yekun"
export type Forma3Status = "qaralama" | "tesdiq"

export interface Forma3Line {
  smetaLineId: string
  code: string
  name: string
  unit: string
  smetaQty: number
  smetaValue: number
  priorQty: number
  priorValue: number
  periodQty: number
  periodValue: number
  cumulativeQty: number
  cumulativeValue: number
  remainQty: number
  remainValue: number
}

export interface Forma3 {
  id: string
  number: string
  projectId: string
  project: string
  client: string
  contractNumber: string
  kind: Forma3Kind
  period: string
  date: string
  lines: Forma3Line[]
  smetaValue: number
  priorValue: number
  periodValue: number
  cumulativeValue: number
  remainValue: number
  advanceBalance: number
  retention: number
  vat: number
  payable: number
  status: Forma3Status
}

export type UnitKind = "menzil" | "ofis" | "parking"
export type PlaceKind = "bina" | "villa" | "heyet" | "plaza"
export type UnitStatus = "bos" | "bron" | "muqavile" | "satilib" | "acar"
export type CreditKind = "nagd" | "daxili" | "ipoteka"
export type SaleStatus = "aktiv" | "acar"
export type SalePayStatus = "gozleyir" | "odenilib"

export interface SubCompany {
  id: string
  name: string
  voen: string
  city: string
}

export interface Complex {
  id: string
  companyId: string
  projectId: string
  name: string
  city: string
  district: string
}

export interface Building {
  id: string
  companyId: string
  complexId: string
  projectId: string
  name: string
  kind: PlaceKind
  floors: number
}

export interface Unit {
  id: string
  buildingId: string
  kind: UnitKind
  number: string
  floor: number
  area: number
  price: number
  status: UnitStatus
  buyerId?: string
}

export interface Buyer {
  id: string
  name: string
  phone: string
  email: string
}

export interface SaleScheduleRow {
  id: string
  title: string
  due: string
  amount: number
  status: SalePayStatus
  paidOn?: string
}

export interface SaleContract {
  id: string
  number: string
  unitId: string
  buyerId: string
  date: string
  price: number
  credit: CreditKind
  status: SaleStatus
  schedule: SaleScheduleRow[]
}

export interface ReportLine {
  smetaLineId: string
  qty: number
}

export interface ReportMachine {
  assetId: string
  hours: number
}

export interface DailyReport {
  id: string
  projectId: string
  date: string
  weather: Weather
  note: string
  crew: number
  lines: ReportLine[]
  machines: ReportMachine[]
  status: ReportStatus
  author: string
  laborCost?: number
  machineCost?: number
  attendance?: Attendance[]
  payrollId?: string
}

export interface Attendance {
  personId: string
  hours: number
}

export interface Location {
  id: string
  name: string
  kind: LocationKind
  projectId?: string
}

export interface LocationForm {
  name: string
  kind: LocationKind
}

export interface ShopForm {
  name: string
  place: string
  shift: string
  unit: string
  plan: string
}

export interface Stock {
  materialId: string
  locationId: string
  qty: number
}

export interface MaterialRequest {
  id: string
  projectId: string
  project: string
  materialId: string
  material: string
  qty: number
  unit: string
  status: RequestStatus
  author: string
  date: string
  text?: string
  poId?: string
  decidedBy?: string
  decision?: string
}

export interface Document {
  id: string
  projectId: string
  title: string
  kind: string
  status: DocStatus
  date: string
}

export interface ChangeLine {
  name: string
  unit: string
  qty: number
  unitPrice: number
  laborHours: number
  recipe: string
}

export interface ChangeOrder {
  id: string
  projectId: string
  title: string
  reason: string
  status: ChangeStatus
  lines: ChangeLine[]
  author: string
  date: string
  smetaVersion?: number
}

export interface Quote {
  id: string
  requestId: string
  supplier: string
  amount: number
  days: number
  status: QuoteStatus
}

export interface Payable {
  id: string
  supplier: string
  poId: string
  amount: number
  status: PayableStatus
  date: string
}

export interface PayrollLine {
  personId: string
  name: string
  hours: number
  amount: number
}

export interface Payroll {
  id: string
  date: string
  lines: PayrollLine[]
  total: number
  status: PayrollStatus
}

export interface ServiceJob {
  id: string
  assetId: string
  asset: string
  project: string
  status: ServiceStatus
  opened: string
  closed?: string
  note: string
  materialId?: string
  qty?: number
  cost: number
}

export interface AuditEntry {
  id: string
  at: string
  actor: string
  role: string
  action: string
  detail: string
}

export type TaskStatus = "acik" | "gedir" | "gozleyir" | "bitdi"
export type TaskPriority = "asagi" | "orta" | "yuksek" | "tecili"
export type TaskKind = "zeng" | "gorus" | "teklif" | "sened" | "takip"
export type FileKind = "teklif" | "muqavile" | "cizgi" | "mektub" | "sexsiyyet" | "akt"
export type FileStatus = "qaralama" | "gozleyir" | "tesdiq" | "arxiv"
export type ActivityKind = "zeng" | "gorus" | "email" | "qeyd" | "ziyaret"

export interface CrmTask {
  id: string
  title: string
  kind: TaskKind
  status: TaskStatus
  priority: TaskPriority
  owner: string
  due: string
  client: string
  dealId: string
  leadId: string
  note: string
}

export interface CrmFile {
  id: string
  title: string
  number: string
  kind: FileKind
  status: FileStatus
  owner: string
  date: string
  due: string
  client: string
  dealId: string
  projectId: string
  note: string
}

export interface CrmActivity {
  id: string
  kind: ActivityKind
  title: string
  at: string
  owner: string
  client: string
  dealId: string
  leadId: string
  note: string
}

export interface AppState {
  users: User[]
  currentUserId: string
  projects: Project[]
  smetas: Smeta[]
  contracts: Contract[]
  acts: Act[]
  reports: DailyReport[]
  locations: Location[]
  stocks: Stock[]
  materials: Material[]
  movements: Movement[]
  shipments: Shipment[]
  purchaseOrders: PurchaseOrder[]
  requests: MaterialRequest[]
  recipes: Recipe[]
  orders: WorkOrder[]
  assets: Asset[]
  drivers: Driver[]
  trips: Trip[]
  fuels: FuelFill[]
  fleetDocs: FleetDoc[]
  gear: Gear[]
  gearEvents: GearEvent[]
  plants: Plant[]
  invoices: Invoice[]
  expenses: Expense[]
  documents: Document[]
  deals: Deal[]
  clients: Client[]
  leads: Lead[]
  tasks: CrmTask[]
  files: CrmFile[]
  activities: CrmActivity[]
  people: Person[]
  offices: Office[]
  departments: Department[]
  terminals: Terminal[]
  attendance: AttendanceRow[]
  leaves: LeaveRequest[]
  hrPayments: HrPayment[]
  moves: HrMove[]
  journal: JournalEntry[]
  audit: AuditEntry[]
  suppliers: Supplier[]
  changes: ChangeOrder[]
  quotes: Quote[]
  payables: Payable[]
  payrolls: Payroll[]
  closedPeriods: string[]
  services: ServiceJob[]
  forma3s: Forma3[]
  companies: SubCompany[]
  complexes: Complex[]
  buildings: Building[]
  units: Unit[]
  buyers: Buyer[]
  saleContracts: SaleContract[]
}

export type OpResult =
  | { error: string; patch?: Partial<AppState>; projectId?: string }
  | { error?: undefined; patch: Partial<AppState>; projectId?: string }

export interface ClientForm {
  name: string
  sector: string
  contact: string
  phone: string
  email: string
  city: string
  value: string
}

export interface LeadForm {
  name: string
  company: string
  value: string
  heat: Heat
  source: string
  next: string
}

export interface DealForm {
  title: string
  client: string
  value: string
  close: string
  owner?: string
}

export interface TaskForm {
  title: string
  kind: TaskKind
  priority: TaskPriority
  owner: string
  due: string
  client: string
  dealId: string
  leadId: string
  note: string
}

export interface FileForm {
  title: string
  number: string
  kind: FileKind
  date: string
  due: string
  client: string
  dealId: string
  projectId: string
  note: string
  owner: string
}

export interface ActivityForm {
  kind: ActivityKind
  title: string
  at: string
  owner?: string
  client: string
  dealId: string
  leadId: string
  note: string
}

export interface InvoiceForm {
  client: string
  project: string
  amount: string
  due: string
}

export interface ExpenseForm {
  id?: string
  category: string
  vendor: string
  project: string
  amount: string
  date: string
}

export interface PayableForm {
  supplier: string
  amount: string
  date: string
}

export interface PurchaseForm {
  supplier: string
  materialId: string
  item?: string
  qty: string
  amount: string
  eta: string
}

export interface StockForm {
  materialId: string
  qty: number | string
  locationId?: string
  project?: string
  projectId?: string
  smetaLineId?: string
  type?: string
  note?: string
}

export interface TransferForm {
  materialId: string
  from: string
  to: string
  qty: number | string
}

export interface PurchaseReceiveForm {
  poId: string
  qty?: number | string
  locationId?: string
}

export interface ReportForm {
  id?: string
  projectId: string
  date?: string
  weather?: Weather
  note?: string
  crew?: number | string
  lines?: { smetaLineId: string; qty: number | string }[]
  machines?: { assetId: string; hours: number | string }[]
  attendance?: { personId: string; hours: number | string }[]
  submit?: boolean
}

export interface ChangeForm {
  projectId: string
  title: string
  reason: string
  name: string
  unit: string
  qty: string
  unitPrice: string
}

export interface QuoteForm {
  requestId: string
  supplier: string
  amount: string
  days: string
}

export interface ServiceForm {
  assetId: string
  materialId?: string
  qty?: string
  note?: string
}

export interface VehicleForm {
  id?: string
  name: string
  type: string
  plate: string
  year: string
  site: string
  ownership: Ownership
  fuel: FuelKind
  meter: MeterKind
  odometer: string
  hours: string
  rate: string
  fuelPerHour: string
  nextService: string
  driverId: string
}

export interface DriverForm {
  id?: string
  name: string
  phone: string
  license: string
  category: string
  expires: string
  status: DriverStatus
}

export interface TripForm {
  assetId: string
  driverId: string
  project: string
  from: string
  to: string
  cargo: string
  km: string
  note: string
}

export interface FuelForm {
  assetId: string
  liters: string
  reading: string
  project: string
  note: string
}

export interface FleetDocForm {
  assetId: string
  kind: FleetDocKind
  number: string
  issuer: string
  expires: string
}

export interface AssignForm {
  assetId: string
  site: string
  status: AssetStatus
  driverId: string
}

export interface RequestForm {
  projectId: string
  materialId: string
  qty: number | string
}
