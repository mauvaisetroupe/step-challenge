import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import Fastify from 'fastify'
import path from 'node:path'
import { createRequireAuth } from './auth/authenticate.js'
import { createGoogleIdTokenVerifier } from './auth/google.js'
import { checkDatabase, pool } from './db.js'
import { parseDemoAccessCode } from './demo/demoAccount.js'
import { registerRateLimit } from './rateLimit.js'
import appLinkRoutes from './routes/appLinks.js'
import authRoutes from './routes/auth.js'
import blockRoutes from './routes/blocks.js'
import friendRoutes from './routes/friends.js'
import healthRoutes from './routes/health.js'
import invitationRoutes from './routes/invitations.js'
import leaderboardRoutes from './routes/leaderboard.js'
import meRoutes from './routes/me.js'
import meStepsRoutes from './routes/meSteps.js'
import reportRoutes from './routes/reports.js'

const app = Fastify({
  logger: true,
})

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID

if (!GOOGLE_CLIENT_ID) {
  throw new Error('GOOGLE_CLIENT_ID is not configured')
}

// Demo access for store reviewers (ADR 0006): disabled when absent.
const DEMO_ACCESS_CODE = parseDemoAccessCode(process.env.DEMO_ACCESS_CODE)

// Base of the invitation links shared by users (ADR 0002).
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL ?? 'https://step.architech.lu'

await app.register(fastifyStatic, {
  root: path.join(process.cwd(), 'public'),
  prefix: '/',
})

await registerRateLimit(app)

await app.register(cors, {
  origin: true,
})

await app.register(appLinkRoutes, {
  host: new URL(PUBLIC_BASE_URL).host,
})

await app.register(healthRoutes, {
  prefix: '/api',
})

const requireAuth = createRequireAuth(pool)

await app.register(authRoutes, {
  prefix: '/api',
  db: pool,
  verifyGoogleIdToken: createGoogleIdTokenVerifier({
    clientId: GOOGLE_CLIENT_ID,
  }),
  requireAuth,
  demoAccessCode: DEMO_ACCESS_CODE,
})

await app.register(meRoutes, {
  prefix: '/api',
  db: pool,
  requireAuth,
})

await app.register(meStepsRoutes, {
  prefix: '/api',
  db: pool,
  requireAuth,
})

await app.register(blockRoutes, {
  prefix: '/api',
  db: pool,
  requireAuth,
})

await app.register(reportRoutes, {
  prefix: '/api',
  db: pool,
  requireAuth,
})

await app.register(friendRoutes, {
  prefix: '/api',
  db: pool,
  requireAuth,
})

await app.register(invitationRoutes, {
  prefix: '/api',
  db: pool,
  requireAuth,
  publicBaseUrl: PUBLIC_BASE_URL,
})

await app.register(leaderboardRoutes, {
  prefix: '/api',
  db: pool,
  requireAuth,
})

try {
  await checkDatabase()

  app.log.info('Database connection successful')
  app.log.info(`Demo access ${DEMO_ACCESS_CODE ? 'enabled' : 'disabled'}`)

  await app.listen({
    host: process.env.HOST ?? '0.0.0.0',
    port: Number(process.env.PORT ?? 3000),
  })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}