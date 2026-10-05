import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { MAX_DAILY_STEPS } from '../routes/meSteps.js'
import {
  dailySteps,
  dayProgress,
  DEMO_FRIENDS,
  lastDates,
} from './demoData.js'

const profile = { base: 9_000, weekend: 1.2 }

describe('dailySteps', () => {
  it('is stable for a person and a date', () => {
    assert.equal(
      dailySteps('alice', profile, '2026-10-05'),
      dailySteps('alice', profile, '2026-10-05'),
    )
  })

  it('stays credible over a year of days', () => {
    const values = lastDates('2026-10-05', 365).map((date) =>
      dailySteps('alice', profile, date),
    )

    for (const value of values) {
      assert.ok(Number.isInteger(value))
      assert.ok(value >= 500 && value <= MAX_DAILY_STEPS, `${value}`)
    }

    const average = values.reduce((sum, value) => sum + value, 0) / 365

    assert.ok(average > 6_000 && average < 13_000, `average ${average}`)
    // Days vary: not a flat line.
    assert.ok(new Set(values).size > 300)
  })

  it('follows the weekend habit of the profile', () => {
    const dates = lastDates('2026-10-04', 364)
    const averageOf = (weekend: boolean, factor: number) => {
      const days = dates.filter((date) => {
        const day = new Date(`${date}T00:00:00Z`).getUTCDay()
        return (day === 0 || day === 6) === weekend
      })

      return (
        days.reduce(
          (sum, date) =>
            sum + dailySteps('bob', { base: 9_000, weekend: factor }, date),
          0,
        ) / days.length
      )
    }

    assert.ok(averageOf(true, 1.5) > averageOf(false, 1.5))
    assert.ok(averageOf(true, 0.7) < averageOf(false, 0.7))
  })

  it('differs from one person to another', () => {
    const date = '2026-10-05'
    const values = new Set(
      DEMO_FRIENDS.map((friend) => dailySteps(friend.id, friend, date)),
    )

    assert.equal(values.size, DEMO_FRIENDS.length)
  })
})

describe('dayProgress', () => {
  const at = (hours: number, minutes = 0) =>
    dayProgress(new Date(2026, 9, 5, hours, minutes))

  it('grows during the day, from almost nothing to the full day', () => {
    assert.equal(at(3), 0.05)
    assert.ok(at(12) > at(9))
    assert.equal(at(22), 1)
    assert.equal(at(23, 30), 1)
  })
})

describe('lastDates', () => {
  it('lists the days ending with today, across months', () => {
    assert.deepEqual(lastDates('2026-03-02', 4), [
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ])
  })
})

describe('DEMO_FRIENDS', () => {
  it('have distinct ids and names', () => {
    assert.equal(
      new Set(DEMO_FRIENDS.map((friend) => friend.id)).size,
      DEMO_FRIENDS.length,
    )
    assert.equal(
      new Set(DEMO_FRIENDS.map((friend) => friend.name)).size,
      DEMO_FRIENDS.length,
    )
  })
})
