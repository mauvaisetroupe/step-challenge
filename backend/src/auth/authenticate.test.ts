import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'

import { bearer, buildTestApp, signInAs } from '../test/app.js'
import {
  createTestPool,
  resetDatabase,
  skipWithoutDatabase,
} from '../test/database.js'
import { readBearerToken } from './authenticate.js'
import { SESSION_TTL_DAYS } from './sessions.js'

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

describe('readBearerToken', () => {
  it('extracts the token', () => {
    assert.equal(readBearerToken('Bearer abc_DEF-123'), 'abc_DEF-123')
  })

  it('rejects missing or malformed headers', () => {
    assert.equal(readBearerToken(undefined), null)
    assert.equal(readBearerToken(''), null)
    assert.equal(readBearerToken('Bearer'), null)
    assert.equal(readBearerToken('Bearer '), null)
    assert.equal(readBearerToken('Basic abc'), null)
    assert.equal(readBearerToken('Bearer abc def'), null)
    assert.equal(readBearerToken('Bearer abc\nX-Injected: 1'), null)
  })
})

describe('requireAuth', { skip: skipWithoutDatabase }, () => {
  function getMe(app: Awaited<ReturnType<typeof buildApp>>, headers = {}) {
    return app.inject({ method: 'GET', url: '/api/me', headers })
  }

  it('accepts a valid session', async () => {
    const app = await buildApp()
    const { token, user } = await signInAs(app, 'alice')

    const response = await getMe(app, bearer(token))

    assert.equal(response.statusCode, 200)
    assert.equal(response.json().id, user.id)
  })

  it('rejects a request without token', async () => {
    const app = await buildApp()

    const response = await getMe(app)

    assert.equal(response.statusCode, 401)
    assert.equal(response.headers['www-authenticate'], 'Bearer')
    assert.deepEqual(response.json(), { error: 'unauthenticated' })
  })

  it('authenticates before validating the body', async () => {
    const app = await buildApp()

    // Invalid bodies: without a session, the answer must be 401, not a
    // validation error describing the expected payload.
    const requests = [
      { method: 'PATCH', url: '/api/me', payload: { displayName: 42 } },
      { method: 'POST', url: '/api/me/steps', payload: { days: [] } },
      { method: 'POST', url: '/api/auth/logout', payload: 'not json' },
    ] as const

    for (const request of requests) {
      const response = await app.inject({
        ...request,
        headers: { 'content-type': 'application/json' },
      })

      assert.equal(
        response.statusCode,
        401,
        `${request.method} ${request.url}: ${response.body}`,
      )
    }
  })

  it('rejects an unknown token', async () => {
    const app = await buildApp()

    await signInAs(app, 'alice')

    const response = await getMe(app, bearer('unknown-token'))

    assert.equal(response.statusCode, 401)
  })

  it('rejects an expired session', async () => {
    const app = await buildApp()
    const { token } = await signInAs(app, 'alice')

    await pool!.query(
      "UPDATE sessions SET expires_at = now() - interval '1 second'",
    )

    const response = await getMe(app, bearer(token))

    assert.equal(response.statusCode, 401)
  })

  it('extends the session on use (sliding expiry)', async () => {
    const app = await buildApp()
    const { token } = await signInAs(app, 'alice')

    await pool!.query(
      "UPDATE sessions SET expires_at = now() + interval '1 day'",
    )

    await getMe(app, bearer(token))

    const result = await pool!.query(
      `
      SELECT round(extract(epoch FROM expires_at - now()) / 86400) AS days
      FROM sessions
      `,
    )

    assert.equal(Number(result.rows[0].days), SESSION_TTL_DAYS)
  })
})
