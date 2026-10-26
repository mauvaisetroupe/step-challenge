import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'

import Fastify from 'fastify'
import pg from 'pg'

import { createTestPool, skipWithoutDatabase } from '../test/database.js'
import healthRoutes from './health.js'

const pool = createTestPool()

after(async () => {
  await pool?.end()
})

async function health(db: pg.Pool) {
  const app = Fastify()

  await app.register(healthRoutes, { prefix: '/api', db })

  return app.inject({ method: 'GET', url: '/api/health' })
}

describe('health', { skip: skipWithoutDatabase }, () => {
  it('answers 200 when the database answers', async () => {
    const response = await health(pool!)

    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), { status: 'ok' })
  })

  it('answers 503 when the database does not', async () => {
    // Nothing listens on port 1.
    const unreachable = new pg.Pool({ host: '127.0.0.1', port: 1 })

    try {
      const response = await health(unreachable)

      assert.equal(response.statusCode, 503)
      assert.deepEqual(response.json(), { status: 'unavailable' })
    } finally {
      await unreachable.end()
    }
  })
})
