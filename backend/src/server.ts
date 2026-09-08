import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import Fastify from 'fastify'
import path from 'node:path'
import { checkDatabase } from './db.js'
import healthRoutes from './routes/health.js'
import leaderboardRoutes from './routes/leaderboard.js'
import stepsRoutes from './routes/steps.js'
import usersRoutes from './routes/users.js'

const app = Fastify({
  logger: true,
})

const API_KEY = process.env.API_KEY

if (!API_KEY) {
  throw new Error('API_KEY is not configured')
}

app.addHook('onRequest', async (request, reply) => {
  if (!request.url.startsWith('/api/')) {
    return
  }

  // wait for client migration
  // const apiKey = request.headers['x-api-key']

  // if (apiKey !== API_KEY) {
  //   return reply.code(401).send({
  //     error: 'Unauthorized',
  //   })
  // }
})

await app.register(fastifyStatic, {
  root: path.join(process.cwd(), '..', 'download'),
  prefix: '/download/',
})

await app.register(cors, {
  origin: true,
})

await app.register(healthRoutes, {
  prefix: '/api',
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
    port: 3000,
  })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}