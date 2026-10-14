import * as XLSX from "xlsx"
import type { Extracted } from "./engine"

export const EXPORTS = [
  ["xlsx", "Excel"],
  ["csv", "CSV"],
  ["txt", "Mətn"],
  ["pdf", "PDF"],
] as const

export type ExportKind = (typeof EXPORTS)[number][0]

const FIELDS: { key: keyof Extracted; label: string }[] = [
  { key: "name", label: "Ad" },
  { key: "code", label: "Kod" },
  { key: "qty", label: "Say" },
  { key: "width", label: "En" },
  { key: "height", label: "Hündürlük" },
  { key: "profile", label: "Profil" },
  { key: "glass", label: "Şüşə" },
  { key: "hardware", label: "Furnitur" },
  { key: "spec", label: "Spesifikasiya" },
  { key: "install", label: "Montaj" },
]

const REBUILD = new Set(["csv", "txt", "xls", "xlsx", "pdf", "dxf", "ifc"])

type Sheet = { name: string; ext: string; rows: Extracted[]; blobId?: string; revised?: boolean }

function matrix(rows: Extracted[]) {
  return [
    [...FIELDS.map((field) => field.label), "Təsdiq"],
    ...rows.map((row) => [...FIELDS.map((field) => String(row[field.key] ?? "")), row.confirmed ? "Bəli" : "Xeyr"]),
  ]
}

function stem(name: string) {
  const clean = name.trim() || "fayl"
  return clean.replace(/\.[^.]+$/, "") || "fayl"
}

function quote(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

function toCsv(rows: Extracted[]) {
  const text = matrix(rows).map((line) => line.map(quote).join(";")).join("\r\n")
  return new TextEncoder().encode(`\uFEFF${text}`)
}

function toTxt(rows: Extracted[]) {
  const text = matrix(rows).map((line) => line.join("\t")).join("\r\n")
  return new TextEncoder().encode(text)
}

function toSheet(rows: Extracted[], bookType: "xlsx" | "xls") {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(matrix(rows)), "Setirler")
  return new Uint8Array(XLSX.write(book, { type: "array", bookType }) as ArrayBuffer)
}

function toDxf(rows: Extracted[]) {
  const entities = rows.map((row, index) => {
    const text = [row.name, row.code, row.qty, row.width && row.height ? `${row.width}x${row.height}` : "", row.profile]
      .filter(Boolean)
      .join(" | ")
      .replace(/[\r\n]/g, " ")
    const y = (rows.length - index) * 8
    return `0\nTEXT\n8\n0\n10\n10\n20\n${y}\n40\n3.5\n1\n${text}\n`
  })
  const body = `0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities.join("")}0\nENDSEC\n0\nEOF\n`
  return new TextEncoder().encode(body)
}

function toIfc(rows: Extracted[]) {
  const data = rows.map((row, index) => {
    const kind = /qapı|qapi|door/i.test(row.name) ? "DOOR" : "WINDOW"
    const name = row.name.replace(/'/g, "''")
    return `#${index + 1}=IFC${kind}('${row.code}','${name}');`
  })
  const body = `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('AFEZ'),'2;1');\nFILE_NAME('afez','',('AFEZ'),('AFEZ'),'AFEZ','AFEZ','');\nFILE_SCHEMA(('IFC2X3'));\nENDSEC;\nDATA;\n${data.join("\n")}\nENDSEC;\nEND-ISO-10303-21;\n`
  return new TextEncoder().encode(body)
}

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function jpegPdf(jpeg: Uint8Array, pxW: number, pxH: number) {
  const pageW = 595
  const pageH = Math.max(200, Math.round((pageW * pxH) / pxW))
  const enc = (value: string) => new TextEncoder().encode(value)
  const content = enc(`q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im Do\nQ\n`)
  const head = enc("%PDF-1.4\n")
  const parts: Uint8Array[] = [head]
  const offsets = [0]
  let cursor = head.length
  function add(body: Uint8Array) {
    offsets.push(cursor)
    const wrap = concat([enc(`${offsets.length - 1} 0 obj\n`), body, enc("\nendobj\n")])
    parts.push(wrap)
    cursor += wrap.length
  }
  add(enc("<< /Type /Catalog /Pages 2 0 R >>"))
  add(enc("<< /Type /Pages /Count 1 /Kids [3 0 R] >>"))
  add(enc(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /XObject << /Im 5 0 R >> >> >>`))
  add(concat([enc(`<< /Length ${content.length} >>\nstream\n`), content, enc("endstream")]))
  add(concat([
    enc(`<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
    jpeg,
    enc("\nendstream"),
  ]))
  let xref = "xref\n0 6\n0000000000 65535 f \n"
  for (let index = 1; index <= 5; index += 1) xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`
  xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${cursor}\n%%EOF`
  parts.push(enc(xref))
  return concat(parts)
}

function clip(ctx: CanvasRenderingContext2D, value: string, max: number) {
  if (ctx.measureText(value).width <= max) return value
  let text = value
  while (text.length > 1 && ctx.measureText(`${text}…`).width > max) text = text.slice(0, -1)
  return `${text}…`
}

async function toPdf(title: string, rows: Extracted[]) {
  const width = 1100
  const columns = [210, 80, 56, 120, 150, 130, 160, 110, 70]
  const heads = ["Ad", "Kod", "Say", "Ölçü", "Profil", "Şüşə", "Spesifikasiya", "Montaj", "Təsdiq"]
  const rowH = 26
  const height = 78 + rowH + Math.max(rows.length, 1) * rowH + 28
  const canvas = document.createElement("canvas")
  canvas.width = width * 2
  canvas.height = height * 2
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("PDF yazılmadı")
  ctx.scale(2, 2)
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = "#0e2a43"
  ctx.font = "600 18px Segoe UI, sans-serif"
  ctx.fillText(title, 28, 36)
  let x = 28
  let y = 64
  ctx.font = "600 11px Segoe UI, sans-serif"
  ctx.fillStyle = "#5c6b7a"
  heads.forEach((head, index) => {
    ctx.fillText(clip(ctx, head, columns[index] - 8), x, y)
    x += columns[index]
  })
  ctx.strokeStyle = "#e4ebf1"
  ctx.beginPath()
  ctx.moveTo(28, y + 8)
  ctx.lineTo(width - 28, y + 8)
  ctx.stroke()
  ctx.font = "13px Segoe UI, sans-serif"
  ctx.fillStyle = "#102033"
  rows.forEach((row, index) => {
    y = 64 + rowH + index * rowH
    const size = row.width && row.height ? `${row.width}×${row.height}` : ""
    const cells = [row.name, row.code, row.qty, size, row.profile, row.glass, row.spec, row.install, row.confirmed ? "Bəli" : "Xeyr"]
    x = 28
    cells.forEach((cell, cellIndex) => {
      ctx.fillText(clip(ctx, cell || "—", columns[cellIndex] - 8), x, y)
      x += columns[cellIndex]
    })
  })
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92))
  if (!blob) throw new Error("PDF yazılmadı")
  return jpegPdf(new Uint8Array(await blob.arrayBuffer()), canvas.width, canvas.height)
}

export async function buildSheet(ext: string, name: string, rows: Extracted[]) {
  const kind = ext.toLowerCase()
  if (kind === "csv") return { ext: "csv", mime: "text/csv;charset=utf-8", bytes: toCsv(rows) }
  if (kind === "txt") return { ext: "txt", mime: "text/plain;charset=utf-8", bytes: toTxt(rows) }
  if (kind === "xls") return { ext: "xls", mime: "application/vnd.ms-excel", bytes: toSheet(rows, "xls") }
  if (kind === "pdf") return { ext: "pdf", mime: "application/pdf", bytes: await toPdf(stem(name), rows) }
  if (kind === "dxf") return { ext: "dxf", mime: "application/dxf", bytes: toDxf(rows) }
  if (kind === "ifc") return { ext: "ifc", mime: "application/octet-stream", bytes: toIfc(rows) }
  return { ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: toSheet(rows, "xlsx") }
}

function mimeOf(ext: string) {
  if (ext === "pdf") return "application/pdf"
  if (ext === "csv") return "text/csv;charset=utf-8"
  if (ext === "txt") return "text/plain;charset=utf-8"
  if (ext === "xls") return "application/vnd.ms-excel"
  if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  return "application/octet-stream"
}

function saveDownload(name: string, bytes: Uint8Array, mime: string) {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  const url = URL.createObjectURL(new Blob([copy], { type: mime }))
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

function store() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("afez-files", 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("blobs")) request.result.createObjectStore("blobs")
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function putBlob(key: string, bytes: Uint8Array) {
  return store().then((db) => new Promise<void>((resolve, reject) => {
    const tx = db.transaction("blobs", "readwrite")
    tx.objectStore("blobs").put(bytes, key)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  }))
}

function readBlob(key: string) {
  return store().then((db) => new Promise<Uint8Array | null>((resolve, reject) => {
    const request = db.transaction("blobs", "readonly").objectStore("blobs").get(key)
    request.onsuccess = () => {
      const value = request.result as ArrayBuffer | Uint8Array | undefined
      db.close()
      if (!value) resolve(null)
      else resolve(value instanceof Uint8Array ? value : new Uint8Array(value))
    }
    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  }))
}

export async function downloadSheet(file: Sheet, kind?: ExportKind) {
  if (!kind && file.blobId && !file.revised) {
    const stored = await readBlob(file.blobId).catch(() => null)
    if (stored) {
      const ext = file.ext || "bin"
      const name = file.name.includes(".") ? file.name : `${stem(file.name)}.${ext}`
      saveDownload(name, stored, mimeOf(ext))
      return
    }
  }
  const target = kind ?? (REBUILD.has(file.ext) ? file.ext : "xlsx")
  const built = await buildSheet(target, file.name, file.rows)
  saveDownload(`${stem(file.name)}.${built.ext}`, built.bytes, built.mime)
  if (!kind && !REBUILD.has(file.ext)) return "Orijinal fayl saxlanmayıb. Sətirlər Excel kimi endirildi."
}
