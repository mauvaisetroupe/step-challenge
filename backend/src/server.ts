import cors from '@fastify/cors'
import Fastify from 'fastify'
import { checkDatabase } from './db.js'
import healthRoutes from './routes/health.js'
import stepsRoutes from './routes/steps.js'
import usersRoutes from './routes/users.js'

console.log('DATABASE_HOST:', process.env.DATABASE_HOST)
console.log('DATABASE_NAME:', process.env.DATABASE_NAME)

const app = Fastify({
  logger: true,
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