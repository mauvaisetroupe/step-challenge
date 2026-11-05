import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { challengeOfMonth, MONTHLY_CHALLENGES } from './catalogue.js'
import { addDays } from './dates.js'
import {
  evaluateBadges,
  finalPeriods,
  rankingAwards,
  type Award,
  type DayRecord,
  type EvaluationContext,
} from './evaluate.js'

/** Consecutive days from `start`, without activity minutes. */
function history(start: string, steps: number[]): DayRecord[] {
  return steps.map((daySteps, index) => ({
    date: addDays(start, index),
    steps: daySteps,
    activeMinutes: null,
    veryActiveMinutes: null,
    inactiveMinutes: null,
  }))
}

function withMinutes(
  day: DayRecord,
  active: number,
  veryActive: number,
  inactive: number,
): DayRecord {
  return {
    ...day,
    activeMinutes: active,
    veryActiveMinutes: veryActive,
    inactiveMinutes: inactive,
  }
}

const LATER: EvaluationContext = { today: '2030-01-01', periodsFrom: '2026-01' }

function ids(awards: Award[], prefix = '') {
  return awards
    .filter((award) => award.badgeId.startsWith(prefix))
    .map((award) =>
      award.occurrence ? `${award.badgeId} ${award.occurrence}` : award.badgeId,
    )
    .sort()
}

function find(awards: Award[], badgeId: string, occurrence = '') {
  return awards.find(
    (award) => award.badgeId === badgeId && award.occurrence === occurrence,
  )
}

describe('evaluateBadges', () => {
  it('awards every day threshold reached, with its points', () => {
    const awards = evaluateBadges(
      history('2026-03-02', [12_000, 21_000, 16_000]),
      LATER,
    )

    assert.deepEqual(ids(awards, 'day.'), ['day.15000', 'day.20000'])
    assert.deepEqual(find(awards, 'day.20000'), {
      badgeId: 'day.20000',
      occurrence: '',
      points: 1,
      earnedOn: '2026-03-03',
    })
  })

  it('awards the total on the day it is reached', () => {
    const awards = evaluateBadges(
      history('2026-01-01', Array(100).fill(10_000)),
      LATER,
    )

    assert.equal(find(awards, 'total.1000000')?.earnedOn, '2026-04-10')
    assert.equal(find(awards, 'total.2500000'), undefined)
  })

  it('awards streak milestones once, and every block of 30 and 60 days', () => {
    const awards = evaluateBadges(
      history('2026-01-01', Array(61).fill(10_000)),
      LATER,
    )

    assert.deepEqual(ids(awards, 'streak.'), [
      'streak.14',
      'streak.30',
      'streak.60',
      'streak.7',
      'streak.every30 #1',
      'streak.every30 #2',
      'streak.every60 #1',
    ])
    assert.equal(find(awards, 'streak.every30', '#2')?.earnedOn, '2026-03-01')
    assert.equal(find(awards, 'streak.every30', '#2')?.points, 3)
    assert.equal(find(awards, 'streak.every60', '#1')?.points, 4)
  })

  it('counts the blocks of every run of the history', () => {
    const steps = [
      ...Array(35).fill(10_000),
      0,
      ...Array(31).fill(10_000),
    ]
    const awards = evaluateBadges(history('2026-01-01', steps), LATER)

    assert.deepEqual(ids(awards, 'streak.every'), [
      'streak.every30 #1',
      'streak.every30 #2',
    ])
  })

  it('never loses a block when a late day merges two runs', () => {
    const before = history('2026-01-01', [
      ...Array(29).fill(10_000),
      0,
      ...Array(29).fill(10_000),
    ])
    const after = before.map((day, index) =>
      index === 29 ? { ...day, steps: 10_000 } : day,
    )

    assert.deepEqual(ids(evaluateBadges(before, LATER), 'streak.every'), [])
    assert.deepEqual(ids(evaluateBadges(after, LATER), 'streak.every'), [
      'streak.every30 #1',
    ])
  })

  it('breaks a streak on a day missing from the database', () => {
    const days = [
      ...history('2026-01-01', Array(5).fill(10_000)),
      ...history('2026-01-07', Array(5).fill(10_000)),
    ]

    assert.deepEqual(ids(evaluateBadges(days, LATER), 'streak.'), [])
  })

  it('awards non-sedentary days that are finished, successful and with minutes sent', () => {
    const [done, notSent, short, today] = history('2026-05-04', [
      12_000, 12_000, 3_000, 12_000,
    ])
    const awards = evaluateBadges(
      [
        withMinutes(done, 40, 10, 0),
        notSent,
        withMinutes(short, 0, 0, 0),
        withMinutes(today, 40, 10, 0),
      ],
      { today: '2026-05-07', periodsFrom: '2026-01' },
    )

    assert.deepEqual(ids(awards, 'activity.'), [
      'activity.nonSedentaryDay #1',
    ])
    assert.equal(
      find(awards, 'activity.nonSedentaryDay', '#1')?.earnedOn,
      '2026-05-04',
    )
  })

  it('ignores days after today', () => {
    const awards = evaluateBadges(history('2026-05-04', [12_000, 30_000]), {
      today: '2026-05-04',
      periodsFrom: '2026-01',
    })

    assert.deepEqual(ids(awards, 'day.'), [])
  })

  it('awards week badges by ISO week, from the first month of the badges', () => {
    // Monday 2026-10-26 to Sunday 2026-11-08: two weeks at 15 000 a day.
    const days = history('2026-10-26', Array(14).fill(15_000))
    const awards = evaluateBadges(days, {
      today: '2026-11-20',
      periodsFrom: '2026-11',
    })

    assert.deepEqual(ids(awards, 'week.'), [
      'week.100000 2026-W45',
      'week.70000 2026-W45',
    ])
    assert.equal(find(awards, 'week.70000', '2026-W45')?.earnedOn, '2026-11-06')
  })

  it('awards an active week when the WHO score reaches 150', () => {
    const days = history('2026-11-02', Array(3).fill(8_000)).map((day) =>
      withMinutes(day, 30, 10, 20),
    )
    const awards = evaluateBadges(days, {
      today: '2026-11-20',
      periodsFrom: '2026-11',
    })

    // 50 a day: the third day reaches 150.
    assert.equal(find(awards, 'week.active', '2026-W45')?.earnedOn, '2026-11-04')
  })

  it('awards month badges from the first month of the badges only', () => {
    const days = history('2026-10-01', Array(61).fill(16_000))
    const awards = evaluateBadges(days, {
      today: '2026-12-15',
      periodsFrom: '2026-11',
    })

    assert.deepEqual(ids(awards, 'month.'), [
      'month.300000 2026-11',
      'month.400000 2026-11',
      'month.perfect 2026-11',
      'month.regular 2026-11',
    ])
    assert.equal(find(awards, 'month.regular', '2026-11')?.earnedOn, '2026-11-20')
    assert.equal(find(awards, 'month.perfect', '2026-11')?.earnedOn, '2026-11-30')
  })

  it('awards a perfect month only once it is over', () => {
    const days = history('2026-11-01', Array(30).fill(10_000))
    const during = evaluateBadges(days, { today: '2026-11-29', periodsFrom: '2026-11' })
    const after = evaluateBadges(days, { today: '2026-11-30', periodsFrom: '2026-11' })

    assert.equal(find(during, 'month.perfect', '2026-11'), undefined)
    assert.ok(find(after, 'month.perfect', '2026-11'))
  })

  it('awards the challenge of the month', () => {
    // November 2026: 3 days at 20 000.
    assert.equal(challengeOfMonth('2026-11'), 'days20000')

    const days = history('2026-11-01', [20_000, 5_000, 21_000, 0, 25_000])
    const awards = evaluateBadges(days, { today: '2026-11-05', periodsFrom: '2026-11' })

    assert.equal(find(awards, 'month.challenge', '2026-11')?.earnedOn, '2026-11-05')
  })

  it('awards the streak challenge to a run started in the month', () => {
    // October 2026: a streak of 14 days started in the month.
    assert.equal(challengeOfMonth('2026-10'), 'streak14')

    const days = history('2026-10-25', Array(14).fill(10_000))
    const awards = evaluateBadges(days, { today: '2026-11-20', periodsFrom: '2026-10' })

    assert.equal(find(awards, 'month.challenge', '2026-10')?.earnedOn, '2026-11-07')
  })
})

describe('challengeOfMonth', () => {
  it('rotates through every challenge', () => {
    const months = ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12']

    assert.deepEqual(
      new Set(months.map(challengeOfMonth)),
      new Set(MONTHLY_CHALLENGES),
    )
    assert.equal(challengeOfMonth('2027-12'), challengeOfMonth('2026-12'))
  })
})

describe('finalPeriods', () => {
  it('lists the last final weeks and months', () => {
    // Thursday: last week (ending Sunday 2026-11-01) is final.
    assert.deepEqual(
      finalPeriods(
        { today: '2026-11-05', periodsFrom: '2026-10' },
        { weeks: 2, months: 1 },
      ),
      [
        { period: 'week', occurrence: '2026-W44', start: '2026-10-26', end: '2026-11-01' },
        { period: 'week', occurrence: '2026-W43', start: '2026-10-19', end: '2026-10-25' },
        { period: 'month', occurrence: '2026-10', start: '2026-10-01', end: '2026-10-31' },
      ],
    )
  })

  it('skips periods not final yet and those before the badges', () => {
    // Monday: last week and last month can still change.
    assert.deepEqual(
      finalPeriods(
        { today: '2026-11-02', periodsFrom: '2026-10' },
        { weeks: 4, months: 2 },
      ).map((period) => period.occurrence),
      ['2026-W43', '2026-W42', '2026-W41'],
    )
  })
})

describe('rankingAwards', () => {
  const week = {
    period: 'week' as const,
    occurrence: '2026-W44',
    start: '2026-10-26',
    end: '2026-11-01',
  }

  function entry(steps: number, isMe = false, newcomer = false) {
    return { steps, isMe, newcomer }
  }

  it('awards the winner and the podium', () => {
    const others = [entry(90_000), entry(80_000), entry(70_000)]

    assert.deepEqual(rankingAwards(week, [entry(95_000, true), ...others]), [
      { badgeId: 'ranking.week.first', occurrence: '2026-W44', points: 2, earnedOn: '2026-11-01' },
    ])
    assert.deepEqual(
      ids(rankingAwards(week, [entry(75_000, true), ...others])),
      ['ranking.week.podium 2026-W44'],
    )
    assert.deepEqual(rankingAwards(week, [entry(60_000, true), ...others]), [])
  })

  it('shares the rank between ties', () => {
    assert.deepEqual(
      ids(rankingAwards(week, [entry(90_000, true), entry(90_000), entry(10_000)])),
      ['ranking.week.first 2026-W44'],
    )
  })

  it('needs 3 participants with steps', () => {
    assert.deepEqual(
      rankingAwards(week, [entry(90_000, true), entry(80_000), entry(0)]),
      [],
    )
  })

  it('leaves newcomers out of competition', () => {
    const entries = [
      entry(50_000, true),
      entry(90_000, false, true),
      entry(40_000),
      entry(30_000),
    ]

    assert.deepEqual(ids(rankingAwards(week, entries)), [
      'ranking.week.first 2026-W44',
    ])
    assert.deepEqual(
      rankingAwards(week, [entry(90_000, true, true), entry(40_000), entry(30_000), entry(20_000)]),
      [],
    )
  })
})
