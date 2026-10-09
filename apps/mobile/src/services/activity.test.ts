/// <reference types="node" />

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import fixtures from '../../modules/step-sync/test-fixtures/activity-days.json'
import { summarizeDayActivity } from './activity'
import { findInactivePeriods, type StepSlice } from './inactivity'

/**
 * The shared fixtures (ADR 0010): the Kotlin worker must give the same
 * results, see modules/step-sync/android/src/test.
 */

const MIDNIGHT = new Date(2026, 9, 8)

function toSlices(runs: number[][]): StepSlice[] {
  return runs
    .flatMap(([minutes, steps]) => Array<number>(minutes).fill(steps))
    .map((steps, minute) => ({
      start: new Date(MIDNIGHT.getTime() + minute * 60_000),
      steps,
    }))
}

const minuteOf = (date: Date) => (date.getTime() - MIDNIGHT.getTime()) / 60_000

describe('activity minutes (shared fixtures)', () => {
  for (const day of fixtures.days) {
    it(day.name, () => {
      const slices = toSlices(day.runs)
      const sleepHours = 'sleepHours' in day ? day.sleepHours : undefined
      const periods = findInactivePeriods(slices, sleepHours)
      const { score, ...minutes } = summarizeDayActivity(slices, periods)

      assert.equal(slices.length, 1440, 'a fixture day lasts 1440 minutes')
      assert.deepEqual(
        periods.map((period) => [minuteOf(period.start), minuteOf(period.end)]),
        day.expected.inactivePeriods,
      )
      assert.deepEqual(minutes, {
        activeMinutes: day.expected.activeMinutes,
        veryActiveMinutes: day.expected.veryActiveMinutes,
        inactiveMinutes: day.expected.inactiveMinutes,
      })
      assert.equal(score, minutes.activeMinutes + 2 * minutes.veryActiveMinutes)
    })
  }
})
