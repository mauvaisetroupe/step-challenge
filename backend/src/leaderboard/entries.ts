import type { Pool } from 'pg'

export type LeaderboardEntry = {
  id: string
  name: string
  alias: string | null
  steps: number
  isMe: boolean
  firstDay: string | null
  newcomer: boolean
  /** Total of the badge points, for the level. */
  badgePoints: number
}

/**
 * Leaderboard of a user and their friends between start and end
 * (YYYY-MM-DD), used by GET /api/leaderboard and by the ranking badges.
 * Each entry carries the name chosen by the user and the alias the
 * viewer gave them, if any. A past period ranks today's friends, not
 * those of that time. firstDay is the first day with steps in the
 * database. newcomer flags who created their account during the period
 * and has no steps before its start: they cannot catch up (out of
 * competition, still ranked by steps). Days without steps do not count:
 * the app sends the last 30 days of Health Connect at sign-in, with 0
 * for the days it has no data for.
 */
export async function leaderboardEntries(
  db: Pool,
  userId: string,
  start: string,
  end: string,
) {
  const result = await db.query<LeaderboardEntry>(
    `
    WITH visible AS (
      SELECT $1::uuid AS id
      UNION
      SELECT CASE WHEN user_low = $1 THEN user_high ELSE user_low END
      FROM friendships
      WHERE user_low = $1 OR user_high = $1
    )
    SELECT
      u.id,
      u.name,
      fa.alias,
      COALESCE(SUM(ds.steps), 0)::integer AS steps,
      u.id = $1 AS "isMe",
      to_char(first.day, 'YYYY-MM-DD') AS "firstDay",
      u.created_at::date > $2::date
        AND (first.day IS NULL OR first.day > $2::date) AS newcomer,
      badges.points AS "badgePoints"
    FROM visible v
    JOIN users u ON u.id = v.id
    LEFT JOIN LATERAL (
      SELECT min(date) FILTER (WHERE steps > 0) AS day
      FROM daily_steps
      WHERE user_id = u.id
    ) first ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(points), 0)::integer AS points
      FROM user_badges
      WHERE user_id = u.id
    ) badges ON true
    LEFT JOIN friend_aliases fa
      ON fa.owner_id = $1 AND fa.friend_id = u.id
    LEFT JOIN daily_steps ds
      ON ds.user_id = u.id
      AND ds.date BETWEEN $2::date AND $3::date
      AND ds.date <= CURRENT_DATE
    GROUP BY u.id, u.name, u.created_at, fa.alias, first.day, badges.points
    ORDER BY steps DESC, lower(COALESCE(fa.alias, u.name)), u.id
    `,
    [userId, start, end],
  )

  return result.rows
}
