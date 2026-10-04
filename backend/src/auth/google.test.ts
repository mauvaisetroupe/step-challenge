import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
  type JWTPayload,
} from 'jose'

import {
  createGoogleIdTokenVerifier,
  GOOGLE_ISSUER,
  InvalidIdTokenError,
} from './google.js'

const CLIENT_ID = 'test-client.apps.googleusercontent.com'
const KEY_ID = 'test-key'

let googleKey: CryptoKey
let otherKey: CryptoKey
let verify: ReturnType<typeof createGoogleIdTokenVerifier>

async function signToken(
  claims: JWTPayload,
  options: {
    key?: CryptoKey
    expiresIn?: string | number
    issuer?: string
    audience?: string
  } = {},
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: KEY_ID })
    .setIssuer(options.issuer ?? GOOGLE_ISSUER)
    .setAudience(options.audience ?? CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime(options.expiresIn ?? '1h')
    .sign(options.key ?? googleKey)
}

before(async () => {
  const google = await generateKeyPair('RS256')
  const other = await generateKeyPair('RS256')

  googleKey = google.privateKey
  otherKey = other.privateKey

  const publicJwk = await exportJWK(google.publicKey)

  verify = createGoogleIdTokenVerifier({
    clientId: CLIENT_ID,
    jwks: createLocalJWKSet({
      keys: [{ ...publicJwk, kid: KEY_ID, alg: 'RS256' }],
    }),
  })
})

describe('verifyGoogleIdToken', () => {
  it('returns the identity of a valid token', async () => {
    const token = await signToken({ sub: '1234567890' })

    assert.deepEqual(await verify(token), {
      issuer: GOOGLE_ISSUER,
      subject: '1234567890',
    })
  })

  it('normalizes the short issuer form', async () => {
    const token = await signToken(
      { sub: '1234567890' },
      { issuer: 'accounts.google.com' },
    )

    assert.equal((await verify(token)).issuer, GOOGLE_ISSUER)
  })

  it('ignores the email claim', async () => {
    const token = await signToken({
      sub: '1234567890',
      email: 'someone@example.com',
    })

    assert.deepEqual(Object.keys(await verify(token)).sort(), [
      'issuer',
      'subject',
    ])
  })

  it('rejects a token for another client', async () => {
    const token = await signToken(
      { sub: '1234567890' },
      { audience: 'other-client.apps.googleusercontent.com' },
    )

    await assert.rejects(verify(token), InvalidIdTokenError)
  })

  it('rejects a token from another issuer', async () => {
    const token = await signToken(
      { sub: '1234567890' },
      { issuer: 'https://evil.example.com' },
    )

    await assert.rejects(verify(token), InvalidIdTokenError)
  })

  it('rejects an expired token', async () => {
    const token = await signToken(
      { sub: '1234567890' },
      { expiresIn: Math.floor(Date.now() / 1000) - 3600 },
    )

    await assert.rejects(verify(token), InvalidIdTokenError)
  })

  it('rejects a token signed by another key', async () => {
    const token = await signToken(
      { sub: '1234567890' },
      { key: otherKey },
    )

    await assert.rejects(verify(token), InvalidIdTokenError)
  })

  it('rejects a token without subject', async () => {
    const token = await signToken({})

    await assert.rejects(verify(token), InvalidIdTokenError)
  })

  it('rejects an unsigned token', async () => {
    const header = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' }),
    ).toString('base64url')
    const payload = Buffer.from(
      JSON.stringify({
        sub: '1234567890',
        iss: GOOGLE_ISSUER,
        aud: CLIENT_ID,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString('base64url')

    await assert.rejects(
      verify(`${header}.${payload}.`),
      InvalidIdTokenError,
    )
  })

  it('rejects garbage', async () => {
    await assert.rejects(verify('not-a-jwt'), InvalidIdTokenError)
  })
})
