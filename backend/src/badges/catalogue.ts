/**
 * Badge catalogue (docs/reference/badges.md). Badges are defined here,
 * in code: nobody creates or awards them by hand, and the badges of a
 * week or a month follow from the calendar.
 */

/** Steps of a successful day: the goal of the app. */
export const DAILY_GOAL = 10_000

/** WHO: activity score to reach per week (ADR 0010). */
export const WEEKLY_ACTIVITY_GOAL = 150

/**
 * Days after the end of a period during which its leaderboard can still
 * change (same rule as the app, services/leaderboardPeriods.ts).
 */
export const LATE_SYNC_DAYS = 2

/** Participants a leaderboard needs for its ranking badges, me included. */
export const MIN_RANKING_PARTICIPANTS = 3

/**
 * unique: once per account; period: once per week or month (occurrence
 * YYYY-Www or YYYY-MM); repeatable: every time (occurrence #1, #2…).
 */
export type BadgeKind = 'unique' | 'period' | 'repeatable'

export type BadgeFamily =
  | 'day'
  | 'week'
  | 'month'
  | 'streak'
  | 'activity'
  | 'total'
  | 'ranking'

export type BadgeDefinition = {
  kind: BadgeKind
  family: BadgeFamily
  points: number
}

export const DAY_THRESHOLDS = [
  { steps: 15_000, points: 1 },
  { steps: 20_000, points: 1 },
  { steps: 25_000, points: 2 },
  { steps: 30_000, points: 2 },
  { steps: 40_000, points: 3 },
  { steps: 50_000, points: 4 },
]

export const TOTAL_THRESHOLDS = [
  { steps: 1_000_000, points: 1 },
  { steps: 2_500_000, points: 1 },
  { steps: 5_000_000, points: 2 },
  { steps: 10_000_000, points: 3 },
  { steps: 25_000_000, points: 4 },
]

/** Same milestones as the streak card of the home screen. */
export const STREAK_THRESHOLDS = [
  { days: 7, points: 1 },
  { days: 14, points: 1 },
  { days: 30, points: 2 },
  { days: 60, points: 2 },
  { days: 100, points: 3 },
  { days: 200, points: 3 },
  { days: 365, points: 4 },
]

/** Repeatable streaks: one occurrence per block of `days` days. */
export const STREAK_BLOCKS = [
  { days: 30, points: 3 },
  { days: 60, points: 4 },
]

export const WEEK_THRESHOLDS = [
  { steps: 70_000, points: 1 },
  { steps: 100_000, points: 2 },
]

export const MONTH_THRESHOLDS = [
  { steps: 300_000, points: 1 },
  { steps: 400_000, points: 1 },
  { steps: 500_000, points: 2 },
]

/** Successful days of a "regular month". */
export const REGULAR_MONTH_DAYS = 20

/**
 * Challenges of the month, in rotation: each month has the next one
 * (absolute month number modulo the length of the list). Adding one
 * lengthens the cycle.
 */
export const MONTHLY_CHALLENGES = [
  'days15000',
  'activeWeeks',
  'weekendDays',
  'streak14',
  'days20000',
  'nonSedentaryDay',
] as const

export type MonthlyChallenge = (typeof MONTHLY_CHALLENGES)[number]

export function challengeOfMonth(month: string): MonthlyChallenge {
  const [year, monthNumber] = month.split('-').map(Number)

  return MONTHLY_CHALLENGES[
    (year * 12 + monthNumber - 1) % MONTHLY_CHALLENGES.length
  ]
}

export const BADGES: Record<string, BadgeDefinition> = {
  ...Object.fromEntries(
    DAY_THRESHOLDS.map(({ steps, points }) => [
      `day.${steps}`,
      { kind: 'unique', family: 'day', points },
    ]),
  ),
  ...Object.fromEntries(
    TOTAL_THRESHOLDS.map(({ steps, points }) => [
      `total.${steps}`,
      { kind: 'unique', family: 'total', points },
    ]),
  ),
  ...Object.fromEntries(
    STREAK_THRESHOLDS.map(({ days, points }) => [
      `streak.${days}`,
      { kind: 'unique', family: 'streak', points },
    ]),
  ),
  ...Object.fromEntries(
    STREAK_BLOCKS.map(({ days, points }) => [
      `streak.every${days}`,
      { kind: 'repeatable', family: 'streak', points },
    ]),
  ),
  'activity.nonSedentaryDay': {
    kind: 'repeatable',
    family: 'activity',
    points: 3,
  },
  ...Object.fromEntries(
    WEEK_THRESHOLDS.map(({ steps, points }) => [
      `week.${steps}`,
      { kind: 'period', family: 'week', points },
    ]),
  ),
  'week.active': { kind: 'period', family: 'activity', points: 1 },
  ...Object.fromEntries(
    MONTH_THRESHOLDS.map(({ steps, points }) => [
      `month.${steps}`,
      { kind: 'period', family: 'month', points },
    ]),
  ),
  'month.regular': { kind: 'period', family: 'month', points: 2 },
  'month.perfect': { kind: 'period', family: 'month', points: 4 },
  'month.challenge': { kind: 'period', family: 'month', points: 2 },
  'ranking.week.first': { kind: 'period', family: 'ranking', points: 2 },
  'ranking.week.podium': { kind: 'period', family: 'ranking', points: 1 },
  'ranking.month.first': { kind: 'period', family: 'ranking', points: 3 },
  'ranking.month.podium': { kind: 'period', family: 'ranking', points: 2 },
}
