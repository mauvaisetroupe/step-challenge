import { createHash, randomBytes, randomUUID } from 'node:crypto'

import type { Pool, PoolClient } from 'pg'

/**
 * Sliding lifetime of a mobile session (ADR 0001): long enough for the
 * daily background sync to keep working without user interaction.
 */
export const SESSION_TTL_DAYS = 180

const TOKEN_BYTES = 32

/**
 * Generates an opaque session token (256 random bits, base64url).
 *
 * The token is returned to the client once and never stored as is.
 */
export function generateSessionToken() {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

/**
 * Hashes a session token for storage and lookup.
 *
 * A fast hash is sufficient: the token is a high-entropy random secret,
 * not a human-chosen password.
 */
export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest()
}

/**
 * Creates a session for the user and returns its token.
 */
export async function createSession(
  db: Pool | PoolClient,
  userId: string,
) {
  const token = generateSessionToken()

  await db.query(
    `
    INSERT INTO sessions (id, user_id, token_hash, expires_at)
    VALUES ($1, $2, $3, now() + make_interval(days => $4))
    `,
    [randomUUID(), userId, hashSessionToken(token), SESSION_TTL_DAYS],
  )

  return token
}
