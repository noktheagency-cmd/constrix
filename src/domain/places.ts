import type { AppState, HrMoveKind, HrPlace, PersonStatus } from "./types"

export const PLACE_KINDS: HrPlace[] = ["sahe", "ofis", "istehsal"]

export const PERSON_STATUSES: PersonStatus[] = [
  "sahede",
  "ofisde",
  "istehsalda",
  "ezamiyyetde",
  "mezuniyyet",
  "xestelik",
  "telim",
  "dayandirilib",
  "cixis",
]

export const PLACE_STATUS: Record<HrPlace, PersonStatus> = {
  sahe: "sahede",
  ofis: "ofisde",
  istehsal: "istehsalda",
}

const YARD = ["Mərkəzi anbar", "Servis mərkəzi"]

type Places = Pick<AppState, "projects" | "offices" | "plants">

function unique(names: string[]) {
  return [...new Set(names.map((item) => item.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "az"))
}

export function isAway(status: PersonStatus) {
  return status !== "sahede" && status !== "ofisde" && status !== "istehsalda"
}

export function catalog(state: Places, kind: HrPlace) {
  if (kind === "sahe") return unique(state.projects.map((item) => item.name))
  if (kind === "ofis") return unique(state.offices.map((item) => item.name))
  return unique([...state.plants.map((item) => item.name), ...YARD])
}

export function placeKindOf(state: Places, site: string): HrPlace {
  if (state.offices.some((item) => item.name === site)) return "ofis"
  if (state.projects.some((item) => item.name === site)) return "sahe"
  return "istehsal"
}

export function knownPlace(state: Places, site: string) {
  const name = site.trim()
  return PLACE_KINDS.some((kind) => catalog(state, kind).includes(name))
}

export const MOVE_KINDS: HrMoveKind[] = ["zavod", "tikinti", "ofis"]

export function movePlaces(state: Places, kind: HrMoveKind) {
  if (kind === "zavod") return unique(state.plants.map((item) => item.name))
  if (kind === "ofis") return catalog(state, "ofis")
  return catalog(state, "sahe")
}

export function moveDepartments(state: Pick<AppState, "projects" | "offices" | "plants" | "departments">, kind: HrMoveKind, site: string) {
  if (kind === "tikinti") return state.departments.filter((item) => placeKindOf(state, item.site) === "sahe")
  const here = state.departments.filter((item) => item.site === site)
  if (here.length) return here
  const place = kind === "zavod" ? "istehsal" : "ofis"
  return state.departments.filter((item) => placeKindOf(state, item.site) === place)
}

export function placeGroups(state: Places) {
  return PLACE_KINDS.map((kind) => ({
    kind,
    options: catalog(state, kind).map((name) => ({ value: name, label: name })),
  })).filter((group) => group.options.length > 0)
}
