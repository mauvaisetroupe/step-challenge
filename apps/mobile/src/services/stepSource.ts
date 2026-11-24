import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'

import { setNativeStepSource } from '../../modules/step-sync'

/**
 * Where Step Challenge reads the steps (ADR 0013): one source at a
 * time, chosen by the user, kept on the phone and never sent to the
 * server.
 *
 * - healthConnect: Health Connect, or the phone step counter of the
 *   AppGallery build when Health Connect is missing (the default);
 * - huawei: Huawei Health, through the Health Kit REST API.
 */
export type StepSource = 'healthConnect' | 'huawei'

const STORAGE_KEY = '@step-challenge/step-source'

const DEFAULT_SOURCE: StepSource = 'healthConnect'

let current: StepSource = DEFAULT_SOURCE
let loaded: Promise<StepSource> | null = null
const listeners = new Set<() => void>()

function isValid(value: unknown): value is StepSource {
  return value === 'healthConnect' || value === 'huawei'
}

/** Stored source, or the default one. */
export function loadStepSource() {
  loaded ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      if (isValid(raw)) {
        current = raw
        listeners.forEach((listener) => listener())
      }

      return current
    })
    .catch((error) => {
      console.error('Step source unreadable:', error)
      return current
    })

  return loaded
}

export async function saveStepSource(source: StepSource) {
  current = source
  loaded = Promise.resolve(source)
  listeners.forEach((listener) => listener())
  setNativeStepSource(source)

  await AsyncStorage.setItem(STORAGE_KEY, source)
}

/**
 * Gives the stored source to the native background sync, at app start:
 * it only reads Health Connect, and must not send its steps when the
 * user chose Huawei Health.
 */
export async function configureNativeStepSource() {
  setNativeStepSource(await loadStepSource())
}

/** Current step source, updated when it changes in Settings. */
export function useStepSource() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      loadStepSource()

      return () => listeners.delete(listener)
    },
    () => current,
  )
}
