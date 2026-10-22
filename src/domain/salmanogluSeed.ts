import { salmanogluSample } from "./salmanogluSample"
import type { Act, Contract, Project, PurchaseAct, Smeta, SmetaLine, SmetaLineKind } from "./types"

type SampleSmetaLine = {
  sort: number
  kind: SmetaLineKind
  houseNo: string
  section: string
  code: string
  name: string
  unit: string
  qty: number
  unitPrice: number
}

type SampleApril = { code: string; houseNo: string; name: string; qty: number }

const MONTHS: Record<string, string> = {
  yanvar: "01",
  fevral: "02",
  mart: "03",
  aprel: "04",
  may: "05",
  iyun: "06",
  iyul: "07",
  avqust: "08",
  sentyabr: "09",
  oktyabr: "10",
  noyabr: "11",
  dekabr: "12",
}

function sheetDate(sheet: string, label: string) {
  const fromSheet = sheet.match(/^(\d{2})\.(\d{2})\.(\d{2,4})/)
  if (fromSheet) {
    const year = fromSheet[3].length === 2 ? `20${fromSheet[3]}` : fromSheet[3]
    return `${year}-${fromSheet[2]}-${fromSheet[1]}`
  }
  const lower = label.toLowerCase()
  const day = lower.match(/(\d{1,2})\s/)
  const year = lower.match(/(20\d{2})/)
  for (const [name, mm] of Object.entries(MONTHS)) {
    if (lower.includes(name)) {
      return `${year?.[1] || "2025"}-${mm}-${String(day?.[1] || "01").padStart(2, "0")}`
    }
  }
  return "2025-12-10"
}

export function buildSalmanogluBundle() {
  const meta = salmanogluSample.project
  const sampleLines = salmanogluSample.smetaLines as unknown as SampleSmetaLine[]
  const aprilAct = salmanogluSample.aprilAct as unknown as SampleApril[]
  const project: Project = {
    id: meta.id,
    name: meta.name,
    client: meta.client,
    district: "Xocalı",
    city: "Xocalı",
    address: "Təzəbinə kəndi",
    phase: "Tamamlama",
    progress: 18,
    budget: Math.round(
      sampleLines
        .filter((line) => line.kind === "work")
        .reduce((sum, line) => sum + line.qty * line.unitPrice, 0),
    ),
    spent: 0,
    start: "2025-12-12",
    end: "2026-09-30",
    manager: "Tapdıq",
    crew: 40,
    status: "aktiv",
    type: "Yaşayış",
    floors: 1,
    area: 7200,
    phases: [
      { name: "Torpaq", done: true },
      { name: "Bünövrə", done: true },
      { name: "Karkas", done: true },
      { name: "Fasad", done: true },
      { name: "Tamamlama", current: true },
      { name: "Təhvil" },
    ],
    notes: [
      { id: "PN-XOCA-1", date: "2026-04-30", text: "Aprel Forma-2 təhvilə hazırlandı (nümunə: 2 ev)." },
    ],
    smetaId: `SM-${meta.id}`,
  }

  const lines: SmetaLine[] = sampleLines.map((line, index) => {
    const kind = line.kind
    const isWork = kind === "work"
    const april = isWork
      ? aprilAct.find((row) => row.houseNo === line.houseNo && row.code === line.code && row.name === line.name)
        || aprilAct.find((row) => row.houseNo === line.houseNo && row.code === line.code)
      : undefined
    const periodQty = april?.qty || 0
    return {
      id: `SL-${meta.id}-${index + 1}`,
      code: line.code,
      name: line.name,
      unit: line.unit,
      qty: line.qty,
      unitPrice: line.unitPrice,
      doneQty: periodQty,
      billedQty: periodQty,
      laborHours: 0,
      recipe: "",
      kind,
      houseNo: line.houseNo,
      section: line.section,
    }
  })

  const smeta: Smeta = {
    id: `SM-${meta.id}`,
    projectId: meta.id,
    version: 1,
    status: "razilasma",
    lines,
  }

  const contract: Contract = {
    id: `MQ-${meta.id.slice(4)}`,
    projectId: meta.id,
    client: meta.client,
    number: meta.contractNumber,
    signed: meta.contractSigned,
    value: project.budget,
    advancePct: 15,
    retentionPct: 5,
    vat: 0.18,
    schedule: [
      { id: "1", title: "Avans", due: meta.contractSigned, share: 0.15, status: "odenilib" },
      { id: "2", title: "Aprel aktı", due: "2026-04-30", share: 0.25, status: "gonderilib" },
      { id: "3", title: "Yekun", due: project.end, share: 0.6, status: "gozleyir" },
    ],
  }

  const actLines = lines
    .filter((line) => (line.kind || "work") === "work" && line.billedQty > 0)
    .map((line) => ({
      smetaLineId: line.id,
      code: line.code,
      name: line.name,
      unit: line.unit,
      unitPrice: line.unitPrice,
      qty: line.billedQty,
      cumulativeQty: line.billedQty,
    }))
  const net = Math.round(actLines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0))
  const vat = Math.round(net * 0.18)
  const act: Act = {
    id: "AKT-XOCA-APR",
    number: "AKT № 1",
    projectId: meta.id,
    project: project.name,
    client: project.client,
    contractNumber: contract.number,
    period: "2026-04",
    date: "2026-04-30",
    lines: actLines,
    net,
    vat,
    gross: net + vat,
    status: "tesdiq",
  }

  const purchaseActs: PurchaseAct[] = salmanogluSample.purchaseActs.map((raw, index) => {
    const date = sheetDate(raw.sheet, raw.dateLabel)
    const lines = raw.lines.map((line, lineIndex) => ({
      id: `PAL-${index + 1}-${lineIndex + 1}`,
      materialName: line.materialName,
      unit: line.unit,
      qty: line.qty,
      unitPrice: line.unitPrice,
      amount: line.amount,
      cashPaid: line.cashPaid ?? null,
      firmName: line.firmName,
      note: line.note,
      sender: line.sender,
    }))
    return {
      id: `PA-${String(index + 1).padStart(3, "0")}`,
      number: `AA-${String(index + 1).padStart(3, "0")}`,
      projectId: undefined,
      project: "",
      objectName: raw.objectName,
      person: raw.person,
      date,
      status: "tesdiq" as const,
      net: raw.total,
      note: raw.sheet,
      lines,
      adjustments: [],
    }
  })

  if (salmanogluSample.adjustments.length) {
    purchaseActs.push({
      id: "PA-ELAVE",
      number: "AA-ELAVE",
      project: "",
      objectName: "Akta əlavə · Fortis Group",
      person: "Sakit",
      date: "2026-02-11",
      status: "qaralama",
      net: salmanogluSample.adjustments.reduce((sum, row) => sum + row.diffAmount, 0),
      note: "Qiymət fərqi əlavəsi",
      lines: [],
      adjustments: salmanogluSample.adjustments.map((row, index) => ({
        id: `PAA-${index + 1}`,
        materialName: row.materialName,
        unit: row.unit,
        qty: row.qty,
        unitPrice: row.unitPrice,
        amount: row.amount,
        diff: row.diff,
        diffAmount: row.diffAmount,
        actLabel: row.actLabel,
      })),
    })
  }

  return { project, smeta, contract, act, purchaseActs }
}
