import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'

import { bearer, buildTestApp, signInAs, type TestApp } from '../test/app.js'
import {
  createTestPool,
  resetDatabase,
  skipWithoutDatabase,
} from '../test/database.js'
import {
  DEFAULT_HISTORY_DAYS,
  MAX_DAILY_STEPS,
  MAX_DAYS_PER_REQUEST,
} from './meSteps.js'

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

/** Server-side date (CURRENT_DATE + offset), as YYYY-MM-DD. */
async function serverDate(offsetDays = 0) {
  const result = await pool!.query(
    "SELECT to_char(CURRENT_DATE + $1::int, 'YYYY-MM-DD') AS d",
    [offsetDays],
  )

  return result.rows[0].d as string
}

function postSteps(app: TestApp, token: string, days: unknown) {
  return app.inject({
    method: 'POST',
    url: '/api/me/steps',
    headers: bearer(token),
    payload: { days },
  })
}

function getSteps(app: TestApp, token: string, query = '') {
  return app.inject({
    method: 'GET',
    url: `/api/me/steps${query}`,
    headers: bearer(token),
  })
}

describe('POST /api/me/steps', { skip: skipWithoutDatabase }, () => {
  it('records several days at once', async () => {
    const app = await buildApp()
    const { token } = await signInAs(app, 'alice')
    const today = await serverDate()
    const yesterday = await serverDate(-1)

    const response = await postSteps(app, token, [
      { date: yesterday, steps: 8000 },
      { date: today, steps: 1200 },
    ])

    assert.equal(response.statusCode, 204)

    assert.deepEqual((await getSteps(app, token)).json(), [
      { date: today, steps: 1200 },
      { date: yesterday, steps: 8000 },
    ])
  })

  it('keeps the highest value of each day', async () => {
    const app = await buildApp()
    const { token } = await signInAs(app, 'alice')
    const today = await serverDate()

    await postSteps(app, token, [{ date: today, steps: 5000 }])
    await postSteps(app, token, [{ date: today, steps: 3000 }])

    assert.equal((await getSteps(app, token)).json()[0].steps, 5000)

    await postSteps(app, token, [{ date: today, steps: 7000 }])

    assert.equal((await getSteps(app, token)).json()[0].steps, 7000)
  })

  it('only writes for the signed-in user', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice')
    const bob = await signInAs(app, 'bob')
    const today = await serverDate()

    await app.inject({
      method: 'POST',
      url: '/api/me/steps',
      headers: bearer(alice.token),
      payload: {
        userId: bob.user.id,
        days: [{ date: today, steps: 9999 }],
      },
    })

    assert.deepEqual((await getSteps(app, bob.token)).json(), [])
    assert.equal((await getSteps(app, alice.token)).json()[0].steps, 9999)
  })

  it('accepts tomorrow (timezones ahead of the server)', async () => {
    const app = await buildApp()
    const { token } = await signInAs(app, 'alice')

    const response = await postSteps(app, token, [
      { date: await serverDate(1), steps: 100 },
    ])

    assert.equal(response.statusCode, 204)
  })

  it('rejects dates further in the future', async () => {
    const app = await buildApp()
    const { token } = await signInAs(app, 'alice')

    const response = await postSteps(app, token, [
      { date: await serverDate(), steps: 100 },
      { date: await serverDate(2), steps: 100 },
    ])

    assert.equal(response.statusCode, 400)
    assert.deepEqual(response.json(), { error: 'invalid_date' })
    assert.deepEqual((await getSteps(app, token)).json(), [])
  })

  it('rejects impossible dates', async () => {
    const app = await buildApp()
    const { token } = await signInAs(app, 'alice')

    const response = await postSteps(app, token, [
      { date: '2026-02-30', steps: 100 },
    ])

    assert.equal(response.statusCode, 400)
    assert.deepEqual(response.json(), { error: 'invalid_date' })
  })

  it('rejects duplicate dates', async () => {
    const app = await buildApp()
    const { token } = await signInAs(app, 'alice')
    const today = await serverDate()

    const response = await postSteps(app, token, [
      { date: today, steps: 100 },
      { date: today, steps: 200 },
    ])

    assert.equal(response.statusCode, 400)
    assert.deepEqual(response.json(), { error: 'duplicate_date' })
  })

  it('rejects invalid payloads', async () => {
    const app = await buildApp()
    const { token } = await signInAs(app, 'alice')
    const today = await serverDate()

    const tooManyDays = Array.from(
      { length: MAX_DAYS_PER_REQUEST + 1 },
      (_, i) => ({
        date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
        steps: 1,
      }),
    )

    const invalid: unknown[] = [
      [],
      tooManyDays,
      [{ date: today, steps: MAX_DAILY_STEPS + 1 }],
      [{ date: today, steps: -1 }],
      [{ date: today, steps: 12.5 }],
      [{ date: '04/10/2026', steps: 100 }],
      [{ date: today }],
    ]

    for (const days of invalid) {
      const response = await postSteps(app, token, days)

      assert.equal(
        response.statusCode,
        400,
        `expected 400 for ${JSON.stringify(days).slice(0, 80)}`,
      )
    }
  })

  it('accepts the plausibility bound itself', async () => {
    const app = await buildApp()
    const { token } = await signInAs(app, 'alice')

    const response = await postSteps(app, token, [
      { date: await serverDate(), steps: MAX_DAILY_STEPS },
    ])

    assert.equal(response.statusCode, 204)
  })

  it('requires a session', async () => {
    const app = await buildApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/me/steps',
      payload: { days: [{ date: await serverDate(), steps: 100 }] },
    })

    assert.equal(response.statusCode, 401)
  })
})

describe('GET /api/me/steps', { skip: skipWithoutDatabase }, () => {
  async function insertSteps(userId: string, offsetDays: number) {
    await pool!.query(
      `
      INSERT INTO daily_steps (user_id, date, steps)
      VALUES ($1, CURRENT_DATE + $2::int, 1000)
      `,
      [userId, offsetDays],
    )
  }

  it('returns only the signed-in user steps', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice')
    const bob = await signInAs(app, 'bob')

    await insertSteps(bob.user.id, 0)

    assert.deepEqual((await getSteps(app, alice.token)).json(), [])
  })

  it('limits the default history', async () => {
    const app = await buildApp()
    const { token, user } = await signInAs(app, 'alice')

    await insertSteps(user.id, -DEFAULT_HISTORY_DAYS)
    await insertSteps(user.id, -(DEFAULT_HISTORY_DAYS + 1))

    const days = (await getSteps(app, token)).json()

    assert.deepEqual(
      days.map((day: { date: string }) => day.date),
      [await serverDate(-DEFAULT_HISTORY_DAYS)],
    )
  })

  it('returns the history since a given date', async () => {
    const app = await buildApp()
    const { token, user } = await signInAs(app, 'alice')

    await insertSteps(user.id, -500)
    await insertSteps(user.id, -10)

    const from = await serverDate(-600)
    const days = (await getSteps(app, token, `?from=${from}`)).json()

    assert.equal(days.length, 2)
  })

  it('rejects an invalid from date', async () => {
    const app = await buildApp()
    const { token } = await signInAs(app, 'alice')

    assert.equal(
      (await getSteps(app, token, '?from=2026-13-01')).statusCode,
      400,
    )
    assert.equal(
      (await getSteps(app, token, '?from=yesterday')).statusCode,
      400,
    )
  })

  it('requires a session', async () => {
    const app = await buildApp()

    const response = await app.inject({
      method: 'GET',
      url: '/api/me/steps',
    })

    assert.equal(response.statusCode, 401)
  })
})
