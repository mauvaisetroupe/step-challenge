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

  app.get('/users/:id', async (request, reply) => {
    const { id } = request.params as {
      id: string
    }

    const result = await pool.query(
      `
      SELECT id, name, created_at
      FROM users
      WHERE id = $1
      `,
      [id]
    )

    if (result.rows.length === 0) {
      return reply.code(404).send({
        error: 'User not found',
      })
    }

    return reply.send(result.rows[0])
  })
}

export default usersRoutes