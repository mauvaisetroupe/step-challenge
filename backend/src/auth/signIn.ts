import { randomUUID } from 'node:crypto'

import type { Pool } from 'pg'

import { ensureDemoAccount } from '../demo/demoAccount.js'
import { acceptLegal, LEGAL_DOCUMENTS, LEGAL_VERSIONS } from '../legal.js'
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

/** Versions of the legal documents seen when creating the account. */
export type AcceptedLegal = Partial<Record<string, string>>

/**
 * Signs in a verified OIDC identity.
 *
 * Finds the user linked to (issuer, subject), or creates one with the
 * given display name, then opens a new session. A new account also
 * records the legal documents accepted at their version in force
 * (ADR 0017); an outdated one stays to accept.
 */
export async function signInWithOidc(
  db: Pool,
  identity: OidcIdentity,
  displayName: string | undefined,
  acceptedLegal: AcceptedLegal = {},
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

      await acceptLegal(
        client,
        user.id,
        LEGAL_DOCUMENTS.filter(
          (document) => acceptedLegal[document] === LEGAL_VERSIONS[document],
        ),
      )
    }

    const sessionToken = await createSession(client, user.id)

    await client.query('COMMIT')

    return { sessionToken, user, isNewUser }
  } catch (error) {
    await client.query('ROLLBACK')

    // Two concurrent first sign-ins with the same Google account (double
    // tap): the other request created the user first. Retry once: the
    // retry finds that user.
    if (
      isUniqueViolation(error, 'user_credentials_issuer_subject_key') &&
      !isRetry
    ) {
      return signInWithOidc(db, identity, displayName, acceptedLegal, true)
    }

    throw error
  } finally {
    client.release()
  }
}

/**
 * Opens a session on the demo account (ADR 0006), recreating it and
 * refreshing its fictitious friends if needed. The caller has checked
 * the demo access code.
 */
export async function signInDemo(
  db: Pool,
  isRetry = false,
): Promise<SignInResult> {
  const client = await db.connect()

  try {
    await client.query('BEGIN')

    const user = await ensureDemoAccount(client)
    const sessionToken = await createSession(client, user.id)

    await client.query('COMMIT')

    // The account exists: no display name to choose.
    return { sessionToken, user, isNewUser: false }
  } catch (error) {
    await client.query('ROLLBACK')

    // Two reviewers signing in at once while the account does not exist:
    // the other request created it first. The retry finds it.
    if (
      isUniqueViolation(error, 'user_credentials_issuer_subject_key') &&
      !isRetry
    ) {
      return signInDemo(db, true)
    }

    throw error
  } finally {
    client.release()
  }
}
