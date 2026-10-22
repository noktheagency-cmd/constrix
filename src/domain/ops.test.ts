import assert from "node:assert/strict"
import test from "node:test"
import { approveAct, approveChange, approveForma3, returnForma3, deleteForma3, refreshForma3, approveReport, completeWorkOrder, coverRequest, createAct, createForma3, dispatchWorkOrder, handoverSale, invoiceAct, issueStock, openProjectFromDeal, openSale, openService, openWorkOrder, paySale, proposeChange, receivePurchase, reserveUnit, runPayroll, saveReport, deleteReport, returnReport, startWorkOrder, cancelWorkOrder, returnWorkOrder, writeWaste, setPlantPlan, addShiftNote, updateJournal, deleteJournal, confirmPlantPlan, addPlantProduct, updatePlantProduct, deletePlantProduct, saveFormula, rejectRequest, advancePlantQueue, createShipment, advanceShipment, onHand, sendGearCheck, startGearCheck, confirmGearCheck, finishGearCheck, returnGearCheck, replaceGear, acceptGear, obsoleteGear, loseGear, addLocation, updateLocation, deleteLocation, addShop, updateShop, deleteShop, updateAct, deleteAct, returnAct, updateClient, deleteClient, promoteLead, deleteDeal, addPerson, updatePerson, deletePerson, assignAsset, updateAsset, releaseAsset, logFuel, openTrip, departTrip, arriveTrip, assignVehicle, addProject, updateProject, deleteProject, addProjectNote, updateProjectNote, deleteProjectNote, addDocument, updateDocument, deleteDocument } from "./ops"
import { agingRows, cashRows, vatRows } from "./financeReports"
import { createInitialState } from "./seed"
import type { AppState, OpResult } from "./types"

const actor = { name: "Test", role: "director" }

function patchOf(result: OpResult) {
  if (result.error || !result.patch) throw new Error(result.error || "patch yoxdur")
  return result.patch
}

function withPatch(state: AppState, result: OpResult): AppState {
  return { ...state, ...patchOf(result) }
}

test("satınalma qəbulu anbarı artırır və təkrar tam qəbulu dayandırır", () => {
  const state = createInitialState()
  const before = state.materials.find((item) => item.id === "MAT-SEM")
  assert.ok(before)
  const received = receivePurchase(state, { poId: "PO-318", qty: 100 }, actor)
  assert.equal(received.error, undefined)
  const materials = patchOf(received).materials
  assert.ok(materials)
  const qty = materials.find((item) => item.id === "MAT-SEM")?.qty
  assert.equal(qty, before.qty + 100)
  const again = receivePurchase(withPatch(state, received), { poId: "PO-318", qty: 10000 }, actor)
  assert.match(again.error ?? "", /arasında/)
})

test("çatışmayan qalıq məxaric olunmur", () => {
  const state = createInitialState()
  const result = issueStock(state, { materialId: "MAT-SEM", qty: 999999, locationId: "LOC-MERKEZ", project: "Port Baku Residence" }, actor)
  assert.match(result.error ?? "", /qalıq/)
})

test("gündəlik təsdiqi smeta həcmini və xərci artırır, ikinci dəfə bağlanır", () => {
  const state = createInitialState()
  const before = state.smetas.find((item) => item.projectId === "PRJ-2408")?.lines.find((line) => line.code === "02")
  assert.ok(before)
  const result = approveReport(state, "DR-014", actor)
  assert.equal(result.error, undefined)
  const patch = patchOf(result)
  const after = patch.smetas?.find((item) => item.projectId === "PRJ-2408")?.lines.find((line) => line.code === "02")
  assert.ok(after)
  assert.equal(after.doneQty, before.doneQty + 30)
  assert.ok(patch.expenses?.some((item) => item.category === "Əmək haqqı" && item.project === "Port Baku Residence"))
  const second = approveReport(withPatch(state, result), "DR-014", actor)
  assert.match(second.error ?? "", /göndərilmiş/)
})

test("akt təsdiqdən sonra ƏDV-li faktura açır", () => {
  let state = createInitialState()
  const created = createAct(state, "PRJ-2408", actor)
  assert.equal(created.error, undefined)
  state = withPatch(state, created)
  const act = state.acts[0]
  assert.ok(act)
  assert.equal(act.vat, Math.round(act.net * 0.18))
  const approved = approveAct(state, act.id, actor)
  state = withPatch(state, approved)
  const invoiced = invoiceAct(state, act.id, actor)
  assert.equal(invoiced.error, undefined)
  const invoices = patchOf(invoiced).invoices
  assert.ok(invoices)
  const retention = Math.round(act.net * 0.05)
  const advance = Math.round(act.net * 0.2)
  assert.equal(invoices[0]?.retention, retention)
  assert.equal(invoices[0]?.advance, advance)
  assert.equal(invoices[0]?.net, act.net - retention - advance)
  assert.equal(invoices[0]?.amount, (invoices[0]?.net ?? 0) + (invoices[0]?.vat ?? 0))
  assert.equal(invoices[0]?.actId, act.id)
  assert.equal(act.period, "2026-09")
  assert.ok(act.number.startsWith("F2-"))
  assert.ok(act.lines.every((line) => line.cumulativeQty >= line.qty))
})

test("əlavə iş smetaya sətir əlavə edir və köhnə sətiri saxlayır", () => {
  let state = createInitialState()
  const before = state.smetas.find((item) => item.projectId === "PRJ-2414")
  assert.ok(before)
  const lineCount = before.lines.length
  const contract = state.contracts.find((item) => item.projectId === "PRJ-2414")
  assert.ok(contract)
  const created = proposeChange(state, { projectId: "PRJ-2414", title: "Lift", reason: "Şaxta", name: "Lift şaxtası", unit: "m³", qty: "10", unitPrice: "200" }, actor)
  state = withPatch(state, created)
  const change = state.changes.find((item) => item.title === "Lift")
  assert.ok(change)
  const approved = approveChange(state, change.id, actor)
  const patch = patchOf(approved)
  const smeta = patch.smetas?.find((item) => item.projectId === "PRJ-2414")
  assert.ok(smeta)
  assert.equal(smeta.lines.length, lineCount + 1)
  assert.equal(smeta.lines[0]?.id, before.lines[0]?.id)
  assert.equal(smeta.version, before.version + 1)
  assert.equal(patch.contracts?.find((item) => item.projectId === "PRJ-2414")?.value, contract.value + 2000)
})

test("çatan qalıq tələbi sahəyə köçürür, çatmayan qalıq sifariş açmır", () => {
  const state = createInitialState()
  const covered = coverRequest(state, "TLB-014", actor)
  assert.equal(covered.error, undefined)
  assert.equal(patchOf(covered).requests?.find((item) => item.id === "TLB-014")?.status, "anbar")
  const hungry = createInitialState()
  hungry.requests = [{ ...hungry.requests[0]!, qty: 999999 }]
  const missed = coverRequest(hungry, "TLB-014", actor)
  assert.match(missed.error ?? "", /Təklif/)
  assert.equal(missed.patch, undefined)
})

test("çatışmayan resept tələbnamə açır və istehsalı bağlamır", () => {
  const state = createInitialState()
  const orders = state.orders.map((item) => (item.id === "WO-551" ? { ...item, qty: 100000 } : item))
  const result = completeWorkOrder({ ...state, orders }, "WO-551", actor)
  assert.match(result.error ?? "", /çatmır/)
  assert.ok(result.patch?.requests?.some((item) => item.materialId === "MAT-SEM" && item.project === "Port Baku Residence"))
  assert.equal(result.patch?.orders, undefined)
})

test("tabel saatı əmək haqqı cədvəlinə düşür", () => {
  let state = createInitialState()
  const line = state.smetas.find((item) => item.projectId === "PRJ-2408")?.lines.find((item) => item.qty - item.doneQty > 1)
  assert.ok(line)
  const saved = saveReport(state, { projectId: "PRJ-2408", lines: [{ smetaLineId: line.id, qty: 1 }], attendance: [{ personId: "HR-01", hours: 8 }], submit: true }, actor)
  state = withPatch(state, saved)
  const report = state.reports[0]
  assert.ok(report)
  const approved = approveReport(state, report.id, actor)
  state = withPatch(state, approved)
  const payroll = runPayroll(state, actor)
  const lines = patchOf(payroll).payrolls?.[0]?.lines
  assert.equal(lines?.[0]?.personId, "HR-01")
  assert.equal(lines?.[0]?.amount, 64)
  const again = runPayroll(withPatch(state, payroll), actor)
  assert.match(again.error ?? "", /Tabel/)
})

test("servis ehtiyatı mərkəzi anbardan silir", () => {
  const state = createInitialState()
  const before = state.stocks.find((row) => row.materialId === "MAT-SEM" && row.locationId === "LOC-MERKEZ")
  assert.ok(before)
  const opened = openService(state, { assetId: "AST-014", materialId: "MAT-SEM", qty: "2", note: "Nasos" }, actor)
  const patch = patchOf(opened)
  const after = patch.stocks?.find((row) => row.materialId === "MAT-SEM" && row.locationId === "LOC-MERKEZ")
  assert.ok(after)
  assert.equal(after.qty, before.qty - 2)
  assert.equal(patch.assets?.find((item) => item.id === "AST-014")?.status, "servis")
  assert.ok(patch.expenses?.some((item) => item.vendor === "Servis" && item.project === "Port Baku Residence"))
})

test("beton əmri zavod anbarından resepti silir", () => {
  const state = createInitialState()
  const before = state.stocks.find((row) => row.materialId === "MAT-SEM" && row.locationId === "LOC-ZAVOD")
  assert.ok(before)
  const result = completeWorkOrder(state, "WO-551", actor)
  assert.equal(result.error, undefined)
  const patch = patchOf(result)
  const after = patch.stocks?.find((row) => row.materialId === "MAT-SEM" && row.locationId === "LOC-ZAVOD")
  assert.ok(after)
  assert.ok(Math.abs(before.qty - after.qty - 25.6) < 0.01)
  assert.equal(patch.orders?.find((item) => item.id === "WO-551")?.status, "hazir")
})

test("iş əmri növbəyə düşür, işə düşür, növbədən bağlanmır", () => {
  const state = createInitialState()
  const opened = openWorkOrder(state, { plantId: "beton", recipeId: "b25", project: "Port Baku Residence", qty: "2", due: "2026-09-23" }, actor)
  assert.equal(opened.error, undefined)
  const queued = withPatch(state, opened)
  const order = queued.orders[0]
  assert.ok(order)
  assert.equal(order.status, "novbede")
  assert.equal(order.plant, "Beton zavodu")
  const blocked = completeWorkOrder(queued, order.id, actor)
  assert.match(blocked.error ?? "", /işə salın/)
  const started = startWorkOrder(queued, order.id, actor)
  assert.equal(started.error, undefined)
  assert.equal(patchOf(started).orders?.find((item) => item.id === order.id)?.status, "gedir")
})

test("çatışmayan sex əmri işə düşmür və tələbnamə açır", () => {
  const state = createInitialState()
  const opened = openWorkOrder(state, { plantId: "armatur", recipeId: "armatur", project: "Xəzər Business Center", qty: "100000", due: "2026-09-24" }, actor)
  const queued = withPatch(state, opened)
  const order = queued.orders[0]
  assert.ok(order)
  const started = startWorkOrder(queued, order.id, actor)
  assert.match(started.error ?? "", /çatmır/)
  assert.ok(started.patch?.requests?.some((item) => item.materialId === "MAT-ARM"))
  assert.equal(started.patch?.orders, undefined)
})

test("bağlanmış əmr sahəyə gedir, işdəki əmr getmir", () => {
  const state = createInitialState()
  const started = startWorkOrder(state, "WO-552", actor)
  const running = withPatch(state, started)
  const closed = completeWorkOrder(running, "WO-552", actor)
  assert.equal(closed.error, undefined)
  const done = withPatch(running, closed)
  const order = done.orders.find((item) => item.id === "WO-552")
  assert.equal(order?.status, "hazir")
  assert.ok((order?.issued?.length || 0) > 0)
  assert.ok((order?.cost || 0) > 0)
  const blocked = dispatchWorkOrder(running, "WO-552", actor)
  assert.match(blocked.error ?? "", /bağlanmış/)
  const sent = dispatchWorkOrder(done, "WO-552", actor)
  assert.equal(sent.error, undefined)
  const patch = patchOf(sent)
  assert.equal(patch.orders?.find((item) => item.id === "WO-552")?.status, "gonderildi")
  assert.equal(patch.orders?.find((item) => item.id === "WO-552")?.sentBy, actor.name)
  assert.ok(patch.audit?.some((item) => item.action === "Məhsul sahəyə getdi"))
})

test("növbədəki əmr ləğv olunur, işdəki əmr növbəyə qayıdır", () => {
  const state = createInitialState()
  const cancelled = cancelWorkOrder(state, "WO-552", actor)
  assert.equal(cancelled.error, undefined)
  assert.equal(patchOf(cancelled).orders?.find((item) => item.id === "WO-552")?.status, "legv")
  const running = withPatch(state, startWorkOrder(state, "WO-552", actor))
  const blocked = cancelWorkOrder(running, "WO-552", actor)
  assert.match(blocked.error ?? "", /növbədəki/)
  const back = returnWorkOrder(running, "WO-552", actor)
  assert.equal(back.error, undefined)
  assert.equal(patchOf(back).orders?.find((item) => item.id === "WO-552")?.status, "novbede")
  assert.equal(patchOf(back).orders?.find((item) => item.id === "WO-552")?.startedBy, undefined)
})

test("itki anbarı azaldır, yol vərəqəsi və plan yazılır", () => {
  const state = createInitialState()
  const before = state.stocks.find((row) => row.materialId === "MAT-SEM" && row.locationId === "LOC-ZAVOD")
  assert.ok(before)
  const wasted = writeWaste(state, { locationId: "LOC-ZAVOD", materialId: "MAT-SEM", qty: "1.5", project: "Port Baku Residence", reason: "Qalıq beton" }, actor)
  assert.equal(wasted.error, undefined)
  const patch = patchOf(wasted)
  const after = patch.stocks?.find((row) => row.materialId === "MAT-SEM" && row.locationId === "LOC-ZAVOD")
  assert.ok(after)
  assert.ok(Math.abs(before.qty - after.qty - 1.5) < 0.01)
  assert.ok(patch.expenses?.some((item) => item.category === "İtki" && item.project === "Port Baku Residence"))
  const closed = withPatch(state, completeWorkOrder(state, "WO-551", actor))
  const sent = dispatchWorkOrder(closed, "WO-551", actor, { vehicle: "Mercedes mikser", note: "7-ci mərtəbə" })
  const order = patchOf(sent).orders?.find((item) => item.id === "WO-551")
  assert.equal(order?.vehicle, "Mercedes mikser")
  assert.equal(order?.note, "7-ci mərtəbə")
  const plan = setPlantPlan(state, "beton", "260", actor)
  assert.equal(patchOf(plan).plants?.find((item) => item.id === "beton")?.plan, 260)
  assert.equal(patchOf(plan).plants?.find((item) => item.id === "beton")?.planStatus, "qaralama")
  const drafted = withPatch(state, plan)
  const confirmed = confirmPlantPlan(drafted, "beton", actor)
  assert.equal(patchOf(confirmed).plants?.find((item) => item.id === "beton")?.planBy, actor.name)
  assert.match(confirmPlantPlan(withPatch(drafted, confirmed), "beton", actor).error ?? "", /təsdiqlənib/)
  assert.match(setPlantPlan(state, "beton", "0", actor).error ?? "", /sıfırdan/)
  const note = addShiftNote(state, "Beton zavodu", "Nasos dayandı", actor)
  assert.equal(patchOf(note).journal?.[0]?.text, "Nasos dayandı")
  assert.match(addShiftNote(state, "Beton zavodu", "  ", actor).error ?? "", /Qeyd/)
})

test("formul yazılır, boş və təkrar xammal dayanır, tələbnamə rədd olunur", () => {
  const state = createInitialState()
  const opened = addPlantProduct(state, { plantId: "beton", name: "B20 beton", unit: "m³" }, actor)
  assert.equal(opened.error, undefined)
  const next = withPatch(state, opened)
  const recipe = next.recipes.find((item) => item.product === "B20 beton")
  assert.ok(recipe)
  assert.match(saveFormula(next, recipe.id, [], actor).error ?? "", /ən azı bir/)
  const dup = saveFormula(next, recipe.id, [
    { materialId: "MAT-SEM", qty: "0.3" },
    { materialId: "MAT-SEM", qty: "0.1" },
  ], actor)
  assert.match(dup.error ?? "", /bir dəfə/)
  const saved = saveFormula(next, recipe.id, [{ materialId: "MAT-SEM", qty: "0.3" }, { materialId: "MAT-QUM", qty: "0.6" }], actor)
  assert.equal(patchOf(saved).recipes?.find((item) => item.id === recipe.id)?.items.length, 2)
  const rejected = rejectRequest(state, "TLB-014", "Sahədə sement var", actor)
  assert.equal(patchOf(rejected).requests?.find((item) => item.id === "TLB-014")?.status, "redd")
  assert.match(rejectRequest(state, "TLB-014", "  ", actor).error ?? "", /səbəbi/)
})

test("məhsul redaktə olunur, açıq əmri olan məhsul silinmir", () => {
  const state = createInitialState()
  const opened = addPlantProduct(state, { plantId: "beton", name: "B20 beton", unit: "m³" }, actor)
  const next = withPatch(state, opened)
  const recipe = next.recipes.find((item) => item.product === "B20 beton")
  assert.ok(recipe)
  const edited = updatePlantProduct(next, recipe.id, { name: "B20", unit: "m³", lines: [{ materialId: "MAT-SEM", qty: "0.2" }] }, actor)
  assert.equal(edited.error, undefined)
  assert.equal(patchOf(edited).recipes?.find((item) => item.id === recipe.id)?.product, "B20")
  assert.equal(patchOf(edited).recipes?.find((item) => item.id === recipe.id)?.items.length, 1)
  const gone = deletePlantProduct(withPatch(next, edited), recipe.id, actor)
  assert.equal(gone.error, undefined)
  assert.equal(patchOf(gone).recipes?.some((item) => item.id === recipe.id), false)
  assert.match(deletePlantProduct(state, "b25", actor).error ?? "", /silinmir/)
})

test("təchizat yoxlamaya gedir, təsdiqlənir, bitir və qaytarılır", () => {
  const state = createInitialState()
  assert.match(sendGearCheck(state, "GR-001", "  ", actor).error ?? "", /qeyd/)
  const sent = sendGearCheck(state, "GR-001", "İllik yoxlama", actor)
  assert.equal(patchOf(sent).gear?.find((item) => item.id === "GR-001")?.status, "gonderildi")
  const started = startGearCheck(withPatch(state, sent), "GR-001", "Açıldı", actor)
  assert.equal(patchOf(started).gear?.find((item) => item.id === "GR-001")?.status, "yoxlamada")
  const confirmed = confirmGearCheck(withPatch(withPatch(state, sent), started), "GR-001", "Yararlıdır", actor)
  assert.equal(patchOf(confirmed).gear?.find((item) => item.id === "GR-001")?.status, "tesdiq")
  const done = finishGearCheck(withPatch(withPatch(withPatch(state, sent), started), confirmed), "GR-001", "Bağlandı", actor)
  assert.equal(patchOf(done).gear?.find((item) => item.id === "GR-001")?.status, "istifade")
  assert.equal(patchOf(done).gear?.find((item) => item.id === "GR-001")?.nextCheck, "2026-12-23")
  assert.match(finishGearCheck(withPatch(state, sent), "GR-001", "Tez", actor).error ?? "", /təsdiq/)
  const sentBack = sendGearCheck(state, "GR-004", "Anbardan", actor)
  const back = returnGearCheck(withPatch(state, sentBack), "GR-004", "Geri gəldi", actor)
  assert.equal(patchOf(back).gear?.find((item) => item.id === "GR-004")?.status, "anbarda")
  const replaced = replaceGear(state, "GR-008", "Balonu bitib", actor)
  assert.equal(patchOf(replaced).gear?.find((item) => item.id === "GR-008")?.status, "deyisme")
  const accepted = acceptGear(withPatch(state, replaced), "GR-008", "Yeni balon taxıldı", actor)
  assert.equal(patchOf(accepted).gear?.find((item) => item.id === "GR-008")?.status, "istifade")
  const old = obsoleteGear(state, "GR-011", "Zərbədən çatlayıb", actor)
  assert.equal(patchOf(old).gear?.find((item) => item.id === "GR-011")?.status, "kohnelmis")
  assert.match(loseGear(state, "GR-015", "Təkrar", actor).error ?? "", /çıxıb/)
})

test("avtomatik keçid yalnız növbədəki əmri işə salır", () => {
  const state = createInitialState()
  const result = advancePlantQueue(state, "beton", actor)
  assert.equal(result.error, undefined)
  const orders = patchOf(result).orders
  assert.equal(orders?.find((item) => item.id === "WO-538")?.status, "gedir")
  assert.equal(orders?.find((item) => item.id === "WO-536")?.status, "gedir")
  assert.equal(orders?.find((item) => item.id === "WO-551")?.status, "gedir")
  assert.match(patchOf(result).audit?.[0]?.detail ?? "", /işə düşdü/)
  const again = advancePlantQueue(withPatch(state, result), "beton", actor)
  assert.match(again.error ?? "", /Növbədə/)
})

test("transfer marşrutu bir neçə materialı dayanacaqdan dayanacağa aparır", () => {
  const state = createInitialState()
  const made = createShipment(state, {
    stops: ["LOC-ZAVOD", "LOC-MERKEZ", "LOC-SEX"],
    lines: [
      { materialId: "MAT-SEM", qty: 2, price: 168 },
      { materialId: "MAT-QUM", qty: 5, price: 32 },
    ],
  }, actor)
  assert.equal(made.error, undefined)
  const born = patchOf(made).shipments?.[0]
  assert.equal(born?.step, 0)
  assert.equal(born?.lines[0]?.amount, 336)
  assert.equal(born?.lines[1]?.amount, 160)
  const empty = createShipment(state, { stops: ["LOC-ZAVOD", "LOC-MERKEZ"], lines: [] }, actor)
  assert.match(empty.error ?? "", /material/)
  const moving = withPatch(state, made)
  const hop = advanceShipment(moving, born?.id || "", actor)
  assert.equal(hop.error, undefined)
  const after = withPatch(moving, hop)
  assert.equal(after.shipments.find((item) => item.id === born?.id)?.step, 1)
  assert.equal(onHand(after.stocks, "MAT-SEM", "LOC-ZAVOD"), onHand(state.stocks, "MAT-SEM", "LOC-ZAVOD") - 2)
  assert.equal(onHand(after.stocks, "MAT-SEM", "LOC-MERKEZ"), onHand(state.stocks, "MAT-SEM", "LOC-MERKEZ") + 2)
  const done = withPatch(after, advanceShipment(after, born?.id || "", actor))
  assert.equal(done.shipments.find((item) => item.id === born?.id)?.step, 2)
  assert.match(advanceShipment(done, born?.id || "", actor).error ?? "", /başa çatıb/)
})

test("müqavilə mərhələsi layihə, smeta və müqavilə açır", () => {
  const state = createInitialState()
  const deal = state.deals.find((item) => item.stage === "muqavile")
  assert.ok(deal)
  const result = openProjectFromDeal(state, deal.id, actor)
  assert.equal(result.error, undefined)
  const patch = patchOf(result)
  assert.ok(patch.projects?.[0]?.smetaId)
  assert.equal(patch.contracts?.[0]?.projectId, result.projectId)
  assert.equal(patch.deals?.find((item) => item.id === deal.id)?.projectId, result.projectId)
})

test("eyni dövrün Forma-3-ü təkrar açılmır, yekun açıq həcmdə dayanır", () => {
  const state = createInitialState()
  const again = createForma3(state, "PRJ-2408", "araliq", actor)
  assert.match(again.error ?? "", /təsdiqlənib/)
  const blocked = createForma3(state, "PRJ-2414", "yekun", actor)
  assert.match(blocked.error ?? "", /bağlanmamış/)
  const interim = createForma3(state, "PRJ-2414", "araliq", actor)
  assert.equal(interim.error, undefined)
  const doc = patchOf(interim).forma3s?.[0]
  assert.ok(doc)
  assert.equal(doc.kind, "araliq")
  assert.ok(doc.cumulativeValue > 0)
  assert.equal(doc.vat, Math.round(doc.cumulativeValue * 0.18))
})

test("yekun Forma-3 smeta bağlananda açılır və təsdiqdən sonra donur", () => {
  const state = createInitialState()
  const projectId = "PRJ-2414"
  const smetas = state.smetas.map((smeta) => {
    if (smeta.projectId !== projectId) return smeta
    return {
      ...smeta,
      lines: smeta.lines.map((line) => ({ ...line, doneQty: line.qty, billedQty: line.qty })),
    }
  })
  const smeta = smetas.find((item) => item.projectId === projectId)
  assert.ok(smeta)
  const closed = {
    ...state,
    smetas,
    acts: state.acts.map((act) =>
      act.projectId === projectId
        ? {
            ...act,
            lines: smeta.lines.map((line) => ({
              smetaLineId: line.id,
              code: line.code,
              name: line.name,
              unit: line.unit,
              unitPrice: line.unitPrice,
              qty: line.qty,
              cumulativeQty: line.qty,
            })),
          }
        : act,
    ),
    forma3s: state.forma3s.filter((item) => item.projectId !== projectId),
  }
  const opened = createForma3(closed, projectId, "yekun", actor)
  assert.equal(opened.error, undefined)
  const draft = withPatch(closed, opened)
  const doc = draft.forma3s[0]
  assert.ok(doc)
  assert.equal(doc.kind, "yekun")
  assert.equal(doc.remainValue, 0)
  const approved = approveForma3(draft, doc.id, actor)
  assert.equal(approved.error, undefined)
  const frozen = approveForma3(withPatch(draft, approved), doc.id, actor)
  assert.match(frozen.error ?? "", /Qaralama/)
})

test("forma-3 qaralaması silinir, təsdiq qaralamaya qayıdır və yenilənir", () => {
  const fresh = createInitialState()
  const draft = fresh.forma3s.find((item) => item.status === "qaralama")
  assert.ok(draft)
  const signed = fresh.forma3s.find((item) => item.projectId === "PRJ-2408" && item.status === "tesdiq")
  assert.ok(signed)
  assert.match(deleteForma3(fresh, signed.id, actor).error ?? "", /qaralama/)
  const removed = deleteForma3(fresh, draft.id, actor)
  assert.equal(removed.error, undefined)
  assert.equal(patchOf(removed).forma3s?.some((item) => item.id === draft.id), false)
  const back = returnForma3(fresh, signed.id, actor)
  assert.equal(back.error, undefined)
  const returned = withPatch(fresh, back)
  assert.equal(returned.forma3s.find((item) => item.id === signed.id)?.status, "qaralama")
  const refreshed = refreshForma3(returned, signed.id, actor)
  assert.equal(refreshed.error, undefined)
  assert.equal(patchOf(refreshed).forma3s?.find((item) => item.id === signed.id)?.number, signed.number)
  assert.match(refreshForma3(fresh, signed.id, actor).error ?? "", /donub/)
})

test("sifarişçi yazılır və adı layihəyə keçir, bağlı sifarişçi silinmir", () => {
  const fresh = createInitialState()
  const born = {
    ...fresh,
    clients: [{ id: "CLT-900", name: "Sınaq Holdinq", sector: "Development", contact: "Aysel", phone: "—", email: "—", city: "Bakı", projects: 0, value: 0, since: "2026" }, ...fresh.clients],
  }
  const form = { name: "Sınaq 2", sector: "Sənaye", contact: "Nigar", phone: "", email: "", city: "Gəncə", value: "1000" }
  const edited = updateClient(born, "CLT-900", form, actor)
  assert.equal(edited.error, undefined)
  assert.equal(patchOf(edited).clients?.find((item) => item.id === "CLT-900")?.name, "Sınaq 2")
  const renamed = updateClient(fresh, "CLT-014", { name: "Xəzər Holdinq 2", sector: "Development", contact: "Rəşad", phone: "", email: "", city: "Bakı", value: "" }, actor)
  assert.equal(patchOf(renamed).projects?.find((item) => item.id === "PRJ-2408")?.client, "Xəzər Holdinq 2")
  assert.match(deleteClient(fresh, "CLT-014", actor).error ?? "", /layihə/)
  const removed = deleteClient(withPatch(born, edited), "CLT-900", actor)
  assert.equal(removed.error, undefined)
  const lead = fresh.leads[0]
  assert.ok(lead)
  const promoted = promoteLead(fresh, lead.id, actor)
  assert.equal(promoted.error, undefined)
  assert.equal(patchOf(promoted).leads?.some((item) => item.id === lead.id), false)
  assert.equal(patchOf(promoted).deals?.[0]?.title, lead.name)
  const deal = fresh.deals.find((item) => !item.projectId)
  assert.ok(deal)
  assert.equal(deleteDeal(fresh, deal.id, actor).error, undefined)
})

test("boş mənzil bron, nağd satış, ödəniş və açar təhvilindən keçir", () => {
  let state = createInitialState()
  state = withPatch(state, reserveUnit(state, "UN-A12", "BY-01", actor))
  assert.equal(state.units.find((item) => item.id === "UN-A12")?.status, "bron")
  state = withPatch(state, openSale(state, "UN-A12", "BY-01", "nagd", actor))
  const contract = state.saleContracts[0]
  assert.ok(contract)
  assert.equal(contract.credit, "nagd")
  assert.equal(state.units.find((item) => item.id === "UN-A12")?.status, "muqavile")
  const row = contract.schedule[0]
  assert.ok(row)
  state = withPatch(state, paySale(state, contract.id, row.id, actor))
  assert.equal(state.units.find((item) => item.id === "UN-A12")?.status, "satilib")
  state = withPatch(state, handoverSale(state, contract.id, actor))
  assert.equal(state.units.find((item) => item.id === "UN-A12")?.status, "acar")
  assert.equal(state.saleContracts.find((item) => item.id === contract.id)?.status, "acar")
})

test("ƏDV və pul axını Forma-2 və mənzil ödənişindən yığılır", () => {
  const state = createInitialState()
  const vat = vatRows(state)
  assert.ok(vat.some((row) => row.period === "2026-08" && row.vat > 0))
  const cash = cashRows(state)
  assert.ok(cash.some((row) => row.month === "2026-08" && row.inflow >= 63000))
  assert.ok(agingRows(state).every((row) => row.bucket.length > 0))
})

test("anbar açılır, adı dəyişir, dolu anbar silinmir", () => {
  const state = createInitialState()
  const made = addLocation(state, { name: "Ehtiyat anbar", kind: "merkez" }, actor)
  const id = patchOf(made).locations?.find((item) => item.name === "Ehtiyat anbar")?.id || ""
  assert.ok(id)
  const renamed = updateLocation(withPatch(state, made), id, { name: "Ehtiyat sahə", kind: "sahe" }, actor)
  assert.equal(patchOf(renamed).locations?.find((item) => item.id === id)?.name, "Ehtiyat sahə")
  assert.match(deleteLocation(state, "LOC-MERKEZ", actor).error ?? "", /qalıq|hərəkət|marşrut|bağlı|sahə/)
  const gone = deleteLocation(withPatch(withPatch(state, made), renamed), id, actor)
  assert.equal(gone.error, undefined)
  assert.equal(patchOf(gone).locations?.some((item) => item.id === id), false)
})

test("sex açılır, adı iş əmrinə keçir və boş sex silinir", () => {
  const state = createInitialState()
  const form = { name: "Qaynaq sexi", place: "Xırdalan", shift: "Gündüz növbəsi", unit: "ton", plan: "8" }
  const made = addShop(state, form, actor)
  const born = withPatch(state, made)
  const shop = born.plants.find((item) => item.name === "Qaynaq sexi")
  assert.equal(shop?.kind, "sex")
  assert.ok(born.locations.some((item) => item.id === shop?.locationId))
  assert.match(deleteShop(state, "armatur", actor).error ?? "", /əmr|resept/)
  const tagged = { ...born, orders: born.orders.map((item, index) => (index === 0 ? { ...item, plant: "Qaynaq sexi" } : item)) }
  const edited = updateShop(tagged, shop?.id || "", { ...form, name: "Qaynaq 2" }, actor)
  assert.equal(patchOf(edited).orders?.find((item) => item.id === tagged.orders[0]?.id)?.plant, "Qaynaq 2")
  assert.match(deleteShop(tagged, shop?.id || "", actor).error ?? "", /əmr/)
  const removed = deleteShop(born, shop?.id || "", actor)
  assert.equal(removed.error, undefined)
  assert.equal(patchOf(removed).plants?.some((item) => item.id === shop?.id), false)
  assert.equal(patchOf(removed).locations?.some((item) => item.id === shop?.locationId), false)
})

test("qaralama akt redaktə olunur, təsdiq və faktura silinmir", () => {
  const fresh = createInitialState()
  const created = createAct(fresh, "PRJ-2408", actor)
  let state = withPatch(fresh, created)
  const act = state.acts[0]
  assert.ok(act)
  const line = act.lines[0]
  assert.ok(line)
  const before = fresh.smetas.find((item) => item.projectId === "PRJ-2408")?.lines.find((item) => item.id === line.smetaLineId)?.billedQty
  const edited = updateAct(state, act.id, act.lines.map((item) => ({ smetaLineId: item.smetaLineId, qty: item.smetaLineId === line.smetaLineId ? line.qty / 2 : item.qty })), actor)
  state = withPatch(state, edited)
  const mid = state.smetas.find((item) => item.projectId === "PRJ-2408")?.lines.find((item) => item.id === line.smetaLineId)?.billedQty
  assert.ok(mid !== undefined && before !== undefined)
  assert.ok(Math.abs(mid - (before + line.qty / 2)) < 0.02)
  assert.match(updateAct(state, act.id, [{ smetaLineId: line.smetaLineId, qty: 999999 }], actor).error ?? "", /aktlaşdırılıb|ən çox/)
  state = withPatch(state, approveAct(state, act.id, actor))
  assert.match(deleteAct(state, act.id, actor).error ?? "", /qaralama/)
  state = withPatch(state, returnAct(state, act.id, actor))
  assert.equal(state.acts.find((item) => item.id === act.id)?.status, "qaralama")
  state = withPatch(state, approveAct(state, act.id, actor))
  state = withPatch(state, invoiceAct(state, act.id, actor))
  assert.match(deleteAct(state, act.id, actor).error ?? "", /silinmir/)
  const draft = createAct(fresh, "PRJ-2414", actor)
  const born = withPatch(fresh, draft)
  const id = born.acts[0]?.id || ""
  const removed = deleteAct(born, id, actor)
  const restored = withPatch(born, removed).smetas.find((item) => item.projectId === "PRJ-2414")?.lines[0]?.billedQty
  const original = fresh.smetas.find((item) => item.projectId === "PRJ-2414")?.lines[0]?.billedQty
  assert.equal(restored, original)
})

test("qaralama gündəlik yazılır və silinir, təsdiq donur", () => {
  const fresh = createInitialState()
  const draft = fresh.reports.find((item) => item.status === "qaralama")
  assert.ok(draft)
  assert.equal(draft.author, "Elşən Qarayev")
  const edited = saveReport(fresh, { id: draft.id, projectId: draft.projectId, lines: draft.lines, note: "Yeniləndi", weather: "yagis" }, actor)
  assert.equal(patchOf(edited).reports?.find((item) => item.id === draft.id)?.note, "Yeniləndi")
  assert.equal(patchOf(edited).reports?.find((item) => item.id === draft.id)?.author, "Elşən Qarayev")
  assert.equal(patchOf(edited).reports?.find((item) => item.id === draft.id)?.status, "qaralama")
  const removed = deleteReport(withPatch(fresh, edited), draft.id, actor)
  assert.equal(patchOf(removed).reports?.some((item) => item.id === draft.id), false)
  assert.match(deleteReport(fresh, "DR-014", actor).error ?? "", /düzəlişə/)
  const returned = withPatch(fresh, returnReport(fresh, "DR-014", actor))
  const kept = saveReport(returned, { id: "DR-014", projectId: "PRJ-2408", lines: returned.reports.find((item) => item.id === "DR-014")?.lines || [], note: "Düzəliş" }, actor)
  assert.equal(patchOf(kept).reports?.find((item) => item.id === "DR-014")?.status, "duzelis")
  const signed = withPatch(fresh, approveReport(fresh, "DR-014", actor))
  assert.match(deleteReport(signed, "DR-014", actor).error ?? "", /silinmir/)
  assert.match(saveReport(signed, { id: "DR-014", projectId: "PRJ-2408", lines: [{ smetaLineId: "x", qty: 1 }] }, actor).error ?? "", /donub/)
  const noted = addShiftNote(fresh, "Port Baku Residence", "Yağış dayandı", actor)
  const id = patchOf(noted).journal?.[0]?.id || ""
  assert.ok(id)
  const changed = updateJournal(withPatch(fresh, noted), id, "Yağış kəsildi", actor)
  assert.equal(patchOf(changed).journal?.find((item) => item.id === id)?.text, "Yağış kəsildi")
  assert.match(updateJournal(fresh, id, "  ", actor).error ?? "", /Qeyd/)
  const gone = deleteJournal(withPatch(withPatch(fresh, noted), changed), id, actor)
  assert.equal(patchOf(gone).journal?.some((item) => item.id === id), false)
})

test("sahəyə işçi yazılır, texnika parkdan cəlb olunur", () => {
  const fresh = createInitialState()
  const form = { name: "Kamal Əliyev", role: "Fəhlə", crew: "Karkas-1", phone: "", status: "sahede" as const }
  const added = addPerson(fresh, "Port Baku Residence", form, actor)
  const person = patchOf(added).people?.[0]
  assert.equal(person?.site, "Port Baku Residence")
  assert.equal(person?.phone, "—")
  const renamed = updatePerson(withPatch(fresh, added), person?.id || "", "Port Baku Residence", { ...form, name: "Kamal Əliyev 2" }, actor)
  assert.equal(patchOf(renamed).people?.find((item) => item.id === person?.id)?.name, "Kamal Əliyev 2")
  assert.match(deletePerson(fresh, "HR-04", actor).error ?? "", /tabel/)
  const removed = deletePerson(withPatch(withPatch(fresh, added), renamed), person?.id || "", actor)
  assert.equal(patchOf(removed).people?.some((item) => item.id === person?.id), false)
  const pulled = assignAsset(fresh, "AST-040", "Port Baku Residence", actor)
  assert.equal(patchOf(pulled).assets?.find((item) => item.id === "AST-040")?.status, "sahede")
  assert.equal(patchOf(pulled).assets?.find((item) => item.id === "AST-040")?.site, "Port Baku Residence")
  assert.match(assignAsset(withPatch(fresh, pulled), "AST-040", "Port Baku Residence", actor).error ?? "", /artıq/)
  assert.match(assignAsset(fresh, "AST-033", "Port Baku Residence", actor).error ?? "", /Servis/)
  const back = releaseAsset(withPatch(fresh, pulled), "AST-040", actor)
  assert.equal(patchOf(back).assets?.find((item) => item.id === "AST-040")?.status, "bos")
  assert.equal(patchOf(back).assets?.find((item) => item.id === "AST-040")?.site, "Mərkəzi anbar")
  const edited = updateAsset(fresh, "AST-014", { name: "Liebherr 2", type: "Kran", hours: "10", nextService: "2026-10-02", utilization: "80" }, actor)
  assert.equal(patchOf(edited).assets?.find((item) => item.id === "AST-014")?.name, "Liebherr 2")
  assert.match(updateAsset(fresh, "AST-014", { name: "Liebherr", type: "Kran", hours: "-1", nextService: "2026-10-02", utilization: "80" }, actor).error ?? "", /mənfi/)
})

test("yanacaq dizel anbarını azaldır və layihə xərcinə yazılır", () => {
  const state = createInitialState()
  const before = onHand(state.stocks, "MAT-DSL", "LOC-MERKEZ")
  const filled = logFuel(state, { assetId: "AST-058", liters: "100", reading: "98600", project: "Port Baku Residence", note: "Növbə" }, actor)
  assert.equal(filled.error, undefined)
  const patch = patchOf(filled)
  assert.equal(onHand(patch.stocks || [], "MAT-DSL", "LOC-MERKEZ"), before - 100)
  assert.ok(patch.expenses?.some((item) => item.category === "Yanacaq" && item.project === "Port Baku Residence"))
  assert.equal(patch.assets?.find((item) => item.id === "AST-058")?.odometer, 98600)
  const again = logFuel(withPatch(state, filled), { assetId: "AST-058", liters: "999999", reading: "", project: "Port Baku Residence", note: "" }, actor)
  assert.match(again.error ?? "", /çatmır|qalıq/)
})

test("reys yürüşü yazır, servis və vaxtı bitmiş vəsiqə dayanır", () => {
  const state = createInitialState()
  const opened = openTrip(state, {
    assetId: "AST-040",
    driverId: "DRV-002",
    project: "Sumqayıt Lojistik Park",
    from: "Mərkəzi anbar",
    to: "Sumqayıt Lojistik Park",
    cargo: "Qum",
    km: "40",
    note: "",
  }, actor)
  assert.equal(opened.error, undefined)
  const tripId = patchOf(opened).trips?.[0]?.id || ""
  const moving = departTrip(withPatch(state, opened), tripId, actor)
  assert.equal(patchOf(moving).trips?.find((item) => item.id === tripId)?.status, "yolda")
  const arrived = arriveTrip(withPatch(withPatch(state, opened), moving), tripId, actor)
  assert.equal(patchOf(arrived).assets?.find((item) => item.id === "AST-040")?.odometer, 186440)
  assert.match(arriveTrip(withPatch(withPatch(withPatch(state, opened), moving), arrived), tripId, actor).error ?? "", /Yolda/)
  assert.match(openTrip(state, {
    assetId: "AST-033",
    driverId: "DRV-002",
    project: "Sumqayıt Lojistik Park",
    from: "Servis mərkəzi",
    to: "Sumqayıt Lojistik Park",
    cargo: "Nasos",
    km: "12",
    note: "",
  }, actor).error ?? "", /Servis/)
  assert.match(openTrip(state, {
    assetId: "AST-044",
    driverId: "DRV-005",
    project: "Port Baku Residence",
    from: "Mərkəzi anbar",
    to: "Port Baku Residence",
    cargo: "Bağlama",
    km: "8",
    note: "",
  }, actor).error ?? "", /vaxtı/)
  assert.match(assignVehicle(state, { assetId: "AST-062", site: "Xırdalan Məktəb Kompleksi", status: "sahede", driverId: "DRV-001" }, actor).error ?? "", /başqa texnika/)
})

test("layihə pasportu yazılır, sənəd və qeyd bağlanır", () => {
  const fresh = createInitialState()
  const project = fresh.projects.find((item) => item.id === "PRJ-2408")
  if (!project) throw new Error("layihə yoxdur")
  const form = {
    name: "Port Baku 2",
    address: project.address,
    district: project.district,
    city: project.city,
    type: project.type,
    phase: "Fasad",
    manager: project.manager,
    floors: String(project.floors),
    area: String(project.area),
    start: project.start,
    end: project.end,
    status: "aktiv" as const,
  }
  assert.match(updateProject(fresh, "PRJ-2408", { ...form, name: " " }, actor).error ?? "", /Ad/)
  assert.match(updateProject(fresh, "PRJ-2408", { ...form, end: "2020-01-01" }, actor).error ?? "", /əvvəl/)
  const renamed = updateProject(fresh, "PRJ-2408", form, actor)
  const next = withPatch(fresh, renamed)
  assert.equal(next.projects.find((item) => item.id === "PRJ-2408")?.name, "Port Baku 2")
  assert.equal(next.projects.find((item) => item.id === "PRJ-2408")?.phases.find((item) => item.name === "Fasad")?.current, true)
  assert.equal(next.people.find((item) => item.id === "HR-01")?.site, "Port Baku 2")
  assert.ok(next.locations.some((item) => item.projectId === "PRJ-2408" && item.name.includes("Port Baku 2")))
  assert.ok(next.invoices.some((item) => item.project === "Port Baku 2"))
  assert.match(deleteProject(next, "PRJ-2408", actor).error ?? "", /smeta/)
  const noted = addProjectNote(next, "PRJ-2408", "Fasad cizgisi yeniləndi", actor)
  const noteId = withPatch(next, noted).projects.find((item) => item.id === "PRJ-2408")?.notes[0]?.id || ""
  assert.equal(updateProjectNote(withPatch(next, noted), "PRJ-2408", noteId, "Fasad rev D", actor).error, undefined)
  assert.equal(deleteProjectNote(withPatch(withPatch(next, noted), updateProjectNote(withPatch(next, noted), "PRJ-2408", noteId, "Fasad rev D", actor)), "PRJ-2408", noteId, actor).error, undefined)
  assert.match(deleteDocument(fresh, "DOC-02", actor).error ?? "", /silinmir/)
  assert.match(updateDocument(fresh, "DOC-02", { projectId: "PRJ-2408", title: "Yeni", kind: "Çizgi", date: "2026-09-18" }, actor).error ?? "", /donub/)
  const opened = addDocument(fresh, { projectId: "PRJ-2391", title: "Geodeziya aktı", kind: "Akt", date: "2026-09-23" }, actor)
  const docId = patchOf(opened).documents?.[0]?.id || ""
  const edited = updateDocument(withPatch(fresh, opened), docId, { projectId: "PRJ-2391", title: "Geodeziya aktı 2", kind: "Akt", date: "2026-09-23" }, actor)
  assert.equal(patchOf(edited).documents?.find((item) => item.id === docId)?.title, "Geodeziya aktı 2")
  assert.equal(deleteDocument(withPatch(withPatch(fresh, opened), edited), docId, actor).error, undefined)
})

test("yeni layihə açılır", () => {
  const fresh = createInitialState()
  const client = fresh.clients[0]
  if (!client) throw new Error("müştəri yoxdur")
  const form = {
    name: "Yeni sahə",
    client: client.name,
    address: "Nizami 1",
    district: "Nəsimi",
    city: "Bakı",
    type: "Yaşayış",
    phase: "Fasad",
    manager: "Nigar Əliyeva",
    floors: "8",
    area: "12000",
    budget: "1500000",
    start: "2026-10-14",
    end: "2027-06-01",
    status: "plan" as const,
  }
  assert.match(addProject(fresh, { ...form, name: " " }, actor).error ?? "", /Ad/)
  assert.match(addProject(fresh, { ...form, client: " " }, actor).error ?? "", /Sifarişçi/)
  assert.match(addProject(fresh, { ...form, end: "2020-01-01" }, actor).error ?? "", /əvvəl/)
  assert.match(addProject(fresh, { ...form, name: "Port Baku Residence" }, actor).error ?? "", /adda/)
  const opened = addProject(fresh, form, actor)
  const next = withPatch(fresh, opened)
  const project = next.projects.find((item) => item.name === "Yeni sahə")
  if (!project) throw new Error("layihə açılmadı")
  assert.equal(project.client, client.name)
  assert.equal(project.status, "plan")
  assert.equal(project.budget, 1500000)
  assert.equal(project.progress, 0)
  assert.equal(project.phases.find((item) => item.name === "Fasad")?.current, true)
  assert.equal(project.phases.find((item) => item.name === "Torpaq")?.done, true)
  assert.ok(next.locations.some((item) => item.projectId === project.id && item.kind === "sahe"))
  assert.equal(next.clients.find((item) => item.id === client.id)?.projects, client.projects + 1)
})
