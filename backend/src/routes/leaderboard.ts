import type { FastifyPluginAsync } from 'fastify'
import type { Pool } from 'pg'

import type { RequireAuth } from '../auth/authenticate.js'

export type LeaderboardRoutesOptions = {
  db: Pool
  requireAuth: RequireAuth
}

const leaderboardRoutes: FastifyPluginAsync<
  LeaderboardRoutesOptions
> = async (app, { db, requireAuth }) => {
  app.addHook('onRequest', requireAuth)

  /**
   * Leaderboard of the signed-in user and their friends (ADR 0002) for
   * the current week or month. Each entry carries the name chosen by the
   * user and the alias I gave them, if any; isMe flags my own entry.
   */
  app.get('/leaderboard', async (request, reply) => {
    const { period = 'week' } = request.query as {
      period?: 'week' | 'month'
    }

    if (period !== 'week' && period !== 'month') {
      return reply.code(400).send({
        error: 'Invalid period. Use "week" or "month".',
      })
    }

    const result = await db.query(
      `
      WITH visible AS (
        SELECT $2::uuid AS id
        UNION
        SELECT CASE WHEN user_low = $2 THEN user_high ELSE user_low END
        FROM friendships
        WHERE user_low = $2 OR user_high = $2
      )
      SELECT
        u.id,
        u.name,
        fa.alias,
        COALESCE(SUM(ds.steps), 0)::integer AS steps,
        u.id = $2 AS "isMe"
      FROM visible v
      JOIN users u ON u.id = v.id
      LEFT JOIN friend_aliases fa
        ON fa.owner_id = $2 AND fa.friend_id = u.id
      LEFT JOIN daily_steps ds
        ON ds.user_id = u.id
        AND ds.date >=
          CASE
            WHEN $1 = 'week'
              THEN date_trunc('week', CURRENT_DATE)::date
            ELSE date_trunc('month', CURRENT_DATE)::date
          END
        AND ds.date <= CURRENT_DATE
      GROUP BY u.id, u.name, fa.alias
      ORDER BY steps DESC, lower(COALESCE(fa.alias, u.name)), u.id
      `,
      [period, request.auth!.userId],
    )

    return reply.send({
      period,
      results: result.rows,
    })
  })
}

export default leaderboardRoutes
