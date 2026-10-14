import { nextId } from "../format"
import type {
  Actor,
  AppState,
  AttendanceForm,
  AttendanceMark,
  DepartmentForm,
  HrPayForm,
  HrPayKind,
  LeaveForm,
  LeaveKind,
  OpResult,
  HrMove,
  HrMoveForm,
  HrMoveKind,
  OfficeForm,
  Person,
  StaffForm,
  TerminalForm,
  TerminalStatus,
} from "./types"
import { isAway, knownPlace, PLACE_STATUS, placeKindOf } from "./places"
import { TODAY } from "./ops"

export const MARKS: AttendanceMark[] = ["geldi", "gec", "gelmedi", "mezuniyyet", "ezamiyyet"]
export const LEAVE_KINDS: LeaveKind[] = ["illik", "xestelik", "odenissiz", "ezamiyyet"]
export const PAY_KINDS: HrPayKind[] = ["maas", "avans", "mukafat", "cerime"]

function audit(state: AppState, actor: Actor | undefined, action: string, detail: string) {
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

function fail(error: string): OpResult {
  return { error }
}

function same(a: string, b: string) {
  return a.trim().toLocaleLowerCase("az") === b.trim().toLocaleLowerCase("az")
}

function hoursOf(inAt: string, outAt: string) {
  const [ih, im] = inAt.split(":").map(Number)
  const [oh, om] = outAt.split(":").map(Number)
  if (!Number.isFinite(ih) || !Number.isFinite(oh)) return 0
  const mins = oh * 60 + (om || 0) - (ih * 60 + (im || 0))
  if (mins <= 0) return 0
  return Math.round((mins / 60) * 10) / 10
}

function span(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00`)
  const end = Date.parse(`${to}T00:00:00`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0
  return Math.round((end - start) / 86400000) + 1
}

function covers(from: string, to: string, day: string) {
  return from <= day && day <= to
}

function periodClosed(state: AppState, iso: string) {
  return state.closedPeriods.includes(iso.slice(0, 7))
}

function renameOwner<T extends { owner: string }>(rows: T[], from: string, to: string) {
  if (from === to) return rows
  return rows.map((item) => (item.owner === from ? { ...item, owner: to } : item))
}

export function ownerOptions(people: { name: string; role: string }[], current = "") {
  const rows = [...people]
    .sort((a, b) => a.name.localeCompare(b.name, "az"))
    .map((item) => ({ value: item.name, label: item.role ? `${item.name} · ${item.role}` : item.name }))
  if (current && !rows.some((item) => item.value === current)) rows.unshift({ value: current, label: current })
  return rows
}

export function hrmRecords(): Pick<AppState, "offices" | "departments" | "terminals" | "attendance" | "leaves" | "hrPayments" | "moves"> {
  return {
    offices: [
      { id: "OFF-01", name: "Baş ofis", city: "Bakı", address: "Nərimanov, Atatürk pr. 14" },
      { id: "OFF-02", name: "Gəncə ofis", city: "Gəncə", address: "Kəpəz, Nizami 22" },
      { id: "OFF-03", name: "Sumqayıt ofis", city: "Sumqayıt", address: "Sülh küç. 8" },
    ],
    departments: [
      { id: "DEP-01", name: "İdarəetmə", code: "IDR", leadId: "HR-11", site: "Baş ofis" },
      { id: "DEP-02", name: "Layihə", code: "LAY", leadId: "HR-01", site: "Port Baku Residence" },
      { id: "DEP-03", name: "Kommersiya", code: "KOM", leadId: "HR-03", site: "Baş ofis" },
      { id: "DEP-04", name: "Maliyyə", code: "MAL", leadId: "HR-05", site: "Baş ofis" },
      { id: "DEP-05", name: "Təchizat", code: "TEC", leadId: "HR-07", site: "Baş ofis" },
      { id: "DEP-06", name: "Anbar", code: "ANB", leadId: "HR-02", site: "Mərkəzi anbar" },
      { id: "DEP-07", name: "İstehsal", code: "IST", leadId: "HR-06", site: "Beton zavodu" },
      { id: "DEP-08", name: "Sahə", code: "SAH", leadId: "HR-04", site: "Xəzər Business Center" },
      { id: "DEP-09", name: "Texnika", code: "TEX", leadId: "HR-08", site: "Servis mərkəzi" },
    ],
    terminals: [
      { id: "TRM-01", name: "Port Baku giriş", code: "PB-01", site: "Port Baku Residence", status: "online", lastSeen: "2026-09-23 08:02" },
      { id: "TRM-02", name: "Xəzər keçid", code: "XZ-01", site: "Xəzər Business Center", status: "online", lastSeen: "2026-09-23 07:55" },
      { id: "TRM-03", name: "Zavod keçid", code: "ZV-01", site: "Beton zavodu", status: "offline", lastSeen: "2026-09-22 17:40" },
      { id: "TRM-04", name: "Baş ofis", code: "OF-01", site: "Baş ofis", status: "online", lastSeen: "2026-09-23 09:05" },
    ],
    attendance: [
      { id: "ATT-01", personId: "HR-01", date: "2026-09-23", inAt: "08:02", outAt: "18:10", mark: "geldi", terminalId: "TRM-01", hours: 10.1, note: "" },
      { id: "ATT-02", personId: "HR-04", date: "2026-09-23", inAt: "07:55", outAt: "17:40", mark: "geldi", terminalId: "TRM-02", hours: 9.8, note: "" },
      { id: "ATT-03", personId: "HR-06", date: "2026-09-23", inAt: "09:20", outAt: "18:00", mark: "gec", terminalId: "TRM-03", hours: 8.7, note: "Nasos növbəsinə gecikdi." },
      { id: "ATT-04", personId: "HR-03", date: "2026-09-23", inAt: "09:05", outAt: "18:00", mark: "geldi", terminalId: "TRM-04", hours: 8.9, note: "" },
      { id: "ATT-05", personId: "HR-05", date: "2026-09-23", inAt: "", outAt: "", mark: "mezuniyyet", terminalId: "", hours: 0, note: "İllik məzuniyyət." },
      { id: "ATT-06", personId: "HR-08", date: "2026-09-23", inAt: "", outAt: "", mark: "gelmedi", terminalId: "", hours: 0, note: "Zəng gəlmədi." },
    ],
    leaves: [
      { id: "LV-01", personId: "HR-05", kind: "illik", from: "2026-09-20", to: "2026-09-30", days: 11, status: "tesdiq", note: "Planlı illik." },
      { id: "LV-02", personId: "HR-09", kind: "xestelik", from: "2026-09-26", to: "2026-09-28", days: 3, status: "gozleyir", note: "Həkim arayışı gözlənilir." },
      { id: "LV-03", personId: "HR-07", kind: "odenissiz", from: "2026-10-02", to: "2026-10-03", days: 2, status: "gozleyir", note: "Şəxsi iş." },
    ],
    hrPayments: [
      { id: "PAY-01", personId: "HR-01", kind: "avans", amount: 500, date: "2026-09-23", status: "gozleyir", note: "Sentyabr avansı.", expenseId: "" },
      { id: "PAY-02", personId: "HR-06", kind: "mukafat", amount: 200, date: "2026-09-23", status: "gozleyir", note: "Növbə mükafatı.", expenseId: "" },
      { id: "PAY-03", personId: "HR-02", kind: "cerime", amount: 40, date: "2026-09-22", status: "gozleyir", note: "Gecikmə.", expenseId: "" },
    ],
    moves: [
      { id: "MOV-01", personId: "HR-06", date: "2026-02-12", kind: "zavod", fromSite: "Panel sexi", fromDepartmentId: "DEP-07", toSite: "Beton zavodu", toDepartmentId: "DEP-07", note: "Beton növbəsinə keçdi." },
      { id: "MOV-02", personId: "HR-01", date: "2026-04-01", kind: "tikinti", fromSite: "Baş ofis", fromDepartmentId: "DEP-03", toSite: "Port Baku Residence", toDepartmentId: "DEP-02", note: "Layihə şöbəsinə keçdi." },
    ],
  }
}

function personFrom(form: StaffForm, id: string): Person {
  return {
    id,
    name: form.name.trim(),
    role: form.role.trim(),
    crew: form.crew.trim() || "—",
    site: form.site.trim(),
    placeKind: form.placeKind,
    status: form.status,
    phone: form.phone.trim() || "—",
    email: form.email.trim() || "—",
    departmentId: form.departmentId,
    pin: form.pin.trim(),
    hired: form.hired,
    salary: Math.round(Number(form.salary) || 0),
    card: form.card.trim(),
  }
}

export function saveStaff(state: AppState, form: StaffForm, actor: Actor, id?: string): OpResult {
  const name = form.name.trim()
  if (!name || !form.role.trim()) return fail("Ad və vəzifə vacibdir.")
  if (!form.departmentId || !state.departments.some((item) => item.id === form.departmentId)) return fail("Şöbə seçin.")
  if (!form.site.trim()) return fail("Yer seçin.")
  if (form.placeKind !== placeKindOf(state, form.site) || !knownPlace(state, form.site)) return fail("Yer bu kateqoriyada yoxdur.")
  if (!form.hired) return fail("İşə qəbul tarixi vacibdir.")
  if (form.email.trim() && !form.email.includes("@")) return fail("E-poçt düzgün deyil.")
  if (form.pin.trim() && !/^\d{7}$/.test(form.pin.trim())) return fail("FİN 7 rəqəm olmalıdır.")
  if (!(Number(form.salary) >= 0)) return fail("Maaş mənfi ola bilməz.")
  if (state.people.some((item) => item.id !== id && same(item.name, name))) return fail("Bu adda işçi var.")
  if (form.pin.trim() && state.people.some((item) => item.id !== id && item.pin === form.pin.trim())) return fail("Bu FİN artıq yazılıb.")
  if (form.card.trim() && state.people.some((item) => item.id !== id && item.card === form.card.trim())) return fail("Bu kart artıq yazılıb.")
  const current = id ? state.people.find((item) => item.id === id) : undefined
  if (id && !current) return fail("İşçi tapılmadı.")
  const person = personFrom(form, current?.id || nextId("HR", state.people))
  const people = current ? state.people.map((item) => (item.id === current.id ? person : item)) : [person, ...state.people]
  const from = current?.name || ""
  const carry = <T extends { owner: string }>(rows: T[]) => (from && from !== person.name ? renameOwner(rows, from, person.name) : rows)
  return {
    patch: {
      people,
      tasks: carry(state.tasks),
      files: carry(state.files),
      activities: carry(state.activities),
      leads: carry(state.leads),
      deals: carry(state.deals),
      audit: audit(state, actor, current ? "İşçi yazıldı" : "İşçi əlavə olundu", person.name),
    },
  }
}

export function saveDepartment(state: AppState, form: DepartmentForm, actor: Actor, id?: string): OpResult {
  const name = form.name.trim()
  const code = form.code.trim().toUpperCase()
  if (!name || !code) return fail("Ad və kod vacibdir.")
  if (!form.site.trim()) return fail("Yer seçin.")
  if (!knownPlace(state, form.site)) return fail("Yer siyahıda yoxdur.")
  if (form.leadId && !state.people.some((item) => item.id === form.leadId)) return fail("Rəhbər tapılmadı.")
  if (state.departments.some((item) => item.id !== id && same(item.name, name))) return fail("Bu adda şöbə var.")
  if (state.departments.some((item) => item.id !== id && item.code.toUpperCase() === code)) return fail("Bu kod artıq yazılıb.")
  const current = id ? state.departments.find((item) => item.id === id) : undefined
  if (id && !current) return fail("Şöbə tapılmadı.")
  const row = { id: current?.id || nextId("DEP", state.departments), name, code, leadId: form.leadId, site: form.site.trim() }
  return {
    patch: {
      departments: current ? state.departments.map((item) => (item.id === current.id ? row : item)) : [row, ...state.departments],
      audit: audit(state, actor, current ? "Şöbə yazıldı" : "Şöbə açıldı", row.name),
    },
  }
}

export function deleteDepartment(state: AppState, id: string, actor: Actor): OpResult {
  const row = state.departments.find((item) => item.id === id)
  if (!row) return fail("Şöbə tapılmadı.")
  if (state.people.some((item) => item.departmentId === id)) return fail("Bu şöbədə işçi var.")
  return {
    patch: {
      departments: state.departments.filter((item) => item.id !== id),
      audit: audit(state, actor, "Şöbə silindi", row.name),
    },
  }
}

export function saveOffice(state: AppState, form: OfficeForm, actor: Actor, id?: string): OpResult {
  const name = form.name.trim()
  const city = form.city.trim()
  const address = form.address.trim()
  if (!name || !city) return fail("Ad və şəhər vacibdir.")
  if (state.offices.some((item) => item.id !== id && same(item.name, name))) return fail("Bu adda ofis var.")
  if (state.projects.some((item) => same(item.name, name)) || state.plants.some((item) => same(item.name, name))) return fail("Bu ad artıq yer kimi yazılıb.")
  const current = id ? state.offices.find((item) => item.id === id) : undefined
  if (id && !current) return fail("Ofis tapılmadı.")
  const row = { id: current?.id || nextId("OFF", state.offices), name, city, address }
  const from = current?.name || ""
  const renamed = Boolean(from && from !== name)
  return {
    patch: {
      offices: current ? state.offices.map((item) => (item.id === current.id ? row : item)) : [row, ...state.offices],
      people: renamed ? state.people.map((item) => (item.site === from ? { ...item, site: name } : item)) : state.people,
      departments: renamed ? state.departments.map((item) => (item.site === from ? { ...item, site: name } : item)) : state.departments,
      terminals: renamed ? state.terminals.map((item) => (item.site === from ? { ...item, site: name } : item)) : state.terminals,
      audit: audit(state, actor, current ? "Ofis yazıldı" : "Ofis açıldı", row.name),
    },
  }
}

export function deleteOffice(state: AppState, id: string, actor: Actor): OpResult {
  const row = state.offices.find((item) => item.id === id)
  if (!row) return fail("Ofis tapılmadı.")
  if (state.people.some((item) => item.site === row.name)) return fail("Bu ofisdə işçi var.")
  if (state.departments.some((item) => item.site === row.name)) return fail("Bu ofisə şöbə bağlıdır.")
  if (state.terminals.some((item) => item.site === row.name)) return fail("Bu ofisə terminal bağlıdır.")
  return {
    patch: {
      offices: state.offices.filter((item) => item.id !== id),
      audit: audit(state, actor, "Ofis silindi", row.name),
    },
  }
}

export function saveTerminal(state: AppState, form: TerminalForm, actor: Actor, id?: string): OpResult {
  const name = form.name.trim()
  const code = form.code.trim().toUpperCase()
  if (!name || !code) return fail("Ad və kod vacibdir.")
  if (!form.site.trim()) return fail("Yer seçin.")
  if (!knownPlace(state, form.site)) return fail("Yer siyahıda yoxdur.")
  if (state.terminals.some((item) => item.id !== id && item.code.toUpperCase() === code)) return fail("Bu kod artıq yazılıb.")
  const current = id ? state.terminals.find((item) => item.id === id) : undefined
  if (id && !current) return fail("Terminal tapılmadı.")
  const row = {
    id: current?.id || nextId("TRM", state.terminals),
    name,
    code,
    site: form.site.trim(),
    status: form.status,
    lastSeen: current?.lastSeen || "",
  }
  return {
    patch: {
      terminals: current ? state.terminals.map((item) => (item.id === current.id ? row : item)) : [row, ...state.terminals],
      audit: audit(state, actor, current ? "Terminal yazıldı" : "Terminal açıldı", row.name),
    },
  }
}

export function setTerminalStatus(state: AppState, id: string, status: TerminalStatus, actor: Actor): OpResult {
  const row = state.terminals.find((item) => item.id === id)
  if (!row) return fail("Terminal tapılmadı.")
  if (row.status === status) return fail(status === "online" ? "Terminal artıq onlayndır." : "Terminal artıq oflayndır.")
  return {
    patch: {
      terminals: state.terminals.map((item) => (item.id === id ? { ...item, status, lastSeen: status === "online" ? `${TODAY} 08:00` : item.lastSeen } : item)),
      audit: audit(state, actor, status === "online" ? "Terminal açıldı" : "Terminal söndü", row.name),
    },
  }
}

export function deleteTerminal(state: AppState, id: string, actor: Actor): OpResult {
  const row = state.terminals.find((item) => item.id === id)
  if (!row) return fail("Terminal tapılmadı.")
  if (state.attendance.some((item) => item.terminalId === id)) return fail("Bu terminalın davamiyyəti var.")
  return {
    patch: {
      terminals: state.terminals.filter((item) => item.id !== id),
      audit: audit(state, actor, "Terminal silindi", row.name),
    },
  }
}

export function saveAttendance(state: AppState, form: AttendanceForm, actor: Actor, id?: string): OpResult {
  if (!state.people.some((item) => item.id === form.personId)) return fail("İşçi seçin.")
  if (!form.date) return fail("Tarix vacibdir.")
  if (!MARKS.includes(form.mark)) return fail("Nişan seçin.")
  if ((form.mark === "geldi" || form.mark === "gec") && !form.inAt) return fail("Giriş saatı vacibdir.")
  if (form.terminalId && !state.terminals.some((item) => item.id === form.terminalId)) return fail("Terminal tapılmadı.")
  if (state.attendance.some((item) => item.id !== id && item.personId === form.personId && item.date === form.date)) {
    return fail("Bu gün üçün davamiyyət var.")
  }
  const current = id ? state.attendance.find((item) => item.id === id) : undefined
  if (id && !current) return fail("Davamiyyət tapılmadı.")
  const row = {
    id: current?.id || nextId("ATT", state.attendance),
    personId: form.personId,
    date: form.date,
    inAt: form.inAt,
    outAt: form.outAt,
    mark: form.mark,
    terminalId: form.terminalId,
    hours: form.mark === "gelmedi" || form.mark === "mezuniyyet" ? 0 : hoursOf(form.inAt, form.outAt),
    note: form.note.trim(),
  }
  const seen = form.inAt || "08:00"
  return {
    patch: {
      attendance: current ? state.attendance.map((item) => (item.id === current.id ? row : item)) : [row, ...state.attendance],
      terminals: form.terminalId
        ? state.terminals.map((item) => (item.id === form.terminalId ? { ...item, lastSeen: `${form.date} ${seen}`, status: "online" as const } : item))
        : state.terminals,
      audit: audit(state, actor, current ? "Davamiyyət yazıldı" : "Davamiyyət açıldı", row.id),
    },
  }
}

export function deleteAttendance(state: AppState, id: string, actor: Actor): OpResult {
  if (!state.attendance.some((item) => item.id === id)) return fail("Davamiyyət tapılmadı.")
  return {
    patch: {
      attendance: state.attendance.filter((item) => item.id !== id),
      audit: audit(state, actor, "Davamiyyət silindi", id),
    },
  }
}

export function saveLeave(state: AppState, form: LeaveForm, actor: Actor, id?: string): OpResult {
  if (!state.people.some((item) => item.id === form.personId)) return fail("İşçi seçin.")
  if (!LEAVE_KINDS.includes(form.kind)) return fail("Növ seçin.")
  const days = span(form.from, form.to)
  if (!days) return fail("Tarix aralığı düzgün deyil.")
  const clash = state.leaves.some(
    (item) => item.id !== id && item.status !== "redd" && item.personId === form.personId && form.from <= item.to && item.from <= form.to,
  )
  if (clash) return fail("Bu aralıqda məzuniyyət var.")
  const current = id ? state.leaves.find((item) => item.id === id) : undefined
  if (id && !current) return fail("Məzuniyyət tapılmadı.")
  if (current && current.status === "tesdiq") return fail("Təsdiqli məzuniyyət yazılmır.")
  const row = {
    id: current?.id || nextId("LV", state.leaves),
    personId: form.personId,
    kind: form.kind,
    from: form.from,
    to: form.to,
    days,
    status: current?.status || ("gozleyir" as const),
    note: form.note.trim(),
  }
  return {
    patch: {
      leaves: current ? state.leaves.map((item) => (item.id === current.id ? row : item)) : [row, ...state.leaves],
      audit: audit(state, actor, current ? "Məzuniyyət yazıldı" : "Məzuniyyət açıldı", row.id),
    },
  }
}

export function approveLeave(state: AppState, id: string, actor: Actor): OpResult {
  const row = state.leaves.find((item) => item.id === id)
  if (!row || row.status !== "gozleyir") return fail("Gözləyən məzuniyyət seçin.")
  const away = covers(row.from, row.to, TODAY)
  return {
    patch: {
      leaves: state.leaves.map((item) => (item.id === id ? { ...item, status: "tesdiq" as const } : item)),
      people: away ? state.people.map((item) => (item.id === row.personId ? { ...item, status: "mezuniyyet" as const } : item)) : state.people,
      audit: audit(state, actor, "Məzuniyyət təsdiqləndi", row.id),
    },
  }
}

export function rejectLeave(state: AppState, id: string, actor: Actor): OpResult {
  const row = state.leaves.find((item) => item.id === id)
  if (!row || row.status !== "gozleyir") return fail("Gözləyən məzuniyyət seçin.")
  return {
    patch: {
      leaves: state.leaves.map((item) => (item.id === id ? { ...item, status: "redd" as const } : item)),
      audit: audit(state, actor, "Məzuniyyət rədd edildi", row.id),
    },
  }
}

export function deleteLeave(state: AppState, id: string, actor: Actor): OpResult {
  const row = state.leaves.find((item) => item.id === id)
  if (!row) return fail("Məzuniyyət tapılmadı.")
  if (row.status === "tesdiq") return fail("Təsdiqli məzuniyyət silinmir.")
  return {
    patch: {
      leaves: state.leaves.filter((item) => item.id !== id),
      audit: audit(state, actor, "Məzuniyyət silindi", id),
    },
  }
}

export function saveHrPay(state: AppState, form: HrPayForm, actor: Actor, id?: string): OpResult {
  if (!state.people.some((item) => item.id === form.personId)) return fail("İşçi seçin.")
  if (!PAY_KINDS.includes(form.kind)) return fail("Növ seçin.")
  const amount = Math.round(Number(form.amount) || 0)
  if (!(amount > 0)) return fail("Məbləğ vacibdir.")
  if (!form.date) return fail("Tarix vacibdir.")
  if (periodClosed(state, form.date)) return fail("Bağlı dövrə ödəniş yazılmır.")
  const current = id ? state.hrPayments.find((item) => item.id === id) : undefined
  if (id && !current) return fail("Ödəniş tapılmadı.")
  if (current?.status === "odenilib") return fail("Ödənilmiş sətir yazılmır.")
  const row = {
    id: current?.id || nextId("PAY", state.hrPayments),
    personId: form.personId,
    kind: form.kind,
    amount,
    date: form.date,
    status: "gozleyir" as const,
    note: form.note.trim(),
    expenseId: "",
  }
  return {
    patch: {
      hrPayments: current ? state.hrPayments.map((item) => (item.id === current.id ? row : item)) : [row, ...state.hrPayments],
      audit: audit(state, actor, current ? "Ödəniş yazıldı" : "Ödəniş açıldı", row.id),
    },
  }
}

export function payHr(state: AppState, id: string, actor: Actor): OpResult {
  const row = state.hrPayments.find((item) => item.id === id)
  if (!row || row.status !== "gozleyir") return fail("Gözləyən ödəniş seçin.")
  if (periodClosed(state, row.date)) return fail("Bağlı dövrə ödəniş düşmür.")
  const person = state.people.find((item) => item.id === row.personId)
  if (!person) return fail("İşçi tapılmadı.")
  const expenseId = nextId("EXP", state.expenses)
  return {
    patch: {
      hrPayments: state.hrPayments.map((item) => (item.id === id ? { ...item, status: "odenilib" as const, expenseId } : item)),
      expenses: [
        { id: expenseId, category: "Əmək haqqı", vendor: person.name, project: "—", amount: row.amount, date: row.date, status: "tesdiq" as const },
        ...state.expenses,
      ],
      audit: audit(state, actor, "Ödəniş maliyyəyə düşdü", `${row.id} · ${person.name}`),
    },
  }
}

export function deleteHrPay(state: AppState, id: string, actor: Actor): OpResult {
  const row = state.hrPayments.find((item) => item.id === id)
  if (!row) return fail("Ödəniş tapılmadı.")
  if (row.status === "odenilib") return fail("Ödənilmiş sətir silinmir.")
  return {
    patch: {
      hrPayments: state.hrPayments.filter((item) => item.id !== id),
      audit: audit(state, actor, "Ödəniş silindi", id),
    },
  }
}

function movePlace(kind: HrMoveKind) {
  return kind === "zavod" ? "istehsal" : kind === "ofis" ? "ofis" : "sahe"
}

function laterMove(moves: HrMove[], move: HrMove) {
  const index = moves.findIndex((item) => item.id === move.id)
  return moves.some((item, at) => item.id !== move.id && item.personId === move.personId && (item.date > move.date || (item.date === move.date && at < index)))
}

function placedBy(person: { site: string; departmentId: string }, move: HrMove) {
  return person.site === move.toSite && person.departmentId === move.toDepartmentId
}

function park(state: AppState, people: AppState["people"], move: HrMove, back: boolean) {
  return people.map((item) => {
    if (item.id !== move.personId) return item
    if (back && !placedBy(item, move)) return item
    const site = back ? move.fromSite : move.toSite
    const departmentId = back ? move.fromDepartmentId : move.toDepartmentId
    const placeKind = back ? placeKindOf(state, site) : movePlace(move.kind)
    return { ...item, site, departmentId, placeKind, status: isAway(item.status) ? item.status : PLACE_STATUS[placeKind] }
  })
}

export function saveHrMove(state: AppState, form: HrMoveForm, actor: Actor, id?: string): OpResult {
  const person = state.people.find((item) => item.id === form.personId)
  if (!person) return fail("İşçi seçin.")
  if (person.status === "cixis") return fail("İşdən çıxmış işçi köçürülmür.")
  if (!form.date) return fail("Tarix vacibdir.")
  if (form.kind !== "zavod" && form.kind !== "tikinti" && form.kind !== "ofis") return fail("Növ seçin.")
  const site = form.site.trim()
  if (form.kind === "zavod" && !state.plants.some((item) => item.name === site)) return fail("Zavod seçin.")
  if (form.kind === "ofis" && !state.offices.some((item) => item.name === site)) return fail("Ofis seçin.")
  if (form.kind === "tikinti" && !state.projects.some((item) => item.name === site)) return fail("Tikinti sahəsi seçin.")
  const current = id ? state.moves.find((item) => item.id === id) : undefined
  if (id && !current) return fail("Köçürmə tapılmadı.")
  const department = form.departmentId ? state.departments.find((item) => item.id === form.departmentId) : undefined
  if (form.departmentId && !department) return fail("Şöbə tapılmadı.")
  if (form.kind === "tikinti" && (!department || placeKindOf(state, department.site) !== "sahe")) return fail("Tikinti şöbəsi seçin.")
  const samePerson = !current || current.personId === person.id
  const departmentId = department?.id || (current && samePerson ? current.toDepartmentId : person.departmentId)
  const sameTarget = Boolean(current && current.personId === person.id && current.toSite === site && current.toDepartmentId === departmentId)
  if (!sameTarget && person.site === site && departmentId === person.departmentId) return fail("İşçi artıq bu yerdədir.")
  const row: HrMove = {
    id: current?.id || nextId("MOV", state.moves),
    personId: person.id,
    date: form.date,
    kind: form.kind,
    fromSite: current && samePerson ? current.fromSite : person.site,
    fromDepartmentId: current && samePerson ? current.fromDepartmentId : person.departmentId,
    toSite: site,
    toDepartmentId: departmentId,
    note: form.note.trim(),
  }
  const wasControlling = Boolean(current && !laterMove(state.moves, current) && state.people.some((item) => item.id === current.personId && placedBy(item, current)))
  let people = wasControlling && current ? park(state, state.people, current, true) : state.people
  const moves = current ? state.moves.map((item) => (item.id === current.id ? row : item)) : [row, ...state.moves]
  const sitting = people.find((item) => item.id === row.personId)
  const canPlace = !laterMove(moves, row) && (!current || wasControlling || current.personId !== row.personId || sitting?.site === row.fromSite)
  if (canPlace) people = park(state, people, row, false)
  return {
    patch: {
      moves,
      people,
      audit: audit(state, actor, current ? "Köçürmə yazıldı" : "İşçi köçürüldü", `${person.name} · ${row.fromSite} → ${site}`),
    },
  }
}

export function deleteHrMove(state: AppState, id: string, actor: Actor): OpResult {
  const row = state.moves.find((item) => item.id === id)
  if (!row) return fail("Köçürmə tapılmadı.")
  const people = laterMove(state.moves, row) ? state.people : park(state, state.people, row, true)
  return {
    patch: {
      moves: state.moves.filter((item) => item.id !== id),
      people,
      audit: audit(state, actor, "Köçürmə silindi", row.id),
    },
  }
}
