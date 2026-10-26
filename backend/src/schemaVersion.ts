import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import type { Pool } from 'pg'

/**
 * Schema version check at start (ADR 0011). Migrations are applied by
 * the migration image (Flyway) before the API starts; the API only
 * checks that the database has reached the version it was built with.
 */

export const MIGRATIONS_DIRECTORY = fileURLToPath(
  new URL('../migrations/', import.meta.url),
)

// V007__name.sql (versioned) or B006__name.sql (baseline migration).
const MIGRATION_FILE = /^[VB](\d+)__.+\.sql$/

export class SchemaVersionError extends Error {}

/** Highest migration of the repository, the version the API expects. */
export async function expectedSchemaVersion(directory = MIGRATIONS_DIRECTORY) {
  const versions = (await readdir(directory))
    .map((name) => MIGRATION_FILE.exec(name))
    .filter((match) => match !== null)
    .map((match) => Number(match[1]))

  if (versions.length === 0) {
    throw new SchemaVersionError(`No migration found in ${directory}`)
  }

  return Math.max(...versions)
}

/**
 * Checks the Flyway history (flyway_schema_history). Throws when
 * migrations were never run, when one failed, or when the database is
 * older than expected. A newer database is accepted (going back to the
 * previous image after a compatible migration) and returns a warning.
 */
export async function checkSchemaVersion(db: Pool, expected: number) {
  const history = await db.query<{ exists: boolean }>(
    "SELECT to_regclass('flyway_schema_history') IS NOT NULL AS exists",
  )

  if (!history.rows[0].exists) {
    throw new SchemaVersionError(
      'The database has no migration history (flyway_schema_history): ' +
        'run the migration image before the API (see docs/exploitation.md)',
    )
  }

  const result = await db.query<{ version: string; success: boolean }>(
    'SELECT version, success FROM flyway_schema_history WHERE version IS NOT NULL',
  )

  const failed = result.rows.filter((row) => !row.success)

  if (failed.length > 0) {
    throw new SchemaVersionError(
      `Migration ${failed.map((row) => row.version).join(', ')} failed: ` +
        'fix it with the migration image before starting the API',
    )
  }

  const current = Math.max(0, ...result.rows.map((row) => Number(row.version)))

  if (current < expected) {
    throw new SchemaVersionError(
      `The database schema is at version ${current}, this API needs ${expected}: ` +
        'run the migration image of the same version first',
    )
  }

  return {
    current,
    warning:
      current > expected
        ? `The database schema (version ${current}) is newer than this API (${expected})`
        : undefined,
  }
}
