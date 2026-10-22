import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { PermissionsAndroid, Platform } from 'react-native'

import {
  isPhoneStepCounterAvailable,
  readPhoneStepCounter,
} from '../../modules/phone-steps'
import { postMySteps } from '../api/steps'
import { addPhoneStepReading, type PhoneStepTally } from './phoneStepTally'

/**
 * Phone step counter: fallback for phones without Health Connect
 * (Huawei), in the AppGallery build only (PHONE_STEP_COUNTER, see
 * app.config.ts), until Health Kit is approved. Isolated here and in
 * modules/phone-steps, to be removed then.
 */

const TALLY_KEY = '@step-challenge/phone-step-tally'

/** Built with the phone step counter, and the phone has the sensor. */
export function isPhoneStepCounterEnabled() {
  return (
    Platform.OS === 'android' &&
    Constants.expoConfig?.extra?.phoneStepCounter === true &&
    isPhoneStepCounterAvailable()
  )
}

/** Physical activity permission, needed by the sensor since Android 10. */
async function hasActivityPermission(request: boolean) {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 29) {
    return true
  }

  const permission = PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION

  if (await PermissionsAndroid.check(permission)) {
    return true
  }

  if (!request) {
    return false
  }

  return (
    (await PermissionsAndroid.request(permission)) ===
    PermissionsAndroid.RESULTS.GRANTED
  )
}

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

async function loadTally(): Promise<PhoneStepTally | null> {
  const value = await AsyncStorage.getItem(TALLY_KEY)

  return value ? (JSON.parse(value) as PhoneStepTally) : null
}

/** Several screens sync on opening: one reading at a time. */
let pending: Promise<number | null> | null = null

/**
 * Reads the phone step counter, adds it to the day's tally and sends
 * the day totals. Returns today's steps, or null when the counter
 * cannot be read (not enabled, permission refused, no value).
 */
export function syncPhoneSteps({ requestPermission = true } = {}) {
  pending ??= readAndSend(requestPermission).finally(() => {
    pending = null
  })

  return pending
}

async function readAndSend(requestPermission: boolean) {
  if (!isPhoneStepCounterEnabled()) {
    return null
  }

  if (!(await hasActivityPermission(requestPermission))) {
    return null
  }

  const reading = await readPhoneStepCounter()

  if (!reading) {
    return null
  }

  const { tally, days } = addPhoneStepReading(
    await loadTally(),
    reading,
    localDateKey(new Date()),
  )

  // Saved first: today's total grows with each reading, so a failed
  // request is caught up by the next one (the backend keeps the highest
  // value).
  await AsyncStorage.setItem(TALLY_KEY, JSON.stringify(tally))

  try {
    await postMySteps(days)
  } catch (error) {
    console.error('Phone steps not sent:', error)
  }

  return tally.steps
}
