import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { generateSessionToken, hashSessionToken } from './sessions.js'

describe('generateSessionToken', () => {
  it('generates 256-bit base64url tokens', () => {
    const token = generateSessionToken()

    assert.match(token, /^[A-Za-z0-9_-]{43}$/)
    assert.equal(Buffer.from(token, 'base64url').length, 32)
  })

  it('generates a different token each time', () => {
    const tokens = new Set(
      Array.from({ length: 100 }, generateSessionToken),
    )

    assert.equal(tokens.size, 100)
  })
})

describe('hashSessionToken', () => {
  it('is a deterministic SHA-256 digest', () => {
    const token = generateSessionToken()

    assert.equal(hashSessionToken(token).length, 32)
    assert.deepEqual(hashSessionToken(token), hashSessionToken(token))
    assert.notDeepEqual(
      hashSessionToken(token),
      hashSessionToken(generateSessionToken()),
    )
  })
})
