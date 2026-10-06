import type { DayStat, LeaderboardEntry } from '../api/steps'

/**
 * Home screen insights: weekly rank among friends and goal streaks.
 * Pure functions, computed from the leaderboard and the step history of
 * the database.
 */

export type WeekRank = {
  /** 1 for the first; ties share the same rank. */
  rank: number
  /** People in the leaderboard, me included. */
  total: number
  /** Closest person with more steps than me, and the steps needed to pass them. */
  ahead: { name: string; stepsToPass: number } | null
  /** When I am first: the next person, and my lead (0 when tied). */
  behind: { name: string; lead: number } | null
  /** Everyone in the leaderboard, fewest steps first (for the track). */
  people: { id: string; name: string; steps: number; isMe: boolean }[]
  /** Id of the person just ahead, if any. */
  aheadId: string | null
}

function nameOf(entry: LeaderboardEntry) {
  return entry.alias ?? entry.name
}

/**
 * My position in the leaderboard. Returns null when I am not in it.
 */
export function computeWeekRank(entries: LeaderboardEntry[]): WeekRank | null {
  const me = entries.find((entry) => entry.isMe)

  if (!me) {
    return null
  }

  const others = entries.filter((entry) => !entry.isMe)
  const above = others.filter((entry) => entry.steps > me.steps)
  const rank = above.length + 1

  // The person just ahead: the smallest total above mine.
  const closest = above.reduce<LeaderboardEntry | null>(
    (best, entry) => (!best || entry.steps < best.steps ? entry : best),
    null,
  )

  // When first: the highest total among the others.
  const next = others.reduce<LeaderboardEntry | null>(
    (best, entry) => (!best || entry.steps > best.steps ? entry : best),
    null,
  )

  const people = entries
    .map((entry) => ({
      id: entry.id,
      name: nameOf(entry),
      steps: entry.steps,
      isMe: entry.isMe,
    }))
    .sort((a, b) => a.steps - b.steps)

  return {
    rank,
    total: entries.length,
    people,
    aheadId: closest?.id ?? null,
    ahead: closest
      ? { name: nameOf(closest), stepsToPass: closest.steps - me.steps + 1 }
      : null,
    behind:
      rank === 1 && next
        ? { name: nameOf(next), lead: me.steps - next.steps }
        : null,
  }
}

export type Streaks = {
  /** Consecutive days at or above the goal, ending today or yesterday. */
  current: number
  /** Whether today is already part of the current streak. */
  includesToday: boolean
  /** Longest streak in the whole history. */
  best: number
}

/** Days since 1970-01-01 for a YYYY-MM-DD date (time zone free). */
function dayNumber(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000)
}

/**
 * Goal streaks from the daily totals. A day missing from the history
 * counts as below the goal. Today, until it reaches the goal, does not
 * break the current streak: it still counts up to yesterday.
 */
export function computeStreaks(
  days: DayStat[],
  today: string,
  goal: number,
): Streaks {
  const reached = new Set(
    days.filter((day) => day.steps >= goal).map((day) => dayNumber(day.date)),
  )

  const todayNumber = dayNumber(today)
  const includesToday = reached.has(todayNumber)

  let current = 0
  let cursor = includesToday ? todayNumber : todayNumber - 1

  while (reached.has(cursor)) {
    current++
    cursor--
  }

  let best = 0
  let run = 0
  let previous: number | null = null

  for (const day of [...reached].sort((a, b) => a - b)) {
    run = previous !== null && day === previous + 1 ? run + 1 : 1
    best = Math.max(best, run)
    previous = day
  }

  return { current, includesToday, best }
}

/**
 * Streak milestones, in days: close at first (one to three weeks apart),
 * so that the next one always looks reachable, then further apart once
 * the streak is a habit. After a year: every 100 days.
 */
const STREAK_MILESTONES = [
  3, 7, 14, 21, 30, 45, 60, 75, 100, 150, 200, 250, 300, 365,
]
const MILESTONE_EVERY_AFTER_A_YEAR = 100

function milestoneAfter(days: number) {
  const fixed = STREAK_MILESTONES.find((milestone) => milestone > days)

  return (
    fixed ??
    (Math.floor(days / MILESTONE_EVERY_AFTER_A_YEAR) + 1) *
      MILESTONE_EVERY_AFTER_A_YEAR
  )
}

function milestonesUpTo(days: number) {
  const reached = STREAK_MILESTONES.filter((milestone) => milestone <= days)

  for (
    let milestone = 400;
    milestone <= days;
    milestone += MILESTONE_EVERY_AFTER_A_YEAR
  ) {
    reached.push(milestone)
  }

  return reached
}

export type StreakTrack = {
  /** The last milestones reached (at most three), oldest first. */
  reached: number[]
  /** The next milestone to reach. */
  next: number
  /** Days left before the next milestone. */
  remaining: number
}

/**
 * Milestones shown on the streak track: the last ones reached and the
 * next one, which gives a goal to keep going.
 */
export function computeStreakTrack(current: number): StreakTrack {
  const next = milestoneAfter(current)

  return {
    reached: milestonesUpTo(current).slice(-3),
    next,
    remaining: next - current,
  }
}

