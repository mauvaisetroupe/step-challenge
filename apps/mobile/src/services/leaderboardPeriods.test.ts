/// <reference types="node" />

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isProvisional, showsLastWeekRecap } from './leaderboardPeriods'

describe('isProvisional', () => {
  it('is provisional during the period and the two days after', () => {
    // Week of Monday 2026-10-19 to Sunday 2026-10-25.
    assert.equal(isProvisional('2026-10-25', '2026-10-25'), true)
    assert.equal(isProvisional('2026-10-25', '2026-10-26'), true)
    assert.equal(isProvisional('2026-10-25', '2026-10-27'), true)
  })

  it('is final from the third day after the period', () => {
    assert.equal(isProvisional('2026-10-25', '2026-10-28'), false)
  })

  it('crosses months and years', () => {
    assert.equal(isProvisional('2026-09-30', '2026-10-02'), true)
    assert.equal(isProvisional('2026-12-31', '2027-01-03'), false)
  })
})

describe('showsLastWeekRecap', () => {
  it('shows it from Monday to Wednesday', () => {
    // 2026-10-26 is a Monday.
    assert.equal(showsLastWeekRecap(new Date(2026, 9, 26)), true)
    assert.equal(showsLastWeekRecap(new Date(2026, 9, 27)), true)
    assert.equal(showsLastWeekRecap(new Date(2026, 9, 28)), true)
  })

  it('hides it from Thursday to Sunday', () => {
    assert.equal(showsLastWeekRecap(new Date(2026, 9, 29)), false)
    assert.equal(showsLastWeekRecap(new Date(2026, 10, 1)), false)
  })
})
