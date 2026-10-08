import AsyncStorage from '@react-native-async-storage/async-storage'

import {
  getNativeSyncHistory,
  scheduleNativeSync,
} from '../../modules/step-sync'
import { syncLast30Days } from './stepSync'

/**
 * Step sync outside the screens:
 *
 * - in the background, by the native worker of modules/step-sync
 *   (ADR 0009), about every 6 hours, without JavaScript;
 * - "Sync now" in Settings → Sync, here in TypeScript.
 *
 * Settings → Sync shows both histories together.
 */

const MANUAL_HISTORY_KEY = '@step-challenge/background-sync-history'

const MAX_HISTORY = 10

/**
 * Minimum time between two background syncs, in minutes: the friends
 * leaderboard stays fresh even when the app is not opened. Android may
 * run the sync later (battery, network).
 *
 * In development: 15 minutes, the minimum Android allows, to test the
 * sync with the app closed without waiting hours.
 */
const SYNC_INTERVAL_MINUTES = __DEV__ ? 15 : 6 * 60

export type BackgroundSyncRun = {
  timestamp: string
  status: 'success' | 'failed'
  syncedDays?: number
  /** Run by Android in the background, or by "Sync now" in Settings. */
  trigger: 'background' | 'manual'
  /** Cause of a failure (Health Connect permission, network…). */
  error?: string
}

async function readManualHistory(): Promise<BackgroundSyncRun[]> {
  const raw = await AsyncStorage.getItem(MANUAL_HISTORY_KEY)

  return raw ? JSON.parse(raw) : []
}

async function saveManualRun(run: BackgroundSyncRun) {
  const history = await readManualHistory()

  history.unshift(run)

  await AsyncStorage.setItem(
    MANUAL_HISTORY_KEY,
    JSON.stringify(history.slice(0, MAX_HISTORY)),
  )
}

/** Schedules the native background sync. Called at each app start. */
export function scheduleBackgroundSync() {
  scheduleNativeSync(SYNC_INTERVAL_MINUTES)
}

/**
 * "Sync now" in Settings: sends the last 30 days now, with the app on
 * screen, and records the run.
 */
export async function syncNow(): Promise<BackgroundSyncRun> {
  let run: BackgroundSyncRun

  try {
    // Also recomputes the activity minutes of the 30 days (ADR 0010).
    const syncedDates = await syncLast30Days({ activityDays: 30 })

    run = {
      timestamp: new Date().toISOString(),
      status: 'success',
      syncedDays: syncedDates.length,
      trigger: 'manual',
    }
  } catch (error) {
    run = {
      timestamp: new Date().toISOString(),
      status: 'failed',
      trigger: 'manual',
      error: error instanceof Error ? error.message : String(error),
    }
  }

  await saveManualRun(run)

  return run
}

/** Background and manual runs, most recent first. */
export async function getBackgroundSyncStatus() {
  const history = [...getNativeSyncHistory(), ...(await readManualHistory())]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, MAX_HISTORY)

  return { history }
}
