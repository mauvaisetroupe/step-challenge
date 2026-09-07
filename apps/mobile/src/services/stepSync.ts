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

async function getUserId() {
  const userId = await AsyncStorage.getItem(USER_ID_KEY)

  if (!userId) {
    throw new Error('User profile not configured')
  }

  return userId
}

function getStartOfDay(date: Date) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function getDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getDaysAgo(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

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