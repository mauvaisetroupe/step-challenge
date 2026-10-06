import AsyncStorage from '@react-native-async-storage/async-storage'

import * as BackgroundTask from 'expo-background-task'
import * as TaskManager from 'expo-task-manager'

import { getSessionToken } from '../auth/session'
import { syncLast30Days } from './stepSync'

const STEP_SYNC_TASK = 'step-challenge-sync'

const SYNC_HISTORY_KEY =
  '@step-challenge/background-sync-history'

const MAX_HISTORY = 10

/**
 * Minimum time between two background syncs, in minutes: the friends
 * leaderboard stays fresh even when the app is not opened. Android may
 * run the task later (battery, network).
 */
const SYNC_INTERVAL_MINUTES = 6 * 60

/** Interval the task was registered with, to re-register it on change. */
const REGISTERED_INTERVAL_KEY =
  '@step-challenge/background-sync-interval'

export type BackgroundSyncRun = {
  timestamp: string
  status: 'success' | 'failed'
  syncedDays?: number
  /** Run by Android in the background, or by "Sync now" in Settings. */
  trigger: 'background' | 'manual'
  /** Cause of a failure (Health Connect permission, network…). */
  error?: string
}

async function saveSyncRun(run: BackgroundSyncRun) {
  const raw = await AsyncStorage.getItem(SYNC_HISTORY_KEY)
  const history: BackgroundSyncRun[] = raw ? JSON.parse(raw) : []

  history.unshift(run)

  await AsyncStorage.setItem(
    SYNC_HISTORY_KEY,
    JSON.stringify(history.slice(0, MAX_HISTORY)),
  )
}

/**
 * Sends the last 30 days of Health Connect steps to the server and
 * records the run in the history shown in Settings → Sync.
 */
async function runSync(
  trigger: BackgroundSyncRun['trigger'],
): Promise<BackgroundSyncRun> {
  let run: BackgroundSyncRun

  try {
    // In the background, no permission dialog: it needs the app on
    // screen. Without the background access permission, Health Connect
    // refuses the read and the run is recorded as failed, with the cause.
    const syncedDates = await syncLast30Days({
      requestPermissions: trigger === 'manual',
    })

    run = {
      timestamp: new Date().toISOString(),
      status: 'success',
      syncedDays: syncedDates.length,
      trigger,
    }
  } catch (error) {
    run = {
      timestamp: new Date().toISOString(),
      status: 'failed',
      trigger,
      error: error instanceof Error ? error.message : String(error),
    }
  }

  await saveSyncRun(run)
  console.log('Step sync', trigger, run.status, run.syncedDays ?? run.error)

  return run
}

/**
 * The task run by Android in the background.
 */
TaskManager.defineTask(STEP_SYNC_TASK, async () => {
  console.log('BACKGROUND TASK STARTED:', new Date().toISOString())

  // Not signed in (new install, signed out, account deleted): nothing
  // to sync. Not recorded as a failure.
  if (!(await getSessionToken())) {
    console.log('BACKGROUND TASK SKIPPED: no session')

    return BackgroundTask.BackgroundTaskResult.Success
  }

  const run = await runSync('background')

  return run.status === 'success'
    ? BackgroundTask.BackgroundTaskResult.Success
    : BackgroundTask.BackgroundTaskResult.Failed
})

/**
 * "Sync now" in Settings: the same sync as the background task, run
 * immediately, with the app on screen.
 */
export function syncNow() {
  return runSync('manual')
}

export async function registerBackgroundStepSync() {
  console.log('Registering background step sync')

  const isRegistered = await TaskManager.isTaskRegisteredAsync(STEP_SYNC_TASK)

  // Registered with the current interval: nothing to do. Registered
  // with another one (an older version of the app): register again, so
  // that installed apps pick up the new interval.
  const registeredInterval = await AsyncStorage.getItem(
    REGISTERED_INTERVAL_KEY,
  )

  if (isRegistered && registeredInterval === String(SYNC_INTERVAL_MINUTES)) {
    return
  }

  if (isRegistered) {
    await BackgroundTask.unregisterTaskAsync(STEP_SYNC_TASK)
  }

  await BackgroundTask.registerTaskAsync(STEP_SYNC_TASK, {
    minimumInterval: SYNC_INTERVAL_MINUTES,
  })

  await AsyncStorage.setItem(
    REGISTERED_INTERVAL_KEY,
    String(SYNC_INTERVAL_MINUTES),
  )

  console.log('Background step sync registered')
}

export async function getBackgroundSyncStatus() {
  const raw = await AsyncStorage.getItem(SYNC_HISTORY_KEY)
  const history: BackgroundSyncRun[] = raw ? JSON.parse(raw) : []

  return { history }
}
