import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, afterEach, beforeEach, describe, it } from 'node:test'

import pg from 'pg'

import {
  checkSchemaVersion,
  expectedSchemaVersion,
  SchemaVersionError,
} from './schemaVersion.js'
import { skipWithoutDatabase } from './test/database.js'

describe('expected schema version', () => {
  it('is the highest migration of the repository', async () => {
    assert.ok((await expectedSchemaVersion()) >= 6)
  })

  it('counts versioned and baseline migrations only', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'migrations-'))

    try {
      for (const name of [
        'V001__a.sql',
        'B006__schema.sql',
        'V007__b.sql',
        'README.md',
        '008_not_flyway.sql',
      ]) {
        await writeFile(join(directory, name), '')
      }

      assert.equal(await expectedSchemaVersion(directory), 7)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})

// A schema of its own, through search_path, with a stand-in for the
// history table Flyway creates (only the columns read by the API).
const SCHEMA = 'schema_version_test'

const admin = process.env.TEST_DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL })
  : null

let pool: pg.Pool

beforeEach(async () => {
  if (!admin) {
    return
  }

  await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`)
  await admin.query(`CREATE SCHEMA ${SCHEMA}`)
  pool = new pg.Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    options: `-c search_path=${SCHEMA}`,
  })
})

afterEach(async () => {
  await pool?.end()
})

after(async () => {
  await admin?.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`)
  await admin?.end()
})

async function history(rows: [string | null, boolean][]) {
  await pool.query(
    'CREATE TABLE flyway_schema_history (version text, success boolean NOT NULL)',
  )

  for (const [version, success] of rows) {
    await pool.query(
      'INSERT INTO flyway_schema_history (version, success) VALUES ($1, $2)',
      [version, success],
    )
  }
}

describe('schema version check', { skip: skipWithoutDatabase }, () => {
  it('refuses a database never migrated by Flyway', async () => {
    await assert.rejects(
      checkSchemaVersion(pool, 6),
      (error: Error) =>
        error instanceof SchemaVersionError &&
        error.message.includes('migration image'),
    )
  })

  it('accepts the expected version', async () => {
    // Baseline at 6, then a repeatable migration (no version).
    await history([
      ['6', true],
      [null, true],
    ])

    assert.deepEqual(await checkSchemaVersion(pool, 6), {
      current: 6,
      warning: undefined,
    })
  })

  it('compares versions as numbers', async () => {
    await history([
      ['6', true],
      ['10', true],
    ])

    assert.equal((await checkSchemaVersion(pool, 10)).current, 10)
  })

  it('refuses an older database', async () => {
    await history([['6', true]])

    await assert.rejects(checkSchemaVersion(pool, 7), /version 6, this API needs 7/)
  })

  it('refuses a failed migration', async () => {
    await history([
      ['6', true],
      ['7', false],
    ])

    await assert.rejects(checkSchemaVersion(pool, 6), /Migration 7 failed/)
  })

  it('accepts a newer database with a warning', async () => {
    await history([
      ['6', true],
      ['7', true],
    ])

    const result = await checkSchemaVersion(pool, 6)

    assert.equal(result.current, 7)
    assert.match(result.warning!, /newer/)
  })
})
