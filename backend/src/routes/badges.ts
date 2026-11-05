import type { FastifyPluginAsync } from 'fastify'
import type { Pool } from 'pg'

import type { RequireAuth } from '../auth/authenticate.js'
import {
  awardBadges,
  BADGE_PERIODS_FROM,
  loadHistory,
  serverToday,
} from '../badges/award.js'
import { BADGES } from '../badges/catalogue.js'
import { monthKey } from '../badges/dates.js'
import { levelOf } from '../badges/levels.js'
import { currentProgress } from '../badges/progress.js'
import { badgeTexts, localeOf, type Locale } from '../badges/texts.js'
import { areFriends } from '../friends/friendships.js'

export type BadgeRoutesOptions = {
  db: Pool
  requireAuth: RequireAuth
  /** First month of the period badges; tests move it back. */
  badgePeriodsFrom?: string
}

const textProperties = {
  name: { type: 'string' },
  period: { type: ['string', 'null'] },
  description: { type: 'string' },
} as const

const badgeProperties = {
  id: { type: 'string' },
  family: { type: 'string' },
  points: { type: 'integer' },
  ...textProperties,
} as const

/** Response contract of the badge routes (ADR 0012). */
const badgeReportSchema = {
  type: 'object',
  required: ['level', 'points', 'levelPoints', 'nextLevelPoints', 'earned', 'inProgress', 'locked'],
  properties: {
    level: { type: 'integer' },
    points: { type: 'integer' },
    levelPoints: { type: 'integer' },
    nextLevelPoints: { type: 'integer' },
    earned: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'family', 'kind', 'occurrence', 'count', 'points', 'earnedOn', 'createdAt', 'name', 'period', 'description'],
        properties: {
          ...badgeProperties,
          kind: { type: 'string' },
          occurrence: { type: 'string' },
          count: { type: 'integer' },
          earnedOn: { type: 'string' },
          createdAt: { type: 'string' },
        },
      },
    },
    inProgress: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'family', 'occurrence', 'points', 'value', 'target', 'name', 'period', 'description'],
        properties: {
          ...badgeProperties,
          occurrence: { type: 'string' },
          value: { type: 'integer' },
          target: { type: 'integer' },
        },
      },
    },
    locked: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'family', 'points', 'name', 'period', 'description'],
        properties: badgeProperties,
      },
    },
  },
} as const

type BadgeRow = {
  badgeId: string
  occurrence: string
  points: number
  earnedOn: string
  createdAt: Date
}

/**
 * Level, badges earned (most recent first, a repeatable badge once with
 * its count), progress of the badges of the current week and month, and
 * unique badges not earned yet. Badges this version does not know are
 * left out of the lists, their points still count.
 */
async function badgeReport(
  db: Pool,
  userId: string,
  locale: Locale,
  periodsFrom: string,
) {
  const today = await serverToday(db)
  const { rows } = await db.query<BadgeRow>(
    `
    SELECT badge_id AS "badgeId",
           occurrence,
           points,
           to_char(earned_on, 'YYYY-MM-DD') AS "earnedOn",
           created_at AS "createdAt"
    FROM user_badges
    WHERE user_id = $1
    ORDER BY earned_on DESC, created_at DESC, badge_id, occurrence
    `,
    [userId],
  )
  const points = rows.reduce((total, row) => total + row.points, 0)
  const earnedKeys = new Set(rows.map((row) => `${row.badgeId} ${row.occurrence}`))
  const earned = new Map<string, Record<string, unknown> & { count: number; points: number }>()

  for (const row of rows) {
    const definition = BADGES[row.badgeId]
    const key =
      definition?.kind === 'repeatable'
        ? row.badgeId
        : `${row.badgeId} ${row.occurrence}`
    const existing = earned.get(key)

    // Rows come most recent first: the first one gives the dates.
    if (existing) {
      existing.count++
      existing.points += row.points
      continue
    }

    const texts = badgeTexts(locale, row.badgeId, row.occurrence)

    if (!definition || !texts) {
      continue
    }

    earned.set(key, {
      id: row.badgeId,
      family: definition.family,
      kind: definition.kind,
      occurrence: row.occurrence,
      count: 1,
      points: row.points,
      earnedOn: row.earnedOn,
      createdAt: row.createdAt.toISOString(),
      ...texts,
    })
  }

  const inProgress =
    monthKey(today) < periodsFrom
      ? []
      : currentProgress(await loadHistory(db, userId), today)
          .filter(({ badgeId, occurrence }) => !earnedKeys.has(`${badgeId} ${occurrence}`))
          .map(({ badgeId, occurrence, value, target }) => ({
            id: badgeId,
            family: BADGES[badgeId].family,
            occurrence,
            points: BADGES[badgeId].points,
            value,
            target,
            ...badgeTexts(locale, badgeId, occurrence)!,
          }))

  const earnedIds = new Set(rows.map((row) => row.badgeId))
  const locked = Object.entries(BADGES)
    .filter(([id, { kind }]) => kind === 'unique' && !earnedIds.has(id))
    .map(([id, { family, points }]) => ({
      id,
      family,
      points,
      ...badgeTexts(locale, id)!,
    }))

  return {
    ...levelOf(points),
    earned: [...earned.values()],
    inProgress,
    locked,
  }
}

const badgeRoutes: FastifyPluginAsync<BadgeRoutesOptions> = async (
  app,
  { db, requireAuth, badgePeriodsFrom = BADGE_PERIODS_FROM },
) => {
  app.addHook('onRequest', requireAuth)

  /**
   * My badges (docs/reference/badges.md), awarded first: the ranking
   * badges of a period become final with time, not with my steps.
   * Texts in the language of Accept-Language (French or English).
   */
  app.get(
    '/me/badges',
    { schema: { response: { 200: badgeReportSchema } } },
    async (request, reply) => {
      const userId = request.auth!.userId

      await awardBadges(db, userId, badgePeriodsFrom)

      return reply.send(
        await badgeReport(
          db,
          userId,
          localeOf(request.headers['accept-language']),
          badgePeriodsFrom,
        ),
      )
    },
  )

  /** The badges of a friend, visible to their friends only. */
  app.get<{ Params: { id: string } }>(
    '/friends/:id/badges',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: { 200: badgeReportSchema },
      },
    },
    async (request, reply) => {
      const friendId = request.params.id

      if (!(await areFriends(db, request.auth!.userId, friendId))) {
        return reply.code(404).send({ error: 'friend_not_found' })
      }

      return reply.send(
        await badgeReport(
          db,
          friendId,
          localeOf(request.headers['accept-language']),
          badgePeriodsFrom,
        ),
      )
    },
  )
}

export default badgeRoutes
