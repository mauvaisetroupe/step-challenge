import {
  createRemoteJWKSet,
  errors,
  jwtVerify,
  type JWTVerifyGetKey,
} from 'jose'

/**
 * Canonical issuer stored in user_credentials.
 *
 * Google issues ID tokens with either form of the issuer; both identify
 * the same account and must map to the same credential.
 */
export const GOOGLE_ISSUER = 'https://accounts.google.com'

const ACCEPTED_ISSUERS = [GOOGLE_ISSUER, 'accounts.google.com']

const GOOGLE_JWKS_URL = new URL(
  'https://www.googleapis.com/oauth2/v3/certs',
)

export type OidcIdentity = {
  issuer: string
  subject: string
}

export class InvalidIdTokenError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'InvalidIdTokenError'
  }
}

/**
 * Creates a verifier for Google ID tokens (OpenID Connect).
 *
 * The token must be signed by Google (RS256, keys from Google's JWKS),
 * issued by Google, addressed to our Web client ID and not expired.
 * Only the stable subject identifier is returned: the email address
 * is deliberately ignored (ADR 0001).
 *
 * `jwks` can be overridden in tests to use locally generated keys.
 */
export function createGoogleIdTokenVerifier(options: {
  clientId: string
  jwks?: JWTVerifyGetKey
}) {
  const jwks =
    options.jwks ?? createRemoteJWKSet(GOOGLE_JWKS_URL)

  return async function verifyGoogleIdToken(
    idToken: string,
  ): Promise<OidcIdentity> {
    try {
      const { payload } = await jwtVerify(idToken, jwks, {
        issuer: ACCEPTED_ISSUERS,
        audience: options.clientId,
        algorithms: ['RS256'],
        clockTolerance: 30,
      })

      if (!payload.sub) {
        throw new InvalidIdTokenError('ID token has no subject')
      }

      return {
        issuer: GOOGLE_ISSUER,
        subject: payload.sub,
      }
    } catch (error) {
      if (error instanceof InvalidIdTokenError) {
        throw error
      }

      if (error instanceof errors.JOSEError) {
        throw new InvalidIdTokenError(error.message, { cause: error })
      }

      throw error
    }
  }
}
