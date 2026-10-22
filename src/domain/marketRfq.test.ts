import assert from "node:assert/strict"
import test from "node:test"
import { chooseQuote, deliverOrder, openRfq, orderFromRfq, receiveOrder, seedQuotes } from "./marketRfq"

test("RFQ → təklif → sifariş → qəbul axını", () => {
  const opened = openRfq(
    [{ productId: "1", name: "Sement", unit: "kisə", supplier: "A MMC", qty: 100 }],
    "Bakı",
    "2026-11-01",
    [],
  )
  assert.equal(typeof opened, "object")
  if (typeof opened === "string") return
  const rfq = { ...opened, quotes: seedQuotes(opened), status: "teklifler" as const }
  assert.ok(rfq.quotes.length >= 2)
  const chosen = chooseQuote(rfq, rfq.quotes[0].id)
  assert.equal(typeof chosen, "object")
  if (typeof chosen === "string") return
  const order = orderFromRfq(chosen, [])
  assert.equal(typeof order, "object")
  if (typeof order === "string") return
  const shipped = deliverOrder(order, 100)
  assert.equal(typeof shipped, "object")
  if (typeof shipped === "string") return
  const done = receiveOrder(shipped, 95, 5)
  assert.equal(typeof done, "object")
  if (typeof done === "string") return
  assert.equal(done.receivedQty, 95)
  assert.equal(done.disputeQty, 5)
})

test("təklifsiz sifariş açılmır", () => {
  const opened = openRfq(
    [{ productId: "1", name: "Sement", unit: "kisə", supplier: "A", qty: 10 }],
    "Bakı",
    "2026-11-01",
    [],
  )
  assert.equal(typeof opened, "object")
  if (typeof opened === "string") return
  assert.match(String(orderFromRfq(opened, [])), /təklif/)
})
