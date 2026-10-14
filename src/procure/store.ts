import { useSyncExternalStore } from "react"
import { blankState, withPlanDefaults, type AuditRow, type ProcureState } from "./engine"

const STORE_KEY = "afez-procure"

function mergeNames(base: string[], saved: unknown) {
  const extra = Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string") : []
  const seen = new Set<string>()
  const names: string[] = []
  for (const item of [...base, ...extra]) {
    const name = item.trim()
    const key = name.toLocaleLowerCase("az")
    if (!name || seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }
  return names
}

function mergeRows<T extends { id: string }>(base: T[], saved: unknown, ok: (row: T) => boolean) {
  if (!Array.isArray(saved) || saved.length === 0) return base
  return saved.filter((item): item is T => !!item && typeof item === "object" && ok(item as T))
}

function load(): ProcureState {
  const base = blankState()
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw) as Partial<ProcureState>
    if (!Array.isArray(parsed.companies)) return base
    return {
      ...base,
      ...parsed,
      categories: mergeNames(base.categories, parsed.categories),
      units: mergeNames(base.units, parsed.units),
      plans: withPlanDefaults(parsed.plans ?? []),
      disputes: mergeRows(base.disputes, parsed.disputes, (row) => typeof row.id === "string" && typeof row.text === "string" && (row.status === "aciq" || row.status === "bagli")),
      audit: mergeRows(base.audit, parsed.audit, (row) => typeof row.id === "string" && typeof row.action === "string" && typeof row.detail === "string"),
      companies: parsed.companies,
      activeId: parsed.activeId || "",
    }
  } catch {
    return base
  }
}

let current = load()
const listeners = new Set<() => void>()

function emit(next: ProcureState) {
  current = next
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next))
  } catch {
    /* saxlama bağlıdır */
  }
  listeners.forEach((listener) => listener())
}

export function useProcure() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
  )
}

export function patchProcure(recipe: (state: ProcureState) => ProcureState) {
  emit(recipe(current))
}

export function replaceProcure(next: ProcureState) {
  emit(next)
}

export function procureNow() {
  return current
}

export function stamp(state: ProcureState, action: string, detail: string): AuditRow {
  return { id: crypto.randomUUID(), at: new Date().toISOString(), actor: state.actor || "Kabinet", action, detail }
}
