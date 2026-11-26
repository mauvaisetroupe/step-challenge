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
      steps: groupSteps(group),
    }))
}

/**
 * Steps grouped by hour, from the local midnight of `end` to `end`.
 * Depends on the device that counts: a Huawei watch uploads hourly
 * data, a Pixel counting with Huawei Health only daily totals, and
 * every hour then comes back empty.
 */
export function buildHourlyRequest(end: Date) {
  return buildDetailRequest(end, 3_600_000)
}

/**
 * Steps grouped by minute, from the local midnight of `end` to `end`:
 * does the device upload the detail that the activity minutes need
 * (ADR 0010)? Diagnostic only for now.
 */
export function buildMinuteRequest(end: Date) {
  return buildDetailRequest(end, 60_000)
}

function buildDetailRequest(end: Date, duration: number) {
  const midnight = new Date(end)
  midnight.setHours(0, 0, 0, 0)

  return {
    polymerizeWith: [{ dataTypeName: 'com.huawei.continuous.steps.delta' }],
    startTime: midnight.getTime(),
    endTime: end.getTime(),
    groupByTime: { duration },
  }
}

/**
 * Minutes with steps in the response, and the most steps in one of
 * them. A walk gives at most about 200 steps a minute: far more means
 * the device uploads coarser samples, credited to a single minute.
 */
export function countMinutesWithSteps(response: unknown) {
  const steps = ((response as PolymerizeResponse)?.group ?? [])
    .map(groupSteps)
    .filter((value) => value > 0)

  return {
    withSteps: steps.length,
    maxSteps: steps.length > 0 ? Math.max(...steps) : 0,
  }
}

/** Number of hours in the response, and of hours with steps. */
export function countHoursWithSteps(response: unknown) {
  const groups = (response as PolymerizeResponse)?.group ?? []

  return {
    hours: groups.length,
    withSteps: groups.filter((group) => groupSteps(group) > 0).length,
  }
}

/**
 * What the user must do after a failed read, or null when it is not up
 * to them (network, server error): a rejected token means the consent
 * was withdrawn; a refusal that mentions the privacy switch means the
 * HUAWEI Health Kit switch is off in the HUAWEI Health app.
 */
export function huaweiAccessReasonOf(
  status: number,
  body: string,
): 'notAuthorized' | 'switchOff' | null {
  if (status === 401) {
    return 'notAuthorized'
  }

  if (status === 403) {
    return /switch|privacy/i.test(body) ? 'switchOff' : 'notAuthorized'
  }

  return null
}

/**
 * Steps of each local hour, from midnight to the hour of `end`, the
 * shape of the 1-day timeline (hourlyStepsFromSlices); an hour missing
 * from the response has 0 steps.
 */
export function parseHourlySteps(response: unknown, end: Date) {
  const hours = Array.from({ length: end.getHours() + 1 }, () => 0)

  for (const group of (response as PolymerizeResponse)?.group ?? []) {
    if (typeof group.startTime !== 'number') {
      continue
    }

    const hour = new Date(group.startTime).getHours()

    if (hour < hours.length) {
      hours[hour] += groupSteps(group)
    }
  }

  return hours
}

type Group = NonNullable<PolymerizeResponse['group']>[number]

function groupSteps(group: Group) {
  return (group.sampleSet ?? [])
    .flatMap((set) => set.samplePoints ?? [])
    .flatMap((point) => point.value ?? [])
    .filter((field) => field.fieldName === 'steps')
    .reduce((total, field) => total + (field.integerValue ?? 0), 0)
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
