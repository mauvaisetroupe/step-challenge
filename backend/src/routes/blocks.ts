import type { FastifyPluginAsync } from 'fastify'
import type { Pool } from 'pg'

import type { RequireAuth } from '../auth/authenticate.js'
import { endFriendship } from '../friends/friendships.js'

export type BlockRoutesOptions = {
  db: Pool
  requireAuth: RequireAuth
}

const userIdSchema = { type: 'string', format: 'uuid' } as const

/**
 * Blocking (ADR 0004): blocking someone ends the friendship, and prevents
 * any new friendship between us, in both directions (see the invitation
 * routes). The blocked person is not told.
 */
const blockRoutes: FastifyPluginAsync<BlockRoutesOptions> = async (
  app,
  { db, requireAuth },
) => {
  app.addHook('onRequest', requireAuth)

  /** People I blocked, with their display name when I blocked them. */
  app.get('/blocks', async (request, reply) => {
    const result = await db.query(
      `
      SELECT blocked_id AS "userId", blocked_name AS name, created_at AS since
      FROM user_blocks
      WHERE blocker_id = $1
      ORDER BY created_at DESC
      `,
      [request.auth!.userId],
    )

    return reply.send(result.rows)
  })

  /**
   * Blocks a user: a friend, or the author of an invitation I received.
   * Idempotent: blocking again changes nothing.
   */
  app.post<{ Body: { userId: string } }>(
    '/blocks',
    {
      schema: {
        body: {
          type: 'object',
          required: ['userId'],
          additionalProperties: false,
          properties: { userId: userIdSchema },
        },
      },
    },
    async (request, reply) => {
      const me = request.auth!.userId
      const blockedId = request.body.userId

      if (blockedId === me) {
        return reply.code(400).send({ error: 'cannot_block_self' })
      }

      const client = await db.connect()

      try {
        await client.query('BEGIN')

        const user = await client.query<{ name: string }>(
          'SELECT name FROM users WHERE id = $1',
          [blockedId],
        )

        if (user.rowCount === 0) {
          await client.query('ROLLBACK')
          return reply.code(404).send({ error: 'user_not_found' })
        }

        const inserted = await client.query(
          `
          INSERT INTO user_blocks (blocker_id, blocked_id, blocked_name)
          VALUES ($1, $2, $3)
          ON CONFLICT (blocker_id, blocked_id) DO NOTHING
          `,
          [me, blockedId, user.rows[0].name],
        )

        await endFriendship(client, me, blockedId)
        await client.query('COMMIT')

        return reply.code(inserted.rowCount === 1 ? 201 : 200).send()
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    },
  )

  /** Unblocks a user. The friendship is not restored. */
  app.delete<{ Params: { userId: string } }>(
    '/blocks/:userId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['userId'],
          properties: { userId: userIdSchema },
        },
      },
    },
    async (request, reply) => {
      const result = await db.query(
        'DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2',
        [request.auth!.userId, request.params.userId],
      )

      if (result.rowCount === 0) {
        return reply.code(404).send({ error: 'block_not_found' })
      }

      return reply.code(204).send()
    },
  )
}

export default blockRoutes
