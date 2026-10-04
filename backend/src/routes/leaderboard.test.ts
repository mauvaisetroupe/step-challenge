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

/**
 * Inserts steps on a date given as a SQL expression relative to the
 * server date, e.g. "CURRENT_DATE" or "date_trunc('week', CURRENT_DATE)::date - 1".
 */
async function insertSteps(userId: string, dateSql: string, steps: number) {
  await pool!.query(
    `INSERT INTO daily_steps (user_id, date, steps) VALUES ($1, (${dateSql})::date, $2)`,
    [userId, steps],
  )
}

function getLeaderboard(app: TestApp, token: string, query = '') {
  return app.inject({
    method: 'GET',
    url: `/api/leaderboard${query}`,
    headers: bearer(token),
  })
}

describe('GET /api/leaderboard', { skip: skipWithoutDatabase }, () => {
  it('ranks users and flags the signed-in user', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    await signInAs(app, 'carol', 'Carol')
    await insertSteps(alice.user.id, 'CURRENT_DATE', 3000)
    await insertSteps(bob.user.id, 'CURRENT_DATE', 5000)

    const response = await getLeaderboard(app, alice.token)

    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), {
      period: 'week',
      results: [
        { id: bob.user.id, name: 'Bob', steps: 5000, isMe: false },
        { id: alice.user.id, name: 'Alice', steps: 3000, isMe: true },
        {
          id: response.json().results[2].id,
          name: 'Carol',
          steps: 0,
          isMe: false,
        },
      ],
    })
  })

  it('counts only the current week', async () => {
    const app = await buildApp()
    const { token, user } = await signInAs(app, 'alice')

    await insertSteps(user.id, "date_trunc('week', CURRENT_DATE)::date", 1000)
    await insertSteps(user.id, "date_trunc('week', CURRENT_DATE)::date - 1", 20)
    await insertSteps(user.id, 'CURRENT_DATE + 1', 300)

    const results = (await getLeaderboard(app, token)).json().results

    assert.equal(results[0].steps, 1000)
  })

  it('counts only the current month', async () => {
    const app = await buildApp()
    const { token, user } = await signInAs(app, 'alice')

    await insertSteps(user.id, "date_trunc('month', CURRENT_DATE)::date", 1000)
    await insertSteps(user.id, "date_trunc('month', CURRENT_DATE)::date - 1", 20)
    await insertSteps(user.id, 'CURRENT_DATE + 1', 300)

    const response = await getLeaderboard(app, token, '?period=month')

    assert.equal(response.json().period, 'month')
    assert.equal(response.json().results[0].steps, 1000)
  })

  it('rejects an unknown period', async () => {
    const app = await buildApp()
    const { token } = await signInAs(app, 'alice')

    const response = await getLeaderboard(app, token, '?period=year')

    assert.equal(response.statusCode, 400)
  })

  it('requires a session', async () => {
    const app = await buildApp()

    const response = await app.inject({
      method: 'GET',
      url: '/api/leaderboard',
    })

    assert.equal(response.statusCode, 401)
  })
})
