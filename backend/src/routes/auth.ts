import type { FastifyPluginAsync } from 'fastify'
import type { Pool } from 'pg'

import type { RequireAuth } from '../auth/authenticate.js'
import {
  InvalidIdTokenError,
  type OidcIdentity,
} from '../auth/google.js'
import {
  DisplayNameRequiredError,
  signInDemo,
  signInWithOidc,
} from '../auth/signIn.js'
import { isDemoAccessCode } from '../demo/demoAccount.js'
import { RATE_LIMITS } from '../rateLimit.js'

export type AuthRoutesOptions = {
  db: Pool
  verifyGoogleIdToken: (idToken: string) => Promise<OidcIdentity>
  requireAuth: RequireAuth
  /**
   * Demo access code for store reviewers (ADR 0006). Absent: the demo
   * sign-in route does not exist (404).
   */
  demoAccessCode?: string
}

const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  app,
  { db, verifyGoogleIdToken, requireAuth, demoAccessCode },
) => {
  /**
   * Revokes the current session only; other devices stay signed in.
   */
  app.post(
    '/auth/logout',
    { onRequest: requireAuth },
    async (request, reply) => {
      await db.query('DELETE FROM sessions WHERE id = $1', [
        request.auth!.sessionId,
      ])

      return reply.code(204).send()
    },
  )

  app.post<{
    Body: {
      idToken: string
      displayName?: string
    }
  }>(
    '/auth/google',
    {
      config: { rateLimit: RATE_LIMITS.signIn },
      schema: {
        body: {
          type: 'object',
          required: ['idToken'],
          additionalProperties: false,
          properties: {
            idToken: { type: 'string', minLength: 1, maxLength: 4096 },
            displayName: { type: 'string', minLength: 1, maxLength: 50 },
          },
        },
      },
    },
    async (request, reply) => {
      let identity: OidcIdentity

      try {
        identity = await verifyGoogleIdToken(request.body.idToken)
      } catch (error) {
        if (error instanceof InvalidIdTokenError) {
          request.log.info({ reason: error.message }, 'Invalid ID token')

          return reply.code(401).send({
            error: 'invalid_id_token',
          })
        }

        throw error
      }

      try {
        const result = await signInWithOidc(
          db,
          identity,
          request.body.displayName,
        )

        return reply.code(result.isNewUser ? 201 : 200).send(result)
      } catch (error) {
        if (error instanceof DisplayNameRequiredError) {
          return reply.code(422).send({
            error: 'display_name_required',
          })
        }

        throw error
      }
    },
  )

  if (demoAccessCode) {
    /**
     * Signs in to the demo account with the access code given to store
     * reviewers (ADR 0006). The account and its fictitious friends are
     * recreated or refreshed at each sign-in.
     */
    app.post<{ Body: { code: string } }>(
      '/auth/demo',
      {
        config: { rateLimit: RATE_LIMITS.demoSignIn },
        schema: {
          body: {
            type: 'object',
            required: ['code'],
            additionalProperties: false,
            properties: {
              code: { type: 'string', minLength: 1, maxLength: 200 },
            },
          },
        },
      },
      async (request, reply) => {
        if (!isDemoAccessCode(demoAccessCode, request.body.code.trim())) {
          request.log.info('Invalid demo access code')

          return reply.code(401).send({ error: 'invalid_demo_code' })
        }

        const result = await signInDemo(db)

        request.log.info({ userId: result.user.id }, 'Demo sign-in')

        return reply.code(200).send(result)
      },
    )
  }
}

export default authRoutes
