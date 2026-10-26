import pg from 'pg'

import type { Config } from './config.js'

const { Pool } = pg

/**
 * Pool of the API. Every connection uses the time zone of the
 * configuration: CURRENT_DATE (leaderboard weeks and months, dates
 * refused in the future) must not depend on the server's time zone.
 */
export function createPool({ database, timeZone }: Config) {
  return new Pool({
    host: database.host,
    port: database.port,
    database: database.name,
    user: database.user,
    password: database.password,
    // Same effect as SET TIME ZONE, applied when the connection opens.
    options: `-c TimeZone=${timeZone}`,
    // Fail instead of waiting forever when the database is unreachable.
    connectionTimeoutMillis: 5000,
  })
}
