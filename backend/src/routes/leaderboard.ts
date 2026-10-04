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
   * Leaderboard for the current week or month; isMe flags the signed-in
   * user. Global for now: ADR 0002 will restrict it to the user and
   * their friends.
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
      SELECT
        u.id,
        u.name,
        COALESCE(SUM(ds.steps), 0)::integer AS steps,
        u.id = $2 AS "isMe"
      FROM users u
      LEFT JOIN daily_steps ds
        ON ds.user_id = u.id
        AND ds.date >=
          CASE
            WHEN $1 = 'week'
              THEN date_trunc('week', CURRENT_DATE)::date
            ELSE date_trunc('month', CURRENT_DATE)::date
          END
        AND ds.date <= CURRENT_DATE
      GROUP BY u.id, u.name
      ORDER BY steps DESC, u.name ASC
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
