import { parseDemoAccessCode } from './demo/demoAccount.js'

/**
 * Configuration of the API, read from environment variables only
 * (ADR 0011). Every variable is described in docs/exploitation.md.
 */
export type Config = {
  database: {
    host: string
    port: number
    name: string
    user: string
    password: string
  }
  googleClientId: string
  host: string
  port: number
  publicBaseUrl: string
  demoAccessCode: string | undefined
  timeZone: string
  // Empty string: the address of the connection is used.
  clientIpHeader: string
}

export class ConfigError extends Error {}

const REQUIRED = [
  'DATABASE_HOST',
  'DATABASE_NAME',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'GOOGLE_CLIENT_ID',
] as const

type Env = Record<string, string | undefined>

/**
 * Reads and checks the configuration. Throws a ConfigError naming every
 * missing or invalid variable at once, so that a single start reveals
 * all of them.
 */
export function loadConfig(env: Env): Config {
  const errors: string[] = []

  const missing = REQUIRED.filter((name) => !env[name]?.trim())

  if (missing.length > 0) {
    errors.push(`missing required variables: ${missing.join(', ')}`)
  }

  const integer = (name: string, fallback: number) => {
    const value = env[name]?.trim()

    if (!value) {
      return fallback
    }

    if (!/^\d+$/.test(value)) {
      errors.push(`${name} must be a positive integer, got "${value}"`)
      return fallback
    }

    return Number(value)
  }

  const timeZone = env.APP_TIMEZONE?.trim() || 'Europe/Paris'

  if (!isValidTimeZone(timeZone)) {
    errors.push(`APP_TIMEZONE is not a known time zone: "${timeZone}"`)
  }

  let demoAccessCode: string | undefined

  try {
    demoAccessCode = parseDemoAccessCode(env.DEMO_ACCESS_CODE)
  } catch (error) {
    errors.push((error as Error).message)
  }

  const config: Config = {
    database: {
      host: env.DATABASE_HOST?.trim() ?? '',
      port: integer('DATABASE_PORT', 5432),
      name: env.DATABASE_NAME?.trim() ?? '',
      user: env.DATABASE_USER?.trim() ?? '',
      password: env.DATABASE_PASSWORD ?? '',
    },
    googleClientId: env.GOOGLE_CLIENT_ID?.trim() ?? '',
    host: env.HOST?.trim() || '0.0.0.0',
    port: integer('PORT', 3000),
    // Base of the invitation links shared by users (ADR 0002). The links
    // and their landing page are served by the public site (ADR 0005).
    publicBaseUrl: env.PUBLIC_BASE_URL?.trim() || 'https://step.architech.lu',
    // Demo access for store reviewers (ADR 0006): disabled when absent.
    demoAccessCode,
    timeZone,
    // Unset: Cloudflare's header. Set but empty: no proxy header.
    clientIpHeader: (env.CLIENT_IP_HEADER ?? 'cf-connecting-ip')
      .trim()
      .toLowerCase(),
  }

  if (errors.length > 0) {
    throw new ConfigError(`Invalid configuration: ${errors.join('; ')}`)
  }

  return config
}

function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone })
    return true
  } catch {
    return false
  }
}
