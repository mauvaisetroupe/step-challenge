import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'

import { RATE_LIMITS } from './rateLimit.js'
import { bearer, buildTestApp, signInAs, type TestApp } from './test/app.js'
import {
  createTestPool,
  resetDatabase,
  skipWithoutDatabase,
} from './test/database.js'

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

function signInAttempt(app: TestApp, clientIp?: string) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/google',
    headers: clientIp ? { 'cf-connecting-ip': clientIp } : {},
    payload: { idToken: 'forged' },
  })
}

describe('rate limits', { skip: skipWithoutDatabase }, () => {
  it('limits sign-in attempts per client', async () => {
    const app = await buildApp()

    for (let i = 0; i < RATE_LIMITS.signIn.max; i++) {
      assert.equal((await signInAttempt(app, '203.0.113.1')).statusCode, 401)
    }

    const blocked = await signInAttempt(app, '203.0.113.1')

    assert.equal(blocked.statusCode, 429)
    assert.ok(blocked.headers['retry-after'])
  })

  it('uses the Cloudflare client address, not the connection', async () => {
    const app = await buildApp()

    for (let i = 0; i < RATE_LIMITS.signIn.max; i++) {
      await signInAttempt(app, '203.0.113.1')
    }

    // Same connection (127.0.0.1), different client behind Cloudflare.
    assert.equal((await signInAttempt(app, '203.0.113.2')).statusCode, 401)
  })

  it('limits invitation code lookups', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const headers = { ...bearer(alice.token), 'cf-connecting-ip': '203.0.113.3' }

    for (const [method, url] of [
      ['GET', '/api/invitations/0000-0000'],
      ['POST', '/api/invitations/0000-0000/accept'],
    ] as const) {
      for (let i = 0; i < RATE_LIMITS.invitationLookup.max; i++) {
        const response = await app.inject({ method, url, headers })

        assert.equal(response.statusCode, 404)
      }

      const blocked = await app.inject({ method, url, headers })

      assert.equal(blocked.statusCode, 429, `${method} ${url}`)
    }
  })

  it('does not limit other routes', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')

    for (let i = 0; i < 50; i++) {
      const response = await app.inject({
        method: 'GET',
        url: '/api/me',
        headers: { ...bearer(alice.token), 'cf-connecting-ip': '203.0.113.4' },
      })

      assert.equal(response.statusCode, 200)
    }
  })
})
