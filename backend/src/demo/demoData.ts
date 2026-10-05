import { createHash } from 'node:crypto'

import type { Pool, PoolClient } from 'pg'

import { canonicalPair } from '../friends/friendships.js'
import { MAX_DAILY_STEPS } from '../routes/meSteps.js'

type Db = Pool | PoolClient

/**
 * Fictitious data (ADR 0006): friends with invented first names and
 * credible step histories, so that the leaderboard and the Friends
 * screen show the app working.
 *
 * Shared by the demo sign-in in production, which refreshes the demo
 * account's friends, and by the development seed script (screenshots).
 */

/** How active a fictitious person is. */
export type StepProfile = {
  /** Typical steps on a weekday. */
  base: number
  /** Weekend steps relative to a weekday: > 1 hikes, < 1 rests. */
  weekend: number
}

export type DemoFriend = StepProfile & {
  /** Fixed id: refreshing the friends never duplicates them. */
  id: string
  name: string
}

/**
 * The fictitious friends. They have no sign-in credential: nobody can
 * open a session as one of them. Their ids are fixed, so that they are
 * recognizable (docs/moderation.md) and reused at each refresh.
 */
export const DEMO_FRIENDS: readonly DemoFriend[] = [
  { id: 'de300000-0000-4000-8000-000000000001', name: 'Camille', base: 11_500, weekend: 1.3 },
  { id: 'de300000-0000-4000-8000-000000000002', name: 'Hugo', base: 8_200, weekend: 0.8 },
  { id: 'de300000-0000-4000-8000-000000000003', name: 'Léa', base: 9_800, weekend: 1.1 },
  { id: 'de300000-0000-4000-8000-000000000004', name: 'Nora', base: 6_400, weekend: 1.5 },
  { id: 'de300000-0000-4000-8000-000000000005', name: 'Théo', base: 13_200, weekend: 0.9 },
  { id: 'de300000-0000-4000-8000-000000000006', name: 'Inès', base: 7_300, weekend: 1 },
]

/** Profile of the signed-in user's own steps (development seed only). */
export const OWN_STEP_PROFILE: StepProfile = { base: 9_000, weekend: 1.2 }

/** Six weeks: the week and month leaderboards are always filled. */
export const DEMO_HISTORY_DAYS = 42

/** Three numbers in [0, 1), stable for a given seed and date. */
function randomsFor(seed: string, date: string) {
  const digest = createHash('sha256').update(`${seed}:${date}`).digest()

  return [0, 4, 8].map((offset) => digest.readUInt32BE(offset) / 2 ** 32)
}

function isWeekend(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()

  return day === 0 || day === 6
}

/**
 * Credible daily total for a person on a full day: varies from day to
 * day around the profile, with the occasional long walk or lazy day.
 * Deterministic: the same person and date always give the same value,
 * so a refresh does not make the history jump.
 */
export function dailySteps(seed: string, profile: StepProfile, date: string) {
  const [variation, event, eventSize] = randomsFor(seed, date)

  let steps = profile.base * (0.7 + 0.6 * variation)

  if (isWeekend(date)) {
    steps *= profile.weekend
  }

  if (event < 0.08) {
    // Long walk or hike.
    steps *= 1.5 + 0.5 * eventSize
  } else if (event < 0.14) {
    // Lazy or sick day.
    steps *= 0.25 + 0.25 * eventSize
  }

  return Math.min(MAX_DAILY_STEPS, Math.max(500, Math.round(steps)))
}

/**
 * Share of the day's steps already walked at this time: nothing before
 * 7:00, everything after 22:00. Used for today, still in progress.
 */
export function dayProgress(now: Date) {
  const hours = now.getHours() + now.getMinutes() / 60

  return Math.min(1, Math.max(0.05, (hours - 7) / 15))
}

/** The `days` dates ending with `today`, oldest first (YYYY-MM-DD). */
export function lastDates(today: string, days: number) {
  const end = new Date(`${today}T00:00:00Z`)

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end)
    date.setUTCDate(end.getUTCDate() - (days - 1 - index))
    return date.toISOString().slice(0, 10)
  })
}

export type DemoStepsOptions = {
  /** Days of history, today included. */
  days?: number
  /** Current time, for today's partial total. */
  now?: Date
}

/**
 * Writes the fictitious step history of a user for the last days,
 * replacing existing values. Today is partial (dayProgress). Dates
 * follow the database's CURRENT_DATE, like the leaderboard.
 */
export async function writeDemoSteps(
  db: Db,
  userId: string,
  profile: StepProfile,
  { days = DEMO_HISTORY_DAYS, now = new Date() }: DemoStepsOptions = {},
) {
  const { rows } = await db.query<{ today: string }>(
    "SELECT to_char(CURRENT_DATE, 'YYYY-MM-DD') AS today",
  )

  const today = rows[0].today
  const dates = lastDates(today, days)
  const steps = dates.map((date) => {
    const full = dailySteps(userId, profile, date)

    return date === today ? Math.round(full * dayProgress(now)) : full
  })

  await db.query(
    `
    INSERT INTO daily_steps (user_id, date, steps)
    SELECT $1, d::date, s
    FROM unnest($2::text[], $3::int[]) AS t(d, s)
    ON CONFLICT (user_id, date)
    DO UPDATE SET steps = EXCLUDED.steps, updated_at = now()
    `,
    [userId, dates, steps],
  )
}

/**
 * Gives a user the fictitious friends, in their initial state:
 *
 * - the friends exist with their original names;
 * - blocks and aliases between the user and them are removed;
 * - they are all friends of the user;
 * - their step history covers the last days.
 *
 * Idempotent: running it again only refreshes the data.
 */
export async function seedDemoFriends(
  db: Db,
  userId: string,
  options: DemoStepsOptions = {},
) {
  const ids = DEMO_FRIENDS.map((friend) => friend.id)

  await db.query(
    `
    INSERT INTO users (id, name)
    SELECT * FROM unnest($1::uuid[], $2::text[])
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    `,
    [ids, DEMO_FRIENDS.map((friend) => friend.name)],
  )

  await db.query(
    `
    DELETE FROM user_blocks
    WHERE (blocker_id = $1 AND blocked_id = ANY($2::uuid[]))
       OR (blocked_id = $1 AND blocker_id = ANY($2::uuid[]))
    `,
    [userId, ids],
  )

  await db.query(
    `
    DELETE FROM friend_aliases
    WHERE (owner_id = $1 AND friend_id = ANY($2::uuid[]))
       OR (friend_id = $1 AND owner_id = ANY($2::uuid[]))
    `,
    [userId, ids],
  )

  const pairs = ids.map((id) => canonicalPair(userId, id))

  await db.query(
    `
    INSERT INTO friendships (user_low, user_high)
    SELECT * FROM unnest($1::uuid[], $2::uuid[])
    ON CONFLICT (user_low, user_high) DO NOTHING
    `,
    [pairs.map(([low]) => low), pairs.map(([, high]) => high)],
  )

  for (const friend of DEMO_FRIENDS) {
    await writeDemoSteps(db, friend.id, friend, options)
  }
}
