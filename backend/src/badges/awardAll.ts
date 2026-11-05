/**
 * Awards the badges of every account, once (docs/reference/badges.md).
 * Each account gets its badges at its next sync anyway; this avoids
 * waiting for it, at the release of the badges for instance, so that
 * the leaderboard shows the levels at once. Idempotent: running it again
 * inserts nothing new.
 *
 *   npm run badges:award-all             with the .env of the backend
 *   node dist/badges/awardAll.js         in the API image
 *
 * Same configuration as the API (loadConfig): the same database and time
 * zone.
 */

import 'dotenv/config'

import { loadConfig } from '../config.js'
import { createPool } from '../db.js'
import { awardBadges } from './award.js'

const pool = createPool(loadConfig(process.env))

try {
  const { rows } = await pool.query<{ id: string }>(
    'SELECT id FROM users ORDER BY created_at',
  )
  let inserted = 0

  for (const { id } of rows) {
    inserted += (await awardBadges(pool, id)).length
  }

  console.log(`${rows.length} accounts, ${inserted} badges awarded`)
} finally {
  await pool.end()
}
