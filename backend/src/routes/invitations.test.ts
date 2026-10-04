import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'

import { MAX_FRIENDS } from '../friends/friendships.js'
import { hashInvitationCode } from '../friends/invitationCode.js'
import { bearer, buildTestApp, signInAs, type TestApp } from '../test/app.js'
import {
  createTestPool,
  resetDatabase,
  skipWithoutDatabase,
} from '../test/database.js'
import { INVITATION_TTL_DAYS, MAX_ACTIVE_INVITATIONS } from './invitations.js'

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

function createInvitation(app: TestApp, token: string) {
  return app.inject({
    method: 'POST',
    url: '/api/invitations',
    headers: bearer(token),
  })
}

function preview(app: TestApp, token: string, code: string) {
  return app.inject({
    method: 'GET',
    url: `/api/invitations/${encodeURIComponent(code)}`,
    headers: bearer(token),
  })
}

function accept(app: TestApp, token: string, code: string) {
  return app.inject({
    method: 'POST',
    url: `/api/invitations/${encodeURIComponent(code)}/accept`,
    headers: bearer(token),
  })
}

async function friendships() {
  const result = await pool!.query(
    'SELECT user_low, user_high FROM friendships ORDER BY user_low, user_high',
  )

  return result.rows
}

describe('POST /api/invitations', { skip: skipWithoutDatabase }, () => {
  it('creates an invitation link valid for 7 days', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')

    const response = await createInvitation(app, alice.token)

    assert.equal(response.statusCode, 201)

    const body = response.json()

    assert.match(body.code, /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/)
    assert.equal(body.url, `https://step.example.test/i/${body.code}`)

    const days =
      (new Date(body.expiresAt).getTime() - Date.now()) / 86_400_000

    assert.ok(Math.abs(days - INVITATION_TTL_DAYS) < 0.01)
  })

  it('stores only the hash of the code', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')

    const { code } = (await createInvitation(app, alice.token)).json()

    const result = await pool!.query(
      'SELECT code_hash FROM invitations',
    )

    assert.deepEqual(
      result.rows[0].code_hash,
      hashInvitationCode(code.replace('-', '')),
    )
  })

  it('limits the number of active invitations', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')

    for (let i = 0; i < MAX_ACTIVE_INVITATIONS; i++) {
      assert.equal((await createInvitation(app, alice.token)).statusCode, 201)
    }

    const response = await createInvitation(app, alice.token)

    assert.equal(response.statusCode, 409)
    assert.deepEqual(response.json(), { error: 'too_many_invitations' })
  })

  it('requires a session', async () => {
    const app = await buildApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/invitations',
    })

    assert.equal(response.statusCode, 401)
  })
})

describe('GET and DELETE /api/invitations', { skip: skipWithoutDatabase }, () => {
  it('lists active invitations without their code', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    const created = (await createInvitation(app, alice.token)).json()

    await createInvitation(app, bob.token)

    const list = (
      await app.inject({
        method: 'GET',
        url: '/api/invitations',
        headers: bearer(alice.token),
      })
    ).json()

    assert.equal(list.length, 1)
    assert.equal(list[0].id, created.id)
    assert.equal(list[0].useCount, 0)
    assert.equal(list[0].code, undefined)
  })

  it('revokes an invitation, which can no longer be used', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    const { id, code } = (await createInvitation(app, alice.token)).json()

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/invitations/${id}`,
      headers: bearer(alice.token),
    })

    assert.equal(response.statusCode, 204)
    assert.equal((await accept(app, bob.token, code)).statusCode, 404)
  })

  it("cannot revoke someone else's invitation", async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    const { id } = (await createInvitation(app, alice.token)).json()

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/invitations/${id}`,
      headers: bearer(bob.token),
    })

    assert.equal(response.statusCode, 404)
  })

  it('excludes expired invitations', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')

    await createInvitation(app, alice.token)
    await pool!.query(
      "UPDATE invitations SET expires_at = now() - interval '1 second'",
    )

    const list = (
      await app.inject({
        method: 'GET',
        url: '/api/invitations',
        headers: bearer(alice.token),
      })
    ).json()

    assert.deepEqual(list, [])
  })
})

describe('GET /api/invitations/:code', { skip: skipWithoutDatabase }, () => {
  it('shows who invites me', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    const { code } = (await createInvitation(app, alice.token)).json()

    const response = await preview(app, bob.token, code)

    assert.equal(response.statusCode, 200)
    assert.deepEqual(
      {
        inviter: response.json().inviter,
        isOwnInvitation: response.json().isOwnInvitation,
        alreadyFriends: response.json().alreadyFriends,
      },
      {
        inviter: { id: alice.user.id, name: 'Alice' },
        isOwnInvitation: false,
        alreadyFriends: false,
      },
    )
  })

  it('accepts a code typed by hand', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    const { code } = (await createInvitation(app, alice.token)).json()
    const typed = ` ${code.replace('-', ' ').toLowerCase()} `

    assert.equal((await preview(app, bob.token, typed)).statusCode, 200)
  })

  it('flags my own invitation', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')

    const { code } = (await createInvitation(app, alice.token)).json()

    assert.equal(
      (await preview(app, alice.token, code)).json().isOwnInvitation,
      true,
    )
  })

  it('does not reveal unknown, malformed or expired codes', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    const { code } = (await createInvitation(app, alice.token)).json()

    await pool!.query(
      "UPDATE invitations SET expires_at = now() - interval '1 second'",
    )

    for (const candidate of [code, '0000-0000', 'not-a-code']) {
      const response = await preview(app, bob.token, candidate)

      assert.equal(response.statusCode, 404)
      assert.deepEqual(response.json(), { error: 'invitation_not_found' })
    }
  })
})

describe('POST /api/invitations/:code/accept', { skip: skipWithoutDatabase }, () => {
  it('makes the inviter and me friends', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    const { code } = (await createInvitation(app, alice.token)).json()

    const response = await accept(app, bob.token, code)

    assert.equal(response.statusCode, 201)
    assert.deepEqual(response.json(), {
      friend: { id: alice.user.id, name: 'Alice' },
      alreadyFriends: false,
    })

    const [low, high] = [alice.user.id, bob.user.id].sort()

    assert.deepEqual(await friendships(), [{ user_low: low, user_high: high }])
  })

  it('can be used by several people', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')
    const carol = await signInAs(app, 'carol', 'Carol')

    const { code } = (await createInvitation(app, alice.token)).json()

    assert.equal((await accept(app, bob.token, code)).statusCode, 201)
    assert.equal((await accept(app, carol.token, code)).statusCode, 201)

    const uses = await pool!.query('SELECT use_count FROM invitations')

    assert.equal(uses.rows[0].use_count, 2)
    assert.equal((await friendships()).length, 2)
  })

  it('is idempotent for an existing friend', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    const { code } = (await createInvitation(app, alice.token)).json()

    await accept(app, bob.token, code)
    const again = await accept(app, bob.token, code)

    assert.equal(again.statusCode, 200)
    assert.equal(again.json().alreadyFriends, true)
    assert.equal((await friendships()).length, 1)
  })

  it('creates a single friendship on concurrent accepts', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    const { code } = (await createInvitation(app, alice.token)).json()

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => accept(app, bob.token, code)),
    )

    for (const response of responses) {
      assert.ok([200, 201].includes(response.statusCode), response.body)
    }

    assert.equal((await friendships()).length, 1)
  })

  it('rejects my own invitation', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')

    const { code } = (await createInvitation(app, alice.token)).json()

    const response = await accept(app, alice.token, code)

    assert.equal(response.statusCode, 400)
    assert.deepEqual(response.json(), { error: 'own_invitation' })
    assert.deepEqual(await friendships(), [])
  })

  it('rejects an expired invitation', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    const { code } = (await createInvitation(app, alice.token)).json()

    await pool!.query(
      "UPDATE invitations SET expires_at = now() - interval '1 second'",
    )

    assert.equal((await accept(app, bob.token, code)).statusCode, 404)
  })

  it('enforces the friend limit', async () => {
    const app = await buildApp()
    const alice = await signInAs(app, 'alice', 'Alice')
    const bob = await signInAs(app, 'bob', 'Bob')

    // Alice already has MAX_FRIENDS friends.
    await pool!.query(
      `
      WITH others AS (
        INSERT INTO users (id, name)
        SELECT gen_random_uuid(), 'friend ' || n
        FROM generate_series(1, $2) AS n
        RETURNING id
      )
      INSERT INTO friendships (user_low, user_high)
      SELECT LEAST($1::uuid, id), GREATEST($1::uuid, id) FROM others
      `,
      [alice.user.id, MAX_FRIENDS],
    )

    const { code } = (await createInvitation(app, alice.token)).json()

    const response = await accept(app, bob.token, code)

    assert.equal(response.statusCode, 409)
    assert.deepEqual(response.json(), { error: 'friend_limit_reached' })
  })
})
