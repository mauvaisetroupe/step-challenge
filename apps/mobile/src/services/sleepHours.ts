import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'

import { setNativeSleepHours } from '../../modules/step-sync'
import type { SleepHours } from './inactivity'

export type { SleepHours }

/**
 * Sleep hours: no inactivity is counted during them (services/
 * inactivity). Without them, a few steps to bed after midnight would be
 * the first steps of the day, and the whole night would be inactive.
 *
 * In minutes since midnight. Bed time after wake time crosses midnight
 * (23:00 → 06:00); the same value for both means no sleep hours. Also
 * given to the native background sync (ADR 0009, ADR 0010).
 */
export const DEFAULT_SLEEP_HOURS: SleepHours = { bed: 23 * 60, wake: 6 * 60 }

/** Settings → Activity moves the hours by half an hour. */
export const SLEEP_HOURS_STEP = 30

const STORAGE_KEY = '@step-challenge/sleep-hours'

let current = DEFAULT_SLEEP_HOURS
let loaded: Promise<SleepHours> | null = null
const listeners = new Set<() => void>()

function isValid(value: unknown): value is SleepHours {
  const hours = value as SleepHours

  return [hours?.bed, hours?.wake].every(
    (minute) => Number.isInteger(minute) && minute >= 0 && minute < 24 * 60,
  )
}

/** Stored sleep hours, or the default ones. */
export function loadSleepHours() {
  loaded ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      const value = raw ? JSON.parse(raw) : null

      if (isValid(value)) {
        current = value
        listeners.forEach((listener) => listener())
      }

      return current
    })
    .catch((error) => {
      console.error('Sleep hours unreadable:', error)
      return current
    })

  return loaded
}

export async function saveSleepHours(hours: SleepHours) {
  current = hours
  loaded = Promise.resolve(hours)
  listeners.forEach((listener) => listener())
  setNativeSleepHours(hours.bed, hours.wake)

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(hours))
}

/** Gives the stored hours to the native background sync, at app start. */
export async function configureNativeSleepHours() {
  const hours = await loadSleepHours()

  setNativeSleepHours(hours.bed, hours.wake)
}

/** Current sleep hours, updated when they change in Settings. */
export function useSleepHours() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      loadSleepHours()

      return () => listeners.delete(listener)
    },
    () => current,
  )
}
