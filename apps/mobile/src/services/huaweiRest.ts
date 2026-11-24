import type { DayStat } from '../api/steps'

/**
 * Request and response of the Health Kit REST API used to read the
 * daily steps of Huawei Health (ADR 0013): the data comes from Huawei's
 * cloud, so HMS Core is only needed to sign in. Pure functions, tested
 * in huaweiRest.test.ts; the call itself is in huaweiHealth.ts.
 */

export const POLYMERIZE_URL =
  'https://health-api.cloud.huawei.com/healthkit/v2/sampleSet:polymerize'

/** Huawei refuses more than 31 days in one request. */
export const MAX_POLYMERIZE_DAYS = 31

export type PolymerizeRequest = {
  polymerizeWith: { dataTypeName: string }[]
  startTime: number
  endTime: number
  groupByTime: {
    groupPeriod: { timeZone: string; unit: 'day'; value: 1 }
  }
}

type PolymerizeResponse = {
  group?: {
    startTime?: number
    sampleSet?: {
      samplePoints?: {
        value?: { fieldName?: string; integerValue?: number }[]
      }[]
    }[]
  }[]
}

/**
 * Daily step totals from `start` (inclusive, from its local midnight) to
 * `end`, grouped by day at the phone's current UTC offset.
 */
export function buildPolymerizeRequest(
  start: Date,
  end: Date,
): PolymerizeRequest {
  const midnight = new Date(start)
  midnight.setHours(0, 0, 0, 0)

  return {
    polymerizeWith: [{ dataTypeName: 'com.huawei.continuous.steps.delta' }],
    startTime: midnight.getTime(),
    endTime: end.getTime(),
    groupByTime: {
      groupPeriod: {
        timeZone: formatUtcOffset(getUtcOffsetMinutes(end)),
        unit: 'day',
        value: 1,
      },
    },
  }
}

/**
 * One DayStat per day of the response; a day without sample point has
 * 0 steps.
 *
 * The date is read in the offset of the request, not in the phone's
 * time zone of that day: around a daylight saving change, a midnight at
 * +01:00 is 23:00 the day before at +02:00.
 */
export function parsePolymerizeResponse(
  response: unknown,
  request: PolymerizeRequest,
): DayStat[] {
  const offsetMinutes = parseUtcOffset(
    request.groupByTime.groupPeriod.timeZone,
  )

  return ((response as PolymerizeResponse)?.group ?? [])
    .filter((group) => typeof group.startTime === 'number')
    .map((group) => ({
      date: toDateKey(group.startTime as number, offsetMinutes),
      steps: (group.sampleSet ?? [])
        .flatMap((set) => set.samplePoints ?? [])
        .flatMap((point) => point.value ?? [])
        .filter((field) => field.fieldName === 'steps')
        .reduce((total, field) => total + (field.integerValue ?? 0), 0),
    }))
}

/** Minutes east of UTC (+60 in Paris in winter). */
function getUtcOffsetMinutes(date: Date) {
  return -date.getTimezoneOffset()
}

/** +60 → "+0100", -330 → "-0530". */
export function formatUtcOffset(minutes: number) {
  const sign = minutes < 0 ? '-' : '+'
  const absolute = Math.abs(minutes)
  const hours = String(Math.floor(absolute / 60)).padStart(2, '0')
  const rest = String(absolute % 60).padStart(2, '0')

  return `${sign}${hours}${rest}`
}

function parseUtcOffset(offset: string) {
  const sign = offset.startsWith('-') ? -1 : 1
  const hours = Number(offset.slice(1, 3))
  const minutes = Number(offset.slice(3, 5))

  return sign * (hours * 60 + minutes)
}

/** YYYY-MM-DD of `time` at the given UTC offset. */
function toDateKey(time: number, offsetMinutes: number) {
  return new Date(time + offsetMinutes * 60_000).toISOString().slice(0, 10)
}
