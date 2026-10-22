import { roundMoney, roundQty } from "./ops"
import type { Act, Smeta, SmetaLine } from "./types"

export type NakopitelRow = {
  id: string
  kind: "work" | "house" | "section" | "sectionTotal"
  houseNo: string
  section: string
  code: string
  name: string
  unit: string
  smetaQty: number
  unitPrice: number
  smetaValue: number
  priorQty: number
  priorValue: number
  periodQty: number
  periodValue: number
  cumulativeQty: number
  cumulativeValue: number
  remainQty: number
  remainValue: number
}

function lineKind(line: SmetaLine) {
  return line.kind || "work"
}

function workLines(smeta: Smeta) {
  return smeta.lines.filter((line) => lineKind(line) === "work")
}

export function nakopitelBook(smeta: Smeta, acts: Act[], period: string): NakopitelRow[] {
  const projectActs = acts
    .filter((act) => act.projectId === smeta.projectId && act.status !== "qaralama")
    .slice()
    .sort((a, b) => a.period.localeCompare(b.period) || a.date.localeCompare(b.date))
  const periodActs = projectActs.filter((act) => act.period === period)
  const priorActs = projectActs.filter((act) => act.period < period)

  function qtyOf(list: Act[], smetaLineId: string) {
    return roundQty(list.reduce((sum, act) => {
      const row = act.lines.find((line) => line.smetaLineId === smetaLineId)
      return sum + (row?.qty || 0)
    }, 0))
  }

  const rows: NakopitelRow[] = []
  let sectionWork: NakopitelRow[] = []

  function flushSection() {
    if (!sectionWork.length) return
    const first = sectionWork[0]
    rows.push({
      id: `sec-total-${first.houseNo}-${first.section}`,
      kind: "sectionTotal",
      houseNo: first.houseNo,
      section: first.section,
      code: "",
      name: `${first.section.split(". ")[1] || first.section} üzrə cəmi (manat)`,
      unit: "",
      smetaQty: 0,
      unitPrice: 0,
      smetaValue: roundMoney(sectionWork.reduce((s, r) => s + r.smetaValue, 0)),
      priorQty: 0,
      priorValue: roundMoney(sectionWork.reduce((s, r) => s + r.priorValue, 0)),
      periodQty: 0,
      periodValue: roundMoney(sectionWork.reduce((s, r) => s + r.periodValue, 0)),
      cumulativeQty: 0,
      cumulativeValue: roundMoney(sectionWork.reduce((s, r) => s + r.cumulativeValue, 0)),
      remainQty: 0,
      remainValue: roundMoney(sectionWork.reduce((s, r) => s + r.remainValue, 0)),
    })
    sectionWork = []
  }

  for (const line of smeta.lines) {
    const kind = lineKind(line)
    if (kind === "house") {
      flushSection()
      rows.push({
        id: line.id,
        kind: "house",
        houseNo: line.houseNo || "",
        section: "",
        code: "",
        name: line.name,
        unit: "",
        smetaQty: 0,
        unitPrice: 0,
        smetaValue: 0,
        priorQty: 0,
        priorValue: 0,
        periodQty: 0,
        periodValue: 0,
        cumulativeQty: 0,
        cumulativeValue: 0,
        remainQty: 0,
        remainValue: 0,
      })
      continue
    }
    if (kind === "section") {
      flushSection()
      rows.push({
        id: line.id,
        kind: "section",
        houseNo: line.houseNo || "",
        section: line.section || line.name,
        code: "",
        name: line.name,
        unit: "",
        smetaQty: 0,
        unitPrice: 0,
        smetaValue: 0,
        priorQty: 0,
        priorValue: 0,
        periodQty: 0,
        periodValue: 0,
        cumulativeQty: 0,
        cumulativeValue: 0,
        remainQty: 0,
        remainValue: 0,
      })
      continue
    }

    const priorQty = qtyOf(priorActs, line.id)
    const periodQty = qtyOf(periodActs, line.id)
    const cumulativeQty = roundQty(priorQty + periodQty)
    const remainQty = roundQty(Math.max(0, line.qty - cumulativeQty))
    const row: NakopitelRow = {
      id: line.id,
      kind: "work",
      houseNo: line.houseNo || "",
      section: line.section || "",
      code: line.code,
      name: line.name,
      unit: line.unit,
      smetaQty: line.qty,
      unitPrice: line.unitPrice,
      smetaValue: roundMoney(line.qty * line.unitPrice),
      priorQty,
      priorValue: roundMoney(priorQty * line.unitPrice),
      periodQty,
      periodValue: roundMoney(periodQty * line.unitPrice),
      cumulativeQty,
      cumulativeValue: roundMoney(cumulativeQty * line.unitPrice),
      remainQty,
      remainValue: roundMoney(remainQty * line.unitPrice),
    }
    rows.push(row)
    sectionWork.push(row)
  }
  flushSection()
  return rows
}

export function nakopitelTotals(rows: NakopitelRow[]) {
  const works = rows.filter((row) => row.kind === "work")
  return {
    smetaValue: roundMoney(works.reduce((s, r) => s + r.smetaValue, 0)),
    priorValue: roundMoney(works.reduce((s, r) => s + r.priorValue, 0)),
    periodValue: roundMoney(works.reduce((s, r) => s + r.periodValue, 0)),
    cumulativeValue: roundMoney(works.reduce((s, r) => s + r.cumulativeValue, 0)),
    remainValue: roundMoney(works.reduce((s, r) => s + r.remainValue, 0)),
    houses: new Set(works.map((r) => r.houseNo).filter(Boolean)).size,
    works: works.length,
  }
}

export function workSmetaLines(smeta: Smeta) {
  return workLines(smeta)
}
