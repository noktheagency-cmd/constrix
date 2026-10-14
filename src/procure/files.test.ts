import assert from "node:assert/strict"
import test from "node:test"
import { parseUpload, type Extracted } from "./engine"
import { buildSheet } from "./files"

const rows: Extracted[] = [{
  id: "1",
  name: "Pəncərə P-01",
  code: "P-01",
  qty: "12",
  width: "1400",
  height: "1500",
  profile: "Alüminium 60 mm",
  glass: "24 mm şəffaf",
  hardware: "Dönər",
  spec: "Otaq",
  install: "Daxili",
  flags: [],
  confirmed: true,
}]

test("excel export opens back into the same rows", async () => {
  const built = await buildSheet("xlsx", "pencere.xlsx", rows)
  const parsed = parseUpload("pencere.xlsx", built.bytes)
  assert.equal(parsed.scan.ok, true)
  assert.equal(parsed.rows[0]?.name, "Pəncərə P-01")
  assert.equal(parsed.rows[0]?.qty, "12")
  assert.equal(parsed.rows[0]?.width, "1400")
  assert.equal(parsed.rows[0]?.profile, "Alüminium 60 mm")
})

test("csv export keeps the columns", async () => {
  const built = await buildSheet("csv", "qapi.csv", rows)
  const parsed = parseUpload("qapi.csv", built.bytes)
  assert.equal(parsed.rows[0]?.code, "P-01")
  assert.equal(parsed.rows[0]?.height, "1500")
  assert.equal(parsed.rows[0]?.glass, "24 mm şəffaf")
})

test("dxf and ifc exports carry the line name", async () => {
  const dxf = await buildSheet("dxf", "fasad.dxf", rows)
  assert.match(new TextDecoder().decode(dxf.bytes), /Pəncərə P-01/)
  const ifc = await buildSheet("ifc", "qapi.ifc", rows)
  const parsed = parseUpload("qapi.ifc", ifc.bytes)
  assert.equal(parsed.rows[0]?.name, "Pəncərə P-01")
})
