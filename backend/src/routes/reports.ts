import { randomUUID } from 'node:crypto'

import type { FastifyPluginAsync } from 'fastify'
import type { Pool } from 'pg'

import type { RequireAuth } from '../auth/authenticate.js'
import { areFriends } from '../friends/friendships.js'
import {
  hashInvitationCode,
  normalizeInvitationCode,
} from '../friends/invitationCode.js'
import { RATE_LIMITS } from '../rateLimit.js'

export type ReportRoutesOptions = {
  db: Pool
  requireAuth: RequireAuth
}

export const REPORT_REASONS = [
  'offensive_name',
  'impersonation',
  'harassment',
  'other',
] as const

type ReportBody = {
  userId: string
  reason: (typeof REPORT_REASONS)[number]
  comment?: string
  invitationCode?: string
}

/**
 * Reports (ADR 0004), handled by hand by the maintainer
 * (docs/moderation.md). The reported person is not told.
 */
const reportRoutes: FastifyPluginAsync<ReportRoutesOptions> = async (
  app,
  { db, requireAuth },
) => {
  app.addHook('onRequest', requireAuth)

  /**
   * Reports a friend, or the author of an invitation I received (proved by
   * its code, even expired or revoked: an offensive name may be reported
   * later). Anyone else cannot be reported, and gets the same answer as an
   * unknown user.
   */
  app.post<{ Body: ReportBody }>(
    '/reports',
    {
      config: { rateLimit: RATE_LIMITS.report },
      schema: {
        body: {
          type: 'object',
          required: ['userId', 'reason'],
          additionalProperties: false,
          properties: {
            userId: { type: 'string', format: 'uuid' },
            reason: { type: 'string', enum: [...REPORT_REASONS] },
            comment: { type: 'string', maxLength: 500 },
            invitationCode: { type: 'string', minLength: 1, maxLength: 32 },
          },
        },
      },
    },
    async (request, reply) => {
      const me = request.auth!.userId
      const { userId, reason, invitationCode } = request.body
      const comment = request.body.comment?.trim() || null

      if (userId === me) {
        return reply.code(400).send({ error: 'cannot_report_self' })
      }

      const reported = await db.query<{ name: string }>(
        'SELECT name FROM users WHERE id = $1',
        [userId],
      )

      if (reported.rowCount === 0) {
        return reply.code(404).send({ error: 'user_not_found' })
      }

      let invitationId: string | null = null

      if (invitationCode) {
        const normalized = normalizeInvitationCode(invitationCode)
        const invitation = normalized
          ? await db.query<{ id: string }>(
              'SELECT id FROM invitations WHERE code_hash = $1 AND inviter_id = $2',
              [hashInvitationCode(normalized), userId],
            )
          : null

        invitationId = invitation?.rows[0]?.id ?? null
      }

      if (!invitationId && !(await areFriends(db, me, userId))) {
        return reply.code(404).send({ error: 'user_not_found' })
      }

      await db.query(
        `
        INSERT INTO user_reports
          (id, reporter_id, reported_id, reported_name, reason, comment, invitation_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          randomUUID(),
          me,
          userId,
          reported.rows[0].name,
          reason,
          comment,
          invitationId,
        ],
      )

      return reply.code(201).send()
    },
  )
}

export default reportRoutes
