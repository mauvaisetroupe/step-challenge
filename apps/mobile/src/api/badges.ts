import { ApiError, apiFetch } from './client'

/**
 * Badges, points and levels (docs/reference/badges.md). The texts come
 * translated from the backend (Accept-Language): a badge added to the
 * catalogue shows without a new version of the app. Read tolerantly
 * (ADR 0012): an unknown family gets the default icon.
 */

type BadgeTexts = {
  name: string
  /** "Week of November 2", "November 2026"; null outside periods. */
  period: string | null
  description: string
}

export type BadgeOccurrence = {
  /** YYYY-Www, YYYY-MM, #1… or '' for a unique badge. */
  occurrence: string
  period: string | null
  /** Changes from one month to the next for the challenge of the month. */
  description: string
  earnedOn: string
  points: number
}

/** A badge earned once or more: one entry per badge. */
export type EarnedBadge = BadgeTexts & {
  id: string
  family: string
  kind: string
  occurrence: string
  /** Times earned (week, month and repeatable badges). */
  count: number
  /** Points of all its occurrences. */
  points: number
  /** Day the condition was met, YYYY-MM-DD (latest occurrence). */
  earnedOn: string
  /** When the backend awarded it, ISO date (latest occurrence). */
  createdAt: string
  /** Every time it was earned, most recent first. */
  occurrences: BadgeOccurrence[]
}

export type BadgeInProgress = BadgeTexts & {
  id: string
  family: string
  occurrence: string
  points: number
  value: number
  target: number
}

export type LockedBadge = BadgeTexts & {
  id: string
  family: string
  points: number
}

export type BadgeReport = {
  level: number
  points: number
  /** Points of the current level, and of the next one. */
  levelPoints: number
  nextLevelPoints: number
  /** Most recent first. */
  earned: EarnedBadge[]
  inProgress: BadgeInProgress[]
  locked: LockedBadge[]
}

/**
 * The backend has no badges yet (older API, unknown route): the screens
 * say so. A friend who is no longer one is another 404.
 */
export function isBadgesUnavailable(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status === 404 &&
    error.code !== 'friend_not_found'
  )
}

export async function getMyBadges() {
  return apiFetch<BadgeReport>('/api/me/badges')
}

export async function getFriendBadges(friendId: string) {
  return apiFetch<BadgeReport>(`/api/friends/${friendId}/badges`)
}

const FAMILY_ICONS: Record<string, string> = {
  day: '👟',
  week: '📅',
  month: '🗓️',
  streak: '🔥',
  activity: '⚡',
  total: '🌍',
  ranking: '🏆',
}

export function badgeIcon(family: string) {
  return FAMILY_ICONS[family] ?? '🏅'
}
