import { requireOptionalNativeModule } from 'expo'

/**
 * Native background step sync (ADR 0009). Android only: elsewhere, the
 * functions do nothing and the history is empty.
 */

type StepSyncNativeModule = {
  configure(apiUrl: string, token: string): void
  clear(): void
  schedule(intervalMinutes: number): void
  getHistory(): string
}

/** A background run, as recorded by the native worker. */
export type NativeSyncRun = {
  timestamp: string
  status: 'success' | 'failed'
  syncedDays?: number
  trigger: 'background'
  error?: string
}

const native = requireOptionalNativeModule<StepSyncNativeModule>('StepSync')

/** Gives the worker the API address and the session token. */
export function configureNativeSync(apiUrl: string, token: string) {
  native?.configure(apiUrl, token)
}

/** Forgets the session token and stops the background sync. */
export function clearNativeSync() {
  native?.clear()
}

/** Schedules the background sync (keeps an existing schedule). */
export function scheduleNativeSync(intervalMinutes: number) {
  native?.schedule(intervalMinutes)
}

export function getNativeSyncHistory(): NativeSyncRun[] {
  if (!native) {
    return []
  }

  try {
    return JSON.parse(native.getHistory()) as NativeSyncRun[]
  } catch (error) {
    console.error('Background sync history unreadable:', error)
    return []
  }
}
