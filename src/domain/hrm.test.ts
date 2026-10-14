import assert from "node:assert/strict"
import test from "node:test"
import { approveLeave, deleteDepartment, deleteHrMove, deleteOffice, payHr, saveAttendance, saveDepartment, saveHrMove, saveHrPay, saveLeave, saveOffice, saveStaff } from "./hrm"
import { assignPerson, deletePerson } from "./ops"
import { createInitialState } from "./seed"
import type { StaffForm } from "./types"

const actor = { name: "Test", role: "director" }

function patchOf(result: { patch?: object }) {
  return result.patch as ReturnType<typeof createInitialState>
}

const staff: StaffForm = {
  name: "Kamal Əliyev",
  role: "Fəhlə",
  crew: "Karkas-1",
  phone: "",
  email: "kamal@afez.az",
  status: "sahede",
  departmentId: "DEP-08",
  pin: "1234567",
  hired: "2026-09-01",
  salary: "900",
  card: "EMP-099",
  placeKind: "sahe",
  site: "Xəzər Business Center",
}

test("yeni işçi şöbəyə düşür və adı təkrarlanmır", () => {
  const state = createInitialState()
  const added = saveStaff(state, staff, actor)
  assert.equal(added.error, undefined)
  const person = patchOf(added).people[0]
  assert.equal(person?.name, "Kamal Əliyev")
  assert.equal(person?.departmentId, "DEP-08")
  const again = saveStaff({ ...state, ...patchOf(added) }, staff, actor)
  assert.match(again.error ?? "", /adda işçi/)
})

test("ad dəyişəndə tapşırığın məsulu da dəyişir", () => {
  const state = createInitialState()
  const current = state.people.find((item) => item.name === "Aysel Həsənova")
  assert.ok(current)
  const renamed = saveStaff(
    state,
    {
      name: "Aysel Məmmədova",
      role: current.role,
      crew: current.crew,
      phone: current.phone,
      email: current.email,
      status: current.status,
      departmentId: current.departmentId,
      pin: current.pin,
      hired: current.hired,
      salary: String(current.salary),
      card: current.card,
      placeKind: current.placeKind,
      site: current.site,
    },
    actor,
    current.id,
  )
  assert.equal(patchOf(renamed).tasks.some((item) => item.owner === "Aysel Məmmədova"), true)
  assert.equal(patchOf(renamed).tasks.some((item) => item.owner === "Aysel Həsənova"), false)
})

test("eyni günə ikinci davamiyyət düşmür", () => {
  const state = createInitialState()
  const clash = saveAttendance(
    state,
    { personId: "HR-01", date: "2026-09-23", inAt: "08:00", outAt: "17:00", mark: "geldi", terminalId: "TRM-01", note: "" },
    actor,
  )
  assert.match(clash.error ?? "", /davamiyyət var/)
})

test("təsdiq bu günü örtəndə işçini məzuniyyətə keçirir", () => {
  const state = createInitialState()
  const opened = saveLeave(state, { personId: "HR-10", kind: "illik", from: "2026-09-23", to: "2026-09-24", note: "" }, actor)
  const id = patchOf(opened).leaves[0]?.id || ""
  const next = { ...state, ...patchOf(opened) }
  const approved = approveLeave(next, id, actor)
  assert.equal(patchOf(approved).people.find((item) => item.id === "HR-10")?.status, "mezuniyyet")
})

test("ödəniş maliyyə xərci açır, bağlı dövrə düşmür", () => {
  const state = createInitialState()
  const blocked = saveHrPay(state, { personId: "HR-01", kind: "avans", amount: "10", date: "2026-08-15", note: "" }, actor)
  assert.match(blocked.error ?? "", /Bağlı dövr/)
  const open = payHr(state, "PAY-01", actor)
  assert.equal(open.error, undefined)
  assert.equal(patchOf(open).expenses[0]?.category, "Əmək haqqı")
  assert.equal(patchOf(open).expenses[0]?.vendor, "Nigar Əliyeva")
  assert.equal(patchOf(open).hrPayments.find((item) => item.id === "PAY-01")?.status, "odenilib")
})

test("işçisi olan şöbə silinmir, sahəyə təyin mövcud işçidən gəlir", () => {
  const state = createInitialState()
  assert.match(deleteDepartment(state, "DEP-02", actor).error ?? "", /işçi var/)
  const assigned = assignPerson(state, "HR-03", "Port Baku Residence", "Tamamlama", actor)
  const moved = patchOf(assigned).people.find((item) => item.id === "HR-03")
  assert.equal(moved?.site, "Port Baku Residence")
  assert.equal(moved?.placeKind, "sahe")
  assert.equal(moved?.status, "sahede")
  assert.match(assignPerson(state, "HR-05", "Port Baku Residence", "Ofis", actor).error ?? "", /statusda/)
  assert.match(deletePerson(state, "HR-04", actor).error ?? "", /tabel/)
})

test("ofis siyahısı artır, işçi olan ofis silinmir", () => {
  const state = createInitialState()
  assert.ok(state.offices.length >= 3)
  assert.match(deleteOffice(state, "OFF-01", actor).error ?? "", /işçi/)
  const added = saveOffice(state, { name: "Xaçmaz ofis", city: "Xaçmaz", address: "Mərkəz" }, actor)
  assert.equal(added.error, undefined)
  assert.equal(patchOf(added).offices[0]?.name, "Xaçmaz ofis")
  const bad = saveStaff(state, { ...staff, placeKind: "ofis", site: "Xəzər Business Center" }, actor)
  assert.match(bad.error ?? "", /kateqoriyada/)
  const renamed = saveOffice(state, { name: "Mərkəzi ofis", city: "Bakı", address: "Nərimanov" }, actor, "OFF-01")
  assert.equal(patchOf(renamed).people.find((item) => item.id === "HR-11")?.site, "Mərkəzi ofis")
})

test("işçi zavoda, tikinti şöbəsinə və ofisə köçür", () => {
  const state = createInitialState()
  const same = saveHrMove(state, { personId: "HR-03", date: "2026-09-23", kind: "ofis", site: "Baş ofis", departmentId: "", note: "" }, actor)
  assert.match(same.error ?? "", /artıq bu yerdədir/)
  const office = saveHrMove(state, { personId: "HR-03", date: "2026-09-23", kind: "ofis", site: "Gəncə ofis", departmentId: "", note: "Region" }, actor)
  const moved = patchOf(office).people.find((item) => item.id === "HR-03")
  assert.equal(moved?.site, "Gəncə ofis")
  assert.equal(moved?.placeKind, "ofis")
  assert.equal(patchOf(office).moves[0]?.fromSite, "Baş ofis")
  const plant = saveHrMove(state, { personId: "HR-01", date: "2026-09-23", kind: "zavod", site: "Armatur sexi", departmentId: "DEP-07", note: "" }, actor)
  const atPlant = patchOf(plant).people.find((item) => item.id === "HR-01")
  assert.equal(atPlant?.site, "Armatur sexi")
  assert.equal(atPlant?.placeKind, "istehsal")
  assert.equal(atPlant?.status, "istehsalda")
  const site = saveHrMove(state, { personId: "HR-07", date: "2026-09-23", kind: "tikinti", site: "Sumqayıt Lojistik Park", departmentId: "DEP-08", note: "" }, actor)
  const atSite = patchOf(site).people.find((item) => item.id === "HR-07")
  assert.equal(atSite?.site, "Sumqayıt Lojistik Park")
  assert.equal(atSite?.departmentId, "DEP-08")
  assert.equal(atSite?.status, "sahede")
  const away = saveHrMove(state, { personId: "HR-05", date: "2026-09-23", kind: "ofis", site: "Sumqayıt ofis", departmentId: "", note: "" }, actor)
  assert.equal(patchOf(away).people.find((item) => item.id === "HR-05")?.status, "mezuniyyet")
})

test("köçürmə yazılır və silinəndə işçi əvvəlki yerinə qayıdır", () => {
  const state = createInitialState()
  const moved = saveHrMove(state, { personId: "HR-03", date: "2026-09-23", kind: "ofis", site: "Gəncə ofis", departmentId: "", note: "Region" }, actor)
  const next = { ...state, ...patchOf(moved) }
  const id = patchOf(moved).moves[0]?.id || ""
  const edited = saveHrMove(next, { personId: "HR-03", date: "2026-09-24", kind: "ofis", site: "Sumqayıt ofis", departmentId: "", note: "Region ofis" }, actor, id)
  const person = patchOf(edited).people.find((item) => item.id === "HR-03")
  assert.equal(person?.site, "Sumqayıt ofis")
  assert.equal(patchOf(edited).moves.find((item) => item.id === id)?.fromSite, "Baş ofis")
  assert.equal(patchOf(edited).moves.find((item) => item.id === id)?.note, "Region ofis")
  const removed = deleteHrMove({ ...next, ...patchOf(edited) }, id, actor)
  assert.equal(patchOf(removed).people.find((item) => item.id === "HR-03")?.site, "Baş ofis")
  assert.equal(patchOf(removed).moves.some((item) => item.id === id), false)
  const older = deleteHrMove(state, "MOV-01", actor)
  assert.equal(patchOf(older).people.find((item) => item.id === "HR-06")?.site, "Panel sexi")
  const kept = deleteHrMove(state, "MOV-02", actor)
  assert.equal(patchOf(kept).moves.some((item) => item.id === "MOV-01"), true)
})

test("şöbə kodu təkrarlanmır", () => {
  const state = createInitialState()
  const clash = saveDepartment(state, { name: "Yeni", code: "IDR", leadId: "HR-11", site: "Baş ofis" }, actor)
  assert.match(clash.error ?? "", /kod/)
})
