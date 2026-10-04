import pg from 'pg'

/**
 * Database used by integration tests.
 *
 * Only TEST_DATABASE_URL is used, never the DATABASE_* variables of .env:
 * tests truncate tables and must not run against a real database by
 * mistake. The schema (schema.sql) must already be applied.
 *
 * Returns null when TEST_DATABASE_URL is not set, so that integration
 * tests are skipped.
 */
export function createTestPool() {
  const url = process.env.TEST_DATABASE_URL

  if (!url) {
    return null
  }

  return new pg.Pool({ connectionString: url })
}

export async function resetDatabase(pool: pg.Pool) {
  await pool.query('TRUNCATE users CASCADE')
}

export const skipWithoutDatabase = process.env.TEST_DATABASE_URL
  ? false
  : 'TEST_DATABASE_URL is not set'
