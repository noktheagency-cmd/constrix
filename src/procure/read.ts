import { emptyExtract, parseDocxXml, parseUpload, rowsFromPlainText, scanBytes, type Extracted } from "./engine"

const IMAGE: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
}

function u16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function u32(bytes: Uint8Array, offset: number) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
}

function blobBytes(bytes: Uint8Array) {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

async function inflateRaw(data: Uint8Array) {
  if (typeof DecompressionStream === "function") {
    const stream = new Blob([blobBytes(data)]).stream().pipeThrough(new DecompressionStream("deflate-raw"))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  }
  const { inflateRawSync } = await import("node:zlib")
  return new Uint8Array(inflateRawSync(data))
}

export async function zipText(bytes: Uint8Array, entryName: string) {
  let eocd = -1
  const from = Math.max(0, bytes.length - 22 - 65535)
  for (let index = bytes.length - 22; index >= from; index -= 1) {
    if (bytes[index] === 0x50 && bytes[index + 1] === 0x4b && bytes[index + 2] === 0x05 && bytes[index + 3] === 0x06) {
      eocd = index
      break
    }
  }
  if (eocd < 0) return null
  const count = u16(bytes, eocd + 10)
  let ptr = u32(bytes, eocd + 16)
  for (let index = 0; index < count; index += 1) {
    if (u32(bytes, ptr) !== 0x02014b50) return null
    const method = u16(bytes, ptr + 10)
    const size = u32(bytes, ptr + 20)
    const nameLen = u16(bytes, ptr + 28)
    const extraLen = u16(bytes, ptr + 30)
    const commentLen = u16(bytes, ptr + 32)
    const local = u32(bytes, ptr + 42)
    const name = new TextDecoder().decode(bytes.slice(ptr + 46, ptr + 46 + nameLen)).replace(/\\/g, "/")
    ptr += 46 + nameLen + extraLen + commentLen
    if (name !== entryName) continue
    const dataAt = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28)
    const packed = bytes.slice(dataAt, dataAt + size)
    const raw = method === 0 ? packed : await inflateRaw(packed)
    return new TextDecoder().decode(raw)
  }
  return null
}

function jpegChunks(bytes: Uint8Array) {
  const chunks: Uint8Array[] = []
  for (let index = 0; index < bytes.length - 1; index += 1) {
    if (bytes[index] !== 0xff || bytes[index + 1] !== 0xd8) continue
    const end = bytes.indexOf(0xd9, index + 2)
    if (end > index && bytes[end - 1] === 0xff && end - index > 800) {
      chunks.push(bytes.slice(index, end + 1))
      index = end
    }
  }
  chunks.sort((a, b) => b.length - a.length)
  return chunks.slice(0, 3)
}

async function ocrBytes(bytes: Uint8Array, mime: string) {
  const { createWorker } = await import("tesseract.js")
  const worker = await createWorker("eng")
  try {
    const result = await worker.recognize(new Blob([blobBytes(bytes)], { type: mime }))
    return result.data.text || ""
  } finally {
    await worker.terminate()
  }
}

function pdfPlain(bytes: Uint8Array) {
  const raw = new TextDecoder("latin1").decode(bytes)
  const found: string[] = []
  const re = /\(((?:\\\)|[^)]){2,240})\)/g
  let match = re.exec(raw)
  while (match) {
    const value = match[1].replace(/\\[()\\nrt]/g, (item) => (item === "\\n" || item === "\\r" ? "\n" : item.slice(1))).trim()
    if (/[A-Za-zƏəĞğİıÖöŞşÜüÇç]/.test(value)) found.push(value)
    match = re.exec(raw)
  }
  return found.join("\n")
}

export async function documentText(name: string, bytes: Uint8Array) {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  if (ext === "txt" || ext === "csv") return new TextDecoder().decode(bytes)
  if (ext === "docx") {
    const xml = await zipText(bytes, "word/document.xml")
    if (!xml) return ""
    return xml.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()
  }
  if (ext === "pdf") return pdfPlain(bytes)
  return new TextDecoder().decode(bytes)
}

function useful(rows: Omit<Extracted, "id">[]) {
  return rows.some((row) => row.width || row.height || row.profile || (row.name && !row.flags.includes("oxunmadi")))
}

export async function readProjectFile(name: string, bytes: Uint8Array) {
  const scan = scanBytes(name, bytes)
  const fallback = name.replace(/\.[^.]+$/, "")
  if (!scan.ok) return { scan, rows: [] as Omit<Extracted, "id">[] }
  if (scan.ext === "docx") {
    const xml = await zipText(bytes, "word/document.xml")
    return { scan, rows: xml ? parseDocxXml(xml, fallback) : [emptyExtract(fallback)] }
  }
  if (IMAGE[scan.ext]) {
    try {
      const text = await ocrBytes(bytes, IMAGE[scan.ext])
      return { scan: { ...scan, note: "Skan oxundu. Ölçü təsdiqdən əvvəl hesaba düşmür." }, rows: rowsFromPlainText(text, fallback) }
    } catch {
      return { scan: { ...scan, note: "Skan oxunmadı. Sətir əl ilə yazılmalıdır." }, rows: [emptyExtract(fallback)] }
    }
  }
  const parsed = parseUpload(name, bytes)
  if (scan.ext === "pdf" && !useful(parsed.rows)) {
    const images = jpegChunks(bytes)
    for (const image of images) {
      try {
        const text = await ocrBytes(image, "image/jpeg")
        const rows = rowsFromPlainText(text, fallback)
        if (useful(rows)) return { scan: { ...parsed.scan, note: "PDF skanı oxundu. Ölçü təsdiqdən əvvəl hesaba düşmür." }, rows }
      } catch {
        return { scan: parsed.scan, rows: parsed.rows }
      }
    }
  }
  return parsed
}
