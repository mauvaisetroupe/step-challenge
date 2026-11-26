import { randomUUID } from 'node:crypto'

import type { FastifyPluginAsync } from 'fastify'
import type { Pool } from 'pg'

import type { RequireAuth } from '../auth/authenticate.js'
import type { User } from '../auth/signIn.js'
import {
  acceptLegal,
  LEGAL_VERSIONS,
  pendingConsents,
  type LegalDocument,
} from '../legal.js'
import { RATE_LIMITS } from '../rateLimit.js'

export type MeRoutesOptions = {
  db: Pool
  requireAuth: RequireAuth
}

type ConsentEntry =
  | { subject: LegalDocument; action: 'granted' | 'withdrawn'; version: string }
  | {
      subject: 'huawei_health'
      action: 'granted' | 'withdrawn'
      detail?: { scopes?: string[]; cause?: string }
    }

const consentEntrySchema = {
  type: 'object',
  required: ['subject', 'action'],
  additionalProperties: false,
  properties: {
    subject: { type: 'string', enum: ['terms', 'privacy', 'huawei_health'] },
    action: { type: 'string', enum: ['granted', 'withdrawn'] },
    version: { type: 'string', maxLength: 20 },
    // HUAWEI Health only: scopes granted, or why the app saw it
    // withdrawn ('app', 'huawei_app', 'switch').
    detail: {
      type: 'object',
      additionalProperties: false,
      properties: {
        scopes: {
          type: 'array',
          maxItems: 20,
          items: { type: 'string', maxLength: 200 },
        },
        cause: { type: 'string', enum: ['app', 'huawei_app', 'switch'] },
      },
    },
  },
  // A legal document always comes with the version accepted.
  if: { properties: { subject: { enum: ['terms', 'privacy'] } } },
  then: { required: ['version'] },
} as const

const meRoutes: FastifyPluginAsync<MeRoutesOptions> = async (
  app,
  { db, requireAuth },
) => {
  app.addHook('onRequest', requireAuth)

  app.get('/me', async (request, reply) => {
    const result = await db.query<User>(
      `
      SELECT id, name, created_at
      FROM users
      WHERE id = $1
      `,
      [request.auth!.userId],
    )

    return reply.send({
      ...result.rows[0],
      // Documents to accept before using the app (ADR 0017).
      pendingConsents: await pendingConsents(db, request.auth!.userId),
    })
  })

  /**
   * Records consents (ADR 0017): acceptance of a legal document at its
   * version in force, or a HUAWEI Health authorization granted or
   * withdrawn, as the app saw it.
   */
  app.post<{ Body: { consents: ConsentEntry[] } }>(
    '/me/consents',
    {
      schema: {
        body: {
          type: 'object',
          required: ['consents'],
          additionalProperties: false,
          properties: {
            consents: {
              type: 'array',
              minItems: 1,
              maxItems: 10,
              items: consentEntrySchema,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const me = request.auth!.userId
      const { consents } = request.body
      const documents: LegalDocument[] = []

      for (const consent of consents) {
        if (consent.subject === 'huawei_health') {
          continue
        }

        // Legal documents are accepted, never withdrawn here: refusing
        // them means leaving (sign-out or account deletion).
        if (consent.action !== 'granted') {
          return reply.code(422).send({ error: 'invalid_consent' })
        }

        // The document changed while the user was reading it.
        if (consent.version !== LEGAL_VERSIONS[consent.subject]) {
          return reply.code(409).send({
            error: 'legal_version_outdated',
            pendingConsents: await pendingConsents(db, me),
          })
        }

        documents.push(consent.subject)
      }

      const client = await db.connect()

      try {
        await client.query('BEGIN')

        await acceptLegal(client, me, documents)

        for (const consent of consents) {
          if (consent.subject === 'huawei_health') {
            await client.query(
              `
              INSERT INTO user_consents (id, user_id, subject, action, detail)
              VALUES ($1, $2, 'huawei_health', $3, $4)
              `,
              [randomUUID(), me, consent.action, consent.detail ?? null],
            )
          }
        }

        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }

      return reply.send({ pendingConsents: await pendingConsents(db, me) })
    },
  )

  /**
   * All the personal data of the user, as JSON (ADR 0017, right of
   * access). Never a secret: no Google identifier, no token hash.
   * Reports aimed at the user stay out: they protect the reporter.
   */
  app.get(
    '/me/export',
    { config: { rateLimit: RATE_LIMITS.export } },
    async (request, reply) => {
      const me = request.auth!.userId

      const rows = async (sql: string) =>
        (await db.query(sql, [me])).rows

      const [account] = await rows(`
        SELECT name, created_at AS "createdAt"
        FROM users
        WHERE id = $1
      `)

      const data = {
        exportedAt: new Date().toISOString(),
        account,
        credentials: await rows(`
          SELECT type, issuer AS provider, created_at AS "createdAt",
                 last_used_at AS "lastUsedAt"
          FROM user_credentials
          WHERE user_id = $1
          ORDER BY created_at
        `),
        sessions: await rows(`
          SELECT created_at AS "createdAt", last_used_at AS "lastUsedAt",
                 expires_at AS "expiresAt"
          FROM sessions
          WHERE user_id = $1
          ORDER BY created_at
        `),
        steps: await rows(`
          SELECT to_char(date, 'YYYY-MM-DD') AS date,
                 steps,
                 active_minutes      AS "activeMinutes",
                 very_active_minutes AS "veryActiveMinutes",
                 inactive_minutes    AS "inactiveMinutes",
                 updated_at          AS "updatedAt"
          FROM daily_steps
          WHERE user_id = $1
          ORDER BY date
        `),
        friends: await rows(`
          SELECT u.name, fa.alias, f.created_at AS since
          FROM friendships f
          JOIN users u
            ON u.id = CASE WHEN f.user_low = $1 THEN f.user_high ELSE f.user_low END
          LEFT JOIN friend_aliases fa
            ON fa.owner_id = $1 AND fa.friend_id = u.id
          WHERE f.user_low = $1 OR f.user_high = $1
          ORDER BY f.created_at
        `),
        invitations: await rows(`
          SELECT created_at AS "createdAt", expires_at AS "expiresAt",
                 revoked_at AS "revokedAt", use_count AS "useCount"
          FROM invitations
          WHERE inviter_id = $1
          ORDER BY created_at
        `),
        blocks: await rows(`
          SELECT blocked_name AS name, created_at AS since
          FROM user_blocks
          WHERE blocker_id = $1
          ORDER BY created_at
        `),
        reports: await rows(`
          SELECT reported_name AS "reportedName", reason, comment,
                 created_at AS "createdAt", resolved_at AS "resolvedAt",
                 resolution
          FROM user_reports
          WHERE reporter_id = $1
          ORDER BY created_at
        `),
        badges: await rows(`
          SELECT badge_id AS "badgeId", occurrence, points,
                 to_char(earned_on, 'YYYY-MM-DD') AS "earnedOn"
          FROM user_badges
          WHERE user_id = $1
          ORDER BY earned_on, badge_id
        `),
        consents: await rows(`
          SELECT subject, action, version, detail, created_at AS "createdAt"
          FROM user_consents
          WHERE user_id = $1
          ORDER BY created_at
        `),
      }

      return reply.send(data)
    },
  )

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
