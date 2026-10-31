import type { FastifyPluginAsync } from 'fastify'
import type { Pool } from 'pg'

import type { RequireAuth } from '../auth/authenticate.js'

export type LeaderboardRoutesOptions = {
  db: Pool
  requireAuth: RequireAuth
}

/**
 * Periods back the leaderboard can show: the current one (0) and the one
 * before (1), so that the result of last week is still visible on Monday.
 */
const MAX_OFFSET = 1

const leaderboardRoutes: FastifyPluginAsync<
  LeaderboardRoutesOptions
> = async (app, { db, requireAuth }) => {
  app.addHook('onRequest', requireAuth)

  /**
   * Leaderboard of the signed-in user and their friends (ADR 0002) for
   * the current week or month, or the previous one (offset=1). Each
   * entry carries the name chosen by the user and the alias I gave them,
   * if any; isMe flags my own entry. A past period ranks today's
   * friends, not those of that time. firstDay is the first day of steps
   * in the database; newcomer flags who has none before the start of the
   * period: they arrived during it and cannot catch up (out of
   * competition, still ranked by steps).
   */
  app.get('/leaderboard', async (request, reply) => {
    const { period = 'week', offset: offsetParam = '0' } = request.query as {
      period?: 'week' | 'month'
      offset?: string
    }

    if (period !== 'week' && period !== 'month') {
      return reply.code(400).send({
        error: 'Invalid period. Use "week" or "month".',
      })
    }

    const offset = Number(offsetParam)

    if (!/^\d+$/.test(offsetParam) || offset > MAX_OFFSET) {
      return reply.code(400).send({
        error: `Invalid offset. Use an integer from 0 to ${MAX_OFFSET}.`,
      })
    }

    // First and last day of the period. Subtracting a month from March 31
    // gives the end of February: the truncation then lands on February 1.
    const bounds = await db.query<{ start: string; end: string }>(
      `
      WITH period AS (
        SELECT date_trunc(
          $1,
          CURRENT_DATE - $2::int * ('1 ' || $1)::interval
        ) AS start
      )
      SELECT
        to_char(start, 'YYYY-MM-DD') AS start,
        to_char(
          start + ('1 ' || $1)::interval - interval '1 day',
          'YYYY-MM-DD'
        ) AS "end"
      FROM period
      `,
      [period, offset],
    )
    const { start, end } = bounds.rows[0]

    const result = await db.query(
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
        first.day IS NULL OR first.day > $2::date AS newcomer
      FROM visible v
      JOIN users u ON u.id = v.id
      LEFT JOIN LATERAL (
        SELECT min(date) AS day FROM daily_steps WHERE user_id = u.id
      ) first ON true
      LEFT JOIN friend_aliases fa
        ON fa.owner_id = $1 AND fa.friend_id = u.id
      LEFT JOIN daily_steps ds
        ON ds.user_id = u.id
        AND ds.date BETWEEN $2::date AND $3::date
        AND ds.date <= CURRENT_DATE
      GROUP BY u.id, u.name, fa.alias, first.day
      ORDER BY steps DESC, lower(COALESCE(fa.alias, u.name)), u.id
      `,
      [request.auth!.userId, start, end],
    )

    return reply.send({
      period,
      offset,
      start,
      end,
      results: result.rows,
    })
  })
}

export default leaderboardRoutes
