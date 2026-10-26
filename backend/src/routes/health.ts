import type { FastifyPluginAsync } from 'fastify'
import type { Pool } from 'pg'

export type HealthRoutesOptions = {
  db: Pool
}

/**
 * Health check for the operator (docs/exploitation.md), without
 * authentication: 200 when the API and the database answer, 503
 * otherwise.
 */
const healthRoutes: FastifyPluginAsync<HealthRoutesOptions> = async (
  app,
  { db },
) => {
  app.get('/health', async (request, reply) => {
    try {
      await db.query('SELECT 1')
    } catch (error) {
      request.log.error(error, 'Health check: database unavailable')

      return reply.code(503).send({ status: 'unavailable' })
    }

    return reply.send({ status: 'ok' })
  })
}

export default healthRoutes
