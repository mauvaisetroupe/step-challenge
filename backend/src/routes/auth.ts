import type { FastifyPluginAsync } from 'fastify'
import type { Pool } from 'pg'

import type { RequireAuth } from '../auth/authenticate.js'
import {
  InvalidIdTokenError,
  type OidcIdentity,
} from '../auth/google.js'
import {
  DisplayNameRequiredError,
  DisplayNameTakenError,
  signInWithOidc,
} from '../auth/signIn.js'

export type AuthRoutesOptions = {
  db: Pool
  verifyGoogleIdToken: (idToken: string) => Promise<OidcIdentity>
  requireAuth: RequireAuth
}

const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  app,
  { db, verifyGoogleIdToken, requireAuth },
) => {
  /**
   * Revokes the current session only; other devices stay signed in.
   */
  app.post(
    '/auth/logout',
    { preHandler: requireAuth },
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

        if (error instanceof DisplayNameTakenError) {
          return reply.code(409).send({
            error: 'display_name_taken',
          })
        }

        throw error
      }
    },
  )
}

export default authRoutes
