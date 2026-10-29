import assert from "node:assert/strict"
import test from "node:test"
import { withDemo } from "./demo"
import { blankState } from "./engine"

const org = { id: "library-test", kind: "tikinti", name: "Test şirkəti" }

test("demo library contains eight distinct files and repeated loads preserve edits", () => {
  const seeded = withDemo(blankState(), [org])
  assert.equal(seeded.files.length, 8)
  assert.equal(new Set(seeded.files.map((file) => file.id)).size, 8)
  const rowIds = seeded.files.flatMap((file) => file.rows.map((row) => row.id))
  assert.equal(new Set(rowIds).size, rowIds.length)
  seeded.files[4].rows[0].qty = "99"
  const again = withDemo(seeded, [org])
  assert.equal(again, seeded)
  assert.equal(again.files[4].rows[0].qty, "99")
})

test("extra examples are not added to a library containing only real files", () => {
  const base = blankState()
  base.files = [{ id: "uploaded-file", companyId: org.id, name: "Real.csv", ext: "csv", size: 10, scan: "temiz", scanNote: "", rows: [] }]
  assert.deepEqual(withDemo(base, [org]).files, base.files)
})
