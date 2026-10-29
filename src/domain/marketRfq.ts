/** CONSTRIX Market RFQ → təklif → sifariş → qəbul (ödəniş/komissiya tarifləri AÇIQ — burada yalnız proses). */

export type RfqStatus = "layihe" | "gonderilib" | "teklifler" | "secilib" | "baglanib" | "legv"
export type OrderStatus = "yaradilib" | "tesdiq" | "hazirlanir" | "catdirilib" | "qebul" | "baglanib"
export type ReceiveStatus = "gozleyir" | "qismen" | "tesdiq" | "mubahise"

export type MarketCartLine = {
  productId: string
  name: string
  unit: string
  supplier: string
  qty: number
}

export type MarketQuote = {
  id: string
  supplier: string
  unitPrice: number
  deliveryDays: number
  vat: "daxil" | "xaric" | "unknown"
  qty?: number
  delivery?: number
  note: string
}

export type MarketRfq = {
  id: string
  number: string
  status: RfqStatus
  address: string
  needBy: string
  lines: MarketCartLine[]
  quotes: MarketQuote[]
  chosenQuoteId?: string
  createdAt: string
}

export type MarketOrder = {
  id: string
  number: string
  rfqId: string
  status: OrderStatus
  supplier: string
  lines: MarketCartLine[]
  unitPrice: number
  deliveredQty: number
  receivedQty: number
  disputeQty: number
  createdAt: string
}

export function nextRfqNumber(list: { number: string }[]) {
  return `RFQ-${String(list.length + 1).padStart(3, "0")}`
}

export function nextOrderNumber(list: { number: string }[]) {
  return `PO-M-${String(list.length + 1).padStart(3, "0")}`
}

export function openRfq(lines: MarketCartLine[], address: string, needBy: string, existing: MarketRfq[]): MarketRfq | string {
  if (!lines.length) return "RFQ üçün ən azı bir məhsul seçin."
  if (!address.trim()) return "Çatdırılma ünvanı vacibdir."
  if (!needBy.trim()) return "Tələb olunan tarix vacibdir."
  return {
    id: crypto.randomUUID(),
    number: nextRfqNumber(existing),
    status: "gonderilib",
    address: address.trim(),
    needBy,
    lines: lines.map((line) => ({ ...line, qty: Number(line.qty) || 0 })).filter((line) => line.qty > 0),
    quotes: [],
    createdAt: new Date().toISOString().slice(0, 10),
  }
}

/** Demo təkliflər — təchizatçı qiymətləri bir-birinə görünmür (UI-də ayrı göstərilir). */
export function seedQuotes(rfq: MarketRfq): MarketQuote[] {
  const suppliers = [...new Set(rfq.lines.map((line) => line.supplier).filter(Boolean))]
  if (!suppliers.length) suppliers.push("Naməlum təchizatçı", "Alternativ MMC")
  while (suppliers.length < 2) suppliers.push(`Təchizatçı ${suppliers.length + 1}`)
  return suppliers.slice(0, 3).map((supplier, index) => ({
    id: crypto.randomUUID(),
    supplier,
    unitPrice: 10 + index * 1.5 + rfq.lines.length,
    deliveryDays: 3 + index * 2,
    vat: index % 2 === 0 ? "xaric" : "daxil",
    note: index === 0 ? "Anbardan" : "Sifarişlə",
  }))
}

export function chooseQuote(rfq: MarketRfq, quoteId: string): MarketRfq | string {
  if (rfq.status === "baglanib" || rfq.status === "legv") return "Bu RFQ bağlıdır."
  if (!rfq.quotes.some((item) => item.id === quoteId)) return "Təklif tapılmadı."
  return { ...rfq, status: "secilib", chosenQuoteId: quoteId }
}

export function orderFromRfq(rfq: MarketRfq, existing: MarketOrder[]): MarketOrder | string {
  if (rfq.status !== "secilib" || !rfq.chosenQuoteId) return "Əvvəl təklif seçilməlidir."
  const quote = rfq.quotes.find((item) => item.id === rfq.chosenQuoteId)
  if (!quote) return "Seçilmiş təklif tapılmadı."
  if (quote.qty !== undefined && quote.qty < rfq.lines.reduce((sum, line) => sum + line.qty, 0)) return "Seçilmiş təklif bütün sifariş miqdarını ödəmir."
  return {
    id: crypto.randomUUID(),
    number: nextOrderNumber(existing),
    rfqId: rfq.id,
    status: "tesdiq",
    supplier: quote.supplier,
    lines: rfq.lines,
    unitPrice: quote.unitPrice,
    deliveredQty: 0,
    receivedQty: 0,
    disputeQty: 0,
    createdAt: new Date().toISOString().slice(0, 10),
  }
}

export function deliverOrder(order: MarketOrder, qty: number): MarketOrder | string {
  const total = order.lines.reduce((sum, line) => sum + line.qty, 0)
  const next = Math.min(total, Math.max(0, order.deliveredQty + qty))
  if (!(qty > 0)) return "Çatdırılma miqdarı müsbət olmalıdır."
  return {
    ...order,
    deliveredQty: next,
    status: next + 1e-9 >= total ? "catdirilib" : "hazirlanir",
  }
}

export function receiveOrder(order: MarketOrder, accept: number, dispute: number): MarketOrder | string {
  const left = Math.max(0, order.deliveredQty - order.receivedQty - order.disputeQty)
  if (accept + dispute > left + 1e-9) return `Qəbul+mübahisə ən çox ${left} ola bilər.`
  if (!(accept > 0) && !(dispute > 0)) return "Qəbul və ya mübahisə miqdarı yazın."
  const receivedQty = order.receivedQty + accept
  const disputeQty = order.disputeQty + dispute
  const done = receivedQty + disputeQty + 1e-9 >= order.deliveredQty
  return {
    ...order,
    receivedQty,
    disputeQty,
    status: done ? (disputeQty > 0 ? "qebul" : "baglanib") : "qebul",
  }
}

export function quoteCompareRows(rfq: MarketRfq) {
  const qty = rfq.lines.reduce((sum, line) => sum + line.qty, 0) || 1
  return rfq.quotes.map((quote) => ({
    ...quote,
    total: Math.round((quote.unitPrice * (quote.qty ?? qty) + (quote.delivery ?? 0)) * 100) / 100,
    chosen: quote.id === rfq.chosenQuoteId,
  }))
}
