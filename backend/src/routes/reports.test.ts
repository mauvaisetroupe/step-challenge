import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'

import { RATE_LIMITS } from '../rateLimit.js'
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

function report(
  app: TestApp,
  token: string,
  payload: Record<string, unknown>,
) {
  return app.inject({
    method: 'POST',
    url: '/api/reports',
    headers: bearer(token),
    payload,
  })
}

async function createInvitationCode(app: TestApp, token: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/invitations',
    headers: bearer(token),
  })

  return response.json().code as string
}

async function reports() {
  const result = await pool!.query(
    `
    SELECT reporter_id, reported_id, reported_name, reason, comment,
           invitation_id, resolved_at
    FROM user_reports
    ORDER BY created_at
    `,
  )

  return result.rows
}

describe('POST /api/reports', { skip: skipWithoutDatabase }, () => {
  it('reports a friend, with a snapshot of their name', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    await befriend(app, alice.token, bob.token)

    const response = await report(app, alice.token, {
      userId: bob.user.id,
      reason: 'offensive_name',
      comment: '  Rude name  ',
    })

    assert.equal(response.statusCode, 201)

    await app.inject({
      method: 'PATCH',
      url: '/api/me',
      headers: bearer(bob.token),
      payload: { displayName: 'Robert' },
    })

    const [stored] = await reports()

    assert.equal(stored.reporter_id, alice.user.id)
    assert.equal(stored.reported_id, bob.user.id)
    assert.equal(stored.reported_name, 'Bob')
    assert.equal(stored.reason, 'offensive_name')
    assert.equal(stored.comment, 'Rude name')
    assert.equal(stored.invitation_id, null)
    assert.equal(stored.resolved_at, null)
  })

  it('reports the author of an invitation, without accepting it', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const stranger = await signInAs(app, 'stranger', 'Stranger')
    const code = await createInvitationCode(app, stranger.token)

    const response = await report(app, alice.token, {
      userId: stranger.user.id,
      reason: 'harassment',
      invitationCode: code,
    })

    assert.equal(response.statusCode, 201)

    const [stored] = await reports()

    assert.ok(stored.invitation_id)
    assert.equal(stored.comment, null)
  })

  it('accepts a revoked invitation as proof', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const stranger = await signInAs(app, 'stranger', 'Stranger')
    const code = await createInvitationCode(app, stranger.token)

    await pool!.query('UPDATE invitations SET revoked_at = now()')

    const response = await report(app, alice.token, {
      userId: stranger.user.id,
      reason: 'offensive_name',
      invitationCode: code,
    })

    assert.equal(response.statusCode, 201)
  })

  it('cannot report someone I do not know', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    const response = await report(app, alice.token, {
      userId: bob.user.id,
      reason: 'other',
    })

    // Same answer as an unknown user.
    assert.equal(response.statusCode, 404)
    assert.equal(response.json().error, 'user_not_found')
    assert.deepEqual(await reports(), [])
  })

  it('cannot use an invitation from someone else as proof', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')
    const carol = await signInAs(app, 'carol', 'Carol')
    const carolCode = await createInvitationCode(app, carol.token)

    const response = await report(app, alice.token, {
      userId: bob.user.id,
      reason: 'other',
      invitationCode: carolCode,
    })

    assert.equal(response.statusCode, 404)
  })

  it('rejects reporting myself', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')

    const response = await report(app, alice.token, {
      userId: alice.user.id,
      reason: 'other',
    })

    assert.equal(response.statusCode, 400)
    assert.equal(response.json().error, 'cannot_report_self')
  })

  it('rejects an unknown reason and a too long comment', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    await befriend(app, alice.token, bob.token)

    const badReason = await report(app, alice.token, {
      userId: bob.user.id,
      reason: 'spam',
    })
    const longComment = await report(app, alice.token, {
      userId: bob.user.id,
      reason: 'other',
      comment: 'x'.repeat(501),
    })

    assert.equal(badReason.statusCode, 400)
    assert.equal(longComment.statusCode, 400)
  })

  it('is rate limited', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    await befriend(app, alice.token, bob.token)

    for (let i = 0; i < RATE_LIMITS.report.max; i++) {
      const response = await report(app, alice.token, {
        userId: bob.user.id,
        reason: 'other',
      })

      assert.equal(response.statusCode, 201)
    }

    const limited = await report(app, alice.token, {
      userId: bob.user.id,
      reason: 'other',
    })

    assert.equal(limited.statusCode, 429)
  })

  it('requires a session', async () => {
    const app = await buildApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/reports',
      payload: {
        userId: '00000000-0000-4000-8000-000000000000',
        reason: 'other',
      },
    })

    assert.equal(response.statusCode, 401)
  })

  it('keeps the report when the reported account is deleted', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    await befriend(app, alice.token, bob.token)
    await report(app, alice.token, {
      userId: bob.user.id,
      reason: 'impersonation',
    })

    await app.inject({
      method: 'DELETE',
      url: '/api/me',
      headers: bearer(bob.token),
    })

    const [stored] = await reports()

    assert.equal(stored.reported_id, null)
    assert.equal(stored.reported_name, 'Bob')
  })
})
