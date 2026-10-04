import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'

import { GOOGLE_ISSUER } from '../auth/google.js'
import { hashSessionToken, SESSION_TTL_DAYS } from '../auth/sessions.js'
import {
  bearer,
  buildTestApp,
  signIn,
  signInAs,
} from '../test/app.js'
import {
  createTestPool,
  resetDatabase,
  skipWithoutDatabase,
} from '../test/database.js'

const pool = createTestPool()

const buildApp = () => buildTestApp(pool!)

beforeEach(async () => {
  if (pool) {
    await resetDatabase(pool)
  }
})

after(async () => {
  await pool?.end()
})

describe('POST /api/auth/google', { skip: skipWithoutDatabase }, () => {

  it('creates a user and a session on first sign-in', async () => {
    const app = await buildApp()

    const response = await signIn(app, {
      idToken: 'valid:alice',
      displayName: '  Alice  ',
    })

    assert.equal(response.statusCode, 201)

    const body = response.json()

    assert.equal(body.isNewUser, true)
    assert.equal(body.user.name, 'Alice')
    assert.match(body.sessionToken, /^[A-Za-z0-9_-]{43}$/)

    const credentials = await pool!.query(
      'SELECT user_id, type, issuer, subject FROM user_credentials',
    )

    assert.deepEqual(credentials.rows, [
      {
        user_id: body.user.id,
        type: 'oidc',
        issuer: GOOGLE_ISSUER,
        subject: 'alice',
      },
    ])

    const sessions = await pool!.query(
      `
      SELECT user_id, token_hash,
             round(extract(epoch FROM expires_at - now()) / 86400) AS ttl_days
      FROM sessions
      `,
    )

    assert.equal(sessions.rows.length, 1)
    assert.equal(sessions.rows[0].user_id, body.user.id)
    assert.deepEqual(
      sessions.rows[0].token_hash,
      hashSessionToken(body.sessionToken),
    )
    assert.equal(Number(sessions.rows[0].ttl_days), SESSION_TTL_DAYS)
  })

  it('signs in an existing user with a new session', async () => {
    const app = await buildApp()

    const first = (
      await signIn(app, { idToken: 'valid:alice', displayName: 'Alice' })
    ).json()

    const response = await signIn(app, { idToken: 'valid:alice' })

    assert.equal(response.statusCode, 200)

    const body = response.json()

    assert.equal(body.isNewUser, false)
    assert.equal(body.user.id, first.user.id)
    assert.notEqual(body.sessionToken, first.sessionToken)

    const users = await pool!.query('SELECT count(*)::int AS n FROM users')
    const sessions = await pool!.query(
      'SELECT count(*)::int AS n FROM sessions',
    )

    assert.equal(users.rows[0].n, 1)
    assert.equal(sessions.rows[0].n, 2)
  })

  it('ignores the display name of an existing user', async () => {
    const app = await buildApp()

    await signIn(app, { idToken: 'valid:alice', displayName: 'Alice' })

    const body = (
      await signIn(app, { idToken: 'valid:alice', displayName: 'Mallory' })
    ).json()

    assert.equal(body.user.name, 'Alice')
  })

  it('requires a display name for a new user', async () => {
    const app = await buildApp()

    const response = await signIn(app, { idToken: 'valid:alice' })

    assert.equal(response.statusCode, 422)
    assert.deepEqual(response.json(), { error: 'display_name_required' })

    const users = await pool!.query('SELECT count(*)::int AS n FROM users')

    assert.equal(users.rows[0].n, 0)
  })

  it('rejects a blank display name', async () => {
    const app = await buildApp()

    const response = await signIn(app, {
      idToken: 'valid:alice',
      displayName: '   ',
    })

    assert.equal(response.statusCode, 422)
  })

  it('rejects an already used display name', async () => {
    const app = await buildApp()

    await signIn(app, { idToken: 'valid:alice', displayName: 'Marie' })

    const response = await signIn(app, {
      idToken: 'valid:bob',
      displayName: 'marie',
    })

    assert.equal(response.statusCode, 409)
    assert.deepEqual(response.json(), { error: 'display_name_taken' })
  })

  it('rejects an invalid ID token', async () => {
    const app = await buildApp()

    const response = await signIn(app, {
      idToken: 'forged',
      displayName: 'Alice',
    })

    assert.equal(response.statusCode, 401)
    assert.deepEqual(response.json(), { error: 'invalid_id_token' })
  })

  it('rejects a request without ID token', async () => {
    const app = await buildApp()

    const response = await signIn(app, { displayName: 'Alice' })

    assert.equal(response.statusCode, 400)
  })

  it('ignores a client-chosen user id', async () => {
    const app = await buildApp()
    const forcedId = '00000000-0000-0000-0000-000000000000'

    // Fastify strips properties not declared in the schema
    // (removeAdditional), so the extra field never reaches the handler.
    const response = await signIn(app, {
      idToken: 'valid:alice',
      displayName: 'Alice',
      userId: forcedId,
    })

    assert.equal(response.statusCode, 201)
    assert.notEqual(response.json().user.id, forcedId)
  })

  it('creates a single user on concurrent first sign-ins', async () => {
    const app = await buildApp()

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        signIn(app, { idToken: 'valid:alice', displayName: 'Alice' }),
      ),
    )

    for (const response of responses) {
      assert.ok(
        [200, 201].includes(response.statusCode),
        `unexpected status ${response.statusCode}: ${response.body}`,
      )
    }

    const users = await pool!.query('SELECT count(*)::int AS n FROM users')
    const sessions = await pool!.query(
      'SELECT count(*)::int AS n FROM sessions',
    )

    assert.equal(users.rows[0].n, 1)
    assert.equal(sessions.rows[0].n, 5)
  })
})

describe('POST /api/auth/logout', { skip: skipWithoutDatabase }, () => {
  it('revokes the current session only', async () => {
    const app = await buildApp()

    const phone = await signInAs(app, 'alice')
    const tablet = await signInAs(app, 'alice')

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: bearer(phone.token),
    })

    assert.equal(response.statusCode, 204)

    const afterLogout = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: bearer(phone.token),
    })
    const otherDevice = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: bearer(tablet.token),
    })

    assert.equal(afterLogout.statusCode, 401)
    assert.equal(otherDevice.statusCode, 200)
  })

  it('requires a session', async () => {
    const app = await buildApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
    })

    assert.equal(response.statusCode, 401)
  })
})
