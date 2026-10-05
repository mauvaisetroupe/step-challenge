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

/**
 * Ends a friendship, on both sides: deletes the friendship and the aliases
 * in both directions, and revokes my active invitations, so that the other
 * person cannot come back with a link that is still valid. Returns false
 * when we were not friends (aliases and invitations are handled anyway).
 * Must run inside a transaction.
 */
export async function endFriendship(db: Db, me: string, other: string) {
  const [low, high] = canonicalPair(me, other)

  const deleted = await db.query(
    'DELETE FROM friendships WHERE user_low = $1 AND user_high = $2',
    [low, high],
  )

  await db.query(
    `
    DELETE FROM friend_aliases
    WHERE (owner_id = $1 AND friend_id = $2)
       OR (owner_id = $2 AND friend_id = $1)
    `,
    [me, other],
  )

  await db.query(
    `
    UPDATE invitations
    SET revoked_at = now()
    WHERE inviter_id = $1 AND revoked_at IS NULL AND expires_at > now()
    `,
    [me],
  )

  return deleted.rowCount === 1
}

/** True when either user has blocked the other (ADR 0004). */
export async function isBlockedEitherWay(db: Db, a: string, b: string) {
  const result = await db.query(
    `
    SELECT 1 FROM user_blocks
    WHERE (blocker_id = $1 AND blocked_id = $2)
       OR (blocker_id = $2 AND blocked_id = $1)
    `,
    [a, b],
  )

  return (result.rowCount ?? 0) > 0
}
