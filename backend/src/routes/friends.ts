import type { FastifyPluginAsync } from 'fastify'
import type { Pool } from 'pg'

import type { RequireAuth } from '../auth/authenticate.js'
import { areFriends, canonicalPair } from '../friends/friendships.js'

export type FriendRoutesOptions = {
  db: Pool
  requireAuth: RequireAuth
}

const friendIdParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const

const friendRoutes: FastifyPluginAsync<FriendRoutesOptions> = async (
  app,
  { db, requireAuth },
) => {
  app.addHook('onRequest', requireAuth)

  /**
   * My friends, with the alias I gave them (ADR 0002, "Reconnaître ses
   * amis"). Sorted by the name I see.
   */
  app.get('/friends', async (request, reply) => {
    const result = await db.query(
      `
      SELECT u.id, u.name, fa.alias, f.created_at AS since
      FROM friendships f
      JOIN users u
        ON u.id = CASE WHEN f.user_low = $1 THEN f.user_high ELSE f.user_low END
      LEFT JOIN friend_aliases fa
        ON fa.owner_id = $1 AND fa.friend_id = u.id
      WHERE f.user_low = $1 OR f.user_high = $1
      ORDER BY lower(COALESCE(fa.alias, u.name)), u.id
      `,
      [request.auth!.userId],
    )

    return reply.send(result.rows)
  })

  /**
   * Removes a friend, on both sides. Also deletes the aliases in both
   * directions and revokes my active invitations, so that the removed
   * friend cannot come back with a link that is still valid.
   */
  app.delete<{ Params: { id: string } }>(
    '/friends/:id',
    { schema: { params: friendIdParams } },
    async (request, reply) => {
      const me = request.auth!.userId
      const friendId = request.params.id
      const [low, high] = canonicalPair(me, friendId)
      const client = await db.connect()

      try {
        await client.query('BEGIN')

        const deleted = await client.query(
          'DELETE FROM friendships WHERE user_low = $1 AND user_high = $2',
          [low, high],
        )

        if (deleted.rowCount === 0) {
          await client.query('ROLLBACK')
          return reply.code(404).send({ error: 'friend_not_found' })
        }

        await client.query(
          `
          DELETE FROM friend_aliases
          WHERE (owner_id = $1 AND friend_id = $2)
             OR (owner_id = $2 AND friend_id = $1)
          `,
          [me, friendId],
        )

        await client.query(
          `
          UPDATE invitations
          SET revoked_at = now()
          WHERE inviter_id = $1 AND revoked_at IS NULL AND expires_at > now()
          `,
          [me],
        )

        await client.query('COMMIT')

        return reply.code(204).send()
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    },
  )

  /** Sets the alias I give to a friend. Only I can see it. */
  app.put<{ Params: { id: string }; Body: { alias: string } }>(
    '/friends/:id/alias',
    {
      schema: {
        params: friendIdParams,
        body: {
          type: 'object',
          required: ['alias'],
          additionalProperties: false,
          properties: {
            alias: { type: 'string', minLength: 1, maxLength: 50 },
          },
        },
      },
    },
    async (request, reply) => {
      const me = request.auth!.userId
      const friendId = request.params.id
      const alias = request.body.alias.trim()

      if (!alias) {
        return reply.code(422).send({ error: 'alias_required' })
      }

      if (!(await areFriends(db, me, friendId))) {
        return reply.code(404).send({ error: 'friend_not_found' })
      }

      await db.query(
        `
        INSERT INTO friend_aliases (owner_id, friend_id, alias)
        VALUES ($1, $2, $3)
        ON CONFLICT (owner_id, friend_id)
        DO UPDATE SET alias = EXCLUDED.alias, updated_at = now()
        `,
        [me, friendId, alias],
      )

      return reply.send({ id: friendId, alias })
    },
  )

  /** Removes my alias: the friend is shown with their own name again. */
  app.delete<{ Params: { id: string } }>(
    '/friends/:id/alias',
    { schema: { params: friendIdParams } },
    async (request, reply) => {
      const me = request.auth!.userId
      const friendId = request.params.id

      if (!(await areFriends(db, me, friendId))) {
        return reply.code(404).send({ error: 'friend_not_found' })
      }

      await db.query(
        'DELETE FROM friend_aliases WHERE owner_id = $1 AND friend_id = $2',
        [me, friendId],
      )

      return reply.code(204).send()
    },
  )
}

export default friendRoutes
