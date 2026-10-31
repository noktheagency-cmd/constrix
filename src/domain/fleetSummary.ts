import type { FuelFill } from './types'

export function fleetSummary(fills: FuelFill[], now = new Date()) {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const history = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1)
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const rows = fills.filter(fill => fill.date.slice(0, 7) === period && Number.isFinite(fill.liters) && fill.liters >= 0 && Number.isFinite(fill.amount) && fill.amount >= 0)
    return { period, liters: Math.round(rows.reduce((sum, row) => sum + row.liters, 0) * 100) / 100, amount: Math.round(rows.reduce((sum, row) => sum + row.amount, 0) * 100) / 100, count: rows.length }
  })
  const completed = history.filter(row => row.period < month)
  // Include inactive months after the first observation; exclude the incomplete current month.
  const first = completed.findIndex(row => row.count > 0)
  const observed = first < 0 ? [] : completed.slice(first)
  const forecast = observed.length ? Math.round(observed.reduce((sum, row) => sum + row.liters, 0) / observed.length * 100) / 100 : null
  return { history, current: history[5], forecast, sampleMonths: observed.length }
}
