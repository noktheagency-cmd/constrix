import assert from "node:assert/strict"
import test from "node:test"
import * as XLSX from "xlsx"
import { createAct, onHand } from "./ops"
import { approvePurchaseAct, createPurchaseAct, returnPurchaseAct } from "./purchaseActs"
import { createInitialState } from "./seed"
import { applySmetaImport, exportActSheet, exportNakopitelSheet, parseSmetaWorkbook } from "./smetaIo"
import type { Actor, AppState } from "./types"

const actor: Actor = { name: "Test", role: "director" }

test("Nakopitel ixracı əvvəlki, yığılan, cari və qalıq miqdar/məbləğ cütlərini saxlayır", () => {
  const bytes = exportNakopitelSheet("Test", "2026-04", [{ kind: "work", code: "1", name: "Suvaq", unit: "m2", smetaQty: 100, unitPrice: 25, smetaValue: 2500, priorQty: 30, priorValue: 750, cumulativeQty: 50, cumulativeValue: 1250, periodQty: 20, periodValue: 500, remainQty: 50, remainValue: 1250 }])
  const book = XLSX.read(bytes)
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[book.SheetNames[0]], { header: 1 })
  assert.deepEqual(matrix.find(row => row[0] === "1"), ["1", "Suvaq", "m2", 100, 25, 2500, 30, 750, 50, 1250, 20, 500, 50, 1250])
})

function withPatch(state: AppState, result: { patch?: Partial<AppState>; error?: string }) {
  assert.equal(result.error, undefined, result.error || "")
  return { ...state, ...result.patch }
}

function workbookBuffer(rows: unknown[][]) {
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, "Smeta")
  return XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer
}

test("smeta Excel idxalı ev/bölmə/iş oxuyur", () => {
  const buffer = workbookBuffer([
    ["№", "İşlərin adı", "Ölçü vahidi", "Miqdarı", "Vahidinin dəyəri"],
    ["", "Fərdi yaşayış evi № 1", "", "", ""],
    ["", "Bölmə 1. Torpaq işləri", "", "", ""],
    ["1", "Torpaq qazıntısı", "m3", 10, 5],
    ["", "Bölmə 1 üzrə cəmi", "", "", ""],
    ["2", "Betonlama", "m3", 2, 100],
  ])
  const parsed = parseSmetaWorkbook(buffer)
  assert.equal(parsed.rows.filter((row) => row.kind === "house").length, 1)
  assert.equal(parsed.rows.filter((row) => row.kind === "section").length, 1)
  assert.equal(parsed.rows.filter((row) => row.kind === "work").length, 2)
  assert.equal(parsed.rows.find((row) => row.name === "Torpaq qazıntısı")?.qty, 10)
})

test("smeta idxalı təsdiqli aktı olan layihədə bloklanır", () => {
  const fresh = createInitialState()
  const projectId = "PRJ-2408"
  let state = withPatch(fresh, createAct(fresh, projectId, actor))
  const actId = state.acts[0]?.id || ""
  state = {
    ...state,
    acts: state.acts.map((item) => (item.id === actId ? { ...item, status: "tesdiq" } : item)),
  }
  const blocked = applySmetaImport(state, projectId, [
    { kind: "work", houseNo: "", section: "", code: "1", name: "Yeni iş", unit: "m2", qty: 1, unitPrice: 10 },
  ], actor)
  assert.match(blocked.error ?? "", /akt/)
})

test("Forma-2 Excel 6 sütun ixrac edir", () => {
  const fresh = createInitialState()
  const state = withPatch(fresh, createAct(fresh, "PRJ-2408", actor))
  const act = state.acts[0]
  assert.ok(act)
  const bytes = exportActSheet(act)
  const book = XLSX.read(bytes)
  const sheet = book.Sheets[book.SheetNames[0]]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }) as unknown[][]
  const header = matrix.find((row) => String(row[0]).includes("Sıra"))
  assert.ok(header)
  assert.equal(header?.length, 6)
})

test("eyni həcm ikinci dəfə aktlaşdırılmır", () => {
  const fresh = createInitialState()
  let state = withPatch(fresh, createAct(fresh, "PRJ-2408", actor))
  const actId = state.acts[0]?.id || ""
  state = {
    ...state,
    acts: state.acts.map((item) => (item.id === actId ? { ...item, status: "tesdiq" } : item)),
  }
  const second = createAct(state, "PRJ-2408", actor)
  assert.match(second.error ?? "", /artıq aktlaşdırılıb|bağlanmamış həcm/)
})

test("alış aktı təsdiqi anbara mədaxil yazır", () => {
  const fresh = createInitialState()
  const created = createPurchaseAct(fresh, {
    objectName: "Test obyekt",
    person: "Tapdıq",
    date: "2026-10-22",
    lines: [{ materialName: "Test kərpic", unit: "ədəd", qty: 100, unitPrice: 0.5, firmName: "Firma" }],
  }, actor)
  let state = withPatch(fresh, created)
  const id = state.purchaseActs[0]?.id || ""
  state = withPatch(state, approvePurchaseAct(state, id, actor, "LOC-MERKEZ"))
  const material = state.materials.find((item) => item.name === "Test kərpic")
  assert.ok(material)
  assert.equal(onHand(state.stocks, material.id, "LOC-MERKEZ"), 100)
  assert.ok(state.movements.some((item) => item.materialId === material.id && item.type === "medaxil"))
  state = withPatch(state, returnPurchaseAct(state, id, actor))
  assert.equal(onHand(state.stocks, material.id, "LOC-MERKEZ"), 0)
})
