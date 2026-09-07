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

  app.post('/steps/sample', async (request, reply) => {
    const { userId, recordedAt, steps } = request.body as {
      userId: string
      recordedAt: string
      steps: number
    }

    await pool.query(
      `
      INSERT INTO step_samples (user_id, recorded_at, steps)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, recorded_at)
      DO UPDATE SET
        steps = EXCLUDED.steps
      `,
      [userId, recordedAt, steps]
    )

    return reply.send({ success: true })
  })

  app.get('/steps/samples/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string }

    const result = await pool.query(
      `
      SELECT user_id, recorded_at, steps
      FROM step_samples
      WHERE user_id = $1
      ORDER BY recorded_at ASC
      `,
      [userId]
    )

    return reply.send(result.rows)
  })
}

export default stepsRoutes