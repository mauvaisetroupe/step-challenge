import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'

import type { Pool, PoolClient } from 'pg'

import type { User } from '../auth/signIn.js'
import { seedDemoFriends, type DemoStepsOptions } from './demoData.js'

type Db = Pool | PoolClient

/**
 * Demo account for store reviewers (ADR 0006): a single account,
 * recognized by a dedicated sign-in credential that only
 * POST /api/auth/demo uses.
 */
export const DEMO_CREDENTIAL = {
  type: 'demo',
  issuer: 'step-challenge',
  subject: 'demo',
} as const

export const DEMO_DISPLAY_NAME = 'Demo'

/** ADR 0006: a long random code, given to reviewers. */
export const MIN_DEMO_ACCESS_CODE_LENGTH = 20

/**
 * Reads DEMO_ACCESS_CODE from the configuration. Absent or empty: demo
 * access is disabled. Too short: refused, rather than exposing a sign-in
 * route protected by a guessable code.
 */
export function parseDemoAccessCode(value: string | undefined) {
  const code = value?.trim()

  if (!code) {
    return undefined
  }

  if (code.length < MIN_DEMO_ACCESS_CODE_LENGTH) {
    throw new Error(
      `DEMO_ACCESS_CODE must have at least ${MIN_DEMO_ACCESS_CODE_LENGTH} characters`,
    )
  }

  return code
}

/**
 * Compares a submitted code with the configured one in constant time:
 * both are hashed first, so the comparison does not depend on their
 * lengths or contents.
 */
export function isDemoAccessCode(expected: string, submitted: string) {
  const digest = (value: string) => createHash('sha256').update(value).digest()

  return timingSafeEqual(digest(expected), digest(submitted))
}

/**
 * Returns the demo account, creating it if needed (first use, or after a
 * reviewer deleted it to test account deletion), and refreshes its
 * fictitious friends and their steps.
 *
 * Meant to run inside a transaction: two concurrent first uses make one
 * of them fail on the credential's unique constraint, and the caller
 * retries.
 */
export async function ensureDemoAccount(
  db: Db,
  options: DemoStepsOptions = {},
): Promise<User> {
  const existing = await db.query<User>(
    `
    UPDATE user_credentials uc
    SET last_used_at = now()
    FROM users u
    WHERE u.id = uc.user_id
      AND uc.issuer = $1
      AND uc.subject = $2
    RETURNING u.id, u.name, u.created_at
    `,
    [DEMO_CREDENTIAL.issuer, DEMO_CREDENTIAL.subject],
  )

  let user = existing.rows[0]

  if (!user) {
    const created = await db.query<User>(
      `
      INSERT INTO users (id, name)
      VALUES ($1, $2)
      RETURNING id, name, created_at
      `,
      [randomUUID(), DEMO_DISPLAY_NAME],
    )

    user = created.rows[0]

    await db.query(
      `
      INSERT INTO user_credentials
        (id, user_id, type, issuer, subject, last_used_at)
      VALUES ($1, $2, $3, $4, $5, now())
      `,
      [
        randomUUID(),
        user.id,
        DEMO_CREDENTIAL.type,
        DEMO_CREDENTIAL.issuer,
        DEMO_CREDENTIAL.subject,
      ],
    )
  }

  await seedDemoFriends(db, user.id, options)

  return user
}
