const months = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avqust",
  "sentyabr",
  "oktyabr",
  "noyabr",
  "dekabr",
]

export function money(value: number) {
  const n = Math.round(Number(value) || 0)
  const sign = n < 0 ? "−" : ""
  const body = Math.abs(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return `${sign}${body} ₼`
}

export function moneyShort(value: number) {
  const n = Number(value) || 0
  const abs = Math.abs(n)
  if (abs >= 1_000_000) {
    const v = (n / 1_000_000).toFixed(2).replace(".", ",")
    return `${v} mln ₼`
  }
  return money(n)
}

export function num(value: number, digits = 0) {
  const n = Number(value) || 0
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function monthAZ(period: string) {
  const [y, m] = period.split("-").map(Number)
  if (!y || !m || !months[m - 1]) return period
  return `${months[m - 1]} ${y}`
}

export function monthWord(period: string) {
  return monthAZ(period).split(" ")[0] || period
}

export function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return iso
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function dateAZ(iso: string) {
  if (!iso || iso === "—") return "—"
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${months[m - 1]} ${y}`
}

export function hit(query: string, ...parts: Array<string | number | undefined>) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return parts.join(" ").toLowerCase().includes(q)
}

export function nextId(prefix: string, list: { id: string }[]) {
  const n =
    list.reduce((max, item) => {
      const parsed = parseInt(String(item.id).split("-").pop() ?? "", 10)
      return Number.isFinite(parsed) ? Math.max(max, parsed) : max
    }, 0) + 1
  return `${prefix}-${String(n).padStart(3, "0")}`
}
