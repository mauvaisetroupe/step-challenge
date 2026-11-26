import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'

import { LEGAL_VERSIONS } from '../legal.js'
import {
  bearer,
  befriend,
  buildTestApp,
  signIn,
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

const ALL_PENDING = [
  { document: 'terms', version: LEGAL_VERSIONS.terms },
  { document: 'privacy', version: LEGAL_VERSIONS.privacy },
]

async function getMe(app: TestApp, token: string) {
  const response = await app.inject({
    method: 'GET',
    url: '/api/me',
    headers: bearer(token),
  })

  assert.equal(response.statusCode, 200)

  return response.json()
}

function postConsents(app: TestApp, token: string, consents: unknown[]) {
  return app.inject({
    method: 'POST',
    url: '/api/me/consents',
    headers: bearer(token),
    payload: { consents },
  })
}

async function journal(userId: string) {
  const result = await pool!.query(
    `
    SELECT subject, action, version, detail
    FROM user_consents
    WHERE user_id = $1
    ORDER BY created_at, subject
    `,
    [userId],
  )

  return result.rows
}

describe('legal documents (ADR 0017)', { skip: skipWithoutDatabase }, () => {
  it('leaves both documents to accept for an existing account', async () => {
    const app = await buildApp()
    const { token } = await signInAs(app, 'alice', 'Alice')

    assert.deepEqual((await getMe(app, token)).pendingConsents, ALL_PENDING)
  })

  it('gives the versions to accept with the display name', async () => {
    const app = await buildApp()

    const response = await signIn(app, { idToken: 'valid:alice' })

    assert.equal(response.statusCode, 422)
    assert.deepEqual(response.json(), {
      error: 'display_name_required',
      legal: LEGAL_VERSIONS,
    })
  })

  it('records the documents accepted when creating the account', async () => {
    const app = await buildApp()

    const response = await signIn(app, {
      idToken: 'valid:alice',
      displayName: 'Alice',
      acceptedLegal: { ...LEGAL_VERSIONS },
    })

    assert.equal(response.statusCode, 201)

    const { sessionToken, user } = response.json()

    assert.deepEqual((await getMe(app, sessionToken)).pendingConsents, [])
    assert.deepEqual(
      (await journal(user.id)).map(({ subject, version }) => ({
        subject,
        version,
      })),
      [
        { subject: 'privacy', version: LEGAL_VERSIONS.privacy },
        { subject: 'terms', version: LEGAL_VERSIONS.terms },
      ],
    )
  })

  it('leaves an outdated version seen at account creation to accept', async () => {
    const app = await buildApp()

    const response = await signIn(app, {
      idToken: 'valid:alice',
      displayName: 'Alice',
      acceptedLegal: { terms: LEGAL_VERSIONS.terms, privacy: '2000-01-01' },
    })

    assert.deepEqual(
      (await getMe(app, response.json().sessionToken)).pendingConsents,
      [{ document: 'privacy', version: LEGAL_VERSIONS.privacy }],
    )
  })

  it('accepts the versions in force', async () => {
    const app = await buildApp()
    const { token } = await signInAs(app, 'alice', 'Alice')

    const response = await postConsents(app, token, [
      { subject: 'terms', action: 'granted', version: LEGAL_VERSIONS.terms },
      {
        subject: 'privacy',
        action: 'granted',
        version: LEGAL_VERSIONS.privacy,
      },
    ])

    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), { pendingConsents: [] })
    assert.deepEqual((await getMe(app, token)).pendingConsents, [])
  })

  it('refuses a version that is no longer in force', async () => {
    const app = await buildApp()
    const { token, user } = await signInAs(app, 'alice', 'Alice')

    const response = await postConsents(app, token, [
      { subject: 'privacy', action: 'granted', version: '2000-01-01' },
    ])

    assert.equal(response.statusCode, 409)
    assert.equal(response.json().error, 'legal_version_outdated')
    assert.deepEqual(response.json().pendingConsents, ALL_PENDING)
    assert.deepEqual(await journal(user.id), [])
  })

  it('refuses a document without its version', async () => {
    const app = await buildApp()
    const { token } = await signInAs(app, 'alice', 'Alice')

    const response = await postConsents(app, token, [
      { subject: 'terms', action: 'granted' },
    ])

    assert.equal(response.statusCode, 400)
  })

  it('refuses to withdraw a legal document', async () => {
    const app = await buildApp()
    const { token } = await signInAs(app, 'alice', 'Alice')

    const response = await postConsents(app, token, [
      { subject: 'terms', action: 'withdrawn', version: LEGAL_VERSIONS.terms },
    ])

    assert.equal(response.statusCode, 422)
  })
})

describe('HUAWEI Health authorizations (ADR 0017)', { skip: skipWithoutDatabase }, () => {
  it('journals grants and withdrawals as the app saw them', async () => {
    const app = await buildApp()
    const { token, user } = await signInAs(app, 'alice', 'Alice')
    const scopes = ['https://www.huawei.com/healthkit/step.read']

    assert.equal(
      (
        await postConsents(app, token, [
          { subject: 'huawei_health', action: 'granted', detail: { scopes } },
        ])
      ).statusCode,
      200,
    )
    assert.equal(
      (
        await postConsents(app, token, [
          {
            subject: 'huawei_health',
            action: 'withdrawn',
            detail: { cause: 'switch' },
          },
        ])
      ).statusCode,
      200,
    )

    assert.deepEqual(await journal(user.id), [
      {
        subject: 'huawei_health',
        action: 'granted',
        version: null,
        detail: { scopes },
      },
      {
        subject: 'huawei_health',
        action: 'withdrawn',
        version: null,
        detail: { cause: 'switch' },
      },
    ])
  })

  it('refuses an unknown cause', async () => {
    const app = await buildApp()
    const { token } = await signInAs(app, 'alice', 'Alice')

    const response = await postConsents(app, token, [
      {
        subject: 'huawei_health',
        action: 'withdrawn',
        detail: { cause: 'whatever' },
      },
    ])

    assert.equal(response.statusCode, 400)
  })
})

describe('GET /api/me/export', { skip: skipWithoutDatabase }, () => {
  it('gives all the personal data, without secrets', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    await befriend(app, alice.token, bob.token)

    await app.inject({
      method: 'POST',
      url: '/api/me/steps',
      headers: bearer(alice.token),
      payload: { days: [{ date: '2026-11-01', steps: 8000 }] },
    })

    await postConsents(app, alice.token, [
      { subject: 'terms', action: 'granted', version: LEGAL_VERSIONS.terms },
    ])

    // Bob reports Alice: not in her export, it protects Bob.
    await app.inject({
      method: 'POST',
      url: '/api/reports',
      headers: bearer(bob.token),
      payload: { userId: alice.user.id, reason: 'other' },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/me/export',
      headers: bearer(alice.token),
    })

    assert.equal(response.statusCode, 200)

    const data = response.json()

    assert.equal(data.account.name, 'Alice')
    assert.deepEqual(
      data.steps.map(({ date, steps }: { date: string; steps: number }) => ({
        date,
        steps,
      })),
      [{ date: '2026-11-01', steps: 8000 }],
    )
    assert.deepEqual(
      data.friends.map(({ name }: { name: string }) => name),
      ['Bob'],
    )
    assert.equal(data.invitations.length, 1)
    assert.equal(data.credentials.length, 1)
    assert.equal(data.sessions.length, 1)
    assert.deepEqual(data.reports, [])
    assert.equal(data.consents[0].subject, 'terms')

    // Neither the Google subject nor any hash.
    assert.ok(!response.body.includes('"alice"'))
    assert.ok(!/hash|subject"\s*:\s*"alice/.test(response.body))
  })
})

describe('DELETE /api/me/steps', { skip: skipWithoutDatabase }, () => {
  it("deletes the user's steps only", async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    for (const { token } of [alice, bob]) {
      await app.inject({
        method: 'POST',
        url: '/api/me/steps',
        headers: bearer(token),
        payload: { days: [{ date: '2026-11-01', steps: 8000 }] },
      })
    }

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/me/steps',
      headers: bearer(alice.token),
    })

    assert.equal(response.statusCode, 204)

    const result = await pool!.query(
      'SELECT user_id FROM daily_steps ORDER BY user_id',
    )

    assert.deepEqual(
      result.rows.map((row) => row.user_id),
      [bob.user.id],
    )
  })
})
