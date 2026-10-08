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

/** Minutes in a day: bound of the activity minutes (ADR 0010). */
export const MINUTES_PER_DAY = 1440

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

/**
 * Activity minutes of a day (ADR 0010), computed by the app from the
 * steps per minute. Optional: older app versions and the web send
 * none; null when never sent.
 */
type ActivityMinutes = {
  activeMinutes: number | null
  veryActiveMinutes: number | null
  inactiveMinutes: number | null
}

type DayEntry = {
  date: string
  steps: number
} & Partial<ActivityMinutes>

const ACTIVITY_FIELDS = [
  'activeMinutes',
  'veryActiveMinutes',
  'inactiveMinutes',
] as const

const minutesSchema = {
  type: 'integer',
  minimum: 0,
  maximum: MINUTES_PER_DAY,
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
   * The activity minutes (ADR 0010), all three or none, follow the
   * steps: they are replaced when the total received is the same or
   * higher (steps arriving late, from a watch, can lower the inactive
   * minutes without changing the total). A day sent without them keeps
   * the stored ones.
   *
   * Returns the dates that were actually recorded (new day, higher
   * total or new minutes), so the app can report what a sync changed.
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
                  activeMinutes: minutesSchema,
                  veryActiveMinutes: minutesSchema,
                  inactiveMinutes: minutesSchema,
                },
                // All three activity minutes, or none.
                dependencies: {
                  activeMinutes: ['veryActiveMinutes', 'inactiveMinutes'],
                  veryActiveMinutes: ['activeMinutes', 'inactiveMinutes'],
                  inactiveMinutes: ['activeMinutes', 'veryActiveMinutes'],
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

      // A minute is active or very active, not both.
      if (
        days.some(
          (day) =>
            (day.activeMinutes ?? 0) + (day.veryActiveMinutes ?? 0) >
            MINUTES_PER_DAY,
        )
      ) {
        return reply.code(400).send({ error: 'invalid_minutes' })
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

      // Rows skipped by the WHERE clause (lower total, or same total
      // without new minutes) are neither updated nor returned.
      const result = await db.query<{ date: string }>(
        `
        INSERT INTO daily_steps (
            user_id, date, steps,
            active_minutes, very_active_minutes, inactive_minutes
        )
        SELECT $1, d.date, d.steps, d.active, d.very_active, d.inactive
        FROM unnest($2::date[], $3::int[], $4::int[], $5::int[], $6::int[])
            AS d(date, steps, active, very_active, inactive)
        ON CONFLICT (user_id, date) DO UPDATE
        SET steps = EXCLUDED.steps,
            active_minutes = COALESCE(EXCLUDED.active_minutes, daily_steps.active_minutes),
            very_active_minutes = COALESCE(EXCLUDED.very_active_minutes, daily_steps.very_active_minutes),
            inactive_minutes = COALESCE(EXCLUDED.inactive_minutes, daily_steps.inactive_minutes),
            updated_at = now()
        WHERE daily_steps.steps < EXCLUDED.steps
           OR (
               daily_steps.steps = EXCLUDED.steps
               AND EXCLUDED.active_minutes IS NOT NULL
               AND (EXCLUDED.active_minutes, EXCLUDED.very_active_minutes, EXCLUDED.inactive_minutes)
                   IS DISTINCT FROM
                   (daily_steps.active_minutes, daily_steps.very_active_minutes, daily_steps.inactive_minutes)
           )
        RETURNING to_char(date, 'YYYY-MM-DD') AS date
        `,
        [
          request.auth!.userId,
          dates,
          days.map((day) => day.steps),
          ...ACTIVITY_FIELDS.map((field) =>
            days.map((day) => day[field] ?? null),
          ),
        ],
      )

      return reply.send({
        updatedDates: result.rows.map((row) => row.date).sort(),
      })
    },
  )

  /**
   * Returns the signed-in user's daily totals since `from` (default:
   * DEFAULT_HISTORY_DAYS days ago), most recent first, with the
   * activity minutes (null when never sent).
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
        const result = await db.query<DayEntry & ActivityMinutes>(
          `
          SELECT to_char(date, 'YYYY-MM-DD') AS date,
                 steps,
                 active_minutes      AS "activeMinutes",
                 very_active_minutes AS "veryActiveMinutes",
                 inactive_minutes    AS "inactiveMinutes"
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
