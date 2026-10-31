import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, type Context, type Dispatch, type ReactNode, type SetStateAction } from "react"
import { can } from "./domain/access"
import {Modal,Field} from "./ui"
import {
  acceptGear,
  addGear,
  addLocation,
  addShop,
  addQuote,
  updateAct,
  deleteAct,
  approveChange,
  awardQuote,
  closeService,
  closePeriod,
  confirmExpense,
  createInvoice,
  arriveTrip,
  assignVehicle,
  cancelTrip,
  departTrip,
  logFuel,
  openTrip,
  saveDriver,
  saveExpense,
  saveFleetDoc,
  saveVehicle,
  completeWorkOrder,
  dispatchWorkOrder,
  openWorkOrder,
  sendGearCheck,
  sendInvoice,
  startGearCheck,
  startWorkOrder,
  advancePlantQueue,
  cancelWorkOrder,
  returnWorkOrder,
  writeWaste,
  setPlantPlan,
  addShiftNote,
  updateJournal,
  deleteJournal,
  addPerson,
  assignPerson,
  updatePerson,
  deletePerson,
  releasePerson,
  assignAsset,
  updateAsset,
  releaseAsset,
  confirmGearCheck,
  confirmPlantPlan,
  addPlantProduct,
  updatePlantProduct,
  updateLocation,
  updateShop,
  deletePlantProduct,
  deleteLocation,
  deleteShop,
  saveFormula,
  replaceGear,
  rejectRequest,
  convertRequest,
  coverRequest,
  createAct,
  createForma3,
  updateClient,
  deleteClient,
  updateLead,
  deleteLead,
  promoteLead,
  updateDeal,
  deleteDeal,
  deleteForma3,
  refreshForma3,
  createRequest,
  decideDocument,
  addProject as createProject,
  updateProject,
  deleteProject,
  addProjectNote,
  updateProjectNote,
  deleteProjectNote,
  addDocument,
  updateDocument,
  updateInvoice,
  updatePayable,
  deleteDocument,
  deleteExpense,
  deleteInvoice,
  deletePayable,
  deletePayroll,
  invoiceAct,
  issueStock,
  openProjectFromDeal,
  openPeriod,
  openSale,
  openService,
  loseGear,
  obsoleteGear,
  payPayable,
  payPayroll,
  paySale,
  proposeChange,
  receiveManual,
  receivePurchase,
  reserveUnit,
  returnReport,
  returnExpense,
  returnInvoice,
  returnGearCheck,
  runPayroll,
  saveReport,
  deleteReport,
  settleInvoice,
  submitReport,
  finishGearCheck,
  handoverSale,
  transferStock,
  createShipment,
  advanceShipment,
} from "./domain/ops"
import { loadBooks } from "./books"
import { syncBooks } from "./syncBooks"
import { createEmptyState, createInitialState } from "./domain/seed"
import {
  createPurchaseAct,
  deletePurchaseAct,
  updatePurchaseAct,
  type PurchaseActForm,
} from "./domain/purchaseActs"
import { applySmetaImport, type SmetaImportRow } from "./domain/smetaIo"
import type {
  AppState,
  Area,
  AttendanceForm,
  AssetStatus,
  AssetEdit,
  AssignForm,
  PersonForm,
  PayableForm,
  ChangeForm,
  ActivityForm,
  ClientForm,
  CreditKind,
  DealForm,
  DepartmentForm,
  HrMoveForm,
  OfficeForm,
  DocStatus,
  DocumentForm,
  FileForm,
  FileStatus,
  TaskForm,
  TaskStatus,
  NewProjectForm,
  Project,
  ProjectForm,
  Forma3Kind,
  DriverForm,
  ExpenseForm,
  FleetDocForm,
  FuelForm,
  HrPayForm,
  InvoiceForm,
  LeadForm,
  LeaveForm,
  OpResult,
  PersonStatus,
  PurchaseForm,
  PurchaseReceiveForm,
  QuoteForm,
  ReportForm,
  RequestForm,
  ServiceForm,
  StaffForm,
  StockForm,
  TerminalForm,
  TerminalStatus,
  TransferForm,
  TripForm,
  VehicleForm,
  ShipmentForm,
  User,
  WorkOrderForm,
  DispatchTicket,
  WasteForm,
  ProductForm,
  RecipeEdit,
  FormulaLine,
  GearForm,
  LocationForm,
  ShopForm,
} from "./domain/types"
import {
  createDeal,
  deleteActivity,
  deleteFile,
  deleteTask,
  saveActivity,
  saveFile,
  saveTask,
  setFileStatus,
  setTaskStatus,
} from "./domain/crm"
import {
  approveLeave,
  deleteAttendance,
  deleteDepartment,
  deleteOffice,
  deleteHrMove,
  deleteHrPay,
  deleteLeave,
  deleteTerminal,
  payHr,
  rejectLeave,
  saveAttendance,
  saveDepartment,
  saveOffice,
  saveHrMove,
  saveHrPay,
  saveLeave,
  saveStaff,
  saveTerminal,
  setTerminalStatus,
} from "./domain/hrm"
import { flow } from "./data"
import { usePrefs } from "./i18n"
import { ApiError, api } from "./api"
import { nextId } from "./format"

type Action = { type: "PATCH"; patch: Partial<AppState> } | { type: "USER"; id: string }

export interface StoreValue extends AppState {
  loading: boolean
  loadError: string
  query: string
  setQuery: Dispatch<SetStateAction<string>>
  notice: string
  actor: User
  allowed: (area: Area) => boolean
  setUser: (id: string) => void
  addClient: (form: ClientForm) => string
  editClient: (id: string, form: ClientForm) => string
  removeClient: (id: string) => string
  addLead: (form: LeadForm) => string
  editLead: (id: string, form: LeadForm) => string
  removeLead: (id: string) => string
  promoteLead: (id: string) => string
  editDeal: (id: string, form: { title: string; value: string; close: string }) => string
  removeDeal: (id: string) => string
  moveDeal: (id: string, dir: number) => void
  loseDeal: (id: string) => void
  addDeal: (form: DealForm) => string
  saveTask: (form: TaskForm, id?: string) => string
  moveTask: (id: string, status: TaskStatus) => string
  removeTask: (id: string) => string
  saveCrmFile: (form: FileForm, id?: string) => string
  moveCrmFile: (id: string, status: FileStatus) => string
  removeCrmFile: (id: string) => string
  saveActivity: (form: ActivityForm) => string
  removeActivity: (id: string) => string
  addInvoice: (form: InvoiceForm) => string
  editInvoice: (id: string, form: InvoiceForm) => string
  removeInvoice: (id: string) => string
  sendInvoice: (id: string) => string
  returnInvoice: (id: string) => string
  saveExpense: (form: ExpenseForm) => string
  confirmExpense: (id: string) => string
  returnExpense: (id: string) => string
  removeExpense: (id: string) => string
  editPayable: (id: string, form: PayableForm) => string
  removePayable: (id: string) => string
  payPayroll: (id: string) => string
  removePayroll: (id: string) => string
  closePeriod: (month: string) => string
  openPeriod: (month: string) => string
  markInvoicePaid: (id: string) => string
  setAssetStatus: (id: string, status: AssetStatus) => void
  pullAsset: (id: string, site: string) => string
  editAsset: (id: string, form: AssetEdit) => string
  releaseAsset: (id: string) => string
  addPurchase: (form: PurchaseForm) => string
  setPersonStatus: (id: string, status: PersonStatus) => void
  addCrew: (site: string, form: PersonForm) => string
  editCrew: (id: string, site: string, form: PersonForm) => string
  removeCrew: (id: string) => string
  assignToSite: (id: string, site: string, crew: string) => string
  releaseFromSite: (id: string) => string
  saveStaff: (form: StaffForm, id?: string) => string
  saveDepartment: (form: DepartmentForm, id?: string) => string
  removeDepartment: (id: string) => string
  saveOffice: (form: OfficeForm, id?: string) => string
  removeOffice: (id: string) => string
  saveTerminal: (form: TerminalForm, id?: string) => string
  markTerminal: (id: string, status: TerminalStatus) => string
  removeTerminal: (id: string) => string
  saveAttendance: (form: AttendanceForm, id?: string) => string
  removeAttendance: (id: string) => string
  saveLeave: (form: LeaveForm, id?: string) => string
  approveLeave: (id: string) => string
  rejectLeave: (id: string) => string
  removeLeave: (id: string) => string
  saveHrPay: (form: HrPayForm, id?: string) => string
  payHr: (id: string) => string
  removeHrPay: (id: string) => string
  moveStaff: (form: HrMoveForm, id?: string) => string
  removeMove: (id: string) => string
  stockMove: (form: StockForm) => string
  transfer: (form: TransferForm) => string
  createShipment: (form: ShipmentForm) => string
  advanceShipment: (id: string) => string
  receivePo: (form: PurchaseReceiveForm) => string
  saveDaily: (form: ReportForm) => string
  removeDaily: (id: string) => string
  submitDaily: (id: string) => string
  returnDaily: (id: string) => string
  approveDaily: (id: string) => string
  measureDaily: (id: string) => string
  editNote: (id: string, text: string) => string
  removeNote: (id: string) => string
  makeAct: (projectId: string, options?: { period?: string; houses?: string[] }) => string
  makeForma3: (projectId: string, kind: Forma3Kind) => string
  approveAct: (id: string) => string
  reverseInvoice: (id: string) => string
  returnAct: (id: string) => string
  editAct: (id: string, lines: { smetaLineId: string; qty: number | string }[]) => string
  removeAct: (id: string) => string
  makePurchaseAct: (form: PurchaseActForm) => string
  editPurchaseAct: (id: string, form: PurchaseActForm) => string
  approvePurchaseAct: (id: string, locationId?: string) => string
  returnPurchaseAct: (id: string) => string
  removePurchaseAct: (id: string) => string
  importSmeta: (projectId: string, rows: SmetaImportRow[]) => string
  approveForma3Doc: (id: string) => string
  returnForma3Doc: (id: string) => string
  removeForma3: (id: string) => string
  refreshForma3Doc: (id: string) => string
  invoiceAct: (id: string) => string
  completeOrder: (id: string) => string
  openOrder: (form: WorkOrderForm) => string
  startOrder: (id: string) => string
  advanceQueue: (plantId: string) => string
  sendOrder: (id: string, ticket?: DispatchTicket) => string
  cancelOrder: (id: string) => string
  returnOrder: (id: string) => string
  writeWaste: (form: WasteForm) => string
  setPlan: (plantId: string, plan: string) => string
  addNote: (site: string, text: string) => string
  confirmPlan: (plantId: string) => string
  addProduct: (form: ProductForm) => string
  editProduct: (id: string, form: RecipeEdit) => string
  removeProduct: (id: string) => string
  addGear: (form: GearForm) => string
  addLocation: (form: LocationForm) => string
  editLocation: (id: string, form: LocationForm) => string
  removeLocation: (id: string) => string
  addShop: (form: ShopForm) => string
  editShop: (id: string, form: ShopForm) => string
  removeShop: (id: string) => string
  sendGearCheck: (id: string, note: string) => string
  startGearCheck: (id: string, note: string) => string
  confirmGearCheck: (id: string, note: string) => string
  finishGearCheck: (id: string, note: string) => string
  returnGearCheck: (id: string, note: string) => string
  replaceGear: (id: string, note: string) => string
  acceptGear: (id: string, note: string) => string
  obsoleteGear: (id: string, note: string) => string
  loseGear: (id: string, note: string) => string
  saveFormula: (recipeId: string, lines: FormulaLine[]) => string
  rejectRequest: (id: string, reason: string) => string
  openFromDeal: (id: string) => string
  decideDocument: (id: string, status: DocStatus) => string
  addProject: (form: NewProjectForm) => Promise<string>
  editProject: (id: string, form: ProjectForm) => string
  removeProject: (id: string) => string
  addProjectNote: (projectId: string, text: string) => string
  editProjectNote: (projectId: string, noteId: string, text: string) => string
  removeProjectNote: (projectId: string, noteId: string) => string
  addPaper: (form: DocumentForm) => string
  editPaper: (id: string, form: DocumentForm) => string
  removePaper: (id: string) => string
  createRequest: (form: RequestForm) => string
  convertRequest: (id: string) => string
  proposeChange: (form: ChangeForm) => string
  approveChange: (id: string) => string
  coverRequest: (id: string) => string
  addQuote: (form: QuoteForm) => string
  awardQuote: (id: string) => string
  payPayable: (id: string) => string
  runPayroll: () => string
  openService: (form: ServiceForm) => string
  closeService: (id: string) => string
  saveVehicle: (form: VehicleForm) => string
  assignVehicle: (form: AssignForm) => string
  saveDriver: (form: DriverForm) => string
  openTrip: (form: TripForm) => string
  departTrip: (id: string) => string
  arriveTrip: (id: string) => string
  cancelTrip: (id: string) => string
  logFuel: (form: FuelForm) => string
  saveFleetDoc: (form: FleetDocForm) => string
  addBuyer: (form: { name: string; phone: string; email: string }) => string
  reserveUnit: (unitId: string, buyerId: string) => string
  openSale: (unitId: string, buyerId: string, credit: CreditKind) => string
  paySale: (contractId: string, rowId: string) => string
  handoverSale: (contractId: string) => string
  reload: () => void
}

const StoreContext = (import.meta.hot?.data.storeContext as Context<StoreValue | null> | undefined) ?? createContext<StoreValue | null>(null)
if(import.meta.hot)import.meta.hot.data.storeContext=StoreContext

function reducer(state: AppState, action: Action): AppState {
  if (action.type === "PATCH") return { ...state, ...action.patch }
  if (action.type === "USER") return { ...state, currentUserId: action.id }
  return state
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { session } = usePrefs()
  const [loading,setLoading]=useState(Boolean(session?.userId))
  const [loadError,setLoadError]=useState('')
  const [state, dispatch] = useReducer(reducer, null, ()=>({...createEmptyState(),...(session?{users:[{id:session.userId,name:session.name,role:session.role,title:session.title,initials:session.initials}],currentUserId:session.userId}:{})}))
  useEffect(() => {
    if (session?.userId) dispatch({ type: "USER", id: session.userId })
  }, [session])
  const reload = useCallback(() => {
    if (!session?.userId) {
      setLoading(false);setLoadError('')
      dispatch({ type: "PATCH", patch: createInitialState() })
      return
    }
    setLoading(true);setLoadError('')
    loadBooks().then((patch) => {
      dispatch({ type: "PATCH", patch: {...createEmptyState(),...patch,users:[{id:session.userId,name:session.name,role:session.role,title:session.title,initials:session.initials}],currentUserId:session.userId} })
    }).catch(reason=>{const message=reason instanceof Error?`Məlumatlar yüklənmədi: ${reason.message}`:'Məlumatlar yüklənmədi. Server bağlantısını yoxlayın.';setLoadError(message);toast(message)}).finally(()=>setLoading(false))
  }, [session?.userId])
  useEffect(() => {
    reload()
  }, [reload])
  const [query, setQuery] = useState("")
  const [notice, setNotice] = useState("")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const workflowBusy = useRef(false)
  const workflowKeys = useRef(new Map<string,string>())
  const actor = state.users.find((item) => item.id === state.currentUserId) ?? state.users[0]
  if (!actor) throw new Error("İstifadəçi tapılmadı")

  function toast(message: string) {
    setNotice(message)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setNotice(""), 2800)
  }

  function run(result: OpResult, okMessage?: string) {
    if (result.error) {
      toast(result.error)
      return result.error
    }
    if (!result.patch) {
      toast("Əməliyyat alınmadı")
      return "Əməliyyat alınmadı"
    }
    const before = state
    dispatch({ type: "PATCH", patch: result.patch })
    if (session?.userId) {
      void syncBooks(before, result.patch).catch(reason=>{reload();toast(reason instanceof Error?reason.message:"Dəyişiklik saxlanmadı")})
    }
    if (okMessage) toast(okMessage)
    return ""
  }

  const [workflowReturn,setWorkflowReturn]=useState<{id:string;kind:'return-f2'|'return-f3'|'return-purchase'|'return-invoice'}|null>(null)
  const [workflowReason,setWorkflowReason]=useState('')
  function requestWorkflowReturn(id:string,kind:'return-f2'|'return-f3'|'return-purchase'|'return-invoice'){setWorkflowReason('');setWorkflowReturn({id,kind});return ''}
  function actWorkflow(id:string,kind:'approve-f2'|'receive-purchase'|'return-f2'|'approve-f3'|'return-f3'|'return-purchase'|'return-invoice'|'approve-daily'|'measure-daily',locationId?:string,reason?:string){
    if(!session){toast('Əvvəlcə daxil olun');return 'Əvvəlcə daxil olun'}
    if(workflowBusy.current)return 'Əvvəlki əməliyyat saxlanılır'
    const identity=[id,kind,locationId||''].join('|')
    const key=workflowKeys.current.get(identity)||crypto.randomUUID();workflowKeys.current.set(identity,key)
    workflowBusy.current=true;toast('Əməliyyat serverdə yoxlanılır…')
    void api(`/api/act-workflows/${encodeURIComponent(id)}/${kind}`,{method:'POST',body:JSON.stringify({key,locationId,reason})}).then(()=>{workflowKeys.current.delete(identity);reload();toast(kind==='approve-daily'?'Gündəlik təsdiqləndi; ölçmə gözləyir':kind==='measure-daily'?'Ölçülmüş həcm, irəliləyiş və xərclər yazıldı':kind==='approve-f2'?'Forma-2 təsdiqləndi':kind==='approve-f3'?'Forma-3 təsdiqləndi':kind==='receive-purchase'?'Alış aktı qəbul edildi və anbara yazıldı':'Sənəd qaralamaya qaytarıldı; düzəliş tarixçədə saxlandı')}).catch(reason=>{toast(reason instanceof Error?reason.message:'Əməliyyat saxlanmadı')}).finally(()=>{workflowBusy.current=false})
    return ''
  }

  function patch(partial: Partial<AppState>, message?: string) {
    dispatch({ type: "PATCH", patch: partial })
    if (message) toast(message)
  }

  function addClient(form: ClientForm) {
    if (!form.name.trim() || !form.contact.trim()) return "Şirkət adı və əlaqə şəxsi vacibdir."
    patch({
      clients: [
        {
          id: nextId("CLT", state.clients),
          name: form.name.trim(),
          sector: form.sector,
          contact: form.contact.trim(),
          phone: form.phone.trim() || "—",
          email: form.email.trim() || "—",
          city: form.city.trim() || "Bakı",
          projects: 0,
          value: Number(form.value) || 0,
          since: "2026",
        },
        ...state.clients,
      ],
    }, "Müştəri əlavə olundu")
    return ""
  }

  function addLead(form: LeadForm) {
    if (!form.name.trim() || !form.company.trim()) return "Layihə və şirkət adı vacibdir."
    patch({
      leads: [
        {
          id: nextId("LD", state.leads),
          name: form.name.trim(),
          company: form.company.trim(),
          value: Number(form.value) || 0,
          owner: actor.name,
          heat: form.heat,
          source: form.source.trim() || "Manual",
          next: form.next || "2026-09-30",
        },
        ...state.leads,
      ],
    }, "Potensial əlavə olundu")
    return ""
  }

  function addBuyer(form: { name: string; phone: string; email: string }) {
    if (!form.name.trim()) return "Alıcının adı vacibdir."
    patch(
      {
        buyers: [
          {
            id: nextId("BY", state.buyers),
            name: form.name.trim(),
            phone: form.phone.trim() || "—",
            email: form.email.trim() || "—",
          },
          ...state.buyers,
        ],
      },
      "Alıcı əlavə olundu",
    )
    return ""
  }

  function moveDeal(id: string, dir: number) {
    patch({
      deals: state.deals.map((deal) => {
        if (deal.id !== id) return deal
        if (deal.stage === "uduzulub") return dir < 0 ? { ...deal, stage: "danisiq" } : deal
        const index = flow.indexOf(deal.stage)
        const next = index + dir
        if (index < 0 || next < 0 || next >= flow.length) return deal
        const stage = flow[next]
        if (!stage) return deal
        return { ...deal, stage }
      }),
    })
  }

  function loseDeal(id: string) {
    patch({
      deals: state.deals.map((deal) => (deal.id === id ? { ...deal, stage: "uduzulub" } : deal)),
    }, "Sövdələşmə uduzulmuş kimi bağlandı")
  }

  function addInvoice(form: InvoiceForm) {
    return run(createInvoice(state, form, actor), "Qaimə qaralama kimi açıldı")
  }

  function markInvoicePaid(id: string) {
    return run(settleInvoice(state, id, actor), "Faktura ödənildi, qrafik yeniləndi")
  }

  function setAssetStatus(id: string, status: AssetStatus) {
    patch({
      assets: state.assets.map((item) => (item.id === id ? { ...item, status } : item)),
    }, "Aktiv statusu yeniləndi")
  }

  function addPurchase(form: PurchaseForm) {
    if (!form.supplier.trim() || !form.materialId || !(Number(form.amount) > 0)) {
      return "Təchizatçı, material və məbləğ vacibdir."
    }
    const material = state.materials.find((item) => item.id === form.materialId)
    patch({
      purchaseOrders: [
        {
          id: nextId("PO", state.purchaseOrders),
          supplier: form.supplier.trim(),
          item: material?.name || form.item || "",
          materialId: form.materialId,
          qty: Number(form.qty) || 0,
          unit: material?.unit || "ədəd",
          amount: Number(form.amount),
          status: "tesdiq",
          eta: form.eta || "2026-10-02",
          receivedQty: 0,
        },
        ...state.purchaseOrders,
      ],
    }, "Satınalma sifarişi açıldı")
    return ""
  }

  function setPersonStatus(id: string, status: PersonStatus) {
    patch({
      people: state.people.map((item) => (item.id === id ? { ...item, status } : item)),
    })
  }

  function stockMove(form: StockForm) {
    const action = form.type === "medaxil" ? receiveManual : issueStock
    return run(action(state, form, actor), form.type === "medaxil" ? "Mədaxil qeydə alındı" : "Məxaric smeta xərcinə yazıldı")
  }

  async function addProject(form: NewProjectForm) {
    const result = createProject(state, form, actor)
    if (result.error || !result.patch || !result.projectId) {
      const message = result.error || "Əməliyyat alınmadı"
      toast(message)
      return message
    }
    const project = result.patch.projects?.find((item) => item.id === result.projectId)
    if (!project) {
      toast("Əməliyyat alınmadı")
      return "Əməliyyat alınmadı"
    }
    try {
      const saved = await api<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          id: project.id,
          name: project.name,
          client: project.client,
          district: project.district,
          city: project.city,
          address: project.address,
          phase: project.phase,
          progress: project.progress,
          budget: project.budget,
          spent: project.spent,
          start: project.start,
          end: project.end,
          manager: project.manager,
          crew: project.crew,
          status: project.status,
          type: project.type,
          floors: project.floors,
          area: project.area,
          phases: project.phases.map((phase) => ({ name: phase.name, done: Boolean(phase.done), current: Boolean(phase.current) })),
          notes: project.notes,
          note: project.note,
        }),
      })
      const location = result.patch.locations?.find((item) => item.projectId === project.id && !state.locations.some((row) => row.id === item.id))
      if (location) await api("/api/locations", { method: "POST", body: JSON.stringify(location) }).catch(() => undefined)
      dispatch({
        type: "PATCH",
        patch: {
          ...result.patch,
          projects: (result.patch.projects ?? []).map((item) =>
            item.id === saved.id
              ? { ...item, ...saved, note: saved.note || undefined, phases: saved.phases.length ? saved.phases : item.phases, notes: saved.notes.length ? saved.notes : item.notes }
              : item,
          ),
        },
      })
      toast("Layihə açıldı")
      return ""
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Layihə yazılmadı"
      toast(message)
      return message
    }
  }

  const value: StoreValue = {
    loading,loadError,
    ...state,
    query,
    setQuery,
    notice,
    actor,
    orders: state.orders,
    allowed: (area) => can(actor.role, area),
    setUser: (id) => dispatch({ type: "USER", id }),
    addClient,
    editClient: (id, form) => run(updateClient(state, id, form, actor), "Sifarişçi yazıldı"),
    removeClient: (id) => run(deleteClient(state, id, actor), "Sifarişçi silindi"),
    addLead,
    editLead: (id, form) => run(updateLead(state, id, form, actor), "Potensial yazıldı"),
    removeLead: (id) => run(deleteLead(state, id, actor), "Potensial silindi"),
    promoteLead: (id) => run(promoteLead(state, id, actor), "Sövdə açıldı"),
    editDeal: (id, form) => run(updateDeal(state, id, form, actor), "Sövdə yazıldı"),
    removeDeal: (id) => run(deleteDeal(state, id, actor), "Sövdə silindi"),
    moveDeal,
    loseDeal,
    addDeal: (form) => run(createDeal(state, form, actor), "Sövdə açıldı"),
    saveTask: (form, id) => run(saveTask(state, form, actor, id), id ? "Tapşırıq yazıldı" : "Tapşırıq açıldı"),
    moveTask: (id, status) => run(setTaskStatus(state, id, status, actor), "Tapşırıq yeniləndi"),
    removeTask: (id) => run(deleteTask(state, id, actor), "Tapşırıq silindi"),
    saveCrmFile: (form, id) => run(saveFile(state, form, actor, id), id ? "Sənəd yazıldı" : "Sənəd açıldı"),
    moveCrmFile: (id, status) => run(setFileStatus(state, id, status, actor), "Sənəd yeniləndi"),
    removeCrmFile: (id) => run(deleteFile(state, id, actor), "Sənəd silindi"),
    saveActivity: (form) => run(saveActivity(state, form, actor), "Fəaliyyət yazıldı"),
    removeActivity: (id) => run(deleteActivity(state, id, actor), "Fəaliyyət silindi"),
    addInvoice,
    editInvoice: (id, form) => run(updateInvoice(state, id, form, actor), "Qaimə yazıldı"),
    removeInvoice: (id) => run(deleteInvoice(state, id, actor), "Qaimə silindi"),
    sendInvoice: (id) => run(sendInvoice(state, id, actor), "Qaimə göndərildi"),
    returnInvoice: (id) => run(returnInvoice(state, id, actor), "Qaimə qaralamaya qayıtdı"),
    saveExpense: (form) => run(saveExpense(state, form, actor), form.id ? "Xərc yazıldı" : "Xərc qaralaması açıldı"),
    confirmExpense: (id) => run(confirmExpense(state, id, actor), "Xərc təsdiqləndi"),
    returnExpense: (id) => run(returnExpense(state, id, actor), "Xərc qaralamaya qayıtdı"),
    removeExpense: (id) => run(deleteExpense(state, id, actor), "Xərc silindi"),
    editPayable: (id, form) => run(updatePayable(state, id, form, actor), "Təchizat borcu yazıldı"),
    removePayable: (id) => run(deletePayable(state, id, actor), "Təchizat borcu silindi"),
    payPayroll: (id) => run(payPayroll(state, id, actor), "Əmək haqqı ödənildi"),
    removePayroll: (id) => run(deletePayroll(state, id, actor), "Əmək haqqı cədvəli silindi"),
    closePeriod: (month) => run(closePeriod(state, month, actor), "Dövr bağlandı"),
    openPeriod: (month) => run(openPeriod(state, month, actor), "Dövr açıldı"),
    markInvoicePaid,
    setAssetStatus,
    pullAsset: (id, site) => run(assignAsset(state, id, site, actor), "Texnika sahəyə cəlb olundu"),
    editAsset: (id, form) => run(updateAsset(state, id, form, actor), "Texnika yazıldı"),
    releaseAsset: (id) => run(releaseAsset(state, id, actor), "Texnika sahədən çıxdı"),
    addPurchase,
    setPersonStatus,
    addCrew: (site, form) => run(addPerson(state, site, form, actor), "İşçi əlavə olundu"),
    editCrew: (id, site, form) => run(updatePerson(state, id, site, form, actor), "İşçi yazıldı"),
    removeCrew: (id) => run(deletePerson(state, id, actor), "İşçi silindi"),
    assignToSite: (id, site, crew) => run(assignPerson(state, id, site, crew, actor), "İşçi sahəyə təyin olundu"),
    releaseFromSite: (id) => run(releasePerson(state, id, actor), "İşçi sahədən çıxdı"),
    saveStaff: (form, id) => run(saveStaff(state, form, actor, id), id ? "İşçi yazıldı" : "İşçi əlavə olundu"),
    saveDepartment: (form, id) => run(saveDepartment(state, form, actor, id), id ? "Şöbə yazıldı" : "Şöbə açıldı"),
    removeDepartment: (id) => run(deleteDepartment(state, id, actor), "Şöbə silindi"),
    saveOffice: (form, id) => run(saveOffice(state, form, actor, id), id ? "Ofis yazıldı" : "Ofis açıldı"),
    removeOffice: (id) => run(deleteOffice(state, id, actor), "Ofis silindi"),
    saveTerminal: (form, id) => run(saveTerminal(state, form, actor, id), id ? "Terminal yazıldı" : "Terminal açıldı"),
    markTerminal: (id, status) => run(setTerminalStatus(state, id, status, actor), status === "online" ? "Terminal açıldı" : "Terminal söndü"),
    removeTerminal: (id) => run(deleteTerminal(state, id, actor), "Terminal silindi"),
    saveAttendance: (form, id) => run(saveAttendance(state, form, actor, id), id ? "Davamiyyət yazıldı" : "Davamiyyət açıldı"),
    removeAttendance: (id) => run(deleteAttendance(state, id, actor), "Davamiyyət silindi"),
    saveLeave: (form, id) => run(saveLeave(state, form, actor, id), id ? "Məzuniyyət yazıldı" : "Məzuniyyət açıldı"),
    approveLeave: (id) => run(approveLeave(state, id, actor), "Məzuniyyət təsdiqləndi"),
    rejectLeave: (id) => run(rejectLeave(state, id, actor), "Məzuniyyət rədd edildi"),
    removeLeave: (id) => run(deleteLeave(state, id, actor), "Məzuniyyət silindi"),
    saveHrPay: (form, id) => run(saveHrPay(state, form, actor, id), id ? "Ödəniş yazıldı" : "Ödəniş açıldı"),
    payHr: (id) => run(payHr(state, id, actor), "Ödəniş maliyyəyə düşdü"),
    removeHrPay: (id) => run(deleteHrPay(state, id, actor), "Ödəniş silindi"),
    moveStaff: (form, id) => run(saveHrMove(state, form, actor, id), id ? "Köçürmə yazıldı" : "İşçi köçürüldü"),
    removeMove: (id) => run(deleteHrMove(state, id, actor), "Köçürmə silindi"),
    stockMove,
    transfer: (form) => run(transferStock(state, form, actor), "Köçürmə qeydə alındı"),
    createShipment: (form) => run(createShipment(state, form, actor), "Transfer marşrutu yazıldı"),
    advanceShipment: (id) => run(advanceShipment(state, id, actor), "Material növbəti dayanacağa keçdi"),
    receivePo: (form) => run(receivePurchase(state, form, actor), "Mal qəbul edildi, anbar artdı"),
    saveDaily: (form) => run(saveReport(state, form, actor), form.id ? "Gündəlik redaktə olundu" : "Gündəlik saxlandı"),
    removeDaily: (id) => run(deleteReport(state, id, actor), "Gündəlik silindi"),
    submitDaily: (id) => run(submitReport(state, id, actor), "Gündəlik təsdiqə göndərildi"),
    returnDaily: (id) => run(returnReport(state, id, actor), "Gündəlik düzəlişə qaytarıldı"),
    approveDaily: (id) => actWorkflow(id, 'approve-daily'),
    measureDaily: (id) => actWorkflow(id, 'measure-daily'),
    editNote: (id, text) => run(updateJournal(state, id, text, actor), "Qeyd yazıldı"),
    removeNote: (id) => run(deleteJournal(state, id, actor), "Qeyd silindi"),
    makeAct: (projectId, options) => run(createAct(state, projectId, actor, options), "Forma-2 qaralaması açıldı"),
    makeForma3: (projectId, kind) => run(createForma3(state, projectId, kind, actor), kind === "yekun" ? "Yekun Forma-3 açıldı" : "Aralıq Forma-3 açıldı"),
    approveAct: (id) => actWorkflow(id,'approve-f2'),
    reverseInvoice: (id) => requestWorkflowReturn(id, "return-invoice"),
    returnAct: (id) => requestWorkflowReturn(id, "return-f2"),
    editAct: (id, lines) => run(updateAct(state, id, lines, actor), "Forma-2 redaktə olundu"),
    removeAct: (id) => run(deleteAct(state, id, actor), "Forma-2 silindi"),
    makePurchaseAct: (form) => run(createPurchaseAct(state, form, actor), "Alış aktı açıldı"),
    editPurchaseAct: (id, form) => run(updatePurchaseAct(state, id, form, actor), "Alış aktı yazıldı"),
    approvePurchaseAct: (id, locationId) => actWorkflow(id,'receive-purchase',locationId||state.locations[0]?.id),
    returnPurchaseAct: (id) => requestWorkflowReturn(id, "return-purchase"),
    removePurchaseAct: (id) => run(deletePurchaseAct(state, id, actor), "Alış aktı silindi"),
    importSmeta: (projectId, rows) => run(applySmetaImport(state, projectId, rows, actor), "Smeta Excel-dən yükləndi"),
    approveForma3Doc: (id) => actWorkflow(id, "approve-f3"),
    returnForma3Doc: (id) => requestWorkflowReturn(id, "return-f3"),
    removeForma3: (id) => run(deleteForma3(state, id, actor), "Forma-3 silindi"),
    refreshForma3Doc: (id) => run(refreshForma3(state, id, actor), "Forma-3 yeniləndi"),
    invoiceAct: (id) => run(invoiceAct(state, id, actor), "ƏDV-li faktura açıldı"),
    completeOrder: (id) => run(completeWorkOrder(state, id, actor), "İş əmri bağlandı, resept anbardan silindi"),
    openOrder: (form) => run(openWorkOrder(state, form, actor), "İş əmri növbəyə yazıldı"),
    startOrder: (id) => run(startWorkOrder(state, id, actor), "İş əmri işə düşdü"),
    advanceQueue: (plantId) => {
      const result = advancePlantQueue(state, plantId, actor)
      const detail = result.patch?.audit?.[0]?.detail
      return run(result, detail ? `Avtomatik keçid. ${detail}` : undefined)
    },
    sendOrder: (id, ticket) => run(dispatchWorkOrder(state, id, actor, ticket), "Məhsul sahəyə yazıldı"),
    cancelOrder: (id) => run(cancelWorkOrder(state, id, actor), "İş əmri ləğv olundu"),
    returnOrder: (id) => run(returnWorkOrder(state, id, actor), "İş əmri növbəyə qaytarıldı"),
    writeWaste: (form) => run(writeWaste(state, form, actor), "İtki anbardan silindi"),
    setPlan: (plantId, plan) => run(setPlantPlan(state, plantId, plan, actor), "Növbə planı yazıldı"),
    addNote: (site, text) => run(addShiftNote(state, site, text, actor), "Növbə qeydi yazıldı"),
    confirmPlan: (plantId) => run(confirmPlantPlan(state, plantId, actor), "Növbə planı təsdiqləndi"),
    addProduct: (form) => run(addPlantProduct(state, form, actor), "Məhsul açıldı"),
    editProduct: (id, form) => run(updatePlantProduct(state, id, form, actor), "Resept yazıldı"),
    removeProduct: (id) => run(deletePlantProduct(state, id, actor), "Məhsul silindi"),
    addGear: (form) => run(addGear(state, form, actor), "Təchizat açıldı"),
    addLocation: (form) => run(addLocation(state, form, actor), "Anbar açıldı"),
    editLocation: (id, form) => run(updateLocation(state, id, form, actor), "Anbar yeniləndi"),
    removeLocation: (id) => run(deleteLocation(state, id, actor), "Anbar silindi"),
    addShop: (form) => run(addShop(state, form, actor), "Sex açıldı"),
    editShop: (id, form) => run(updateShop(state, id, form, actor), "Sex yeniləndi"),
    removeShop: (id) => run(deleteShop(state, id, actor), "Sex silindi"),
    sendGearCheck: (id, note) => run(sendGearCheck(state, id, note, actor), "Yoxlamaya göndərildi"),
    startGearCheck: (id, note) => run(startGearCheck(state, id, note, actor), "Yoxlama açıldı"),
    confirmGearCheck: (id, note) => run(confirmGearCheck(state, id, note, actor), "Yoxlama təsdiqləndi"),
    finishGearCheck: (id, note) => run(finishGearCheck(state, id, note, actor), "Yoxlama bitdi"),
    returnGearCheck: (id, note) => run(returnGearCheck(state, id, note, actor), "Yoxlamadan qaytarıldı"),
    replaceGear: (id, note) => run(replaceGear(state, id, note, actor), "Dəyişməyə yazıldı"),
    acceptGear: (id, note) => run(acceptGear(state, id, note, actor), "Yeni təchizat qəbul edildi"),
    obsoleteGear: (id, note) => run(obsoleteGear(state, id, note, actor), "Köhnəlmiş yazılıb"),
    loseGear: (id, note) => run(loseGear(state, id, note, actor), "İtki yazıldı"),
    saveFormula: (recipeId, lines) => run(saveFormula(state, recipeId, lines, actor), "Formul yazıldı"),
    rejectRequest: (id, reason) => run(rejectRequest(state, id, reason, actor), "Tələbnamə rədd edildi"),
    openFromDeal: (id) => run(openProjectFromDeal(state, id, actor), "Layihə, smeta və müqavilə açıldı"),
    decideDocument: (id, status) => run(decideDocument(state, id, status, actor), "Sənəd yeniləndi"),
    addProject,
    editProject: (id, form) => run(updateProject(state, id, form, actor), "Layihə yazıldı"),
    removeProject: (id) => run(deleteProject(state, id, actor), "Layihə silindi"),
    addProjectNote: (projectId, text) => run(addProjectNote(state, projectId, text, actor), "Qeyd yazıldı"),
    editProjectNote: (projectId, noteId, text) => run(updateProjectNote(state, projectId, noteId, text, actor), "Qeyd yazıldı"),
    removeProjectNote: (projectId, noteId) => run(deleteProjectNote(state, projectId, noteId, actor), "Qeyd silindi"),
    addPaper: (form) => run(addDocument(state, form, actor), "Sənəd açıldı"),
    editPaper: (id, form) => run(updateDocument(state, id, form, actor), "Sənəd yazıldı"),
    removePaper: (id) => run(deleteDocument(state, id, actor), "Sənəd silindi"),
    createRequest: (form) => run(createRequest(state, form, actor), "Tələbnamə açıldı"),
    convertRequest: (id) => run(convertRequest(state, id, actor), "Tələbnamə sifarişə çevrildi"),
    proposeChange: (form) => run(proposeChange(state, form, actor), "Əlavə iş qaralama açıldı"),
    approveChange: (id) => run(approveChange(state, id, actor), "Əlavə iş smeta və müqaviləyə yazıldı"),
    coverRequest: (id) => run(coverRequest(state, id, actor), "Tələb sahə anbarına köçürüldü"),
    addQuote: (form) => run(addQuote(state, form, actor), "Təklif yazıldı"),
    awardQuote: (id) => run(awardQuote(state, id, actor), "Təklif sifarişə çevrildi"),
    payPayable: (id) => run(payPayable(state, id, actor), "Təchizatçı borcu bağlandı"),
    runPayroll: () => run(runPayroll(state, actor), "Əmək haqqı cədvəli açıldı"),
    openService: (form) => run(openService(state, form, actor), "Servis açıldı, ehtiyat silindi"),
    closeService: (id) => run(closeService(state, id, actor), "Texnika sahəyə qaytarıldı"),
    saveVehicle: (form) => run(saveVehicle(state, form, actor), form.id ? "Texnika yazıldı" : "Texnika parka əlavə olundu"),
    assignVehicle: (form) => run(assignVehicle(state, form, actor), "Texnika təyin olundu"),
    saveDriver: (form) => run(saveDriver(state, form, actor), form.id ? "Sürücü yazıldı" : "Sürücü açıldı"),
    openTrip: (form) => run(openTrip(state, form, actor), "Reys planlaşdırıldı"),
    departTrip: (id) => run(departTrip(state, id, actor), "Reys yola düşdü"),
    arriveTrip: (id) => run(arriveTrip(state, id, actor), "Reys çatdı, yürüş yazıldı"),
    cancelTrip: (id) => run(cancelTrip(state, id, actor), "Reys ləğv olundu"),
    logFuel: (form) => run(logFuel(state, form, actor), "Yanacaq anbardan silindi və xərcə yazıldı"),
    saveFleetDoc: (form) => run(saveFleetDoc(state, form, actor), "Sənəd yazıldı"),
    addBuyer,
    reserveUnit: (unitId, buyerId) => run(reserveUnit(state, unitId, buyerId, actor), "Bron yazıldı"),
    openSale: (unitId, buyerId, credit) => run(openSale(state, unitId, buyerId, credit, actor), "Satış müqaviləsi açıldı"),
    paySale: (contractId, rowId) => run(paySale(state, contractId, rowId, actor), "Ödəniş yazıldı"),
    handoverSale: (contractId) => run(handoverSale(state, contractId, actor), "Açar təhvil verildi"),
    reload,
  }

  return <StoreContext.Provider value={value}>{children}{workflowReturn&&<Modal title="Düzəliş üçün qaralamaya qaytar" onClose={()=>setWorkflowReturn(null)}><form onSubmit={event=>{event.preventDefault();if(!workflowReason.trim())return;const result=actWorkflow(workflowReturn.id,workflowReturn.kind,undefined,workflowReason.trim());if(!result)setWorkflowReturn(null)}}><p>Təsdiqlənmiş məzmun tarixçədə saxlanır. Alış aktında stok və borc yalnız server yoxlamasından sonra əks əməliyyatla düzəldilir.</p><Field label="Düzəliş səbəbi"><textarea required value={workflowReason} onChange={e=>setWorkflowReason(e.target.value)} /></Field><button className="btn primary" type="submit">Yoxla və qaytar</button></form></Modal>}</StoreContext.Provider>
}

export function useStore() {
  const value = useContext(StoreContext)
  if (!value) throw new Error("StoreProvider tapılmadı")
  return value
}
