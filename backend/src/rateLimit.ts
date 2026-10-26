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
 * Client IP address, read from the header set by the reverse proxy
 * (CLIENT_IP_HEADER, docs/exploitation.md): CF-Connecting-IP behind
 * Cloudflare. Without it every user would share the limit of the proxy
 * connection. A list (X-Forwarded-For) gives its last address, the one
 * written by the proxy in front of the API: the first ones come from
 * the client and can be forged. An empty header name uses the address
 * of the connection.
 *
 * The header can be forged by a client that reaches the server
 * directly, which the hosting is expected to prevent.
 */
export function createClientKey(header: string) {
  return (request: FastifyRequest) => {
    const value = header ? request.headers[header] : undefined
    const address = (Array.isArray(value) ? value.at(-1) : value)
      ?.split(',')
      .at(-1)
      ?.trim()

    return address || request.ip
  }
}

/**
 * Registers the rate limit plugin without global limit: only routes
 * declaring `config.rateLimit` are limited.
 */
export async function registerRateLimit(
  app: FastifyInstance,
  { clientIpHeader = 'cf-connecting-ip' }: { clientIpHeader?: string } = {},
) {
  await app.register(rateLimit, {
    global: false,
    keyGenerator: createClientKey(clientIpHeader),
  })
}
