import test from 'node:test'
import assert from 'node:assert/strict'
import { fleetSummary } from './fleetSummary'
import type { FuelFill } from './types'
const fill = (date: string, liters: number, amount = liters * 2): FuelFill => ({ id: date, assetId: 'a', date, liters, amount, reading: 0, project: '', by: '', note: '' })
test('forecast uses completed months including inactive months and excludes current partial month', () => {
  const summary = fleetSummary([fill('2026-07-05', 300), fill('2026-09-04', 600), fill('2026-10-04', 9000)], new Date(2026, 9, 31))
  assert.equal(summary.forecast, 300)
  assert.equal(summary.sampleMonths, 3)
  assert.equal(summary.current.liters, 9000)
  assert.equal(summary.history.find(row => row.period === '2026-08')?.liters, 0)
})
test('missing or invalid history does not invent a fuel forecast', () => {
  assert.equal(fleetSummary([], new Date(2026, 9, 31)).forecast, null)
  assert.equal(fleetSummary([fill('2026-09-01', -10)], new Date(2026, 9, 31)).forecast, null)
})
