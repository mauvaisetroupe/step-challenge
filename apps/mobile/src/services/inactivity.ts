/**
 * Inactive periods of the day ("chasse à la sédentarité").
 *
 * WHO recommends limiting sedentary time and replacing it with activity
 * of any intensity, without a figure. The thresholds follow Garmin's
 * move bar: it appears after an hour of inactivity, and a couple of
 * minutes of walking reset it.
 *
 * - a period is inactive when it lasts at least 60 minutes without
 *   walking;
 * - walking means about 2 minutes of steps (200) within 15 minutes,
 *   even in several bits (a trip to the coffee machine and back); a
 *   minute under 20 steps is not walking (shuffling at the desk);
 * - only between the first and the last step of the day, and never
 *   during the sleep hours of Settings → Activity (services/sleepHours):
 *   a few steps to bed after midnight must not make the night inactive.
 *   No sleep data from Health Connect: another permission.
 */

/**
 * Length of a slice of steps, in minutes: one minute, the precision of
 * the watches and of the phone, needed for the walking cadence
 * (services/activity).
 */
export const SLICE_MINUTES = 1

/** Minimum length of an inactive period, in minutes. */
export const INACTIVE_MINUTES = 60

/** Steps that break an inactive period (about 2 minutes of walking)… */
export const BREAK_STEPS = 200

/** …within this window, in minutes. */
export const BREAK_WINDOW_MINUTES = 15

/** Below this, a minute is not walking, even next to a walk. */
export const MIN_WALKING_STEPS_PER_MINUTE = 20

export type StepSlice = {
  /** Start of the slice; the slice lasts SLICE_MINUTES. */
  start: Date
  steps: number
}

/**
 * Sleep hours, in minutes since midnight. Bed time after wake time
 * crosses midnight (23:00 → 06:00); the same value for both means none.
 */
export type SleepHours = {
  bed: number
  wake: number
}

/** Minute of the day of a date (local time). */
export function minuteOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}

/** Whether a minute of the day is within the sleep hours. */
export function isSleepMinute(minute: number, { bed, wake }: SleepHours) {
  if (bed === wake) {
    return false
  }

  return bed > wake
    ? minute >= bed || minute < wake
    : minute >= bed && minute < wake
}

export type InactivePeriod = {
  start: Date
  end: Date
}

/**
 * Inactive periods among consecutive slices (sorted, without gaps).
 */
export function findInactivePeriods(
  slices: StepSlice[],
  sleepHours?: SleepHours,
): InactivePeriod[] {
  const first = slices.findIndex((slice) => slice.steps > 0)
  const last = slices.findLastIndex((slice) => slice.steps > 0)

  if (first < 0) {
    return []
  }

  // A slice is active when it is walking and belongs to a window of
  // BREAK_WINDOW_MINUTES with at least BREAK_STEPS steps.
  const windowSlices = BREAK_WINDOW_MINUTES / SLICE_MINUTES
  const active = slices.map(() => false)

  for (let index = 0; index + windowSlices <= slices.length; index++) {
    const window = slices.slice(index, index + windowSlices)

    if (window.reduce((sum, slice) => sum + slice.steps, 0) >= BREAK_STEPS) {
      window.forEach((slice, offset) => {
        if (slice.steps >= MIN_WALKING_STEPS_PER_MINUTE * SLICE_MINUTES) {
          active[index + offset] = true
        }
      })
    }
  }

  const periods: InactivePeriod[] = []
  const minSlices = INACTIVE_MINUTES / SLICE_MINUTES
  let runStart: number | null = null

  const closeRun = (end: number) => {
    if (runStart !== null && end - runStart >= minSlices) {
      periods.push({
        start: slices[runStart].start,
        end: new Date(slices[end - 1].start.getTime() + SLICE_MINUTES * 60_000),
      })
    }

    runStart = null
  }

  for (let index = first; index <= last; index++) {
    const asleep =
      sleepHours !== undefined &&
      isSleepMinute(minuteOfDay(slices[index].start), sleepHours)

    // Walking, or sleeping: not inactive.
    if (active[index] || asleep) {
      closeRun(index)
    } else if (runStart === null) {
      runStart = index
    }
  }

  closeRun(last + 1)

  return periods
}

/** Sums the slices into steps per hour since midnight. */
export function hourlyStepsFromSlices(slices: StepSlice[], now: Date) {
  const hours = Array.from({ length: now.getHours() + 1 }, () => 0)

  for (const slice of slices) {
    const hour = slice.start.getHours()

    if (hour < hours.length) {
      hours[hour] += slice.steps
    }
  }

  return hours
}
