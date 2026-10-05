/**
 * Guard for scripts that write fictitious data: they only run against a
 * local development database, never production.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

export type DatabaseSettings = {
  DATABASE_HOST?: string
  DATABASE_NAME?: string
}

/**
 * Throws unless the settings point to a local database whose name ends
 * with _dev (step_challenge_dev in docker-compose.dev.yml).
 */
export function assertDevelopmentDatabase(env: DatabaseSettings) {
  const host = env.DATABASE_HOST ?? ''
  const name = env.DATABASE_NAME ?? ''

  if (!LOCAL_HOSTS.has(host) || !name.endsWith('_dev')) {
    throw new Error(
      `Refusing to write fictitious data to database "${name}" on "${host}": ` +
        'only a local database whose name ends with _dev is allowed ' +
        '(npm run seed:demo uses .env.development).',
    )
  }
}
