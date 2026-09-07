import AsyncStorage from '@react-native-async-storage/async-storage'
import {
    aggregateRecord,
    initialize,
    requestPermission,
} from 'react-native-health-connect'

import { getSteps, syncSteps } from '../api/steps'

const USER_ID_KEY = '@step-challenge/user-id-v2'

async function getUserId() {
  const userId = await AsyncStorage.getItem(USER_ID_KEY)

  if (!userId) {
    throw new Error('User profile not configured')
  }

  return userId
}

function getTodayKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

export async function getHealthConnectTodaySteps() {
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

  const now = new Date()

  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)

  const result = await aggregateRecord({
    recordType: 'Steps',
    timeRangeFilter: {
      operator: 'between',
      startTime: startOfDay.toISOString(),
      endTime: now.toISOString(),
    },
  })

  return Number(result.COUNT_TOTAL ?? 0)
}

export async function syncTodaySteps() {
  const userId = await getUserId()
  const now = new Date()
  const today = getTodayKey(now)

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