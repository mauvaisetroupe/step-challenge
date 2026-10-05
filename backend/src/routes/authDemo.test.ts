import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'

import { DEMO_CREDENTIAL, DEMO_DISPLAY_NAME } from '../demo/demoAccount.js'
import { DEMO_FRIENDS, DEMO_HISTORY_DAYS } from '../demo/demoData.js'
import { RATE_LIMITS } from '../rateLimit.js'
import {
  bearer,
  buildTestApp,
  TEST_DEMO_ACCESS_CODE,
  type TestApp,
} from '../test/app.js'
import {
  createTestPool,
  resetDatabase,
  skipWithoutDatabase,
} from '../test/database.js'

const pool = createTestPool()

const buildApp = () =>
  buildTestApp(pool!, { demoAccessCode: TEST_DEMO_ACCESS_CODE })

const friendIds = DEMO_FRIENDS.map((friend) => friend.id).sort()

function demoSignIn(app: TestApp, code = TEST_DEMO_ACCESS_CODE) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/demo',
    payload: { code },
  })
}

async function signInAsDemo(app: TestApp) {
  const response = await demoSignIn(app)

  assert.equal(response.statusCode, 200, response.body)

  return response.json() as {
    sessionToken: string
    user: { id: string; name: string }
    isNewUser: boolean
  }
}

async function countUsers() {
  const result = await pool!.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM users',
  )

  return result.rows[0].count
}

beforeEach(async () => {
  if (pool) {
    await resetDatabase(pool)
  }
})

after(async () => {
  await pool?.end()
})

describe('POST /api/auth/demo', { skip: skipWithoutDatabase }, () => {
  it('does not exist when demo access is disabled', async () => {
    const app = await buildTestApp(pool!)

    const response = await demoSignIn(app)

    assert.equal(response.statusCode, 404)
    assert.equal(await countUsers(), 0)
  })

  it('rejects a wrong code without creating anything', async () => {
    const app = await buildApp()

    const response = await demoSignIn(app, 'wrong-code')

    assert.equal(response.statusCode, 401)
    assert.deepEqual(response.json(), { error: 'invalid_demo_code' })
    assert.equal(await countUsers(), 0)
  })

  it('rejects a body without code', async () => {
    const app = await buildApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/demo',
      payload: {},
    })

    assert.equal(response.statusCode, 400)
  })

  it('creates the demo account with fictitious friends and opens a session', async () => {
    const app = await buildApp()

    const body = await signInAsDemo(app)

    assert.equal(body.isNewUser, false)
    assert.equal(body.user.name, DEMO_DISPLAY_NAME)

    const credentials = await pool!.query(
      'SELECT user_id, type, issuer, subject FROM user_credentials',
    )

    assert.deepEqual(credentials.rows, [
      {
        user_id: body.user.id,
        type: DEMO_CREDENTIAL.type,
        issuer: DEMO_CREDENTIAL.issuer,
        subject: DEMO_CREDENTIAL.subject,
      },
    ])

    const me = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: bearer(body.sessionToken),
    })

    assert.equal(me.statusCode, 200)
    assert.equal(me.json().id, body.user.id)

    const friends = await app.inject({
      method: 'GET',
      url: '/api/friends',
      headers: bearer(body.sessionToken),
    })

    assert.deepEqual(
      friends.json().map((friend: { id: string }) => friend.id).sort(),
      friendIds,
    )
  })

  it('fills the leaderboard with the friends steps', async () => {
    const app = await buildApp()
    const { sessionToken } = await signInAsDemo(app)

    const response = await app.inject({
      method: 'GET',
      url: '/api/leaderboard?period=month',
      headers: bearer(sessionToken),
    })

    const results = response.json().results as {
      id: string
      steps: number
      isMe: boolean
    }[]

    assert.equal(results.length, DEMO_FRIENDS.length + 1)

    for (const entry of results.filter((entry) => !entry.isMe)) {
      assert.ok(entry.steps > 0, `${entry.id} has no steps`)
    }

    const history = await pool!.query<{ days: number }>(
      `
      SELECT count(DISTINCT date)::int AS days
      FROM daily_steps
      WHERE user_id = $1
      `,
      [DEMO_FRIENDS[0].id],
    )

    assert.equal(history.rows[0].days, DEMO_HISTORY_DAYS)
  })

  it('reuses the account and its friends on the next sign-in', async () => {
    const app = await buildApp()

    const first = await signInAsDemo(app)
    const second = await signInAsDemo(app)

    assert.equal(second.user.id, first.user.id)
    assert.notEqual(second.sessionToken, first.sessionToken)
    assert.equal(await countUsers(), DEMO_FRIENDS.length + 1)

    const friendships = await pool!.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM friendships',
    )

    assert.equal(friendships.rows[0].count, DEMO_FRIENDS.length)
  })

  it('restores friends removed, blocked or renamed by a reviewer', async () => {
    const app = await buildApp()
    const { sessionToken } = await signInAsDemo(app)
    const [removed, blocked, renamed] = DEMO_FRIENDS

    await app.inject({
      method: 'DELETE',
      url: `/api/friends/${removed.id}`,
      headers: bearer(sessionToken),
    })

    const block = await app.inject({
      method: 'POST',
      url: '/api/blocks',
      headers: bearer(sessionToken),
      payload: { userId: blocked.id },
    })

    assert.equal(block.statusCode, 201, block.body)

    await app.inject({
      method: 'PUT',
      url: `/api/friends/${renamed.id}/alias`,
      headers: bearer(sessionToken),
      payload: { alias: 'Someone else' },
    })

    const next = await signInAsDemo(app)

    const friends = await app.inject({
      method: 'GET',
      url: '/api/friends',
      headers: bearer(next.sessionToken),
    })

    const list = friends.json() as { id: string; alias: string | null }[]

    assert.deepEqual(list.map((friend) => friend.id).sort(), friendIds)
    assert.ok(list.every((friend) => friend.alias === null))

    const blocks = await pool!.query('SELECT 1 FROM user_blocks')

    assert.equal(blocks.rowCount, 0)
  })

  it('recreates the account after a reviewer deleted it', async () => {
    const app = await buildApp()
    const first = await signInAsDemo(app)

    const deletion = await app.inject({
      method: 'DELETE',
      url: '/api/me',
      headers: bearer(first.sessionToken),
    })

    assert.equal(deletion.statusCode, 204)

    const second = await signInAsDemo(app)

    assert.notEqual(second.user.id, first.user.id)
    // The fictitious friends are reused, not duplicated.
    assert.equal(await countUsers(), DEMO_FRIENDS.length + 1)

    const friends = await app.inject({
      method: 'GET',
      url: '/api/friends',
      headers: bearer(second.sessionToken),
    })

    assert.equal(friends.json().length, DEMO_FRIENDS.length)
  })

  it('creates a single account for concurrent first sign-ins', async () => {
    const app = await buildApp()

    const responses = await Promise.all(
      Array.from({ length: 3 }, () => demoSignIn(app)),
    )

    for (const response of responses) {
      assert.equal(response.statusCode, 200, response.body)
    }

    const ids = new Set(responses.map((response) => response.json().user.id))

    assert.equal(ids.size, 1)
    assert.equal(await countUsers(), DEMO_FRIENDS.length + 1)
  })

  it('limits the attempts per client address', async () => {
    const app = await buildApp()
    const { max } = RATE_LIMITS.demoSignIn

    for (let i = 0; i < max; i++) {
      const response = await demoSignIn(app, 'wrong-code')
      assert.equal(response.statusCode, 401)
    }

    const limited = await demoSignIn(app)

    assert.equal(limited.statusCode, 429)
  })
})

describe('fictitious friends', { skip: skipWithoutDatabase }, () => {
  it('cannot sign in: they have no credential', async () => {
    const app = await buildApp()
    await signInAsDemo(app)

    const credentials = await pool!.query(
      'SELECT 1 FROM user_credentials WHERE user_id = ANY($1::uuid[])',
      [friendIds],
    )

    assert.equal(credentials.rowCount, 0)
  })
})
