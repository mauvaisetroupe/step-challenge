import type { FastifyPluginAsync } from 'fastify'
import type { Pool } from 'pg'

import type { RequireAuth } from '../auth/authenticate.js'
import { levelOf } from '../badges/levels.js'
import { leaderboardEntries } from '../leaderboard/entries.js'

export type LeaderboardRoutesOptions = {
  db: Pool
  requireAuth: RequireAuth
}

/**
 * Periods back the leaderboard can show: the current one (0) and the one
 * before (1), so that the result of last week is still visible on Monday.
 */
const MAX_OFFSET = 1

const leaderboardRoutes: FastifyPluginAsync<
  LeaderboardRoutesOptions
> = async (app, { db, requireAuth }) => {
  app.addHook('onRequest', requireAuth)

  /**
   * Leaderboard of the signed-in user and their friends (ADR 0002) for
   * the current week or month, or the previous one (offset=1); isMe
   * flags my own entry, level is the badge level of each person (see
   * leaderboardEntries for the other fields).
   */
  app.get('/leaderboard', async (request, reply) => {
    const { period = 'week', offset: offsetParam = '0' } = request.query as {
      period?: 'week' | 'month'
      offset?: string
    }

    if (period !== 'week' && period !== 'month') {
      return reply.code(400).send({
        error: 'Invalid period. Use "week" or "month".',
      })
    }

    const offset = Number(offsetParam)

    if (!/^\d+$/.test(offsetParam) || offset > MAX_OFFSET) {
      return reply.code(400).send({
        error: `Invalid offset. Use an integer from 0 to ${MAX_OFFSET}.`,
      })
    }

    // First and last day of the period. Subtracting a month from March 31
    // gives the end of February: the truncation then lands on February 1.
    const bounds = await db.query<{ start: string; end: string }>(
      `
      WITH period AS (
        SELECT date_trunc(
          $1,
          CURRENT_DATE - $2::int * ('1 ' || $1)::interval
        ) AS start
      )
      SELECT
        to_char(start, 'YYYY-MM-DD') AS start,
        to_char(
          start + ('1 ' || $1)::interval - interval '1 day',
          'YYYY-MM-DD'
        ) AS "end"
      FROM period
      `,
      [period, offset],
    )
    const { start, end } = bounds.rows[0]

    const results = await leaderboardEntries(
      db,
      request.auth!.userId,
      start,
      end,
    )

    return reply.send({
      period,
      offset,
      start,
      end,
      results: results.map(({ badgePoints, ...entry }) => ({
        ...entry,
        level: levelOf(badgePoints).level,
      })),
    })
  })
}

export default leaderboardRoutes
