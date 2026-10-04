import {
  aggregateGroupByPeriod,
  initialize,
  requestPermission,
} from 'react-native-health-connect'

import {
  getMySteps,
  postMySteps,
  type DayStat,
} from '../api/steps'

export type { DayStat }

const HISTORY_DAYS = 30

/**
 * Returns a copy of the given date set to the beginning of its day.
 *
 * The time is reset to 00:00:00.000 using the device's local timezone.
 */
function getStartOfDay(date: Date) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * Converts a Date into the local calendar date format YYYY-MM-DD.
 *
 * This is used as the common date key between Health Connect
 * and the Step Challenge backend.
 */
function getDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/**
 * Returns a new Date shifted backwards by the specified number of days.
 */
function getDaysAgo(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

/**
 * Initializes Health Connect and requests permission to read step data.
 *
 * Throws an error if Health Connect is not available on the device.
 */
async function initializeHealthConnect() {
  const initialized = await initialize()

  if (!initialized) {
    throw new Error('Health Connect is not available')
  }

  await requestPermission([
    {
      accessType: 'read',
      recordType: 'Steps',
    },
  ])
}

/**
 * Retrieves daily step totals from Health Connect for the given period.
 *
 * Health Connect returns one aggregated result per day.
 * Missing days are explicitly added with 0 steps so that the returned
 * array always contains one entry for every day in the requested period.
 */
async function getHealthConnectDailyStats(
  startDate: Date,
  endDate: Date,
): Promise<DayStat[]> {
  const result = await aggregateGroupByPeriod({
    recordType: 'Steps',
    timeRangeFilter: {
      operator: 'between',
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    },
    timeRangeSlicer: {
      period: 'DAYS',
      length: 1,
    },
  })

  const stats = new Map<string, number>()

  for (const bucket of result) {
    const date = new Date(bucket.startTime)
    const key = getDateKey(date)

    stats.set(
      key,
      Number(bucket.result?.COUNT_TOTAL ?? 0),
    )
  }

  const days: DayStat[] = []
  const current = new Date(startDate)

  while (current < endDate) {
    const key = getDateKey(current)

    days.push({
      date: key,
      steps: stats.get(key) ?? 0,
    })

    current.setDate(current.getDate() + 1)
  }

  return days
}

/**
 * Retrieves the last 30 days of steps from Health Connect.
 *
 * This function only reads local Health Connect data.
 * It does not access the backend and does not perform any synchronization.
 */
export async function getHealthConnectLast30Days(): Promise<
  DayStat[]
> {
  await initializeHealthConnect()

  const now = new Date()

  const startDate = getStartOfDay(
    getDaysAgo(now, HISTORY_DAYS - 1),
  )

  return getHealthConnectDailyStats(
    startDate,
    now,
  )
}

/**
 * Returns today's step count from Health Connect.
 *
 * Health Connect is initialized and the data is queried from the
 * beginning of the current local day until the current time.
 */
export async function getHealthConnectTodaySteps() {
  await initializeHealthConnect()

  const now = new Date()
  const startOfDay = getStartOfDay(now)

  const stats = await getHealthConnectDailyStats(
    startOfDay,
    now,
  )

  return stats[0]?.steps ?? 0
}

/**
 * Sends today's Health Connect step count to the backend.
 *
 * The backend keeps the highest value of the day, so no comparison with
 * the server value is needed. Returns today's Health Connect count.
 */
export async function syncTodaySteps() {
  const steps = await getHealthConnectTodaySteps()

  await postMySteps([
    { date: getDateKey(new Date()), steps },
  ])

  return steps
}

/**
 * Sends the supplied daily totals to the backend in one request.
 *
 * Returns the dates the backend actually recorded (new day or higher
 * total than the stored one).
 */
export async function syncStatsToServer(
  healthConnectStats: DayStat[],
) {
  return postMySteps(healthConnectStats)
}

/**
 * Synchronizes the last 30 days of step data with the backend.
 *
 * This is the complete synchronization operation used by background
 * synchronization and manual refreshes:
 *
 * Health Connect → read 30 days → PostgreSQL
 */
export async function syncLast30Days() {
  const healthConnectStats =
    await getHealthConnectLast30Days()

  return syncStatsToServer(
    healthConnectStats,
  )
}

/**
 * Checks whether the last 30 days contain step data that is newer
 * than the data currently stored on the backend.
 *
 * Returns true as soon as at least one day has more steps in
 * Health Connect than on the server, without performing any writes.
 */
export async function needsRefreshLast30Days() {
  const healthConnectStats =
    await getHealthConnectLast30Days()

  const serverData = await getMySteps(
    healthConnectStats[0]?.date,
  )

  const serverStepsByDate = new Map(
    serverData.map((item) => [item.date, item.steps]),
  )

  return healthConnectStats.some((item) => {
    const serverSteps =
      serverStepsByDate.get(item.date) ?? 0

    return item.steps > serverSteps
  })
}
