import { nextId } from "../format"
import type {
  ActivityForm,
  ActivityKind,
  Actor,
  AppState,
  DealForm,
  FileForm,
  FileKind,
  FileStatus,
  OpResult,
  TaskForm,
  TaskKind,
  TaskPriority,
  TaskStatus,
} from "./types"
import { TODAY } from "./ops"

export const TASK_STATUSES: TaskStatus[] = ["acik", "gedir", "gozleyir", "bitdi"]
export const FILE_STATUSES: FileStatus[] = ["qaralama", "gozleyir", "tesdiq", "arxiv"]
export const TASK_KINDS: TaskKind[] = ["zeng", "gorus", "teklif", "sened", "takip"]
export const FILE_KINDS: FileKind[] = ["teklif", "muqavile", "cizgi", "mektub", "sexsiyyet", "akt"]
export const ACTIVITY_KINDS: ActivityKind[] = ["zeng", "gorus", "email", "qeyd", "ziyaret"]
export const PRIORITIES: TaskPriority[] = ["asagi", "orta", "yuksek", "tecili"]

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

export function parties(state: AppState) {
  return [...new Set([
    ...state.clients.map((item) => item.name),
    ...state.leads.map((item) => item.company),
    ...state.deals.map((item) => item.client),
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b, "az"))
}

export function stepOf<T extends string>(flow: readonly T[], current: T, dir: number): T | "" {
  return flow[flow.indexOf(current) + dir] || ""
}

export function pipelineValue(state: AppState) {
  return state.deals.filter((item) => item.stage !== "uduzulub").reduce((sum, item) => sum + item.value, 0)
}

export function overdueTasks(state: AppState, today = TODAY) {
  return state.tasks.filter((item) => item.status !== "bitdi" && item.due < today)
}

export function waitingFiles(state: AppState) {
  return state.files.filter((item) => item.status === "qaralama" || item.status === "gozleyir")
}

export function dueFiles(state: AppState, today = TODAY) {
  return state.files.filter((item) => item.due && item.due < today && item.status !== "tesdiq" && item.status !== "arxiv")
}

export function crmBoard(state: AppState) {
  const homes = state.units.filter((item) => item.status === "muqavile" || item.status === "satilib" || item.status === "acar")
  return {
    pipeline: pipelineValue(state),
    hot: state.leads.filter((item) => item.heat === "isti").length,
    openTasks: state.tasks.filter((item) => item.status !== "bitdi").length,
    overdue: overdueTasks(state).length,
    waiting: waitingFiles(state).length,
    dueDocs: dueFiles(state).length,
    homes: homes.length,
    contracts: state.contracts.length,
  }
}

export function saveTask(state: AppState, form: TaskForm, actor: Actor, id?: string): OpResult {
  if (!form.title.trim()) return fail("Tapşırığın adı vacibdir.")
  if (!TASK_KINDS.includes(form.kind)) return fail("Növ seçin.")
  if (!PRIORITIES.includes(form.priority)) return fail("Prioritet seçin.")
  if (!form.due) return fail("Son tarix vacibdir.")
  if (!form.owner.trim()) return fail("Məsul vacibdir.")
  if (form.dealId && !state.deals.some((item) => item.id === form.dealId)) return fail("Sövdə tapılmadı.")
  if (form.leadId && !state.leads.some((item) => item.id === form.leadId)) return fail("Potensial tapılmadı.")
  const next = {
    title: form.title.trim(),
    kind: form.kind,
    priority: form.priority,
    owner: form.owner.trim(),
    due: form.due,
    client: form.client.trim(),
    dealId: form.dealId,
    leadId: form.leadId,
    note: form.note.trim(),
  }
  if (id) {
    const current = state.tasks.find((item) => item.id === id)
    if (!current) return fail("Tapşırıq tapılmadı.")
    if (current.status === "bitdi") return fail("Bitmiş tapşırıq yazılmır.")
    return {
      patch: {
        tasks: state.tasks.map((item) => (item.id === id ? { ...item, ...next } : item)),
        audit: audit(state, actor, "Tapşırıq yazıldı", next.title),
      },
    }
  }
  return {
    patch: {
      tasks: [{ id: nextId("TSK", state.tasks), status: "acik", ...next }, ...state.tasks],
      audit: audit(state, actor, "Tapşırıq açıldı", next.title),
    },
  }
}

export function setTaskStatus(state: AppState, id: string, status: TaskStatus, actor: Actor): OpResult {
  const task = state.tasks.find((item) => item.id === id)
  if (!task) return fail("Tapşırıq tapılmadı.")
  if (!TASK_STATUSES.includes(status)) return fail("Status seçin.")
  const from = TASK_STATUSES.indexOf(task.status)
  const to = TASK_STATUSES.indexOf(status)
  if (Math.abs(to - from) !== 1) return fail("Tapşırıq bir addım gedir.")
  return {
    patch: {
      tasks: state.tasks.map((item) => (item.id === id ? { ...item, status } : item)),
      audit: audit(state, actor, "Tapşırıq statusu", `${task.title} · ${status}`),
    },
  }
}

export function deleteTask(state: AppState, id: string, actor: Actor): OpResult {
  const task = state.tasks.find((item) => item.id === id)
  if (!task) return fail("Tapşırıq tapılmadı.")
  if (task.status === "bitdi") return fail("Bitmiş tapşırıq silinmir.")
  return {
    patch: {
      tasks: state.tasks.filter((item) => item.id !== id),
      audit: audit(state, actor, "Tapşırıq silindi", task.title),
    },
  }
}

export function saveFile(state: AppState, form: FileForm, actor: Actor, id?: string): OpResult {
  if (!form.title.trim()) return fail("Sənədin adı vacibdir.")
  if (!FILE_KINDS.includes(form.kind)) return fail("Növ seçin.")
  if (!form.date) return fail("Tarix vacibdir.")
  if (!form.owner.trim()) return fail("Məsul vacibdir.")
  if (form.dealId && !state.deals.some((item) => item.id === form.dealId)) return fail("Sövdə tapılmadı.")
  if (form.projectId && !state.projects.some((item) => item.id === form.projectId)) return fail("Layihə tapılmadı.")
  const next = {
    title: form.title.trim(),
    number: form.number.trim(),
    kind: form.kind,
    owner: form.owner.trim(),
    date: form.date,
    due: form.due,
    client: form.client.trim(),
    dealId: form.dealId,
    projectId: form.projectId,
    note: form.note.trim(),
  }
  if (id) {
    const current = state.files.find((item) => item.id === id)
    if (!current) return fail("Sənəd tapılmadı.")
    if (current.status === "tesdiq" || current.status === "arxiv") return fail("Təsdiqli sənəd yazılmır.")
    return {
      patch: {
        files: state.files.map((item) => (item.id === id ? { ...item, ...next } : item)),
        audit: audit(state, actor, "Sənəd yazıldı", next.title),
      },
    }
  }
  return {
    patch: {
      files: [{ id: nextId("CRF", state.files), status: "qaralama", ...next }, ...state.files],
      audit: audit(state, actor, "Sənəd açıldı", next.title),
    },
  }
}

export function setFileStatus(state: AppState, id: string, status: FileStatus, actor: Actor): OpResult {
  const file = state.files.find((item) => item.id === id)
  if (!file) return fail("Sənəd tapılmadı.")
  if (!FILE_STATUSES.includes(status)) return fail("Status seçin.")
  const from = FILE_STATUSES.indexOf(file.status)
  const to = FILE_STATUSES.indexOf(status)
  if (Math.abs(to - from) !== 1) return fail("Sənəd bir addım gedir.")
  return {
    patch: {
      files: state.files.map((item) => (item.id === id ? { ...item, status } : item)),
      audit: audit(state, actor, "Sənəd statusu", `${file.title} · ${status}`),
    },
  }
}

export function deleteFile(state: AppState, id: string, actor: Actor): OpResult {
  const file = state.files.find((item) => item.id === id)
  if (!file) return fail("Sənəd tapılmadı.")
  if (file.status !== "qaralama") return fail("Yalnız qaralama silinir.")
  return {
    patch: {
      files: state.files.filter((item) => item.id !== id),
      audit: audit(state, actor, "Sənəd silindi", file.title),
    },
  }
}

export function saveActivity(state: AppState, form: ActivityForm, actor: Actor): OpResult {
  if (!form.title.trim()) return fail("Fəaliyyətin adı vacibdir.")
  if (!ACTIVITY_KINDS.includes(form.kind)) return fail("Növ seçin.")
  if (!form.at) return fail("Tarix vacibdir.")
  if (form.dealId && !state.deals.some((item) => item.id === form.dealId)) return fail("Sövdə tapılmadı.")
  if (form.leadId && !state.leads.some((item) => item.id === form.leadId)) return fail("Potensial tapılmadı.")
  const row = {
    id: nextId("ACT", state.activities),
    kind: form.kind,
    title: form.title.trim(),
    at: form.at,
    owner: form.owner?.trim() || actor.name,
    client: form.client.trim(),
    dealId: form.dealId,
    leadId: form.leadId,
    note: form.note.trim(),
  }
  return {
    patch: {
      activities: [row, ...state.activities],
      audit: audit(state, actor, "Fəaliyyət yazıldı", row.title),
    },
  }
}

export function deleteActivity(state: AppState, id: string, actor: Actor): OpResult {
  const row = state.activities.find((item) => item.id === id)
  if (!row) return fail("Fəaliyyət tapılmadı.")
  return {
    patch: {
      activities: state.activities.filter((item) => item.id !== id),
      audit: audit(state, actor, "Fəaliyyət silindi", row.title),
    },
  }
}

export function createDeal(state: AppState, form: DealForm, actor: Actor): OpResult {
  if (!form.title.trim() || !form.client.trim()) return fail("Ad və sifarişçi vacibdir.")
  const amount = Number(form.value)
  if (!(amount > 0)) return fail("Sövdənin dəyəri yazılmalıdır.")
  if (!form.close) return fail("Bağlanış tarixi vacibdir.")
  const deal = {
    id: nextId("DL", state.deals),
    title: form.title.trim(),
    client: form.client.trim(),
    value: Math.round(amount),
    stage: "ilkin" as const,
    owner: form.owner?.trim() || actor.name,
    close: form.close,
    projectId: "",
  }
  return {
    patch: {
      deals: [deal, ...state.deals],
      audit: audit(state, actor, "Sövdə açıldı", deal.title),
    },
  }
}
