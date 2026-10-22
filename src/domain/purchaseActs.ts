import { nextId } from "../format"
import { addStock, audit, fail, onHand, roundMoney, roundQty, syncMaterials } from "./ops"
import type { Actor, AppState, Material, Movement, OpResult, PurchaseAct, PurchaseActAdjust, PurchaseActLine, Stock } from "./types"

function normName(value: string) {
  return value.toLocaleLowerCase("az").replace(/\s+/g, " ").trim()
}

function resolveMaterial(
  materials: Material[],
  line: PurchaseActLine,
): { materials: Material[]; material: Material } {
  const byId = line.materialId ? materials.find((item) => item.id === line.materialId) : undefined
  if (byId) return { materials, material: byId }
  const byName = materials.find((item) => normName(item.name) === normName(line.materialName))
  if (byName) return { materials, material: byName }
  const material: Material = {
    id: nextId("MAT", materials),
    name: line.materialName,
    unit: line.unit || "ədəd",
    qty: 0,
    min: 0,
    location: "Mərkəz",
    price: line.unitPrice,
  }
  return { materials: [...materials, material], material }
}

function money2(value: number | string) {
  return Math.round((Number(value) || 0) * 100) / 100
}

export type PurchaseActForm = {
  projectId?: string
  objectName: string
  person: string
  date: string
  note?: string
  lines: {
    materialName: string
    unit: string
    qty: number | string
    unitPrice: number | string
    amount?: number | string
    cashPaid?: number | string | null
    firmName?: string
    note?: string
    sender?: string
    materialId?: string
  }[]
}

function lineAmount(qty: number, unitPrice: number, amount?: number | string) {
  if (amount !== undefined && amount !== "" && amount !== null) return money2(amount)
  return money2(qty * unitPrice)
}

function buildLines(form: PurchaseActForm["lines"]): PurchaseActLine[] | string {
  const lines: PurchaseActLine[] = []
  for (const [index, row] of form.entries()) {
    const name = String(row.materialName || "").trim()
    if (!name) return "Materialın adı boş ola bilməz."
    const qty = roundQty(row.qty)
    const unitPrice = Number(row.unitPrice)
    if (!(qty > 0)) return `${name}: miqdar düzgün deyil.`
    if (!(unitPrice >= 0) || Number.isNaN(unitPrice)) return `${name}: qiymət düzgün deyil.`
    const cash = row.cashPaid === undefined || row.cashPaid === null || row.cashPaid === "" ? null : money2(row.cashPaid)
    lines.push({
      id: `PAL-${index + 1}`,
      materialName: name,
      unit: String(row.unit || "").trim(),
      qty,
      unitPrice,
      amount: lineAmount(qty, unitPrice, row.amount),
      cashPaid: cash,
      firmName: String(row.firmName || "").trim(),
      note: String(row.note || "").trim(),
      sender: String(row.sender || "").trim(),
      materialId: row.materialId,
    })
  }
  if (!lines.length) return "Ən azı bir sətir yazın."
  return lines
}

export function createPurchaseAct(state: AppState, form: PurchaseActForm, actor: Actor): OpResult {
  const objectName = String(form.objectName || "").trim()
  const date = String(form.date || "").trim()
  if (!objectName) return fail("Obyektin adı vacibdir.")
  if (!date) return fail("Tarix vacibdir.")
  const built = buildLines(form.lines)
  if (typeof built === "string") return fail(built)
  const project = form.projectId ? state.projects.find((item) => item.id === form.projectId) : undefined
  const seq = state.purchaseActs.length + 1
  const act: PurchaseAct = {
    id: nextId("PA", state.purchaseActs),
    number: `AA-${String(seq).padStart(3, "0")}`,
    projectId: project?.id,
    project: project?.name || "",
    objectName,
    person: String(form.person || "").trim(),
    date,
    status: "qaralama",
    net: money2(built.reduce((sum, line) => sum + line.amount, 0)),
    note: String(form.note || "").trim(),
    lines: built,
    adjustments: [],
  }
  return {
    patch: {
      purchaseActs: [act, ...state.purchaseActs],
      audit: audit(state, actor, "Alış aktı açıldı", `${act.number} · ${act.objectName}`),
    },
  }
}

export function updatePurchaseAct(state: AppState, id: string, form: PurchaseActForm, actor: Actor): OpResult {
  const current = state.purchaseActs.find((item) => item.id === id)
  if (!current) return fail("Alış aktı tapılmadı.")
  if (current.status !== "qaralama") return fail("Yalnız qaralama akt redaktə olunur.")
  const objectName = String(form.objectName || "").trim()
  const date = String(form.date || "").trim()
  if (!objectName) return fail("Obyektin adı vacibdir.")
  if (!date) return fail("Tarix vacibdir.")
  const built = buildLines(form.lines)
  if (typeof built === "string") return fail(built)
  const project = form.projectId ? state.projects.find((item) => item.id === form.projectId) : undefined
  const next: PurchaseAct = {
    ...current,
    projectId: project?.id,
    project: project?.name || current.project,
    objectName,
    person: String(form.person || "").trim(),
    date,
    note: String(form.note || "").trim(),
    lines: built.map((line, index) => ({ ...line, id: current.lines[index]?.id || line.id })),
    net: money2(built.reduce((sum, line) => sum + line.amount, 0)),
  }
  return {
    patch: {
      purchaseActs: state.purchaseActs.map((item) => (item.id === id ? next : item)),
      audit: audit(state, actor, "Alış aktı yeniləndi", next.number),
    },
  }
}

export function approvePurchaseAct(state: AppState, id: string, actor: Actor, locationId = "LOC-MERKEZ"): OpResult {
  const act = state.purchaseActs.find((item) => item.id === id)
  if (!act) return fail("Alış aktı tapılmadı.")
  if (act.status !== "qaralama") return fail("Qaralama akt təsdiqlənir.")
  if (!act.lines.length) return fail("Aktda sətir yoxdur.")
  const place = state.locations.find((item) => item.id === locationId)
  if (!place) return fail("Anbar tapılmadı.")

  const byFirm = new Map<string, number>()
  for (const line of act.lines) {
    const firm = line.firmName || "Naməlum"
    byFirm.set(firm, money2((byFirm.get(firm) || 0) + line.amount))
  }
  for (const adj of act.adjustments) {
    byFirm.set("Fortis Group", money2((byFirm.get("Fortis Group") || 0) + adj.diffAmount))
  }
  const firmRows = [...byFirm.entries()]
  const payables = [
    ...firmRows.map(([supplier, amount], index) => ({
      id: `AP-${String(state.payables.length + index + 1).padStart(3, "0")}`,
      supplier,
      poId: act.number,
      amount,
      status: "acik" as const,
      date: act.date,
    })),
    ...state.payables,
  ]

  let materials = state.materials
  let stocks = state.stocks
  const linkedLines: PurchaseActLine[] = []
  const newMoves: Movement[] = []
  for (const [index, line] of act.lines.entries()) {
    const resolved = resolveMaterial(materials, line)
    materials = resolved.materials
    const material = resolved.material
    const oldQty = onHand(stocks, material.id)
    const unitCost = line.unitPrice
    const price = oldQty + line.qty === 0
      ? unitCost
      : roundMoney((oldQty * material.price + line.qty * unitCost) / (oldQty + line.qty))
    materials = materials.map((item) => (item.id === material.id ? { ...item, price, unit: item.unit || line.unit } : item))
    stocks = addStock(stocks, material.id, locationId, line.qty)
    linkedLines.push({ ...line, materialId: material.id })
    newMoves.push({
      id: `MV-${String(state.movements.length + index + 1).padStart(3, "0")}`,
      material: material.name,
      type: "medaxil",
      qty: line.qty,
      unit: material.unit || line.unit,
      project: act.project || act.objectName,
      date: act.date,
      by: actor.name,
      materialId: material.id,
      locationId,
      note: `${act.number} · ${line.firmName || place.name}`,
    })
  }
  materials = syncMaterials(materials, stocks)

  return {
    patch: {
      purchaseActs: state.purchaseActs.map((item) => (
        item.id === id ? { ...item, status: "tesdiq", lines: linkedLines } : item
      )),
      payables,
      materials,
      stocks,
      movements: [...newMoves, ...state.movements],
      audit: audit(state, actor, "Alış aktı təsdiqi", `${act.number} · anbar ${place.name}`),
    },
  }
}

export function returnPurchaseAct(state: AppState, id: string, actor: Actor): OpResult {
  const act = state.purchaseActs.find((item) => item.id === id)
  if (!act) return fail("Alış aktı tapılmadı.")
  if (act.status !== "tesdiq") return fail("Təsdiqlənmiş akt qaralamaya qayıdır.")
  const related = state.movements.filter((item) => (item.note || "").startsWith(act.number))
  let stocks: Stock[] = state.stocks
  for (const move of related) {
    if (!move.materialId || !move.locationId) continue
    const have = onHand(stocks, move.materialId, move.locationId)
    if (have + 1e-9 < move.qty) {
      return fail(`Anbarda ${move.material} artıq xərclənib — aktı qaralamaya qaytarmaq olmur.`)
    }
    stocks = addStock(stocks, move.materialId, move.locationId, -move.qty)
  }
  return {
    patch: {
      purchaseActs: state.purchaseActs.map((item) => (item.id === id ? { ...item, status: "qaralama" } : item)),
      payables: state.payables.filter((item) => item.poId !== act.number),
      movements: state.movements.filter((item) => !(item.note || "").startsWith(act.number)),
      stocks,
      materials: syncMaterials(state.materials, stocks),
      audit: audit(state, actor, "Alış aktı qaralamaya qaytarıldı", act.number),
    },
  }
}

export function deletePurchaseAct(state: AppState, id: string, actor: Actor): OpResult {
  const act = state.purchaseActs.find((item) => item.id === id)
  if (!act) return fail("Alış aktı tapılmadı.")
  if (act.status !== "qaralama") return fail("Yalnız qaralama akt silinir.")
  return {
    patch: {
      purchaseActs: state.purchaseActs.filter((item) => item.id !== id),
      audit: audit(state, actor, "Alış aktı silindi", act.number),
    },
  }
}

export function setPurchaseActAdjustments(
  state: AppState,
  id: string,
  rows: Omit<PurchaseActAdjust, "id">[],
  actor: Actor,
): OpResult {
  const act = state.purchaseActs.find((item) => item.id === id)
  if (!act) return fail("Alış aktı tapılmadı.")
  if (act.status !== "qaralama") return fail("Yalnız qaralama akta əlavə yazılır.")
  const adjustments: PurchaseActAdjust[] = rows.map((row, index) => ({
    ...row,
    id: `PAA-${index + 1}`,
    qty: roundQty(row.qty),
    unitPrice: Number(row.unitPrice),
    amount: money2(row.amount),
    diff: Number(row.diff),
    diffAmount: money2(row.diffAmount),
  }))
  return {
    patch: {
      purchaseActs: state.purchaseActs.map((item) => (item.id === id ? { ...item, adjustments } : item)),
      audit: audit(state, actor, "Alış aktı əlavəsi", act.number),
    },
  }
}
