import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Pool } from 'pg'

import { hashSessionToken, SESSION_TTL_DAYS } from './sessions.js'

export type AuthContext = {
  sessionId: string
  userId: string
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by requireAuth on authenticated routes. */
    auth?: AuthContext
  }
}

/**
 * Extracts the token from an `Authorization: Bearer <token>` header.
 */
export function readBearerToken(header: string | undefined) {
  const match = header?.match(/^Bearer ([A-Za-z0-9_-]+)$/)

  return match?.[1] ?? null
}

/**
 * Resolves a session token and extends the session (sliding expiry).
 *
 * Returns null when the token is unknown or the session has expired.
 */
export async function resolveSession(
  db: Pool,
  token: string,
): Promise<AuthContext | null> {
  const result = await db.query<{ id: string; user_id: string }>(
    `
    UPDATE sessions
    SET last_used_at = now(),
        expires_at = now() + make_interval(days => $2)
    WHERE token_hash = $1
      AND expires_at > now()
    RETURNING id, user_id
    `,
    [hashSessionToken(token), SESSION_TTL_DAYS],
  )

  const session = result.rows[0]

  return session
    ? { sessionId: session.id, userId: session.user_id }
    : null
}

/**
 * Creates a hook that rejects unauthenticated requests and sets
 * request.auth from the session token.
 *
 * Register it as an `onRequest` hook: it only needs the headers, so
 * unauthenticated requests are rejected before their body is parsed
 * and validated, without revealing validation details.
 *
 * The user identity always comes from the session, never from the
 * request body or parameters (ADR 0001).
 */
export function createRequireAuth(db: Pool) {
  return async function requireAuth(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const token = readBearerToken(request.headers.authorization)
    const auth = token ? await resolveSession(db, token) : null

    if (!auth) {
      return reply
        .code(401)
        .header('WWW-Authenticate', 'Bearer')
        .send({ error: 'unauthenticated' })
    }

    request.auth = auth
  }
}

export type RequireAuth = ReturnType<typeof createRequireAuth>
