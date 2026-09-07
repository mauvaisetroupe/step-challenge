import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'node:crypto'
import { pool } from '../db.js'

const usersRoutes: FastifyPluginAsync = async (app) => {
  app.post('/users', async (request, reply) => {
    const { name } = request.body as {
      name: string
    }

    const trimmedName = name.trim()

    if (!trimmedName) {
      return reply.code(400).send({
        error: 'Name is required',
      })
    }

    const id = randomUUID()

    try {
      const result = await pool.query(
        `
    INSERT INTO users (id, name)
    VALUES ($1, $2)
    RETURNING id, name, created_at
    `,
        [id, trimmedName]
      )

      return reply.send(result.rows[0])
    } catch (error: any) {
      if (error.code === '23505') {
        return reply.code(409).send({
          error: 'Username already exists',
        })
      }

      throw error
    }
  })

  app.get('/users/', async (request, reply) => {
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