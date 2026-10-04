import Fastify from 'fastify'
import type { Pool } from 'pg'

import { createRequireAuth } from '../auth/authenticate.js'
import { GOOGLE_ISSUER, InvalidIdTokenError } from '../auth/google.js'
import authRoutes from '../routes/auth.js'
import friendRoutes from '../routes/friends.js'
import invitationRoutes from '../routes/invitations.js'
import leaderboardRoutes from '../routes/leaderboard.js'
import meRoutes from '../routes/me.js'
import meStepsRoutes from '../routes/meSteps.js'
import { registerRateLimit } from '../rateLimit.js'

/**
 * Fake verifier: "valid:<sub>" is a valid token for subject <sub>,
 * anything else is rejected.
 */
export async function fakeVerifyGoogleIdToken(idToken: string) {
  if (!idToken.startsWith('valid:')) {
    throw new InvalidIdTokenError('invalid test token')
  }

  return {
    issuer: GOOGLE_ISSUER,
    subject: idToken.slice('valid:'.length),
  }
}

/**
 * Builds the application routes on the test database, with the fake
 * Google verifier and without the transitional API key.
 */
export async function buildTestApp(db: Pool) {
  const app = Fastify()
  const requireAuth = createRequireAuth(db)

  await registerRateLimit(app)

  await app.register(authRoutes, {
    prefix: '/api',
    db,
    verifyGoogleIdToken: fakeVerifyGoogleIdToken,
    requireAuth,
  })

  await app.register(meRoutes, {
    prefix: '/api',
    db,
    requireAuth,
  })

  await app.register(meStepsRoutes, {
    prefix: '/api',
    db,
    requireAuth,
  })

  await app.register(friendRoutes, {
    prefix: '/api',
    db,
    requireAuth,
  })

  await app.register(invitationRoutes, {
    prefix: '/api',
    db,
    requireAuth,
    publicBaseUrl: 'https://step.example.test',
  })

  await app.register(leaderboardRoutes, {
    prefix: '/api',
    db,
    requireAuth,
  })

  return app
}

export type TestApp = Awaited<ReturnType<typeof buildTestApp>>

export function signIn(app: TestApp, body: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/google',
    payload: body,
  })
}

/**
 * Signs in (creating the user if needed) and returns the session token
 * and the user.
 */
export async function signInAs(
  app: TestApp,
  subject: string,
  displayName = subject,
) {
  const response = await signIn(app, {
    idToken: `valid:${subject}`,
    displayName,
  })

  if (response.statusCode !== 200 && response.statusCode !== 201) {
    throw new Error(`sign-in failed: ${response.statusCode} ${response.body}`)
  }

  const body = response.json()

  return {
    token: body.sessionToken as string,
    user: body.user as { id: string; name: string },
  }
}

export function bearer(token: string) {
  return { authorization: `Bearer ${token}` }
}

/**
 * Makes two users friends through the real invitation flow.
 */
export async function befriend(
  app: TestApp,
  inviterToken: string,
  inviteeToken: string,
) {
  const invitation = await app.inject({
    method: 'POST',
    url: '/api/invitations',
    headers: bearer(inviterToken),
  })

  const response = await app.inject({
    method: 'POST',
    url: `/api/invitations/${invitation.json().code}/accept`,
    headers: bearer(inviteeToken),
  })

  if (response.statusCode !== 201) {
    throw new Error(`befriend failed: ${response.statusCode} ${response.body}`)
  }
}
