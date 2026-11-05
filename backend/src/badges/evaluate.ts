import {
  BADGES,
  DAILY_GOAL,
  DAY_THRESHOLDS,
  LATE_SYNC_DAYS,
  MIN_RANKING_PARTICIPANTS,
  MONTH_THRESHOLDS,
  REGULAR_MONTH_DAYS,
  STREAK_BLOCKS,
  STREAK_THRESHOLDS,
  TOTAL_THRESHOLDS,
  WEEK_THRESHOLDS,
  WEEKLY_ACTIVITY_GOAL,
  challengeOfMonth,
  type MonthlyChallenge,
} from './catalogue.js'
import {
  addDays,
  dayOfWeek,
  monthEnd,
  monthKey,
  monthStart,
  nextMonth,
  weekKey,
  weekStart,
} from './dates.js'

/**
 * Badge evaluation (docs/reference/badges.md). Pure functions: they
 * return every badge the history earns, and the caller inserts the ones
 * not stored yet. Nothing is ever taken back, and the result only grows
 * with the history: the server keeps the highest total of each day.
 */

/** A day of daily_steps; minutes are null when never sent (ADR 0010). */
export type DayRecord = {
  date: string
  steps: number
  activeMinutes: number | null
  veryActiveMinutes: number | null
  inactiveMinutes: number | null
}

export type Award = {
  badgeId: string
  /** '' for a unique badge, YYYY-Www or YYYY-MM, or #1, #2… */
  occurrence: string
  points: number
  /** Day the condition was met. */
  earnedOn: string
}

export type EvaluationContext = {
  /** Today, in the server time zone. */
  today: string
  /**
   * First month of the week and month badges (YYYY-MM): the month the
   * badges went live. Earlier periods earn nothing.
   */
  periodsFrom: string
}

export type Run = { start: string; length: number }

function award(badgeId: string, occurrence: string, earnedOn: string): Award {
  return { badgeId, occurrence, points: BADGES[badgeId].points, earnedOn }
}

export function isSuccessful(day: DayRecord) {
  return day.steps >= DAILY_GOAL
}

/**
 * A finished successful day without any inactive minute. Today can
 * still gain some, and a day without minutes sent does not count.
 */
export function isNonSedentary(day: DayRecord, today: string) {
  return day.date < today && isSuccessful(day) && day.inactiveMinutes === 0
}

export function activityScore(day: DayRecord) {
  return day.activeMinutes === null || day.veryActiveMinutes === null
    ? 0
    : day.activeMinutes + 2 * day.veryActiveMinutes
}

/** Day the running sum of `value` reaches `target`, or null. */
function crossingDate(
  days: DayRecord[],
  target: number,
  value: (day: DayRecord) => number,
) {
  let sum = 0

  for (const day of days) {
    sum += value(day)

    if (sum >= target) {
      return day.date
    }
  }

  return null
}

/** Date of the n-th day matching `test`, or null. */
function nthDate(
  days: DayRecord[],
  n: number,
  test: (day: DayRecord) => boolean,
) {
  return days.filter(test)[n - 1]?.date ?? null
}

/** Runs of consecutive successful days, oldest first. */
export function successfulRuns(days: DayRecord[]) {
  const runs: Run[] = []
  let current: Run | null = null

  for (const day of days) {
    if (!isSuccessful(day)) {
      current = null
      continue
    }

    if (current && addDays(current.start, current.length) === day.date) {
      current.length++
    } else {
      current = { start: day.date, length: 1 }
      runs.push(current)
    }
  }

  return runs
}

export function groupBy(days: DayRecord[], key: (date: string) => string) {
  const groups = new Map<string, DayRecord[]>()

  for (const day of days) {
    const group = groups.get(key(day.date)) ?? []

    group.push(day)
    groups.set(key(day.date), group)
  }

  return groups
}

function dayAwards(days: DayRecord[]) {
  return DAY_THRESHOLDS.flatMap(({ steps }) => {
    const date = nthDate(days, 1, (day) => day.steps >= steps)

    return date ? [award(`day.${steps}`, '', date)] : []
  })
}

function totalAwards(days: DayRecord[]) {
  return TOTAL_THRESHOLDS.flatMap(({ steps }) => {
    const date = crossingDate(days, steps, (day) => day.steps)

    return date ? [award(`total.${steps}`, '', date)] : []
  })
}

/**
 * Unique streak badges: the first run that reaches the length. Repeatable
 * ones count blocks, not dates: a late day can merge two runs and move
 * the end of their blocks, but never lowers their number, since
 * ⌊a ÷ n⌋ + ⌊b ÷ n⌋ ≤ ⌊(a + b + 1) ÷ n⌋. Occurrence #k may get another
 * date on a later evaluation; the stored one stays.
 */
function streakAwards(runs: Run[]) {
  const unique = STREAK_THRESHOLDS.flatMap(({ days }) => {
    const run = runs.find((candidate) => candidate.length >= days)

    return run ? [award(`streak.${days}`, '', addDays(run.start, days - 1))] : []
  })

  const repeatable = STREAK_BLOCKS.flatMap(({ days }) =>
    runs
      .flatMap((run) =>
        Array.from({ length: Math.floor(run.length / days) }, (_, block) =>
          addDays(run.start, (block + 1) * days - 1),
        ),
      )
      .map((date, index) =>
        award(`streak.every${days}`, `#${index + 1}`, date),
      ),
  )

  return [...unique, ...repeatable]
}

function nonSedentaryAwards(days: DayRecord[], today: string) {
  return days
    .filter((day) => isNonSedentary(day, today))
    .map((day, index) =>
      award('activity.nonSedentaryDay', `#${index + 1}`, day.date),
    )
}

/** Weeks starting in the first month of the badges or later. */
function weekAwards(
  days: DayRecord[],
  { periodsFrom }: EvaluationContext,
) {
  const from = monthStart(periodsFrom)
  const awards: Award[] = []

  for (const [start, weekDays] of groupBy(days, weekStart)) {
    if (start < from) {
      continue
    }

    const week = weekKey(start)

    for (const { steps } of WEEK_THRESHOLDS) {
      const date = crossingDate(weekDays, steps, (day) => day.steps)

      if (date) {
        awards.push(award(`week.${steps}`, week, date))
      }
    }

    const active = crossingDate(weekDays, WEEKLY_ACTIVITY_GOAL, activityScore)

    if (active) {
      awards.push(award('week.active', week, active))
    }
  }

  return awards
}

function challengeDate(
  challenge: MonthlyChallenge,
  month: string,
  monthDays: DayRecord[],
  days: DayRecord[],
  runs: Run[],
  today: string,
) {
  switch (challenge) {
    case 'days15000':
      return nthDate(monthDays, 5, (day) => day.steps >= 15_000)
    case 'days20000':
      return nthDate(monthDays, 3, (day) => day.steps >= 20_000)
    case 'weekendDays':
      return nthDate(
        monthDays,
        8,
        (day) => isSuccessful(day) && dayOfWeek(day.date) >= 5,
      )
    case 'nonSedentaryDay':
      return nthDate(monthDays, 1, (day) => isNonSedentary(day, today))
    case 'streak14': {
      // A run started in the month; it may end in the next one.
      const run = runs.find(
        (candidate) =>
          monthKey(candidate.start) === month && candidate.length >= 14,
      )

      return run ? addDays(run.start, 13) : null
    }
    case 'activeWeeks': {
      // Weeks ending (on Sunday) in the month.
      const dates = [...groupBy(days, weekStart)]
        .filter(([start]) => monthKey(addDays(start, 6)) === month)
        .map(([, weekDays]) =>
          crossingDate(weekDays, WEEKLY_ACTIVITY_GOAL, activityScore),
        )
        .filter((date) => date !== null)
        .sort()

      return dates[3] ?? null
    }
  }
}

function monthAwards(
  days: DayRecord[],
  runs: Run[],
  { today, periodsFrom }: EvaluationContext,
) {
  const months = groupBy(days, monthKey)
  const awards: Award[] = []

  for (
    let month = periodsFrom;
    month <= monthKey(today);
    month = nextMonth(month)
  ) {
    const monthDays = months.get(month) ?? []

    for (const { steps } of MONTH_THRESHOLDS) {
      const date = crossingDate(monthDays, steps, (day) => day.steps)

      if (date) {
        awards.push(award(`month.${steps}`, month, date))
      }
    }

    const regular = nthDate(monthDays, REGULAR_MONTH_DAYS, isSuccessful)

    if (regular) {
      awards.push(award('month.regular', month, regular))
    }

    const end = monthEnd(month)
    const daysInMonth = Number(end.slice(8))

    if (
      end <= today &&
      monthDays.filter(isSuccessful).length === daysInMonth
    ) {
      awards.push(award('month.perfect', month, end))
    }

    const challenge = challengeDate(
      challengeOfMonth(month),
      month,
      monthDays,
      days,
      runs,
      today,
    )

    if (challenge) {
      awards.push(award('month.challenge', month, challenge))
    }
  }

  return awards
}

/**
 * Badges earned by a step history (any order; days after today are
 * ignored), except the ranking ones: see rankingAwards.
 */
export function evaluateBadges(
  history: DayRecord[],
  context: EvaluationContext,
): Award[] {
  const days = history
    .filter((day) => day.date <= context.today)
    .sort((a, b) => a.date.localeCompare(b.date))
  const runs = successfulRuns(days)

  return [
    ...dayAwards(days),
    ...totalAwards(days),
    ...streakAwards(runs),
    ...nonSedentaryAwards(days, context.today),
    ...weekAwards(days, context),
    ...monthAwards(days, runs, context),
  ]
}

export type Period = 'week' | 'month'

export type FinalPeriod = {
  period: Period
  /** YYYY-Www or YYYY-MM. */
  occurrence: string
  start: string
  end: string
}

/** The leaderboard of a period ending on `end` no longer changes. */
export function isFinal(end: string, today: string) {
  return today > addDays(end, LATE_SYNC_DAYS)
}

/**
 * The last `weeks` final weeks and `months` final months, not before
 * the first month of the badges, most recent first: the periods whose
 * ranking badges are evaluated. A period is evaluated during a window
 * after its end, with the friends of that time.
 */
export function finalPeriods(
  { today, periodsFrom }: EvaluationContext,
  { weeks, months }: { weeks: number; months: number },
): FinalPeriod[] {
  const from = monthStart(periodsFrom)
  const periods: FinalPeriod[] = []

  for (let start = weekStart(today), found = 0; found < weeks; ) {
    start = addDays(start, -7)

    if (start < from) {
      break
    }

    const end = addDays(start, 6)

    if (isFinal(end, today)) {
      periods.push({ period: 'week', occurrence: weekKey(start), start, end })
      found++
    }
  }

  for (let month = monthKey(today), found = 0; found < months; ) {
    month = monthKey(addDays(monthStart(month), -1))

    if (month < periodsFrom) {
      break
    }

    const end = monthEnd(month)

    if (isFinal(end, today)) {
      periods.push({
        period: 'month',
        occurrence: month,
        start: monthStart(month),
        end,
      })
      found++
    }
  }

  return periods
}

/** An entry of the leaderboard of GET /api/leaderboard. */
export type RankingEntry = {
  steps: number
  isMe: boolean
  newcomer: boolean
}

/**
 * Ranking badges of a final period. Newcomers are out of competition:
 * they neither win nor count among the participants, nor push anyone
 * down. Ties share the rank.
 */
export function rankingAwards(
  { period, occurrence, end }: FinalPeriod,
  entries: RankingEntry[],
): Award[] {
  const competitors = entries.filter(
    (entry) => !entry.newcomer && entry.steps > 0,
  )
  const me = competitors.find((entry) => entry.isMe)

  if (!me || competitors.length < MIN_RANKING_PARTICIPANTS) {
    return []
  }

  const rank =
    1 + competitors.filter((entry) => entry.steps > me.steps).length

  if (rank === 1) {
    return [award(`ranking.${period}.first`, occurrence, end)]
  }

  if (rank <= 3) {
    return [award(`ranking.${period}.podium`, occurrence, end)]
  }

  return []
}
