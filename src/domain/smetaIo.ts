import * as XLSX from "xlsx"
import { audit, fail, roundMoney, roundQty } from "./ops"
import type { Act, Actor, AppState, OpResult, Smeta, SmetaLine, SmetaLineKind } from "./types"

export type SmetaImportRow = {
  kind: SmetaLineKind
  houseNo: string
  section: string
  code: string
  name: string
  unit: string
  qty: number
  unitPrice: number
  warning?: string
}

function cell(row: Record<string, unknown>, keys: string[]) {
  for (const [key, value] of Object.entries(row)) {
    const norm = key.toLocaleLowerCase("az").replace(/\s+/g, " ").trim()
    if (keys.some((item) => norm.includes(item))) {
      if (value === null || value === undefined) return ""
      return String(value).trim()
    }
  }
  return ""
}

function numCell(row: Record<string, unknown>, keys: string[]) {
  const raw = cell(row, keys).replace(",", ".")
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

export function parseSmetaWorkbook(buffer: ArrayBuffer): { rows: SmetaImportRow[]; errors: string[] } {
  const book = XLSX.read(buffer)
  const sheetName = book.SheetNames[0]
  if (!sheetName) return { rows: [], errors: ["Faylda vərəq yoxdur."] }
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheetName], { header: 1, defval: "" }) as unknown[][]
  let headerAt = -1
  for (let i = 0; i < Math.min(matrix.length, 20); i += 1) {
    const joined = matrix[i].map((cell) => String(cell).toLocaleLowerCase("az")).join(" ")
    if (joined.includes("iş") && (joined.includes("miqdar") || joined.includes("həcm") || joined.includes("vahid"))) {
      headerAt = i
      break
    }
  }
  const objects = headerAt >= 0
    ? XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[sheetName], { range: headerAt, defval: "" })
    : XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[sheetName], { defval: "" })

  const rows: SmetaImportRow[] = []
  const errors: string[] = []
  let houseNo = ""
  let section = ""

  for (const row of objects) {
    const name = cell(row, ["işlərin adı", "işin adı", "iş adı", "name", "ad", "təsvir"])
      || cell(row, ["iş"])
    if (!name) continue
    const lower = name.toLocaleLowerCase("az")
    if (lower.startsWith("fərdi yaşayış") || lower.includes("yaşayış evi")) {
      const match = name.match(/№\s*(\S+)/)
      houseNo = match?.[1] || name
      section = ""
      rows.push({ kind: "house", houseNo, section: "", code: "", name, unit: "", qty: 0, unitPrice: 0 })
      continue
    }
    if (lower.startsWith("bölmə") && !lower.includes("üzrə cəmi")) {
      section = name
      rows.push({ kind: "section", houseNo, section, code: "", name, unit: "", qty: 0, unitPrice: 0 })
      continue
    }
    if (lower.includes("üzrə cəmi") || lower.startsWith("cəmi")) continue

    const code = cell(row, ["kod", "№", "no", "sira", "sıra"])
    const unit = cell(row, ["ölçü", "vahid", "unit"])
    const qty = numCell(row, ["miqdar", "həcm", "hecm", "qty", "volume"])
    const unitPrice = numCell(row, ["qiymət", "qiymet", "vahid", "price", "rate"])
    if (!(qty > 0) && !(unitPrice > 0)) {
      errors.push(`«${name}»: miqdar/qiymət oxunmadı`)
      continue
    }
    rows.push({
      kind: "work",
      houseNo,
      section,
      code,
      name,
      unit: unit || "ədəd",
      qty: roundQty(qty),
      unitPrice,
      warning: !unit ? "Ölçü vahidi boşdur" : undefined,
    })
  }

  if (!rows.length) errors.push("Cədvəldə iş sətri tapılmadı. Sütunlar: İşlərin adı, Ölçü, Miqdar, Vahidin qiyməti.")
  return { rows, errors }
}

export function applySmetaImport(state: AppState, projectId: string, rows: SmetaImportRow[], actor: Actor): OpResult {
  const project = state.projects.find((item) => item.id === projectId)
  if (!project) return fail("Layihə tapılmadı.")
  if (!rows.length) return fail("İdxal ediləcək sətir yoxdur.")
  if (state.acts.some((act) => act.projectId === projectId && act.status !== "qaralama")) {
    return fail("Təsdiqlənmiş Forma-2 olan layihədə smeta idxalı aktları səssiz dəyişmir. Əvvəl aktları bağlayın və ya yeni versiya açın.")
  }
  const work = rows.filter((row) => row.kind === "work")
  if (!work.length) return fail("İş sətri yoxdur.")

  const lines: SmetaLine[] = rows.map((row, index) => ({
    id: `SL-${projectId}-${index + 1}`,
    code: row.code || (row.kind === "work" ? String(index + 1) : ""),
    name: row.name,
    unit: row.unit,
    qty: row.qty,
    unitPrice: row.unitPrice,
    doneQty: 0,
    billedQty: 0,
    laborHours: 0,
    recipe: "",
    kind: row.kind,
    houseNo: row.houseNo,
    section: row.section,
  }))

  const existing = state.smetas.find((item) => item.projectId === projectId)
  const smeta: Smeta = existing
    ? { ...existing, lines, version: existing.version + 1 }
    : { id: `SM-${projectId}`, projectId, version: 1, status: "razilasma", lines }

  const value = roundMoney(work.reduce((sum, row) => sum + row.qty * row.unitPrice, 0))
  return {
    patch: {
      smetas: existing
        ? state.smetas.map((item) => (item.id === existing.id ? smeta : item))
        : [...state.smetas, smeta],
      projects: state.projects.map((item) => (
        item.id === projectId
          ? { ...item, smetaId: smeta.id, budget: value || item.budget }
          : item
      )),
      acts: state.acts.filter((act) => !(act.projectId === projectId && act.status === "qaralama")),
      audit: audit(state, actor, "Smeta idxalı", `${project.name} · ${work.length} iş · ${lines.length} sətir`),
    },
  }
}

export function exportActSheet(act: Act) {
  const body = [
    ["Sıra №-si", "İşlərin adı", "Ölçü vahidi", "Miqdarı", "Vahidinin dəyəri (manatla)", "Ümumi dəyəri (manatla)"],
    ...act.lines.map((line, index) => [
      index + 1,
      `${line.code} ${line.name}`.trim(),
      line.unit,
      line.qty,
      line.unitPrice,
      roundMoney(line.qty * line.unitPrice),
    ]),
    ["", "Cəmi", "", "", "", act.net],
    ["", "ƏDV (18 %)", "", "", "", act.vat],
    ["", "Yekun (ƏDV ilə)", "", "", "", act.gross],
  ]
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Forma № 2"],
    [`Sifarişçi: ${act.client}`],
    [`Layihə: ${act.project}`],
    [`Müqavilə: ${act.contractNumber || "—"}`],
    [`Dövr: ${act.period} · ${act.date}`],
    [`Akt: ${act.number}`],
    [],
    ...body,
  ])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, "Forma-2")
  return XLSX.write(book, { type: "array", bookType: "xlsx" }) as Uint8Array
}

export function exportNakopitelSheet(
  projectName: string,
  period: string,
  rows: {
    kind: string
    code: string
    name: string
    unit: string
    smetaQty: number
    unitPrice: number
    smetaValue: number
    priorQty: number
    priorValue: number
    cumulativeQty: number
    cumulativeValue: number
    periodQty: number
    periodValue: number
    remainQty: number
    remainValue: number
  }[],
) {
  const body = [
    ["№", "İşlərin adı", "Ölçü", "Həcm", "Qiymət", "Cəmi", "Əvvəlki miqdar", "Əvvəlki məbləğ", "Yığılan miqdar", "Yığılan məbləğ", "Bu ay miqdar", "Bu ay məbləğ", "Qalıq miqdar", "Qalıq məbləğ"],
    ...rows.map((row) => [
      row.code,
      row.name,
      row.unit,
      row.kind === "work" ? row.smetaQty : "",
      row.kind === "work" ? row.unitPrice : "",
      row.kind === "work" || row.kind === "sectionTotal" ? row.smetaValue : "",
      row.kind === "work" ? row.priorQty : "",
      row.kind === "work" || row.kind === "sectionTotal" ? row.priorValue : "",
      row.kind === "work" ? row.cumulativeQty : "",
      row.kind === "work" || row.kind === "sectionTotal" ? row.cumulativeValue : "",
      row.kind === "work" ? row.periodQty : "",
      row.kind === "work" || row.kind === "sectionTotal" ? row.periodValue : "",
      row.kind === "work" ? row.remainQty : "",
      row.kind === "work" || row.kind === "sectionTotal" ? row.remainValue : "",
    ]),
  ]
  const sheet = XLSX.utils.aoa_to_sheet([
    [projectName],
    [`Nakopitel · hesabat ayı ${period}`],
    [],
    ...body,
  ])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, "Nakopitel")
  return XLSX.write(book, { type: "array", bookType: "xlsx" }) as Uint8Array
}

export function downloadBytes(filename: string, bytes: Uint8Array, mime: string) {
  const blob = new Blob([bytes as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
