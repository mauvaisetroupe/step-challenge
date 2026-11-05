import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  addDays,
  dayOfWeek,
  monthEnd,
  nextMonth,
  weekKey,
  weekStart,
} from './dates.js'

describe('dates', () => {
  it('adds days across months and years', () => {
    assert.equal(addDays('2026-10-31', 1), '2026-11-01')
    assert.equal(addDays('2027-01-01', -1), '2026-12-31')
  })

  it('starts weeks on Monday', () => {
    assert.equal(dayOfWeek('2026-11-02'), 0)
    assert.equal(dayOfWeek('2026-11-08'), 6)
    assert.equal(weekStart('2026-11-08'), '2026-11-02')
  })

  it('names ISO weeks after the year of their Thursday', () => {
    assert.equal(weekKey('2026-11-02'), '2026-W45')
    assert.equal(weekKey('2026-01-01'), '2026-W01')
    assert.equal(weekKey('2027-01-01'), '2026-W53')
  })

  it('finds the last day of a month', () => {
    assert.equal(monthEnd('2028-02'), '2028-02-29')
    assert.equal(monthEnd('2026-12'), '2026-12-31')
    assert.equal(nextMonth('2026-12'), '2027-01')
  })
})
