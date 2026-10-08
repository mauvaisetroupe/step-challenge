import {
  findInactivePeriods,
  SLICE_MINUTES,
  type InactivePeriod,
  type StepSlice,
} from './inactivity'

/**
 * Active minutes of the day, from the walking cadence.
 *
 * Research on walking cadence (CADENCE-Adults, Tudor-Locke et al. 2018,
 * 2019) puts moderate intensity at about 100 steps per minute and
 * vigorous intensity at about 130. Steps only: cycling or swimming are
 * not counted.
 *
 * The score follows WHO (2020): 150 minutes of moderate activity per
 * week, a vigorous minute counting double — the same rule as Google
 * Fit's Heart Points and Garmin's intensity minutes, which use heart
 * rate instead of steps.
 */

/** Steps per minute from which a minute is active (moderate). */
export const ACTIVE_CADENCE = 100

/** Steps per minute from which a minute is very active (vigorous). */
export const VERY_ACTIVE_CADENCE = 130

/** WHO: score to reach per week. */
export const WEEKLY_ACTIVITY_GOAL = 150

export type DayActivity = {
  /** Minutes between 100 and 129 steps per minute. */
  activeMinutes: number
  /** Minutes at 130 steps per minute or more. */
  veryActiveMinutes: number
  /** Minutes in the inactive periods (services/inactivity). */
  inactiveMinutes: number
  /** Active minutes + 2 × very active minutes. */
  score: number
}

export function summarizeDayActivity(
  slices: StepSlice[],
  inactivePeriods: InactivePeriod[],
): DayActivity {
  let activeMinutes = 0
  let veryActiveMinutes = 0

  for (const slice of slices) {
    const cadence = slice.steps / SLICE_MINUTES

    if (cadence >= VERY_ACTIVE_CADENCE) {
      veryActiveMinutes += SLICE_MINUTES
    } else if (cadence >= ACTIVE_CADENCE) {
      activeMinutes += SLICE_MINUTES
    }
  }

  const inactiveMinutes = inactivePeriods.reduce(
    (sum, period) =>
      sum + Math.round((period.end.getTime() - period.start.getTime()) / 60_000),
    0,
  )

  return {
    activeMinutes,
    veryActiveMinutes,
    inactiveMinutes,
    score: activeMinutes + 2 * veryActiveMinutes,
  }
}

/** Activity minutes of a whole day of slices, for the sync (ADR 0010). */
export function computeDayActivity(slices: StepSlice[]) {
  const { activeMinutes, veryActiveMinutes, inactiveMinutes } =
    summarizeDayActivity(slices, findInactivePeriods(slices))

  return { activeMinutes, veryActiveMinutes, inactiveMinutes }
}

/** Daily share of the WHO weekly goal, for the bars of one day. */
export const DAILY_ACTIVITY_GOAL = Math.ceil(WEEKLY_ACTIVITY_GOAL / 7)

type StoredMinutes = {
  activeMinutes?: number | null
  veryActiveMinutes?: number | null
}

/** Score of a stored day; null when its minutes were never sent. */
export function storedDayScore(day: StoredMinutes) {
  if (day.activeMinutes == null || day.veryActiveMinutes == null) {
    return null
  }

  return day.activeMinutes + 2 * day.veryActiveMinutes
}
