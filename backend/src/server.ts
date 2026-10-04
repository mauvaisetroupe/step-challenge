import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import Fastify from 'fastify'
import path from 'node:path'
import { createRequireAuth } from './auth/authenticate.js'
import { createGoogleIdTokenVerifier } from './auth/google.js'
import { checkDatabase, pool } from './db.js'
import authRoutes from './routes/auth.js'
import healthRoutes from './routes/health.js'
import leaderboardRoutes from './routes/leaderboard.js'
import meRoutes from './routes/me.js'
import stepsRoutes from './routes/steps.js'
import usersRoutes from './routes/users.js'

const app = Fastify({
  logger: true,
})

const API_KEY = process.env.API_KEY

if (!API_KEY) {
  throw new Error('API_KEY is not configured')
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID

if (!GOOGLE_CLIENT_ID) {
  throw new Error('GOOGLE_CLIENT_ID is not configured')
}

app.addHook('onRequest', async (request, reply) => {
  if (!request.url.startsWith('/api/')) {
    return
  }

  // wait for client migration
  const apiKey = request.headers['x-api-key']

  if (apiKey !== API_KEY) {
    return reply.code(401).send({
      error: 'Unauthorized',
    })
  }
})

await app.register(fastifyStatic, {
  root: path.join(process.cwd(), 'public'),
  prefix: '/',
})

await app.register(cors, {
  origin: true,
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
})

await app.register(meRoutes, {
  prefix: '/api',
  db: pool,
  requireAuth,
})

await app.register(stepsRoutes, {
  prefix: '/api',
})

await app.register(usersRoutes, {
  prefix: '/api',
})

await app.register(leaderboardRoutes, {
  prefix: '/api',
})

try {
  await checkDatabase()

  app.log.info('Database connection successful')

  await app.listen({
    host: '0.0.0.0',
    port: Number(process.env.PORT ?? 3000),
  })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}