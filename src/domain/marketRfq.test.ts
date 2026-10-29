import assert from "node:assert/strict"
import test from "node:test"
import { chooseQuote, deliverOrder, openRfq, orderFromRfq, receiveOrder, seedQuotes, quoteCompareRows } from "./marketRfq"

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

test("bazadan gələn qismən təklif öz miqdarı və çatdırılma xərci ilə hesablanır", () => {
  const opened = openRfq([{productId:"arm",name:"Armatur",unit:"ton",supplier:"A",qty:300}],"Bakı","2026-11-01",[])
  assert.notEqual(typeof opened,"string")
  if(typeof opened === "string") return
  const quote = {id:"bid",supplier:"A",unitPrice:1040,qty:120,delivery:1800,deliveryDays:6,vat:"unknown" as const,note:""}
  const rfq = {...opened,quotes:[quote],status:"secilib" as const,chosenQuoteId:quote.id}
  assert.equal(quoteCompareRows(rfq)[0].total,126600)
  assert.match(String(orderFromRfq(rfq,[])), /miqdarını ödəmir/)
})
