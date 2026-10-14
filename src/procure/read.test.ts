import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readProjectFile, zipText } from "./read"

const encoder = new TextEncoder()

describe("read", () => {
  it("reads a stored docx document", async () => {
    const xml = `<?xml version="1.0"?><w:document><w:t>Pencere 1200x1500</w:t><w:t>Alum 60</w:t></w:document>`
    const bytes = storedZip({ "word/document.xml": xml })
    const parsed = await readProjectFile("sməta.docx", bytes)
    assert.equal(parsed.rows[0]?.width, "1200")
    assert.equal(parsed.rows[0]?.height, "1500")
    assert.equal(parsed.rows[0]?.profile, "Alum 60")
    assert.equal(parsed.rows[0]?.flags.includes("qeyri-deqiq"), false)
  })

  it("reads a deflated docx document", async () => {
    const xml = `<w:document><w:t>Qapi 900 x 2100</w:t></w:document>`
    const bytes = await deflatedZip({ "word/document.xml": xml })
    const text = await zipText(bytes, "word/document.xml")
    assert.match(text ?? "", /900 x 2100/)
  })
})

function storedZip(files: Record<string, string>) {
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const fileName = encoder.encode(name)
    const data = encoder.encode(text)
    const local = new Uint8Array(30 + fileName.length + data.length)
    const view = new DataView(local.buffer)
    view.setUint32(0, 0x04034b50, true)
    view.setUint16(8, 0, true)
    view.setUint32(18, data.length, true)
    view.setUint32(22, data.length, true)
    view.setUint16(26, fileName.length, true)
    local.set(fileName, 30)
    local.set(data, 30 + fileName.length)
    chunks.push(local)
    const entry = new Uint8Array(46 + fileName.length)
    const head = new DataView(entry.buffer)
    head.setUint32(0, 0x02014b50, true)
    head.setUint16(10, 0, true)
    head.setUint32(20, data.length, true)
    head.setUint32(24, data.length, true)
    head.setUint16(28, fileName.length, true)
    head.setUint32(42, offset, true)
    entry.set(fileName, 46)
    central.push(entry)
    offset += local.length
  }
  const directory = concat(central)
  const end = new Uint8Array(22)
  const tail = new DataView(end.buffer)
  tail.setUint32(0, 0x06054b50, true)
  tail.setUint16(8, central.length, true)
  tail.setUint16(10, central.length, true)
  tail.setUint32(12, directory.length, true)
  tail.setUint32(16, offset, true)
  return concat([...chunks, directory, end])
}

async function deflatedZip(files: Record<string, string>) {
  const { deflateRawSync } = await import("node:zlib")
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const fileName = encoder.encode(name)
    const raw = encoder.encode(text)
    const data = deflateRawSync(raw)
    const local = new Uint8Array(30 + fileName.length + data.length)
    const view = new DataView(local.buffer)
    view.setUint32(0, 0x04034b50, true)
    view.setUint16(8, 8, true)
    view.setUint32(18, data.length, true)
    view.setUint32(22, raw.length, true)
    view.setUint16(26, fileName.length, true)
    local.set(fileName, 30)
    local.set(data, 30 + fileName.length)
    chunks.push(local)
    const entry = new Uint8Array(46 + fileName.length)
    const head = new DataView(entry.buffer)
    head.setUint32(0, 0x02014b50, true)
    head.setUint16(10, 8, true)
    head.setUint32(20, data.length, true)
    head.setUint32(24, raw.length, true)
    head.setUint16(28, fileName.length, true)
    head.setUint32(42, offset, true)
    entry.set(fileName, 46)
    central.push(entry)
    offset += local.length
  }
  const directory = concat(central)
  const end = new Uint8Array(22)
  const tail = new DataView(end.buffer)
  tail.setUint32(0, 0x06054b50, true)
  tail.setUint16(8, central.length, true)
  tail.setUint16(10, central.length, true)
  tail.setUint32(12, directory.length, true)
  tail.setUint32(16, offset, true)
  return concat([...chunks, directory, end])
}

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let cursor = 0
  for (const part of parts) {
    out.set(part, cursor)
    cursor += part.length
  }
  return out
}
