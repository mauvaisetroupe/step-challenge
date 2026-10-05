import rateLimit from '@fastify/rate-limit'
import type { FastifyInstance, FastifyRequest } from 'fastify'

/**
 * Rate limits (ADR 0001 for sign-in, ADR 0002 for invitations, ADR 0004
 * for reports, ADR 0006 for demo access), applied per client IP address.
 *
 * Generous for a person, tight enough to slow down scripts: account
 * creation in bulk, guessing invitation codes.
 */
export const RATE_LIMITS = {
  signIn: { max: 20, timeWindow: '1 minute' },
  invitationCreate: { max: 20, timeWindow: '1 hour' },
  // Applied separately to preview and acceptance: with the in-memory
  // store, each route has its own counter (groupId only works with a
  // shared store such as Redis). 2 × 30 guesses per minute remain far
  // below what guessing a code among ~10^12 within 7 days would need.
  invitationLookup: { max: 30, timeWindow: '1 minute' },
  // Reports are read by a person: enough for a real need, not for
  // flooding the moderation queue.
  report: { max: 10, timeWindow: '1 hour' },
  // Demo access (ADR 0006): a reviewer signs in a few times at most;
  // this leaves no room for guessing the access code.
  demoSignIn: { max: 10, timeWindow: '1 hour' },
} as const

/**
 * Client IP address. In production the API is reached through
 * Cloudflare, which sets CF-Connecting-IP to the real client address;
 * without it every user would share the limit of the Cloudflare
 * connection. The header can be forged by a client that reaches the
 * server directly, which the Cloudflare setup is expected to prevent.
 */
export function clientKey(request: FastifyRequest) {
  const forwarded = request.headers['cf-connecting-ip']

  return typeof forwarded === 'string' && forwarded ? forwarded : request.ip
}

/**
 * Registers the rate limit plugin without global limit: only routes
 * declaring `config.rateLimit` are limited.
 */
export async function registerRateLimit(app: FastifyInstance) {
  await app.register(rateLimit, {
    global: false,
    keyGenerator: clientKey,
  })
}
