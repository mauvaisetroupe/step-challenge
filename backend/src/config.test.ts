import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ConfigError, loadConfig } from './config.js'

const REQUIRED = {
  DATABASE_HOST: 'db',
  DATABASE_NAME: 'step_challenge',
  DATABASE_USER: 'step_challenge',
  DATABASE_PASSWORD: 'secret',
  GOOGLE_CLIENT_ID: 'client-id',
}

describe('configuration', () => {
  it('applies the defaults', () => {
    const config = loadConfig(REQUIRED)

    assert.equal(config.database.port, 5432)
    assert.equal(config.port, 3000)
    assert.equal(config.host, '0.0.0.0')
    assert.equal(config.timeZone, 'Europe/Paris')
    assert.equal(config.clientIpHeader, 'cf-connecting-ip')
    assert.equal(config.publicBaseUrl, 'https://step.architech.lu')
    assert.equal(config.demoAccessCode, undefined)
  })

  it('names every missing variable at once', () => {
    assert.throws(
      () => loadConfig({ GOOGLE_CLIENT_ID: 'client-id', DATABASE_USER: ' ' }),
      (error: Error) =>
        error instanceof ConfigError &&
        error.message.includes(
          'DATABASE_HOST, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD',
        ) &&
        !error.message.includes('GOOGLE_CLIENT_ID'),
    )
  })

  it('refuses an unknown time zone', () => {
    assert.throws(
      () => loadConfig({ ...REQUIRED, APP_TIMEZONE: 'Europe/Nowhere' }),
      /APP_TIMEZONE/,
    )
    assert.equal(
      loadConfig({ ...REQUIRED, APP_TIMEZONE: 'America/Toronto' }).timeZone,
      'America/Toronto',
    )
  })

  it('refuses invalid numbers', () => {
    assert.throws(
      () => loadConfig({ ...REQUIRED, PORT: 'abc', DATABASE_PORT: '-1' }),
      (error: Error) =>
        error.message.includes('PORT must') &&
        error.message.includes('DATABASE_PORT'),
    )
    assert.equal(loadConfig({ ...REQUIRED, PORT: '3001' }).port, 3001)
  })

  it('reads the client IP header, empty meaning none', () => {
    assert.equal(
      loadConfig({ ...REQUIRED, CLIENT_IP_HEADER: 'X-Forwarded-For' })
        .clientIpHeader,
      'x-forwarded-for',
    )
    assert.equal(
      loadConfig({ ...REQUIRED, CLIENT_IP_HEADER: '' }).clientIpHeader,
      '',
    )
  })

  it('refuses a short demo access code', () => {
    assert.throws(
      () => loadConfig({ ...REQUIRED, DEMO_ACCESS_CODE: 'short' }),
      /DEMO_ACCESS_CODE/,
    )
  })
})
