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

function block(app: TestApp, token: string, userId: unknown) {
  return app.inject({
    method: 'POST',
    url: '/api/blocks',
    headers: bearer(token),
    payload: { userId },
  })
}

function unblock(app: TestApp, token: string, userId: string) {
  return app.inject({
    method: 'DELETE',
    url: `/api/blocks/${userId}`,
    headers: bearer(token),
  })
}

function listBlocks(app: TestApp, token: string) {
  return app.inject({
    method: 'GET',
    url: '/api/blocks',
    headers: bearer(token),
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

function preview(app: TestApp, token: string, code: string) {
  return app.inject({
    method: 'GET',
    url: `/api/invitations/${code}`,
    headers: bearer(token),
  })
}

function accept(app: TestApp, token: string, code: string) {
  return app.inject({
    method: 'POST',
    url: `/api/invitations/${code}/accept`,
    headers: bearer(token),
  })
}

async function friendNames(app: TestApp, token: string) {
  const response = await app.inject({
    method: 'GET',
    url: '/api/friends',
    headers: bearer(token),
  })

  return response.json().map((f: { name: string }) => f.name)
}

describe('POST /api/blocks', { skip: skipWithoutDatabase }, () => {
  it('ends the friendship on both sides, with aliases and my invitations', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    await befriend(app, alice.token, bob.token)
    await app.inject({
      method: 'PUT',
      url: `/api/friends/${alice.user.id}/alias`,
      headers: bearer(bob.token),
      payload: { alias: 'Al' },
    })
    await createInvitationCode(app, alice.token)

    const response = await block(app, alice.token, bob.user.id)

    assert.equal(response.statusCode, 201)
    assert.deepEqual(await friendNames(app, alice.token), [])
    assert.deepEqual(await friendNames(app, bob.token), [])

    const aliases = await pool!.query('SELECT count(*)::int AS n FROM friend_aliases')
    const active = await pool!.query(
      'SELECT count(*)::int AS n FROM invitations WHERE revoked_at IS NULL',
    )

    assert.equal(aliases.rows[0].n, 0)
    assert.equal(active.rows[0].n, 0)
  })

  it('also blocks someone who is not a friend', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    const response = await block(app, alice.token, bob.user.id)

    assert.equal(response.statusCode, 201)
  })

  it('is idempotent', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    await block(app, alice.token, bob.user.id)
    const again = await block(app, alice.token, bob.user.id)

    assert.equal(again.statusCode, 200)
    assert.equal((await listBlocks(app, alice.token)).json().length, 1)
  })

  it('rejects blocking myself', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')

    const response = await block(app, alice.token, alice.user.id)

    assert.equal(response.statusCode, 400)
    assert.equal(response.json().error, 'cannot_block_self')
  })

  it('rejects an unknown user', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')

    const response = await block(
      app,
      alice.token,
      '00000000-0000-4000-8000-000000000000',
    )

    assert.equal(response.statusCode, 404)
    assert.equal(response.json().error, 'user_not_found')
  })

  it('rejects an invalid user id', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')

    const response = await block(app, alice.token, 'not-a-uuid')

    assert.equal(response.statusCode, 400)
  })

  it('requires a session', async () => {
    const app = await buildApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/blocks',
      payload: { userId: '00000000-0000-4000-8000-000000000000' },
    })

    assert.equal(response.statusCode, 401)
  })
})

describe('Blocks and invitations', { skip: skipWithoutDatabase }, () => {
  it('the blocked person cannot see nor accept my new invitations', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    await block(app, alice.token, bob.user.id)
    const code = await createInvitationCode(app, alice.token)

    const previewed = await preview(app, bob.token, code)
    const accepted = await accept(app, bob.token, code)

    // Same answer as an invalid link: Bob does not learn he was blocked.
    assert.equal(previewed.statusCode, 404)
    assert.equal(previewed.json().error, 'invitation_not_found')
    assert.equal(accepted.statusCode, 404)
    assert.equal(accepted.json().error, 'invitation_not_found')
    assert.deepEqual(await friendNames(app, alice.token), [])
  })

  it('I cannot accept an invitation from someone I blocked', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    await block(app, alice.token, bob.user.id)
    const code = await createInvitationCode(app, bob.token)

    assert.equal((await preview(app, alice.token, code)).statusCode, 404)
    assert.equal((await accept(app, alice.token, code)).statusCode, 404)
  })

  it('other people can still use the invitation', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')
    const carol = await signInAs(app, 'carol', 'Carol')

    await block(app, alice.token, bob.user.id)
    const code = await createInvitationCode(app, alice.token)

    assert.equal((await accept(app, carol.token, code)).statusCode, 201)
  })
})

describe('GET /api/blocks', { skip: skipWithoutDatabase }, () => {
  it('lists the people I blocked with their name when blocked', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')
    const carol = await signInAs(app, 'carol', 'Carol')

    await block(app, alice.token, bob.user.id)
    await block(app, carol.token, alice.user.id) // not mine
    await app.inject({
      method: 'PATCH',
      url: '/api/me',
      headers: bearer(bob.token),
      payload: { displayName: 'Robert' },
    })

    const blocks = (await listBlocks(app, alice.token)).json()

    assert.equal(blocks.length, 1)
    assert.equal(blocks[0].userId, bob.user.id)
    assert.equal(blocks[0].name, 'Bob')
    assert.ok(blocks[0].since)
  })
})

describe('DELETE /api/blocks/:userId', { skip: skipWithoutDatabase }, () => {
  it('unblocks without restoring the friendship', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    await befriend(app, alice.token, bob.token)
    await block(app, alice.token, bob.user.id)

    const response = await unblock(app, alice.token, bob.user.id)

    assert.equal(response.statusCode, 204)
    assert.deepEqual((await listBlocks(app, alice.token)).json(), [])
    assert.deepEqual(await friendNames(app, alice.token), [])

    // A new invitation works again.
    await befriend(app, alice.token, bob.token)
    assert.deepEqual(await friendNames(app, alice.token), ['Bob'])
  })

  it('returns 404 when the user is not blocked', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    const response = await unblock(app, alice.token, bob.user.id)

    assert.equal(response.statusCode, 404)
    assert.equal(response.json().error, 'block_not_found')
  })
})
