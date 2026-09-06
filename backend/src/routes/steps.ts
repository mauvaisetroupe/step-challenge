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
}

export default stepsRoutes