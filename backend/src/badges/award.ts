import type { Pool } from 'pg'

import { leaderboardEntries } from '../leaderboard/entries.js'
import {
  evaluateBadges,
  finalPeriods,
  rankingAwards,
  type Award,
  type DayRecord,
} from './evaluate.js'

/**
 * Awards the badges of a user (docs/reference/badges.md): evaluates
 * their whole history and inserts what is not stored yet. Idempotent:
 * the primary key (user, badge, occurrence) makes a second insertion a
 * no-op, concurrent syncs included.
 */

/**
 * First month of the week, month and ranking badges: the month the
 * badges went live. Unique and repeatable badges cover the whole
 * history.
 */
export const BADGE_PERIODS_FROM = '2026-11'

/**
 * Final periods whose ranking badges are evaluated: a window after
 * their end, so that "the friends at the time of the award" stay close
 * to the period itself.
 */
export const RANKING_WINDOW = { weeks: 4, months: 2 }

/** Today in the server time zone (APP_TIMEZONE), as the leaderboard. */
export async function serverToday(db: Pool) {
  const result = await db.query<{ today: string }>(
    "SELECT to_char(CURRENT_DATE, 'YYYY-MM-DD') AS today",
  )

  return result.rows[0].today
}

export async function loadHistory(db: Pool, userId: string) {
  const result = await db.query<DayRecord>(
    `
    SELECT to_char(date, 'YYYY-MM-DD') AS date,
           steps,
           active_minutes      AS "activeMinutes",
           very_active_minutes AS "veryActiveMinutes",
           inactive_minutes    AS "inactiveMinutes"
    FROM daily_steps
    WHERE user_id = $1
    `,
    [userId],
  )

  return result.rows
}

/** Returns the badges newly inserted. */
export async function awardBadges(
  db: Pool,
  userId: string,
  periodsFrom = BADGE_PERIODS_FROM,
) {
  const context = { today: await serverToday(db), periodsFrom }
  const awards: Award[] = evaluateBadges(await loadHistory(db, userId), context)

  for (const period of finalPeriods(context, RANKING_WINDOW)) {
    awards.push(
      ...rankingAwards(
        period,
        await leaderboardEntries(db, userId, period.start, period.end),
      ),
    )
  }

  if (awards.length === 0) {
    return []
  }

  const result = await db.query<{ badgeId: string; occurrence: string }>(
    `
    INSERT INTO user_badges (user_id, badge_id, occurrence, points, earned_on)
    SELECT $1, a.badge_id, a.occurrence, a.points, a.earned_on
    FROM unnest($2::text[], $3::text[], $4::smallint[], $5::date[])
        AS a(badge_id, occurrence, points, earned_on)
    ON CONFLICT (user_id, badge_id, occurrence) DO NOTHING
    RETURNING badge_id AS "badgeId", occurrence
    `,
    [
      userId,
      awards.map((award) => award.badgeId),
      awards.map((award) => award.occurrence),
      awards.map((award) => award.points),
      awards.map((award) => award.earnedOn),
    ],
  )

  return result.rows
}
