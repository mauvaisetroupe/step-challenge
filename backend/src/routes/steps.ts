import type { FastifyPluginAsync } from 'fastify'
import { pool } from '../db.js'

const stepsRoutes: FastifyPluginAsync = async (app) => {
  app.post('/steps', async (request, reply) => {
    const { userId, date, steps } = request.body as {
      userId: string
      date: string
      steps: number
    }

    await pool.query(
      `
      INSERT INTO daily_steps (user_id, date, steps)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, date)
      DO UPDATE SET
        steps = EXCLUDED.steps,
        updated_at = NOW()
      `,
      [userId, date, steps]
    )

    return reply.send({
      success: true,
    })
  })

  app.get('/steps/:userId', async (request, reply) => {
    const { userId } = request.params as {
      userId: string
    }

    const result = await pool.query(
      `
      SELECT user_id, date, steps, updated_at
      FROM daily_steps
      WHERE user_id = $1
      ORDER BY date DESC
      `,
      [userId]
    )

    return reply.send(result.rows)
  })

}

export default stepsRoutes