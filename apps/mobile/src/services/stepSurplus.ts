import { SLICE_MINUTES, type StepSlice } from './inactivity'

/**
 * Why the total kept by Health Connect can exceed the main source (the
 * watch): Health Connect removes duplicates interval by interval, and
 * keeps the steps of another source (the phone) where the main one
 * recorded nothing, for instance when walking with the hands on a
 * shopping trolley. The moments when the merged total exceeds the main
 * source are found minute by minute and grouped into periods.
 *
 * Computed on the phone, from Health Connect only: nothing is stored.
 */

/** Minutes without surplus that still join two moments into one period. */
export const SURPLUS_GAP_MINUTES = 5

export type SurplusPeriod = {
  start: Date
  /** End of the last minute with surplus. */
  end: Date
  steps: number
  /** Other sources with steps during the period (ids as given). */
  sources: string[]
}

export type StepSurplus = {
  /** Steps of the merged total above the main source. */
  steps: number
  /** Chronological. */
  periods: SurplusPeriod[]
}

/**
 * Slices are aligned: same start and same length for the merged total,
 * the main source and each other source.
 */
export function findStepSurplus(
  merged: StepSlice[],
  main: StepSlice[],
  others: { id: string; slices: StepSlice[] }[],
): StepSurplus {
  const periods: (SurplusPeriod & { lastIndex: number })[] = []
  let total = 0

  merged.forEach((slice, index) => {
    const surplus = slice.steps - (main[index]?.steps ?? 0)

    if (surplus <= 0) {
      return
    }

    let current = periods[periods.length - 1]

    total += surplus

    if (!current || index - current.lastIndex > SURPLUS_GAP_MINUTES + 1) {
      current = {
        start: slice.start,
        end: slice.start,
        steps: 0,
        sources: [],
        lastIndex: index,
      }
      periods.push(current)
    }

    current.steps += surplus
    current.lastIndex = index
    current.end = new Date(slice.start.getTime() + SLICE_MINUTES * 60_000)

    for (const other of others) {
      if (
        (other.slices[index]?.steps ?? 0) > 0 &&
        !current.sources.includes(other.id)
      ) {
        current.sources.push(other.id)
      }
    }
  })

  return {
    steps: total,
    periods: periods.map(({ lastIndex, ...period }) => period),
  }
}
