import { apiFetch } from './client'

export type DayStat = {
  /** Local calendar date, YYYY-MM-DD. */
  date: string
  steps: number
}

/** Backend limit per request (MAX_DAYS_PER_REQUEST). */
const MAX_DAYS_PER_REQUEST = 31

/**
 * Sends daily totals for the signed-in user.
 *
 * The backend keeps the highest value per day, so sending a day again
 * is harmless. Returns the dates it actually recorded (new day or
 * higher total).
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
  name: string
  steps: number
  isMe: boolean
}

export async function getLeaderboard(period: 'week' | 'month') {
  return apiFetch<{
    period: 'week' | 'month'
    results: LeaderboardEntry[]
  }>(`/api/leaderboard?period=${period}`)
}
