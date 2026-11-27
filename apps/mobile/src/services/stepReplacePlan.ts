import type { DayStat } from '../api/steps'

/** A day the replacement would change: stored total → source total. */
export type DayChange = { date: string; from: number | null; to: number }

/**
 * Days whose source total differs from the stored one, oldest first
 * (ADR 0013, amendment of 2026-11-27). A day without steps in the source
 * is left out: the server never replaces a day by 0. Pure function,
 * tested in stepReplacePlan.test.ts.
 */
export function planReplacement(
  source: DayStat[],
  stored: DayStat[],
): DayChange[] {
  const storedSteps = new Map(stored.map((day) => [day.date, day.steps]))

  return source
    .filter((day) => day.steps > 0 && storedSteps.get(day.date) !== day.steps)
    .map((day) => ({
      date: day.date,
      from: storedSteps.get(day.date) ?? null,
      to: day.steps,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
