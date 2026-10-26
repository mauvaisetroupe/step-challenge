import 'dotenv/config'

import cors from '@fastify/cors'
import Fastify from 'fastify'
import { createRequireAuth } from './auth/authenticate.js'
import { createGoogleIdTokenVerifier } from './auth/google.js'
import { ConfigError, loadConfig, type Config } from './config.js'
import { createPool } from './db.js'
import { registerRateLimit } from './rateLimit.js'
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

let config: Config

try {
  config = loadConfig(process.env)
} catch (error) {
  if (!(error instanceof ConfigError)) {
    throw error
  }

  app.log.fatal(error.message)
  process.exit(1)
}

const pool = createPool(config)

app.addHook('onClose', async () => {
  await pool.end()
})

// Stop cleanly when the container stops: requests in progress end, then
// the pool closes (onClose).
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, async () => {
    app.log.info(`${signal} received, shutting down`)

    try {
      await app.close()
      process.exit(0)
    } catch (error) {
      app.log.error(error)
      process.exit(1)
    }
  })
}

await registerRateLimit(app, {
  clientIpHeader: config.clientIpHeader,
})

await app.register(cors, {
  origin: true,
})

await app.register(healthRoutes, {
  prefix: '/api',
  db: pool,
})

const requireAuth = createRequireAuth(pool)

await app.register(authRoutes, {
  prefix: '/api',
  db: pool,
  verifyGoogleIdToken: createGoogleIdTokenVerifier({
    clientId: config.googleClientId,
  }),
  requireAuth,
  demoAccessCode: config.demoAccessCode,
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
  publicBaseUrl: config.publicBaseUrl,
})

await app.register(leaderboardRoutes, {
  prefix: '/api',
  db: pool,
  requireAuth,
})

try {
  await pool.query('SELECT 1')

  app.log.info('Database connection successful')
  app.log.info(`Demo access ${config.demoAccessCode ? 'enabled' : 'disabled'}`)
  app.log.info(`Time zone ${config.timeZone}`)

  await app.listen({
    host: config.host,
    port: config.port,
  })
} catch (error) {
  app.log.fatal(error)
  await pool.end().catch(() => {})
  process.exit(1)
}
