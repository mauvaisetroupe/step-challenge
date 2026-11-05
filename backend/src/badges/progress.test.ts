import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { addDays } from './dates.js'
import type { DayRecord } from './evaluate.js'
import { currentProgress } from './progress.js'

function history(start: string, steps: number[]): DayRecord[] {
  return steps.map((daySteps, index) => ({
    date: addDays(start, index),
    steps: daySteps,
    activeMinutes: null,
    veryActiveMinutes: null,
    inactiveMinutes: null,
  }))
}

function find(start: string, steps: number[], today: string, badgeId: string) {
  return currentProgress(history(start, steps), today).find(
    (progress) => progress.badgeId === badgeId,
  )
}

describe('currentProgress', () => {
  it('sums the steps of the current week and month', () => {
    // Wednesday 2026-11-04: Monday and Tuesday of the week, and Sunday 1st.
    const steps = [9_000, 12_000, 8_000, 0]

    assert.deepEqual(find('2026-11-01', steps, '2026-11-04', 'week.70000'), {
      badgeId: 'week.70000',
      occurrence: '2026-W45',
      value: 20_000,
      target: 70_000,
    })
    assert.equal(find('2026-11-01', steps, '2026-11-04', 'month.300000')?.value, 29_000)
    assert.equal(find('2026-11-01', steps, '2026-11-04', 'month.regular')?.value, 1)
  })

  it('caps the value at the target', () => {
    assert.equal(
      find('2026-11-02', Array(7).fill(20_000), '2026-11-08', 'week.100000')?.value,
      100_000,
    )
  })

  it('shows the perfect month while every finished day is successful', () => {
    const today = '2026-11-04'

    assert.deepEqual(
      find('2026-11-01', [10_000, 11_000, 12_000, 3_000], today, 'month.perfect'),
      { badgeId: 'month.perfect', occurrence: '2026-11', value: 3, target: 30 },
    )
    assert.equal(find('2026-11-01', [10_000, 9_000, 12_000], today, 'month.perfect'), undefined)
    assert.equal(find('2026-11-02', [10_000, 12_000], today, 'month.perfect'), undefined)
  })

  it('follows the challenge of the month', () => {
    // November 2026: 3 days at 20 000.
    assert.deepEqual(
      find('2026-11-01', [20_000, 25_000, 5_000], '2026-11-03', 'month.challenge'),
      { badgeId: 'month.challenge', occurrence: '2026-11', value: 2, target: 3 },
    )
  })
})
