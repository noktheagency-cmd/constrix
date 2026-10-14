import assert from "node:assert/strict"
import test from "node:test"
import { costBreakdown, gearCost, laborQuote, liveRules, regionMaterial, rulesForMethod, seedRules } from "./smeta"

test("material üsulu işçilik və texnikanı bağlayır", () => {
  const rules = rulesForMethod(seedRules({ method: "material" }), "material")
  const parts = costBreakdown({
    lines: [{ qty: "1", material: "1000", labor: "400", confirmed: true }],
    rules,
    gear: [{ name: "Ekskavator", count: "1", insurance: "0", basis: "saat", rate: "100", span: "1" }],
    profit: "0",
    vat: "18",
  })
  assert.equal(parts.length, 13)
  assert.equal(parts.find((part) => part.key === "material")?.on, true)
  assert.equal(parts.find((part) => part.key === "iscilik")?.on, false)
  assert.equal(parts.find((part) => part.key === "texnika")?.on, false)
  assert.equal(parts.find((part) => part.key === "vergi")?.on, true)
  assert.equal(parts.find((part) => part.key === "iscilik")?.amount, 400)
  assert.equal(parts.find((part) => part.key === "material")?.amount, 1000)
})

test("Qarabağ alüminiumu Bakı bazasından yuxarıdır", () => {
  const baku = regionMaterial("Alüminium", "Bakı və Abşeron")
  const qarabag = regionMaterial("Alüminium", "Qarabağ və Şərqi Zəngəzur")
  assert.equal(baku?.price, 12)
  assert.ok((qarabag?.price ?? 0) > 12)
})

test("betonçu gün və fasad ustası vahid tarif alır", () => {
  const daily = laborQuote("Betonçu", "Gəncə-Qazax", "murakkeb", "gun")
  const unit = laborQuote("Fasad ustası", "Bakı və Abşeron", "orta", "vahid")
  assert.equal(daily?.basis, "gun")
  assert.ok((daily?.amount ?? 0) > 0)
  assert.equal(unit?.basis, "vahid")
  assert.ok((unit?.amount ?? 0) > 0)
})

test("adlı əlavə xərc on üç sətirdə qalır, bağlanan işçilik açılmır", () => {
  const rules = liveRules({
    method: "tam",
    extras: [{ name: "Köməkçi material", amount: "50" }],
    rules: seedRules({ method: "material" }),
  })
  const helper = rules.find((rule) => rule.key === "komekci")
  assert.equal(helper?.mode, "mebleg")
  assert.equal(helper?.value, "50")
  assert.equal(rules.find((rule) => rule.key === "iscilik")?.on, false)
})

test("ekskavator saatı yanacaq və operatorla cəmlənir", () => {
  const cost = gearCost({ name: "Ekskavator", basis: "saat", rate: "80", span: "6", fuel: "40", operator: "15", minSpan: "4", insurance: "20", count: "1" })
  assert.equal(cost.used, 6)
  assert.equal(cost.total, 20 + 6 * (80 + 40 + 15))
})
