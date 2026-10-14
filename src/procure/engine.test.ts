import assert from "node:assert/strict"
import test from "node:test"
import { blankState, blankWindow, framePieces, logisticsMath, parseCsv, parseDxf, parseIfc, parseUpload, scanBytes, windowMath, withPlanDefaults, type ProfileRule } from "./engine"

const rule: ProfileRule = {
  id: "r",
  companyId: "c",
  system: "Alum 60",
  confirmed: true,
  kgPerM: "1.2",
  wastePercent: "10",
  glassDeductMm: "40",
  glassWastePercent: "5",
}

test("çərçivə uzunluğu ölçüdən gəlir", () => {
  const frame = framePieces(1000, 1500, 2, 1)
  assert.equal(frame.pieces.length, 5)
  assert.equal(frame.lengthM, (1000 * 2 + 1500 * 2 + 1500) / 1000)
})

test("təsdiqsiz qayda satış qiymətini bağlamır", () => {
  const input = { ...blankWindow(), width: "1000", height: "1000", count: "1", profileRate: "20", glassRate: "30", hardwareRate: "10", laborRate: "5", packRate: "1", transport: "0", glassConfirmed: true }
  const math = windowMath(input, undefined)
  assert.equal(math.ready, true)
  assert.equal(math.lengthM, 4)
  assert.equal(math.weightKg, null)
  assert.equal(math.gross, null)
  assert.ok(math.blocked.some((item) => item.includes("təsdiqlənməyib")))
})

test("təsdiqli qayda mayanı və satışı bağlayır", () => {
  const input = {
    ...blankWindow(),
    width: "1000",
    height: "1000",
    count: "1",
    sections: "1",
    opening: "sabit" as const,
    profileUnit: "kq" as const,
    profileRate: "10",
    glassRate: "20",
    hardwareRate: "0",
    laborRate: "5",
    packRate: "1",
    installKind: "",
    transport: "0",
    extra: "0",
    vat: "0",
    profit: "10",
    profitMode: "faiz" as const,
  }
  const math = windowMath(input, rule)
  assert.equal(math.weightKg, 4 * 1.2)
  assert.ok(math.cost != null && math.gross != null)
  assert.ok(Math.abs(math.gross - math.cost * 1.1) < 0.001)
})

test("marja satışın içindəki paydır", () => {
  const input = {
    ...blankWindow(),
    width: "1000",
    height: "1000",
    count: "1",
    opening: "sabit" as const,
    profileUnit: "m" as const,
    profileRate: "0",
    glassRate: "0",
    hardwareRate: "0",
    laborRate: "0",
    packRate: "0",
    transport: "100",
    extra: "0",
    vat: "0",
    profit: "20",
    profitMode: "marja" as const,
    glassConfirmed: true,
  }
  const math = windowMath(input, { ...rule, wastePercent: "0", glassWastePercent: "0" })
  assert.equal(math.cost, 100)
  assert.equal(math.sale, 125)
})

test("csv boş xananı oxunmamış işarələyir", () => {
  const rows = parseCsv("ad,say,en,hündürlük\nPəncərə,2,1200,\n", "fayl")
  assert.equal(rows[0].name, "Pəncərə")
  assert.equal(rows[0].qty, "2")
  assert.ok(rows[0].flags.includes("oxunmadi"))
  assert.equal(rows[0].confirmed, false)
})

test("dxf düzbucaqlını qeyri-dəqiq ölçü kimi qaytarır", () => {
  const dxf = ["0", "SECTION", "2", "ENTITIES", "0", "LWPOLYLINE", "10", "0", "20", "0", "10", "1.2", "20", "0", "10", "1.2", "20", "1.5", "10", "0", "20", "1.5", "0", "ENDSEC"].join("\n")
  const rows = parseDxf(dxf, "Pəncərə")
  assert.equal(rows[0].width, "1200")
  assert.equal(rows[0].height, "1500")
  assert.ok(rows[0].flags.includes("qeyri-deqiq"))
})

test("təhlükəli məzmun qəbul olunmur", () => {
  const bytes = new TextEncoder().encode("<script>alert(1)</script>")
  const scan = scanBytes("siyahi.csv", bytes)
  assert.equal(scan.ok, false)
})

test("şüşə standart maşına sığmayanda daşınma bağlanır", () => {
  const math = logisticsMath({
    id: "l",
    companyId: "c",
    carrierId: "",
    from: "Zavod",
    to: "Sahə",
    km: "10",
    weight: "100",
    volume: "1",
    glassWidth: "3000",
    glassHeight: "1500",
    vehicle: "standart",
    capacityKg: "1000",
    maxGlassMm: "2000",
    roundTrip: true,
    loadCost: "0",
    waitCost: "0",
    extra: "0",
    tariff: "2",
    speed: "100",
    days: "",
  })
  assert.equal(math.fit, "olcu")
  assert.equal(math.cost, null)
})

test("boş tarif cədvəli nümunə məbləğlə dolur", () => {
  const seeds = blankState().plans
  assert.equal(seeds.length, 6)
  for (const plan of seeds) {
    assert.ok(plan.amount.trim(), plan.id)
    assert.ok(plan.note.trim(), plan.id)
  }
  const filled = withPlanDefaults(seeds.map((plan) => ({ ...plan, amount: "", note: "" })))
  assert.equal(filled.find((plan) => plan.id === "abune")?.amount, "149")
  assert.equal(filled.find((plan) => plan.id === "komissiya")?.amount, "2.5")
  const kept = withPlanDefaults(seeds.map((plan) => (plan.id === "abune" ? { ...plan, amount: "200" } : plan)))
  assert.equal(kept.find((plan) => plan.id === "abune")?.amount, "200")
})

test("dxf yazılı ölçü və profil dəqiq qalır", () => {
  const text = ["0", "TEXT", "1", "Pencere 1200x1500", "0", "TEXT", "1", "Alum 60"].join("\n")
  const rows = parseDxf(text, "Pəncərə")
  assert.equal(rows[0]?.width, "1200")
  assert.equal(rows[0]?.height, "1500")
  assert.equal(rows[0]?.profile, "Alum 60")
  assert.equal(rows[0]?.flags.includes("qeyri-deqiq"), false)
})

test("ifc pəncərəsinin eni, hündürlüyü və profili oxunur", () => {
  const text = `#1=IFCWINDOW('id','owner','W-12','Pencere',$,$,$,$);
#2=IFCQUANTITYLENGTH('OverallWidth',$,$,1.4);
#3=IFCQUANTITYLENGTH('OverallHeight',$,$,1.6);
#4=IFCPROPERTYSINGLEVALUE('Reference',$,IFCTEXT('Alum 60'),$);`
  const rows = parseIfc(text, "Pəncərə")
  assert.equal(rows[0]?.width, "1400")
  assert.equal(rows[0]?.height, "1600")
  assert.equal(rows[0]?.profile, "Alum 60")
  assert.equal(rows[0]?.flags.includes("qeyri-deqiq"), false)
})

test("dwg mətn cədvəlindən pəncərə oxunur", () => {
  const parsed = parseUpload("plan.dwg", new TextEncoder().encode("Pencere 900x2100 Alum 50"))
  assert.equal(parsed.rows[0]?.width, "900")
  assert.equal(parsed.rows[0]?.height, "2100")
  assert.equal(parsed.rows[0]?.profile, "Alum 50")
})
