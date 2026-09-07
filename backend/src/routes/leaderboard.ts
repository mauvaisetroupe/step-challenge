import type { FastifyPluginAsync } from 'fastify'
import { pool } from '../db.js'

const leaderboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/leaderboard', async (request, reply) => {
    const { period = 'week' } = request.query as {
      period?: 'week' | 'month'
    }

    if (period !== 'week' && period !== 'month') {
      return reply.code(400).send({
        error: 'Invalid period. Use "week" or "month".',
      })
    }

    const result = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        COALESCE(SUM(ds.steps), 0)::integer AS steps
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
      [period]
    )

    return reply.send({
      period,
      results: result.rows,
    })
  })
}

export default leaderboardRoutes