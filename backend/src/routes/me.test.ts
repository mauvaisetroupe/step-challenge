import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'

import { bearer, buildTestApp, signInAs, type TestApp } from '../test/app.js'
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

async function count(table: string) {
  const result = await pool!.query(
    `SELECT count(*)::int AS n FROM ${table}`,
  )

  return result.rows[0].n as number
}

function patchMe(app: TestApp, token: string, body: unknown) {
  return app.inject({
    method: 'PATCH',
    url: '/api/me',
    headers: bearer(token),
    payload: body as Record<string, unknown>,
  })
}

describe('GET /api/me', { skip: skipWithoutDatabase }, () => {
  it('returns the signed-in user only', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')

    await signInAs(app, 'bob', 'Bob')

    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: bearer(alice.token),
    })

    assert.equal(response.statusCode, 200)
    assert.deepEqual(
      { id: response.json().id, name: response.json().name },
      { id: alice.user.id, name: 'Alice' },
    )
  })
})

describe('PATCH /api/me', { skip: skipWithoutDatabase }, () => {
  it('changes the display name', async () => {
    const app = await buildApp()
    const { token } = await signInAs(app, 'alice', 'Alice')

    const response = await patchMe(app, token, {
      displayName: '  Alice D.  ',
    })

    assert.equal(response.statusCode, 200)
    assert.equal(response.json().name, 'Alice D.')
  })

  it('rejects a blank display name', async () => {
    const app = await buildApp()
    const { token } = await signInAs(app, 'alice', 'Alice')

    const response = await patchMe(app, token, { displayName: '   ' })

    assert.equal(response.statusCode, 422)
  })

  it('accepts a display name used by someone else', async () => {
    const app = await buildApp()
    const { token } = await signInAs(app, 'alice', 'Alice')

    await signInAs(app, 'bob', 'Bob')

    const response = await patchMe(app, token, { displayName: 'Bob' })

    assert.equal(response.statusCode, 200)
    assert.equal(response.json().name, 'Bob')
  })

  it('cannot change another user', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    await patchMe(app, alice.token, {
      displayName: 'Alice D.',
      id: bob.user.id,
    })

    const result = await pool!.query(
      'SELECT name FROM users WHERE id = $1',
      [bob.user.id],
    )

    assert.equal(result.rows[0].name, 'Bob')
  })

  it('requires a session', async () => {
    const app = await buildApp()

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/me',
      payload: { displayName: 'Mallory' },
    })

    assert.equal(response.statusCode, 401)
  })
})

describe('DELETE /api/me', { skip: skipWithoutDatabase }, () => {
  it('deletes the account and all its data', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    await signInAs(app, 'alice') // second device

    await pool!.query(
      `
      INSERT INTO daily_steps (user_id, date, steps)
      VALUES ($1, CURRENT_DATE, 1000), ($2, CURRENT_DATE, 2000)
      `,
      [alice.user.id, bob.user.id],
    )

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/me',
      headers: bearer(alice.token),
    })

    assert.equal(response.statusCode, 204)

    const remaining = await pool!.query(
      `
      SELECT
        (SELECT array_agg(name) FROM users) AS users,
        (SELECT count(*)::int FROM sessions) AS sessions,
        (SELECT count(*)::int FROM user_credentials) AS credentials,
        (SELECT array_agg(steps) FROM daily_steps) AS steps
      `,
    )

    assert.deepEqual(remaining.rows[0], {
      users: ['Bob'],
      sessions: 1,
      credentials: 1,
      steps: [2000],
    })
  })

  it('invalidates the deleted account sessions', async () => {
    const app = await buildApp()
    const { token } = await signInAs(app, 'alice', 'Alice')

    await app.inject({
      method: 'DELETE',
      url: '/api/me',
      headers: bearer(token),
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: bearer(token),
    })

    assert.equal(response.statusCode, 401)
    assert.equal(await count('users'), 0)
  })

  it('lets the same Google account sign up again afterwards', async () => {
    const app = await buildApp()
    const first = await signInAs(app, 'alice', 'Alice')

    await app.inject({
      method: 'DELETE',
      url: '/api/me',
      headers: bearer(first.token),
    })

    const second = await signInAs(app, 'alice', 'Alice')

    assert.notEqual(second.user.id, first.user.id)
  })
})
