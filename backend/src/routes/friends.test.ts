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

function listFriends(app: TestApp, token: string) {
  return app.inject({
    method: 'GET',
    url: '/api/friends',
    headers: bearer(token),
  })
}

function setAlias(app: TestApp, token: string, friendId: string, alias: unknown) {
  return app.inject({
    method: 'PUT',
    url: `/api/friends/${friendId}/alias`,
    headers: bearer(token),
    payload: { alias },
  })
}

function removeFriend(app: TestApp, token: string, friendId: string) {
  return app.inject({
    method: 'DELETE',
    url: `/api/friends/${friendId}`,
    headers: bearer(token),
  })
}

async function count(table: string) {
  const result = await pool!.query(`SELECT count(*)::int AS n FROM ${table}`)

  return result.rows[0].n as number
}

describe('GET /api/friends', { skip: skipWithoutDatabase }, () => {
  it('lists my friends, on both sides of the friendship', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')
    const carol = await signInAs(app, 'carol', 'Carol')

    await signInAs(app, 'dave', 'Dave') // not a friend
    await befriend(app, alice.token, bob.token)
    await befriend(app, carol.token, alice.token)

    const friends = (await listFriends(app, alice.token)).json()

    assert.deepEqual(
      friends.map((f: { name: string; alias: string | null }) => [f.name, f.alias]),
      [
        ['Bob', null],
        ['Carol', null],
      ],
    )

    const bobFriends = (await listFriends(app, bob.token)).json()

    assert.deepEqual(
      bobFriends.map((f: { id: string }) => f.id),
      [alice.user.id],
    )
  })

  it('requires a session', async () => {
    const app = await buildApp()

    const response = await app.inject({ method: 'GET', url: '/api/friends' })

    assert.equal(response.statusCode, 401)
  })
})

describe('friend aliases', { skip: skipWithoutDatabase }, () => {
  it('gives a friend an alias that only I see', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    await befriend(app, alice.token, bob.token)

    const response = await setAlias(app, alice.token, bob.user.id, '  Bobby  ')

    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), { id: bob.user.id, alias: 'Bobby' })

    const mine = (await listFriends(app, alice.token)).json()
    const theirs = (await listFriends(app, bob.token)).json()

    assert.deepEqual([mine[0].name, mine[0].alias], ['Bob', 'Bobby'])
    assert.equal(theirs[0].alias, null)
  })

  it('keeps my alias when the friend renames themselves', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    await befriend(app, alice.token, bob.token)
    await setAlias(app, alice.token, bob.user.id, 'Bob')
    await app.inject({
      method: 'PATCH',
      url: '/api/me',
      headers: bearer(bob.token),
      payload: { displayName: 'Alice' },
    })

    const mine = (await listFriends(app, alice.token)).json()

    assert.deepEqual([mine[0].name, mine[0].alias], ['Alice', 'Bob'])
  })

  it('replaces an existing alias', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    await befriend(app, alice.token, bob.token)
    await setAlias(app, alice.token, bob.user.id, 'Bobby')
    await setAlias(app, alice.token, bob.user.id, 'Robert')

    assert.equal((await listFriends(app, alice.token)).json()[0].alias, 'Robert')
    assert.equal(await count('friend_aliases'), 1)
  })

  it('removes an alias', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    await befriend(app, alice.token, bob.token)
    await setAlias(app, alice.token, bob.user.id, 'Bobby')

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/friends/${bob.user.id}/alias`,
      headers: bearer(alice.token),
    })

    assert.equal(response.statusCode, 204)
    assert.equal((await listFriends(app, alice.token)).json()[0].alias, null)
  })

  it('rejects an alias for someone who is not my friend', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    const response = await setAlias(app, alice.token, bob.user.id, 'Bobby')

    assert.equal(response.statusCode, 404)
    assert.deepEqual(response.json(), { error: 'friend_not_found' })
  })

  it('rejects invalid aliases', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    await befriend(app, alice.token, bob.token)

    assert.equal((await setAlias(app, alice.token, bob.user.id, '   ')).statusCode, 422)
    assert.equal((await setAlias(app, alice.token, bob.user.id, '')).statusCode, 400)
    assert.equal(
      (await setAlias(app, alice.token, bob.user.id, 'x'.repeat(51))).statusCode,
      400,
    )
    assert.equal((await setAlias(app, alice.token, 'not-a-uuid', 'Bob')).statusCode, 400)
  })
})

describe('DELETE /api/friends/:id', { skip: skipWithoutDatabase }, () => {
  it('removes the friendship on both sides', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    await befriend(app, alice.token, bob.token)

    const response = await removeFriend(app, bob.token, alice.user.id)

    assert.equal(response.statusCode, 204)
    assert.deepEqual((await listFriends(app, alice.token)).json(), [])
    assert.deepEqual((await listFriends(app, bob.token)).json(), [])
  })

  it('deletes the aliases in both directions', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    await befriend(app, alice.token, bob.token)
    await setAlias(app, alice.token, bob.user.id, 'Bobby')
    await setAlias(app, bob.token, alice.user.id, 'Ali')

    await removeFriend(app, alice.token, bob.user.id)

    assert.equal(await count('friend_aliases'), 0)
  })

  it('revokes my invitations so the removed friend cannot come back', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    const { code } = (
      await app.inject({
        method: 'POST',
        url: '/api/invitations',
        headers: bearer(alice.token),
      })
    ).json()

    await app.inject({
      method: 'POST',
      url: `/api/invitations/${code}/accept`,
      headers: bearer(bob.token),
    })

    await removeFriend(app, alice.token, bob.user.id)

    const again = await app.inject({
      method: 'POST',
      url: `/api/invitations/${code}/accept`,
      headers: bearer(bob.token),
    })

    assert.equal(again.statusCode, 404)
  })

  it('does not touch the invitations of the removed friend', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    await befriend(app, alice.token, bob.token)
    await app.inject({
      method: 'POST',
      url: '/api/invitations',
      headers: bearer(bob.token),
    })

    await removeFriend(app, alice.token, bob.user.id)

    const bobInvitations = (
      await app.inject({
        method: 'GET',
        url: '/api/invitations',
        headers: bearer(bob.token),
      })
    ).json()

    assert.equal(bobInvitations.length, 1)
  })

  it('returns 404 for someone who is not my friend', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    const response = await removeFriend(app, alice.token, bob.user.id)

    assert.equal(response.statusCode, 404)
  })
})

describe('account deletion', { skip: skipWithoutDatabase }, () => {
  it('removes friendships and aliases of the deleted account', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    await befriend(app, alice.token, bob.token)
    await setAlias(app, alice.token, bob.user.id, 'Bobby')
    await setAlias(app, bob.token, alice.user.id, 'Ali')

    await app.inject({
      method: 'DELETE',
      url: '/api/me',
      headers: bearer(bob.token),
    })

    assert.equal(await count('friendships'), 0)
    assert.equal(await count('friend_aliases'), 0)
    assert.deepEqual((await listFriends(app, alice.token)).json(), [])
  })
})
