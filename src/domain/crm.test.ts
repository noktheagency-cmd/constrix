import assert from "node:assert/strict"
import test from "node:test"
import { crmBoard, deleteFile, deleteTask, saveFile, saveTask, setFileStatus, setTaskStatus } from "./crm"
import { deleteClient, promoteLead, updateClient } from "./ops"
import { createInitialState } from "./seed"
import type { FileForm, TaskForm } from "./types"

const actor = { name: "Test", role: "director" }

const taskForm: TaskForm = {
  title: "Zəng et",
  kind: "zeng",
  priority: "yuksek",
  owner: "Aysel Həsənova",
  due: "2026-10-01",
  client: "Xəzər Holdinq",
  dealId: "",
  leadId: "",
  note: "",
}

const fileForm: FileForm = {
  title: "Yeni təklif",
  number: "KT-9",
  kind: "teklif",
  date: "2026-09-23",
  due: "2026-10-01",
  client: "Xəzər Holdinq",
  dealId: "",
  projectId: "",
  note: "",
  owner: "Aysel Həsənova",
}

test("icmal borunu, isti fürsəti, açıq işi və vaxtı keçən sənədi sayır", () => {
  const board = crmBoard(createInitialState())
  assert.equal(board.pipeline, 27200000)
  assert.equal(board.hot, 2)
  assert.equal(board.openTasks, 4)
  assert.equal(board.overdue, 1)
  assert.equal(board.waiting, 3)
  assert.equal(board.dueDocs, 1)
})

test("adsız tapşırıq açılmır, bitən iş açıq siyahıdan çıxır və silinmir", () => {
  const state = createInitialState()
  const blank = saveTask(state, { ...taskForm, title: "  " }, actor)
  assert.match(blank.error ?? "", /vacib/)
  const saved = saveTask(state, taskForm, actor)
  assert.equal(saved.error, undefined)
  const next = { ...state, ...saved.patch }
  assert.equal(crmBoard(next).openTasks, 5)
  const id = next.tasks[0]?.id ?? ""
  const moved = setTaskStatus(next, id, "gedir", actor)
  const going = { ...next, ...moved.patch }
  const done = setTaskStatus(going, id, "bitdi", actor)
  assert.match(done.error ?? "", /addım/)
  const waiting = setTaskStatus(going, id, "gozleyir", actor)
  const held = { ...going, ...waiting.patch }
  const finished = setTaskStatus(held, id, "bitdi", actor)
  const after = { ...held, ...finished.patch }
  assert.equal(crmBoard(after).openTasks, 4)
  assert.match(deleteTask(after, id, actor).error ?? "", /silinmir/)
})

test("sənəd bir addım gedir, qaralama silinir, təsdiq qalır", () => {
  const state = createInitialState()
  assert.match(setFileStatus(state, "CRF-003", "tesdiq", actor).error ?? "", /addım/)
  const stepped = setFileStatus(state, "CRF-003", "gozleyir", actor)
  assert.equal(stepped.error, undefined)
  assert.equal(deleteFile(state, "CRF-003", actor).error, undefined)
  assert.match(deleteFile(state, "CRF-002", actor).error ?? "", /qaralama/)
  assert.match(saveFile(state, fileForm, actor, "CRF-002").error ?? "", /yazılmır/)
  const back = setFileStatus(state, "CRF-001", "qaralama", actor)
  assert.equal(back.error, undefined)
})

test("sifarişçi adı tapşırıq və sənədə keçir, tapşırığı olan sifarişçi silinmir", () => {
  const state = createInitialState()
  const renamed = updateClient(state, "CLT-014", {
    name: "Xəzər Holdinq MMC",
    sector: "Development",
    contact: "Rəşad Quliyev",
    phone: "+994 50 310 22 18",
    email: "rashad@xezerholding.az",
    city: "Bakı",
    value: "42700000",
  }, actor)
  assert.equal(renamed.error, undefined)
  const next = { ...state, ...renamed.patch }
  assert.equal(next.tasks.find((item) => item.id === "TSK-004")?.client, "Xəzər Holdinq MMC")
  assert.equal(next.files.find((item) => item.id === "CRF-002")?.client, "Xəzər Holdinq MMC")
  const held = {
    ...state,
    clients: [...state.clients, { id: "CLT-099", name: "Test MMC", sector: "Sənaye", contact: "A", phone: "—", email: "—", city: "Bakı", projects: 0, value: 0, since: "2026" }],
    tasks: [{ id: "TSK-099", title: "Yoxla", kind: "takip" as const, status: "acik" as const, priority: "orta" as const, owner: "A", due: "2026-10-01", client: "Test MMC", dealId: "", leadId: "", note: "" }, ...state.tasks],
  }
  assert.match(deleteClient(held, "CLT-099", actor).error ?? "", /tapşırığ/)
})

test("potensial sövdəyə keçəndə tapşırıq yeni sövdəyə bağlanır", () => {
  const state = createInitialState()
  const saved = saveTask(state, { ...taskForm, title: "İzlə", client: "Şəki Turizm", leadId: "LD-096" }, actor)
  const withTask = { ...state, ...saved.patch }
  const moved = promoteLead(withTask, "LD-096", actor)
  assert.equal(moved.error, undefined)
  const next = { ...withTask, ...moved.patch }
  const task = next.tasks.find((item) => item.title === "İzlə")
  assert.equal(task?.leadId, "")
  assert.ok(task?.dealId)
  assert.equal(next.leads.some((item) => item.id === "LD-096"), false)
  assert.equal(next.deals[0]?.title, "Şəki otel rekonstruksiyası")
})
