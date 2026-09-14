import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  aggregateGroupByPeriod,
  initialize,
  requestPermission,
} from 'react-native-health-connect'

import { getSteps, syncSteps } from '../api/steps'

const USER_ID_KEY = '@step-challenge/user-id-v2'
const HISTORY_DAYS = 30

type DayStat = {
  date: string
  steps: number
}

/**
 * Retrieves the configured user ID from local storage.
 *
 * The user ID is required to associate step data with the
 * corresponding user on the backend.
 */
async function getUserId() {
  const userId = await AsyncStorage.getItem(USER_ID_KEY)

  if (!userId) {
    throw new Error('User profile not configured')
  }

  return userId
}

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
 * Synchronizes today's step count with the backend.
 *
 * The Health Connect value is compared with the server value.
 * The backend is updated only when Health Connect contains a higher
 * number of steps, preventing an older value from overwriting a newer one.
 *
 * Returns the highest value between Health Connect and the server.
 */
export async function syncTodaySteps() {
  const userId = await getUserId()
  const now = new Date()
  const today = getDateKey(now)

  const healthConnectSteps =
    await getHealthConnectTodaySteps()

  const data = await getSteps(userId)

  const todayEntry = data.find(
    (item) => String(item.date).slice(0, 10) === today,
  )

  const serverSteps = Number(todayEntry?.steps ?? 0)

  if (healthConnectSteps > serverSteps) {
    await syncSteps(
      userId,
      today,
      healthConnectSteps,
    )
  }

  return Math.max(
    healthConnectSteps,
    serverSteps,
  )
}

/**
 * Synchronizes the last 30 days of step data with the backend.
 *
 * For each day, the Health Connect total is compared with the value
 * already stored on the server. Only higher Health Connect values
 * are sent to the backend.
 *
 * Returns the list of dates that were actually synchronized.
 */
export async function syncLast30Days() {
  const userId = await getUserId()

  await initializeHealthConnect()

  const now = new Date()

  const startDate = getStartOfDay(
    getDaysAgo(now, HISTORY_DAYS - 1),
  )

  const healthConnectStats =
    await getHealthConnectDailyStats(
      startDate,
      now,
    )

  const serverData = await getSteps(userId)

  const serverStepsByDate = new Map(
    serverData.map((item) => [
      String(item.date).slice(0, 10),
      Number(item.steps),
    ]),
  )

  const syncedDates: string[] = []

  for (const item of healthConnectStats) {
    const serverSteps =
      serverStepsByDate.get(item.date) ?? 0

    if (item.steps > serverSteps) {
      await syncSteps(
        userId,
        item.date,
        item.steps,
      )

      syncedDates.push(item.date)
    }
  }

  return syncedDates
}

/**
 * Checks whether the last 30 days contain step data that is newer
 * than the data currently stored on the backend.
 *
 * Returns true as soon as at least one day has more steps in
 * Health Connect than on the server.
 *
 * This allows the application to decide whether a full refresh
 * of the last 30 days is necessary without performing any writes.
 */
export async function needsRefreshLast30Days() {
  const userId = await getUserId()

  await initializeHealthConnect()

  const now = new Date()

  const startDate = getStartOfDay(
    getDaysAgo(now, HISTORY_DAYS - 1),
  )

  const healthConnectStats =
    await getHealthConnectDailyStats(
      startDate,
      now,
    )

  const serverData = await getSteps(userId)

  const serverStepsByDate = new Map(
    serverData.map((item) => [
      String(item.date).slice(0, 10),
      Number(item.steps),
    ]),
  )

  return healthConnectStats.some((item) => {
    const serverSteps =
      serverStepsByDate.get(item.date) ?? 0

    return item.steps > serverSteps
  })
}