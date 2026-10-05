/**
 * Fictitious data in the DEVELOPMENT database, for Store screenshots
 * (ADR 0006): the same fictitious friends and step histories as the demo
 * account of the reviewers.
 *
 *   npm run seed:demo                              list the accounts
 *   npm run seed:demo -- --user <id>               friends for an account
 *   npm run seed:demo -- --user <id> --own-steps   and its own steps
 *   npm run seed:demo -- --demo                    the demo account
 *   --days <n>                                     history length
 *
 * Reads .env.development and refuses any database other than a local
 * one whose name ends with _dev. Running it again refreshes the data.
 */

import { parseArgs } from 'node:util'

import pg from 'pg'

import { ensureDemoAccount } from './demoAccount.js'
import {
  DEMO_FRIENDS,
  DEMO_HISTORY_DAYS,
  OWN_STEP_PROFILE,
  seedDemoFriends,
  writeDemoSteps,
} from './demoData.js'
import { assertDevelopmentDatabase } from './developmentDatabase.js'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const { values } = parseArgs({
  options: {
    user: { type: 'string' },
    demo: { type: 'boolean', default: false },
    'own-steps': { type: 'boolean', default: false },
    days: { type: 'string', default: String(DEMO_HISTORY_DAYS) },
  },
})

const days = Number(values.days)

if (!Number.isInteger(days) || days < 1 || days > 400) {
  throw new Error('--days must be an integer between 1 and 400')
}

if (values.user && !UUID_PATTERN.test(values.user)) {
  throw new Error('--user must be an account id (see the list without option)')
}

if (values.user && values.demo) {
  throw new Error('Choose --user or --demo, not both')
}

assertDevelopmentDatabase(process.env)

const pool = new pg.Pool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
})

async function listAccounts() {
  const { rows } = await pool.query<{ id: string; name: string; type: string }>(
    `
    SELECT u.id, u.name, uc.type
    FROM users u
    JOIN user_credentials uc ON uc.user_id = u.id
    ORDER BY u.created_at
    `,
  )

  if (rows.length === 0) {
    console.log('No account yet: sign in once with the development app.')
  }

  for (const row of rows) {
    console.log(`${row.id}  ${row.name}  (${row.type})`)
  }

  console.log('\nThen: npm run seed:demo -- --user <id> [--own-steps]')
}

async function seed() {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    let userId: string

    if (values.demo) {
      userId = (await ensureDemoAccount(client, { days })).id
    } else {
      const user = await client.query<{ id: string; name: string }>(
        'SELECT id, name FROM users WHERE id = $1',
        [values.user],
      )

      if (user.rowCount === 0) {
        throw new Error(`No account ${values.user} in the development database`)
      }

      userId = user.rows[0].id
      await seedDemoFriends(client, userId, { days })
    }

    if (values['own-steps']) {
      await writeDemoSteps(client, userId, OWN_STEP_PROFILE, { days })
    }

    await client.query('COMMIT')

    console.log(
      `${values.demo ? 'Demo account' : 'Account'} ${userId}: ` +
        `${DEMO_FRIENDS.length} fictitious friends, ${days} days of steps` +
        (values['own-steps'] ? ', own steps included.' : '.'),
    )
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

try {
  if (values.user || values.demo) {
    await seed()
  } else {
    await listAccounts()
  }
} finally {
  await pool.end()
}
