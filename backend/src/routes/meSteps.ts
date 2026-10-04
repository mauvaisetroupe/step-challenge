import type { FastifyPluginAsync } from 'fastify'
import type { Pool } from 'pg'

import type { RequireAuth } from '../auth/authenticate.js'

export type MeStepsRoutesOptions = {
  db: Pool
  requireAuth: RequireAuth
}

/** Plausibility bound: about 70 km of walking in a day. */
export const MAX_DAILY_STEPS = 100_000

/** The app syncs the last 30 days; 31 covers month boundaries. */
export const MAX_DAYS_PER_REQUEST = 31

/** Default history: enough for the 12-month statistics view. */
export const DEFAULT_HISTORY_DAYS = 400

const DATE_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$'

/** PostgreSQL errors raised when casting an impossible date. */
const INVALID_DATE_CODES = new Set(['22007', '22008'])

function isInvalidDateError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    INVALID_DATE_CODES.has(error.code as string)
  )
}

type DayEntry = {
  date: string
  steps: number
}

const meStepsRoutes: FastifyPluginAsync<MeStepsRoutesOptions> = async (
  app,
  { db, requireAuth },
) => {
  app.addHook('onRequest', requireAuth)

  /**
   * Records daily step totals for the signed-in user.
   *
   * The server keeps the highest value per day: sending the same or a
   * lower total again has no effect, so the sync is idempotent.
   *
   * Returns the dates that were actually recorded (new day or higher
   * total), so the app can report what a sync changed.
   */
  app.post<{
    Body: { days: DayEntry[] }
  }>(
    '/me/steps',
    {
      schema: {
        body: {
          type: 'object',
          required: ['days'],
          additionalProperties: false,
          properties: {
            days: {
              type: 'array',
              minItems: 1,
              maxItems: MAX_DAYS_PER_REQUEST,
              items: {
                type: 'object',
                required: ['date', 'steps'],
                additionalProperties: false,
                properties: {
                  date: { type: 'string', pattern: DATE_PATTERN },
                  steps: {
                    type: 'integer',
                    minimum: 0,
                    maximum: MAX_DAILY_STEPS,
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { days } = request.body
      const dates = days.map((day) => day.date)

      if (new Set(dates).size !== dates.length) {
        return reply.code(400).send({ error: 'duplicate_date' })
      }

      try {
        // Refuses the future, with one day of margin for timezones
        // ahead of the server. The ::date cast rejects impossible
        // dates such as 2026-02-30.
        const check = await db.query<{ valid: boolean }>(
          `
          SELECT bool_and(d <= CURRENT_DATE + 1) AS valid
          FROM unnest($1::date[]) AS d
          `,
          [dates],
        )

        if (!check.rows[0].valid) {
          return reply.code(400).send({ error: 'invalid_date' })
        }
      } catch (error) {
        if (isInvalidDateError(error)) {
          return reply.code(400).send({ error: 'invalid_date' })
        }

        throw error
      }

      // Rows skipped by the WHERE clause (same or lower total) are
      // neither updated nor returned.
      const result = await db.query<{ date: string }>(
        `
        INSERT INTO daily_steps (user_id, date, steps)
        SELECT $1, d.date, d.steps
        FROM unnest($2::date[], $3::int[]) AS d(date, steps)
        ON CONFLICT (user_id, date) DO UPDATE
        SET steps = EXCLUDED.steps,
            updated_at = now()
        WHERE daily_steps.steps < EXCLUDED.steps
        RETURNING to_char(date, 'YYYY-MM-DD') AS date
        `,
        [request.auth!.userId, dates, days.map((day) => day.steps)],
      )

      return reply.send({
        updatedDates: result.rows.map((row) => row.date).sort(),
      })
    },
  )

  /**
   * Returns the signed-in user's daily totals since `from` (default:
   * DEFAULT_HISTORY_DAYS days ago), most recent first.
   */
  app.get<{
    Querystring: { from?: string }
  }>(
    '/me/steps',
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            from: { type: 'string', pattern: DATE_PATTERN },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await db.query<DayEntry>(
          `
          SELECT to_char(date, 'YYYY-MM-DD') AS date, steps
          FROM daily_steps
          WHERE user_id = $1
            AND date >= COALESCE($2::date, CURRENT_DATE - $3::int)
          ORDER BY date DESC
          `,
          [
            request.auth!.userId,
            request.query.from ?? null,
            DEFAULT_HISTORY_DAYS,
          ],
        )

        return reply.send(result.rows)
      } catch (error) {
        if (isInvalidDateError(error)) {
          return reply.code(400).send({ error: 'invalid_date' })
        }

        throw error
      }
    },
  )
}

export default meStepsRoutes
