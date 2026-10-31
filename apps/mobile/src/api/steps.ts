import { apiFetch } from './client'

export type DayStat = {
  /** Local calendar date, YYYY-MM-DD. */
  date: string
  steps: number
  /**
   * Activity minutes (ADR 0010): computed for the last days only when
   * sending; null in the history when never sent.
   */
  activeMinutes?: number | null
  veryActiveMinutes?: number | null
  inactiveMinutes?: number | null
}

/** Backend limit per request (MAX_DAYS_PER_REQUEST). */
const MAX_DAYS_PER_REQUEST = 31

/**
 * Sends daily totals for the signed-in user.
 *
 * The backend keeps the highest value per day, so sending a day again
 * is harmless. Returns the dates it actually recorded (new day, higher
 * total or new activity minutes).
 */
export async function postMySteps(days: DayStat[]) {
  const updatedDates: string[] = []

  for (let i = 0; i < days.length; i += MAX_DAYS_PER_REQUEST) {
    const response = await apiFetch<{ updatedDates: string[] }>(
      '/api/me/steps',
      {
        method: 'POST',
        body: { days: days.slice(i, i + MAX_DAYS_PER_REQUEST) },
      },
    )

    updatedDates.push(...response.updatedDates)
  }

  return updatedDates
}

/**
 * Returns the signed-in user's daily totals, most recent first.
 *
 * Without `from`, the backend returns about 13 months of history.
 */
export async function getMySteps(from?: string) {
  const query = from ? `?from=${encodeURIComponent(from)}` : ''

  return apiFetch<DayStat[]>(`/api/me/steps${query}`)
}

export type LeaderboardEntry = {
  id: string
  /** Name chosen by the user. */
  name: string
  /** Name I gave this friend (ADR 0002), if any. */
  alias: string | null
  steps: number
  isMe: boolean
  /**
   * First day of steps in the database, YYYY-MM-DD, or null without any.
   * Missing from an API older than newcomers.
   */
  firstDay?: string | null
  /**
   * No steps before the start of the period: arrived during it, out of
   * competition. Still ranked by steps.
   */
  newcomer?: boolean
}

export type Leaderboard = {
  period: 'week' | 'month'
  /**
   * 0 for the current period, 1 for the previous one. Missing from an
   * API older than past leaderboards, which ignores the offset and
   * always returns the current period.
   */
  offset?: number
  /** First and last day of the period, YYYY-MM-DD (same API version). */
  start?: string
  end?: string
  results: LeaderboardEntry[]
}

export async function getLeaderboard(period: 'week' | 'month', offset = 0) {
  return apiFetch<Leaderboard>(
    `/api/leaderboard?period=${period}&offset=${offset}`,
  )
}
