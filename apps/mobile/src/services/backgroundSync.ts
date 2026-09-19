import AsyncStorage from '@react-native-async-storage/async-storage'
import * as BackgroundTask from 'expo-background-task'
import * as TaskManager from 'expo-task-manager'

import { syncLast30Days } from './stepSync'

const STEP_SYNC_TASK = 'step-challenge-sync'

const SYNC_HISTORY_KEY =
  '@step-challenge/background-sync-history'

const MAX_HISTORY = 10

export type BackgroundSyncRun = {
  timestamp: string
  status: 'success' | 'failed'
  syncedDays?: number
}

async function saveSyncRun(
  run: BackgroundSyncRun,
) {
  const raw = await AsyncStorage.getItem(
    SYNC_HISTORY_KEY,
  )

  const history: BackgroundSyncRun[] = raw
    ? JSON.parse(raw)
    : []

  history.unshift(run)

  await AsyncStorage.setItem(
    SYNC_HISTORY_KEY,
    JSON.stringify(
      history.slice(0, MAX_HISTORY),
    ),
  )
}

TaskManager.defineTask(STEP_SYNC_TASK, async () => {
  console.log('Background step sync started')

  try {
    const syncedDates = await syncLast30Days()

    const timestamp =
      new Date().toISOString()

    await saveSyncRun({
      timestamp,
      status: 'success',
      syncedDays: syncedDates.length,
    })

    console.log(
      'Background step sync completed:',
      syncedDates.length,
      'days synced',
    )

    return BackgroundTask.BackgroundTaskResult.Success
  } catch (error) {
    const timestamp =
      new Date().toISOString()

    await saveSyncRun({
      timestamp,
      status: 'failed',
    })

    console.error(
      'Background step sync failed:',
      error,
    )

    return BackgroundTask.BackgroundTaskResult.Failed
  }
})

console.log('Background task definition loaded')

export async function registerBackgroundStepSync() {
  console.log('Registering background step sync')

  const isRegistered =
    await TaskManager.isTaskRegisteredAsync(
      STEP_SYNC_TASK,
    )

  console.log('Already registered:', isRegistered)

  if (isRegistered) {
    return
  }

  await BackgroundTask.registerTaskAsync(
    STEP_SYNC_TASK,
    {
      minimumInterval: 24 * 60,
    },
  )

  console.log(
    'Background step sync registered',
  )
}

export async function getBackgroundSyncStatus() {
  const rawHistory =
    await AsyncStorage.getItem(
      SYNC_HISTORY_KEY,
    )

  const history: BackgroundSyncRun[] =
    rawHistory ? JSON.parse(rawHistory) : []

  return {
    history,
  }
}