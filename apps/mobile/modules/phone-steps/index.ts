import { requireOptionalNativeModule } from 'expo'

/**
 * Phone step counter (modules/phone-steps): fallback without Health
 * Connect, in the AppGallery build only. Android only.
 */

export type PhoneStepReading = {
  /** Steps since the last boot. */
  steps: number
  /** Boot time, ms since the epoch: changes after a reboot. */
  bootTime: number
}

type PhoneStepsNativeModule = {
  isAvailable(): boolean
  read(): Promise<PhoneStepReading | null>
}

const native = requireOptionalNativeModule<PhoneStepsNativeModule>('PhoneSteps')

export function isPhoneStepCounterAvailable() {
  return native?.isAvailable() ?? false
}

/** Null without sensor, or when it gave no value in time. */
export async function readPhoneStepCounter() {
  return native ? native.read() : null
}
