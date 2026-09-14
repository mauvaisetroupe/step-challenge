import AsyncStorage from '@react-native-async-storage/async-storage'
import * as BackgroundTask from 'expo-background-task'
import * as TaskManager from 'expo-task-manager'

import { syncLast30Days } from './stepSync'

const STEP_SYNC_TASK = 'step-challenge-sync'

const LAST_SYNC_KEY =
  '@step-challenge/background-sync-last-run'

const LAST_SYNC_STATUS_KEY =
  '@step-challenge/background-sync-last-status'

TaskManager.defineTask(STEP_SYNC_TASK, async () => {
  console.log('Background step sync started')

  try {
    const syncedDates = await syncLast30Days()

    await AsyncStorage.setItem(
      LAST_SYNC_KEY,
      new Date().toISOString(),
    )

    await AsyncStorage.setItem(
      LAST_SYNC_STATUS_KEY,
      'success',
    )

    console.log(
      'Background step sync completed:',
      syncedDates.length,
      'days synced',
    )

    return BackgroundTask.BackgroundTaskResult.Success
  } catch (error) {
    await AsyncStorage.setItem(
      LAST_SYNC_KEY,
      new Date().toISOString(),
    )

    await AsyncStorage.setItem(
      LAST_SYNC_STATUS_KEY,
      'failed',
    )

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
  const lastRun = await AsyncStorage.getItem(
    LAST_SYNC_KEY,
  )

  const status = await AsyncStorage.getItem(
    LAST_SYNC_STATUS_KEY,
  )

  return {
    lastRun,
    status,
  }
}