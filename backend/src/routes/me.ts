import type { FastifyPluginAsync } from 'fastify'
import type { Pool } from 'pg'

import type { RequireAuth } from '../auth/authenticate.js'
import type { User } from '../auth/signIn.js'

export type MeRoutesOptions = {
  db: Pool
  requireAuth: RequireAuth
}

const meRoutes: FastifyPluginAsync<MeRoutesOptions> = async (
  app,
  { db, requireAuth },
) => {
  app.addHook('preHandler', requireAuth)

  app.get('/me', async (request, reply) => {
    const result = await db.query<User>(
      `
      SELECT id, name, created_at
      FROM users
      WHERE id = $1
      `,
      [request.auth!.userId],
    )

    return reply.send(result.rows[0])
  })

  app.patch<{
    Body: { displayName: string }
  }>(
    '/me',
    {
      schema: {
        body: {
          type: 'object',
          required: ['displayName'],
          additionalProperties: false,
          properties: {
            displayName: { type: 'string', minLength: 1, maxLength: 50 },
          },
        },
      },
    },
    async (request, reply) => {
      const name = request.body.displayName.trim()

      if (!name) {
        return reply.code(422).send({ error: 'display_name_required' })
      }

      const result = await db.query<User>(
        `
        UPDATE users
        SET name = $2
        WHERE id = $1
        RETURNING id, name, created_at
        `,
        [request.auth!.userId, name],
      )

      return reply.send(result.rows[0])
    },
  )

  /**
   * Deletes the account. Sessions, credentials and steps are removed by
   * ON DELETE CASCADE.
   */
  app.delete('/me', async (request, reply) => {
    await db.query('DELETE FROM users WHERE id = $1', [
      request.auth!.userId,
    ])

    return reply.code(204).send()
  })
}

export default meRoutes
