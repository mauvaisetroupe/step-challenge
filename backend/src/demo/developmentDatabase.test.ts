import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { assertDevelopmentDatabase } from './developmentDatabase.js'

describe('assertDevelopmentDatabase', () => {
  it('accepts the local development database', () => {
    for (const host of ['localhost', '127.0.0.1', '::1']) {
      assertDevelopmentDatabase({
        DATABASE_HOST: host,
        DATABASE_NAME: 'step_challenge_dev',
      })
    }
  })

  it('refuses any other database', () => {
    for (const env of [
      { DATABASE_HOST: 'localhost', DATABASE_NAME: 'step_challenge' },
      { DATABASE_HOST: '192.168.1.10', DATABASE_NAME: 'step_challenge_dev' },
      { DATABASE_HOST: 'db.example.com', DATABASE_NAME: 'step_challenge_dev' },
      { DATABASE_NAME: 'step_challenge_dev' },
      {},
    ]) {
      assert.throws(() => assertDevelopmentDatabase(env), /Refusing/)
    }
  })
})
