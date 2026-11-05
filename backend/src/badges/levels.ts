/**
 * Levels (docs/reference/badges.md): derived from the total of points,
 * never stored, so the curve can change without touching the data.
 * Each level is further away than the previous one.
 */

/** Points needed to reach `level` (level 1: 0 points). */
export function levelThreshold(level: number) {
  return Math.round(4 * (level - 1) ** 1.8)
}

export type Level = {
  level: number
  points: number
  /** Points of the current level, and of the next one. */
  levelPoints: number
  nextLevelPoints: number
}

export function levelOf(points: number): Level {
  let level = 1

  while (levelThreshold(level + 1) <= points) {
    level++
  }

  return {
    level,
    points,
    levelPoints: levelThreshold(level),
    nextLevelPoints: levelThreshold(level + 1),
  }
}
