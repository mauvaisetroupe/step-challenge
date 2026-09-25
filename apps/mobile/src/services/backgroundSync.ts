import AsyncStorage from '@react-native-async-storage/async-storage'

import * as BackgroundTask from 'expo-background-task'
import * as TaskManager from 'expo-task-manager'

import { syncLast30Days } from './stepSync'

const STEP_SYNC_TASK = 'step-challenge-sync'

const SYNC_HISTORY_KEY =
  '@step-challenge/background-sync-history'

const MANUAL_TEST_PENDING_KEY =
  '@step-challenge/background-sync-manual-test-pending'

const MAX_HISTORY = 10

export type BackgroundSyncRun = {
  timestamp: string
  status: 'success' | 'failed'
  syncedDays?: number
  trigger: 'background' | 'manual'
}

async function saveSyncRun(
  run: BackgroundSyncRun,
) {
  const raw = await AsyncStorage.getItem(
    SYNC_HISTORY_KEY,
  )

  const history: BackgroundSyncRun[] =
    raw ? JSON.parse(raw) : []

  history.unshift(run)

  await AsyncStorage.setItem(
    SYNC_HISTORY_KEY,
    JSON.stringify(
      history.slice(0, MAX_HISTORY),
    ),
  )
}

/**
 * Mark the next task execution as a manual test.
 *
 * This marker is consumed by the background task,
 * so it cannot affect a later automatic execution.
 */
export async function markManualBackgroundSyncTest() {
  await AsyncStorage.setItem(
    MANUAL_TEST_PENDING_KEY,
    new Date().toISOString(),
  )
}

/**
 * The actual task executed by Android.
 */
TaskManager.defineTask(STEP_SYNC_TASK, async () => {
  const startedAt = new Date().toISOString()

  console.log(
    'BACKGROUND TASK STARTED:',
    startedAt,
  )

  /*
   * If Settings requested a manual test immediately
   * before this task execution, classify this run as
   * manual. Otherwise it is an automatic background run.
   */
  const manualTestRequestedAt =
    await AsyncStorage.getItem(
      MANUAL_TEST_PENDING_KEY,
    )

  const trigger: 'background' | 'manual' =
    manualTestRequestedAt
      ? 'manual'
      : 'background'

  /*
   * Consume the marker immediately.
   *
   * This is important: a later automatic execution
   * must not inherit the "manual" classification.
   */
  if (manualTestRequestedAt) {
    await AsyncStorage.removeItem(
      MANUAL_TEST_PENDING_KEY,
    )
  }

  console.log(
    'BACKGROUND TASK TRIGGER:',
    trigger,
  )

  try {
    const syncedDates = await syncLast30Days()

    const timestamp =
      new Date().toISOString()

    await saveSyncRun({
      timestamp,
      status: 'success',
      syncedDays: syncedDates.length,
      trigger,
    })

    console.log(
      'BACKGROUND TASK COMPLETED:',
      syncedDates.length,
      'days synced',
      'trigger:',
      trigger,
    )

    return BackgroundTask.BackgroundTaskResult.Success
  } catch (error) {
    const timestamp =
      new Date().toISOString()

    await saveSyncRun({
      timestamp,
      status: 'failed',
      trigger,
    })

    console.error(
      'BACKGROUND TASK FAILED:',
      error,
      'trigger:',
      trigger,
    )

    return BackgroundTask.BackgroundTaskResult.Failed
  }
})

console.log(
  'Background task definition loaded',
)

export async function registerBackgroundStepSync() {
  console.log(
    'Registering background step sync',
  )

  const isRegistered =
    await TaskManager.isTaskRegisteredAsync(
      STEP_SYNC_TASK,
    )

  console.log(
    'Already registered:',
    isRegistered,
  )

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

export async function triggerBackgroundStepSyncForTesting() {
  console.log(
    'MANUAL BACKGROUND TASK TEST STARTED',
  )

  try {
    await markManualBackgroundSyncTest()

    await BackgroundTask.triggerTaskWorkerForTestingAsync()

    console.log(
      'MANUAL BACKGROUND TASK TEST COMPLETED',
    )
  } catch (error) {
    /*
     * If the worker could not be triggered, remove the
     * marker so it cannot incorrectly classify a future
     * automatic execution as manual.
     */
    await AsyncStorage.removeItem(
      MANUAL_TEST_PENDING_KEY,
    )

    console.error(
      'Manual background task test failed:',
      error,
    )

    throw error
  }
}

export async function getBackgroundSyncStatus() {
  const rawHistory =
    await AsyncStorage.getItem(
      SYNC_HISTORY_KEY,
    )

  const history: BackgroundSyncRun[] =
    rawHistory
      ? JSON.parse(rawHistory)
      : []

  return {
    history,
  }
}