import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'node:crypto'
import { pool } from '../db.js'

const usersRoutes: FastifyPluginAsync = async (app) => {
  app.post('/users', async (request, reply) => {
    const { name } = request.body as {
      name: string
    }

    const id = randomUUID()

    const result = await pool.query(
      `
      INSERT INTO users (id, name)
      VALUES ($1, $2)
      RETURNING id, name, created_at
      `,
      [id, name]
    )

    return reply.send(result.rows[0])
  })
}

export default usersRoutes
