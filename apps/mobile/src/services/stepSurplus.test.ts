/// <reference types="node" />

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { StepSlice } from './inactivity'
import { findStepSurplus } from './stepSurplus'

const MIDNIGHT = new Date(2026, 9, 10)

/** Steps per minute of the day, from [minute, steps] pairs. */
function day(minutes: [number, number][]): StepSlice[] {
  const steps = Array<number>(1440).fill(0)

  for (const [minute, value] of minutes) {
    steps[minute] = value
  }

  return steps.map((value, minute) => ({
    start: new Date(MIDNIGHT.getTime() + minute * 60_000),
    steps: value,
  }))
}

const at = (hours: number, minutes: number) => hours * 60 + minutes

const minuteOf = (date: Date) => (date.getTime() - MIDNIGHT.getTime()) / 60_000

describe('step surplus', () => {
  it('none when the merged total is the main source', () => {
    const watch = day([[at(9, 0), 100], [at(9, 1), 110]])
    const surplus = findStepSurplus(watch, watch, [])

    assert.equal(surplus.steps, 0)
    assert.deepEqual(surplus.periods, [])
  })

  it('groups the phone-only minutes into periods', () => {
    const watch = day([[at(9, 0), 100]])
    const phone = day([
      [at(9, 0), 90],
      [at(13, 2), 50],
      [at(13, 5), 60],
      [at(13, 16), 40],
      [at(17, 40), 30],
    ])
    const merged = day([
      [at(9, 0), 100],
      [at(13, 2), 50],
      [at(13, 5), 60],
      [at(13, 16), 40],
      [at(17, 40), 30],
    ])

    const surplus = findStepSurplus(merged, watch, [
      { id: 'phone', slices: phone },
    ])

    assert.equal(surplus.steps, 180)
    assert.deepEqual(
      surplus.periods.map((period) => [
        minuteOf(period.start),
        minuteOf(period.end),
        period.steps,
        period.sources,
      ]),
      [
        // 13:05 → 13:16: a 10-minute gap, two periods.
        [at(13, 2), at(13, 6), 110, ['phone']],
        [at(13, 16), at(13, 17), 40, ['phone']],
        [at(17, 40), at(17, 41), 30, ['phone']],
      ],
    )
  })

  it('joins moments up to 5 minutes apart', () => {
    const watch = day([])
    const merged = day([[at(8, 0), 20], [at(8, 6), 20]])
    const surplus = findStepSurplus(merged, watch, [])

    assert.equal(surplus.periods.length, 1)
    assert.equal(minuteOf(surplus.periods[0].end), at(8, 7))
  })

  it('ignores minutes where the merged total is below the main source', () => {
    const watch = day([[at(10, 0), 100]])
    const merged = day([[at(10, 0), 80], [at(11, 0), 30]])
    const surplus = findStepSurplus(merged, watch, [])

    assert.equal(surplus.steps, 30)
    assert.equal(surplus.periods.length, 1)
  })
})
