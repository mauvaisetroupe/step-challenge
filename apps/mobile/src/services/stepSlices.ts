import { aggregateGroupByDuration } from 'react-native-health-connect'

import { SLICE_MINUTES, type StepSlice } from './inactivity'

/**
 * Time range of a day for the 1-day view: from midnight to the next
 * midnight, or to now for today.
 */
export function getDayRange(day: Date, now = new Date()) {
  const start = new Date(day)
  start.setHours(0, 0, 0, 0)

  const nextDay = new Date(start)
  nextDay.setDate(nextDay.getDate() + 1)

  return { start, end: nextDay < now ? nextDay : now }
}

/**
 * Steps in 1-minute slices between two dates, 0 when Health Connect
 * has nothing: the day curve, the inactive periods and the active
 * minutes (ADR 0010). Merged by Health Connect, or of the given sources
 * only (package names).
 */
export async function getHealthConnectStepSlices(
  startDate: Date,
  endDate: Date,
  dataOrigins?: string[],
): Promise<StepSlice[]> {
  const result = await aggregateGroupByDuration({
    recordType: 'Steps',
    timeRangeFilter: {
      operator: 'between',
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    },
    timeRangeSlicer: {
      duration: 'MINUTES',
      length: SLICE_MINUTES,
    },
    dataOriginFilter: dataOrigins,
  })

  const sliceMs = SLICE_MINUTES * 60_000
  const count = Math.ceil((endDate.getTime() - startDate.getTime()) / sliceMs)
  const slices = Array.from({ length: count }, (_, index) => ({
    start: new Date(startDate.getTime() + index * sliceMs),
    steps: 0,
  }))

  for (const bucket of result) {
    const index = Math.floor(
      (new Date(bucket.startTime).getTime() - startDate.getTime()) / sliceMs,
    )

    if (index >= 0 && index < slices.length) {
      slices[index].steps += Number(bucket.result?.COUNT_TOTAL ?? 0)
    }
  }

  return slices
}
