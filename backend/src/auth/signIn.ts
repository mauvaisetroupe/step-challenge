import { randomUUID } from 'node:crypto'

import type { Pool } from 'pg'

import type { OidcIdentity } from './google.js'
import { createSession } from './sessions.js'

export type User = {
  id: string
  name: string
  created_at: string
}

export type SignInResult = {
  sessionToken: string
  user: User
  isNewUser: boolean
}

/** A new user must choose a display name. */
export class DisplayNameRequiredError extends Error {
  constructor() {
    super('A display name is required to create an account')
    this.name = 'DisplayNameRequiredError'
  }
}

/**
 * The display name is already used.
 *
 * Temporary: names stay unique until the cleanup migration drops
 * users_name_unique, once the previous app version is retired.
 */
export class DisplayNameTakenError extends Error {
  constructor() {
    super('This display name is already used')
    this.name = 'DisplayNameTakenError'
  }
}

const UNIQUE_VIOLATION = '23505'

function isUniqueViolation(error: unknown, constraint: string) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === UNIQUE_VIOLATION &&
    'constraint' in error &&
    error.constraint === constraint
  )
}

/**
 * Signs in a verified OIDC identity.
 *
 * Finds the user linked to (issuer, subject), or creates one with the
 * given display name, then opens a new session.
 */
export async function signInWithOidc(
  db: Pool,
  identity: OidcIdentity,
  displayName: string | undefined,
  isRetry = false,
): Promise<SignInResult> {
  const client = await db.connect()

  try {
    await client.query('BEGIN')

    const existing = await client.query<User>(
      `
      UPDATE user_credentials uc
      SET last_used_at = now()
      FROM users u
      WHERE u.id = uc.user_id
        AND uc.issuer = $1
        AND uc.subject = $2
      RETURNING u.id, u.name, u.created_at
      `,
      [identity.issuer, identity.subject],
    )

    let user = existing.rows[0]
    const isNewUser = !user

    if (!user) {
      const name = displayName?.trim()

      if (!name) {
        throw new DisplayNameRequiredError()
      }

      const created = await client.query<User>(
        `
        INSERT INTO users (id, name)
        VALUES ($1, $2)
        RETURNING id, name, created_at
        `,
        [randomUUID(), name],
      )

      user = created.rows[0]

      await client.query(
        `
        INSERT INTO user_credentials
          (id, user_id, type, issuer, subject, last_used_at)
        VALUES ($1, $2, 'oidc', $3, $4, now())
        `,
        [randomUUID(), user.id, identity.issuer, identity.subject],
      )
    }

    const sessionToken = await createSession(client, user.id)

    await client.query('COMMIT')

    return { sessionToken, user, isNewUser }
  } catch (error) {
    await client.query('ROLLBACK')

    const nameTaken = isUniqueViolation(error, 'users_name_unique')
    const identityTaken = isUniqueViolation(
      error,
      'user_credentials_issuer_subject_key',
    )

    // Two concurrent first sign-ins with the same Google account (double
    // tap): the other request may have created the user, which surfaces
    // as a conflict on the name or on the identity. Retry once: the
    // retry finds the user if it exists.
    if ((nameTaken || identityTaken) && !isRetry) {
      return signInWithOidc(db, identity, displayName, true)
    }

    if (nameTaken) {
      throw new DisplayNameTakenError()
    }

    throw error
  } finally {
    client.release()
  }
}
