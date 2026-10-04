import type { Pool, PoolClient } from 'pg'

type Db = Pool | PoolClient

/** Safety limit (ADR 0002), adjustable. */
export const MAX_FRIENDS = 200

/**
 * Friendships are stored once per pair, in canonical order
 * (user_low < user_high).
 */
export function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

export async function areFriends(db: Db, a: string, b: string) {
  const [low, high] = canonicalPair(a, b)

  const result = await db.query(
    'SELECT 1 FROM friendships WHERE user_low = $1 AND user_high = $2',
    [low, high],
  )

  return result.rowCount === 1
}

export async function countFriends(db: Db, userId: string) {
  const result = await db.query<{ count: number }>(
    `
    SELECT count(*)::int AS count
    FROM friendships
    WHERE user_low = $1 OR user_high = $1
    `,
    [userId],
  )

  return result.rows[0].count
}

/**
 * Creates the friendship if it does not exist yet. Returns true when a
 * friendship was created.
 */
export async function createFriendship(
  db: Db,
  a: string,
  b: string,
  invitationId: string | null,
) {
  const [low, high] = canonicalPair(a, b)

  const result = await db.query(
    `
    INSERT INTO friendships (user_low, user_high, invitation_id)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_low, user_high) DO NOTHING
    `,
    [low, high, invitationId],
  )

  return result.rowCount === 1
}
