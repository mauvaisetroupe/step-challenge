import { randomUUID } from 'node:crypto'

import type { FastifyPluginAsync } from 'fastify'
import type { Pool } from 'pg'

import type { RequireAuth } from '../auth/authenticate.js'
import {
  areFriends,
  countFriends,
  createFriendship,
  isBlockedEitherWay,
  MAX_FRIENDS,
} from '../friends/friendships.js'
import {
  formatInvitationCode,
  generateInvitationCode,
  hashInvitationCode,
  normalizeInvitationCode,
} from '../friends/invitationCode.js'
import { RATE_LIMITS } from '../rateLimit.js'

export type InvitationRoutesOptions = {
  db: Pool
  requireAuth: RequireAuth
  /** Base of the invitation links, e.g. https://step.architech.lu */
  publicBaseUrl: string
}

/** ADR 0002: a link can be shared to several people for 7 days. */
export const INVITATION_TTL_DAYS = 7

/** ADR 0002: safety limit, adjustable. */
export const MAX_ACTIVE_INVITATIONS = 10

const UNIQUE_VIOLATION = '23505'

type ValidInvitation = {
  id: string
  inviter_id: string
  inviter_name: string
  expires_at: string
}

const codeParamSchema = {
  type: 'object',
  required: ['code'],
  properties: {
    code: { type: 'string', minLength: 1, maxLength: 32 },
  },
} as const

const invitationRoutes: FastifyPluginAsync<InvitationRoutesOptions> = async (
  app,
  { db, requireAuth, publicBaseUrl },
) => {
  app.addHook('onRequest', requireAuth)

  /**
   * Creates an invitation link. The code is returned once: only its hash
   * is stored.
   */
  app.post(
    '/invitations',
    { config: { rateLimit: RATE_LIMITS.invitationCreate } },
    async (request, reply) => {
      const inviterId = request.auth!.userId

      const active = await db.query<{ count: number }>(
        `
        SELECT count(*)::int AS count
        FROM invitations
        WHERE inviter_id = $1 AND revoked_at IS NULL AND expires_at > now()
        `,
        [inviterId],
      )

      if (active.rows[0].count >= MAX_ACTIVE_INVITATIONS) {
        return reply.code(409).send({ error: 'too_many_invitations' })
      }

      // A collision between two random 40-bit codes is very unlikely;
      // retry a few times rather than failing.
      for (let attempt = 0; attempt < 3; attempt++) {
        const code = generateInvitationCode()

        try {
          const result = await db.query<{ id: string; expires_at: string }>(
            `
            INSERT INTO invitations (id, inviter_id, code_hash, expires_at)
            VALUES ($1, $2, $3, now() + make_interval(days => $4))
            RETURNING id, expires_at
            `,
            [randomUUID(), inviterId, hashInvitationCode(code), INVITATION_TTL_DAYS],
          )

          const formatted = formatInvitationCode(code)

          return reply.code(201).send({
            id: result.rows[0].id,
            code: formatted,
            url: `${publicBaseUrl}/i/${formatted}`,
            expiresAt: result.rows[0].expires_at,
          })
        } catch (error: any) {
          if (error.code !== UNIQUE_VIOLATION) {
            throw error
          }
        }
      }

      throw new Error('Could not generate a unique invitation code')
    },
  )

  /** Lists my active invitations (codes are not stored, so not shown). */
  app.get('/invitations', async (request, reply) => {
    const result = await db.query(
      `
      SELECT id, created_at AS "createdAt", expires_at AS "expiresAt",
             use_count AS "useCount"
      FROM invitations
      WHERE inviter_id = $1 AND revoked_at IS NULL AND expires_at > now()
      ORDER BY created_at DESC
      `,
      [request.auth!.userId],
    )

    return reply.send(result.rows)
  })

  app.delete<{ Params: { id: string } }>(
    '/invitations/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply) => {
      const result = await db.query(
        `
        UPDATE invitations
        SET revoked_at = now()
        WHERE id = $1 AND inviter_id = $2 AND revoked_at IS NULL
        `,
        [request.params.id, request.auth!.userId],
      )

      if (result.rowCount === 0) {
        return reply.code(404).send({ error: 'invitation_not_found' })
      }

      return reply.code(204).send()
    },
  )

  /**
   * Looks up a valid (not expired, not revoked) invitation by code.
   * Unknown, expired and revoked codes are indistinguishable.
   */
  async function findValidInvitation(
    code: string,
    lock = false,
    client: Pick<Pool, 'query'> = db,
  ) {
    const normalized = normalizeInvitationCode(code)

    if (!normalized) {
      return null
    }

    const result = await client.query<ValidInvitation>(
      `
      SELECT i.id, i.inviter_id, u.name AS inviter_name, i.expires_at
      FROM invitations i
      JOIN users u ON u.id = i.inviter_id
      WHERE i.code_hash = $1 AND i.revoked_at IS NULL AND i.expires_at > now()
      ${lock ? 'FOR UPDATE OF i' : ''}
      `,
      [hashInvitationCode(normalized)],
    )

    return result.rows[0] ?? null
  }

  /** Preview before accepting: who invites me? */
  app.get<{ Params: { code: string } }>(
    '/invitations/:code',
    {
      config: { rateLimit: RATE_LIMITS.invitationLookup },
      schema: { params: codeParamSchema },
    },
    async (request, reply) => {
      const invitation = await findValidInvitation(request.params.code)
      const me = request.auth!.userId

      // A block (either way) looks like an invalid link: the blocked
      // person must not learn that they were blocked (ADR 0004).
      if (
        !invitation ||
        (await isBlockedEitherWay(db, me, invitation.inviter_id))
      ) {
        return reply.code(404).send({ error: 'invitation_not_found' })
      }

      return reply.send({
        inviter: { id: invitation.inviter_id, name: invitation.inviter_name },
        expiresAt: invitation.expires_at,
        isOwnInvitation: invitation.inviter_id === me,
        alreadyFriends: await areFriends(db, me, invitation.inviter_id),
      })
    },
  )

  /** Accepts an invitation: the inviter and I become friends. */
  app.post<{ Params: { code: string } }>(
    '/invitations/:code/accept',
    {
      config: { rateLimit: RATE_LIMITS.invitationLookup },
      schema: { params: codeParamSchema },
    },
    async (request, reply) => {
      const me = request.auth!.userId
      const client = await db.connect()

      try {
        await client.query('BEGIN')

        const invitation = await findValidInvitation(
          request.params.code,
          true,
          client,
        )

        if (
          !invitation ||
          (await isBlockedEitherWay(client, me, invitation.inviter_id))
        ) {
          await client.query('ROLLBACK')
          return reply.code(404).send({ error: 'invitation_not_found' })
        }

        const inviter = {
          id: invitation.inviter_id,
          name: invitation.inviter_name,
        }

        if (inviter.id === me) {
          await client.query('ROLLBACK')
          return reply.code(400).send({ error: 'own_invitation' })
        }

        if (await areFriends(client, me, inviter.id)) {
          await client.query('ROLLBACK')
          return reply.send({ friend: inviter, alreadyFriends: true })
        }

        if (
          (await countFriends(client, me)) >= MAX_FRIENDS ||
          (await countFriends(client, inviter.id)) >= MAX_FRIENDS
        ) {
          await client.query('ROLLBACK')
          return reply.code(409).send({ error: 'friend_limit_reached' })
        }

        await createFriendship(client, me, inviter.id, invitation.id)
        await client.query(
          'UPDATE invitations SET use_count = use_count + 1 WHERE id = $1',
          [invitation.id],
        )

        await client.query('COMMIT')

        return reply.code(201).send({ friend: inviter, alreadyFriends: false })
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    },
  )
}

export default invitationRoutes
