import {
  DAILY_GOAL,
  MONTH_THRESHOLDS,
  REGULAR_MONTH_DAYS,
  WEEK_THRESHOLDS,
  WEEKLY_ACTIVITY_GOAL,
  challengeOfMonth,
  type MonthlyChallenge,
} from './catalogue.js'
import { addDays, dayOfWeek, monthEnd, monthKey, weekKey, weekStart } from './dates.js'
import {
  activityScore,
  groupBy,
  isNonSedentary,
  isSuccessful,
  successfulRuns,
  type DayRecord,
} from './evaluate.js'

/**
 * Progress of the badges of the current week and month, to give a goal
 * ("214 000 / 300 000 steps"). The caller leaves out those already
 * earned. Ranking badges have no progress: they are decided at the end.
 */

export type Progress = {
  badgeId: string
  occurrence: string
  value: number
  target: number
}

function sum(days: DayRecord[], value: (day: DayRecord) => number) {
  return days.reduce((total, day) => total + value(day), 0)
}

function count(days: DayRecord[], test: (day: DayRecord) => boolean) {
  return days.filter(test).length
}

function progress(
  badgeId: string,
  occurrence: string,
  value: number,
  target: number,
): Progress {
  return { badgeId, occurrence, value: Math.min(value, target), target }
}

function challengeProgress(
  challenge: MonthlyChallenge,
  month: string,
  monthDays: DayRecord[],
  days: DayRecord[],
  today: string,
): [number, number] {
  switch (challenge) {
    case 'days15000':
      return [count(monthDays, (day) => day.steps >= 15_000), 5]
    case 'days20000':
      return [count(monthDays, (day) => day.steps >= 20_000), 3]
    case 'weekendDays':
      return [
        count(monthDays, (day) => isSuccessful(day) && dayOfWeek(day.date) >= 5),
        8,
      ]
    case 'nonSedentaryDay':
      return [count(monthDays, (day) => isNonSedentary(day, today)), 1]
    case 'streak14': {
      const lengths = successfulRuns(days)
        .filter((run) => monthKey(run.start) === month)
        .map((run) => run.length)

      return [Math.max(0, ...lengths), 14]
    }
    case 'activeWeeks': {
      const active = [...groupBy(days, weekStart)].filter(
        ([start, weekDays]) =>
          monthKey(addDays(start, 6)) === month &&
          sum(weekDays, activityScore) >= WEEKLY_ACTIVITY_GOAL,
      )

      return [active.length, 4]
    }
  }
}

export function currentProgress(
  history: DayRecord[],
  today: string,
): Progress[] {
  const days = history
    .filter((day) => day.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date))
  const week = weekKey(today)
  const weekDays = days.filter((day) => day.date >= weekStart(today))
  const month = monthKey(today)
  const monthDays = days.filter((day) => monthKey(day.date) === month)
  const weekSteps = sum(weekDays, (day) => day.steps)
  const monthSteps = sum(monthDays, (day) => day.steps)
  const successfulDays = count(monthDays, isSuccessful)
  const result = [
    ...WEEK_THRESHOLDS.map(({ steps }) =>
      progress(`week.${steps}`, week, weekSteps, steps),
    ),
    progress(
      'week.active',
      week,
      sum(weekDays, activityScore),
      WEEKLY_ACTIVITY_GOAL,
    ),
    ...MONTH_THRESHOLDS.map(({ steps }) =>
      progress(`month.${steps}`, month, monthSteps, steps),
    ),
    progress('month.regular', month, successfulDays, REGULAR_MONTH_DAYS),
    progress(
      'month.challenge',
      month,
      ...challengeProgress(challengeOfMonth(month), month, monthDays, days, today),
    ),
  ]

  // Still possible while every finished day of the month is successful.
  const daysInMonth = Number(monthEnd(month).slice(8))
  const finished = Number(today.slice(8)) - 1
  const missed = count(
    monthDays,
    (day) => day.date < today && day.steps < DAILY_GOAL,
  )
  const recorded = count(monthDays, (day) => day.date < today)

  if (missed === 0 && recorded === finished) {
    result.push(progress('month.perfect', month, successfulDays, daysInMonth))
  }

  return result
}
