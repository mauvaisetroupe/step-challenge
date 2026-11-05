import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'

import {
  bearer,
  befriend,
  buildTestApp,
  signInAs,
  type TestApp,
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

/**
 * Inserts the same steps on `days` consecutive days, the first one given
 * as a SQL expression relative to the server date.
 */
async function insertDays(
  userId: string,
  firstDaySql: string,
  steps: number,
  days = 1,
) {
  await pool!.query(
    `
    INSERT INTO daily_steps (user_id, date, steps)
    SELECT $1, (${firstDaySql})::date + i, $2
    FROM generate_series(0, $3 - 1) AS i
    `,
    [userId, steps, days],
  )
}

function getBadges(app: TestApp, token: string, headers = {}) {
  return app.inject({
    method: 'GET',
    url: '/api/me/badges',
    headers: { ...bearer(token), ...headers },
  })
}

type EarnedBadge = {
  id: string
  occurrence: string
  count: number
  points: number
  name: string
  period: string | null
}

function earned(body: { earned: EarnedBadge[] }, id: string) {
  return body.earned.find((badge) => badge.id === id)
}

describe('GET /api/me/badges', { skip: skipWithoutDatabase }, () => {
  it('awards and lists my badges, with my level', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice')

    await insertDays(alice.user.id, 'CURRENT_DATE - 1', 21_000)

    const response = await getBadges(app, alice.token)
    const body = response.json()

    assert.equal(response.statusCode, 200)
    assert.deepEqual(
      { level: body.level, points: body.points, nextLevelPoints: body.nextLevelPoints },
      { level: 1, points: 2, nextLevelPoints: 4 },
    )
    assert.equal(earned(body, 'day.20000')?.name, '20,000 steps in a day')
    assert.equal(earned(body, 'day.20000')?.period, null)
    assert.ok(earned(body, 'day.15000'))
    assert.ok(
      body.locked.some((badge: { id: string }) => badge.id === 'day.25000'),
    )
    assert.ok(
      !body.locked.some((badge: { id: string }) => badge.id === 'day.20000'),
    )
  })

  it('speaks French when asked', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice')

    await insertDays(alice.user.id, 'CURRENT_DATE - 1', 21_000)

    const body = (
      await getBadges(app, alice.token, { 'accept-language': 'fr-FR,fr;q=0.9' })
    ).json()

    assert.match(earned(body, 'day.20000')!.name, /^20\s000 pas en un jour$/)
  })

  it('shows a repeatable badge once, with its count', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice')

    await insertDays(alice.user.id, 'CURRENT_DATE - 60', 10_000, 60)

    const body = (await getBadges(app, alice.token)).json()

    assert.deepEqual(
      (({ count, points }) => ({ count, points }))(earned(body, 'streak.every30')!),
      { count: 2, points: 6 },
    )
  })

  it('shows a week badge once, with each week it was earned', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice')

    // Two whole weeks at 10 000 a day, three weeks ago.
    await insertDays(alice.user.id, "date_trunc('week', CURRENT_DATE)::date - 21", 10_000, 14)

    const body = (await getBadges(app, alice.token)).json()
    const week = body.earned.find(
      (badge: { id: string }) => badge.id === 'week.70000',
    )

    assert.equal(week.count, 2)
    assert.equal(week.points, 2)
    assert.equal(week.occurrences.length, 2)
    assert.ok(week.occurrences[0].earnedOn > week.occurrences[1].earnedOn)
    assert.match(week.occurrences[0].period, /^Week of /)
    assert.equal(week.occurrences[0].description, '70,000 steps in the week.')
  })

  it('shows the progress of the current week', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice')

    await insertDays(alice.user.id, 'CURRENT_DATE', 5_000)

    const body = (await getBadges(app, alice.token)).json()
    const week = body.inProgress.find(
      (badge: { id: string }) => badge.id === 'week.70000',
    )

    assert.equal(week.value, 5_000)
    assert.equal(week.target, 70_000)
    assert.match(week.period, /^Week of /)
  })

  it('awards the ranking badges of a final week', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice')
    const bob = await signInAs(app, 'bob')
    const carol = await signInAs(app, 'carol')

    // Each one sees the two others: everyone's leaderboard has 3 people.
    await befriend(app, alice.token, bob.token)
    await befriend(app, alice.token, carol.token)
    await befriend(app, bob.token, carol.token)
    // Members long before: nobody is a newcomer.
    await pool!.query("UPDATE users SET created_at = now() - interval '1 year'")

    // Wednesday two weeks ago: a final week, whatever the day today.
    const day = "date_trunc('week', CURRENT_DATE)::date - 12"

    await insertDays(alice.user.id, day, 50_000)
    await insertDays(bob.user.id, day, 40_000)
    await insertDays(carol.user.id, day, 30_000)

    const { rows } = await pool!.query(
      `SELECT to_char(${day}, 'IYYY-"W"IW') AS week`,
    )
    const aliceBody = (await getBadges(app, alice.token)).json()
    const bobBody = (await getBadges(app, bob.token)).json()

    assert.equal(
      aliceBody.earned.find(
        (badge: EarnedBadge) =>
          badge.id === 'ranking.week.first' && badge.occurrence === rows[0].week,
      )?.points,
      2,
    )
    assert.ok(
      bobBody.earned.some(
        (badge: EarnedBadge) =>
          badge.id === 'ranking.week.podium' && badge.occurrence === rows[0].week,
      ),
    )
  })
})

describe('POST /api/me/steps', { skip: skipWithoutDatabase }, () => {
  it('awards the badges of the steps sent', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice')
    const { rows } = await pool!.query(
      "SELECT to_char(CURRENT_DATE, 'YYYY-MM-DD') AS today",
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/me/steps',
      headers: bearer(alice.token),
      payload: { days: [{ date: rows[0].today, steps: 16_000 }] },
    })
    const badges = await pool!.query(
      'SELECT badge_id FROM user_badges WHERE user_id = $1',
      [alice.user.id],
    )

    assert.equal(response.statusCode, 200)
    assert.ok(badges.rows.some((row) => row.badge_id === 'day.15000'))
  })
})

describe('GET /api/friends/:id/badges', { skip: skipWithoutDatabase }, () => {
  it('shows the badges of a friend, and of friends only', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice')
    const bob = await signInAs(app, 'bob')

    await insertDays(alice.user.id, 'CURRENT_DATE - 1', 21_000)
    await getBadges(app, alice.token)

    const url = `/api/friends/${alice.user.id}/badges`
    const before = await app.inject({ method: 'GET', url, headers: bearer(bob.token) })

    await befriend(app, alice.token, bob.token)

    const response = await app.inject({ method: 'GET', url, headers: bearer(bob.token) })

    assert.equal(before.statusCode, 404)
    assert.equal(response.statusCode, 200)
    assert.equal(response.json().points, 2)
  })
})

describe('GET /api/leaderboard', { skip: skipWithoutDatabase }, () => {
  it('gives the badge level of each person', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice')
    const bob = await signInAs(app, 'bob')

    await befriend(app, alice.token, bob.token)
    // 4 points: level 2.
    await insertDays(alice.user.id, 'CURRENT_DATE - 1', 25_000)
    await getBadges(app, alice.token)

    const results = (
      await app.inject({
        method: 'GET',
        url: '/api/leaderboard',
        headers: bearer(bob.token),
      })
    ).json().results
    const levels = Object.fromEntries(
      results.map((entry: { name: string; level: number }) => [entry.name, entry.level]),
    )

    assert.deepEqual(levels, { alice: 2, bob: 1 })
  })
})
