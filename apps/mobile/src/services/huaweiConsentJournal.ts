import AsyncStorage from '@react-native-async-storage/async-storage'

import { recordHuaweiConsent, type HuaweiWithdrawalCause } from '@/api/me'

/**
 * The HUAWEI Health authorization as last recorded by the backend
 * (ADR 0017), so that each change is sent once: the app signs in to
 * HUAWEI before every read.
 */
const LAST_RECORDED_KEY = '@step-challenge/huawei-consent-recorded'

type Recorded =
  | { action: 'granted'; scopes: string[] }
  | { action: 'withdrawn'; cause: HuaweiWithdrawalCause }

/**
 * Sends the authorization to the consent journal when it changed since
 * the last recording. Never throws and never waits for the network: a
 * failure is sent again at the next sign-in or refusal.
 */
function record(consent: Recorded) {
  const key = JSON.stringify(consent)

  AsyncStorage.getItem(LAST_RECORDED_KEY)
    .then(async (last) => {
      // Unchanged, or a refusal before any authorization (consent
      // screen dismissed at the first try): nothing to journal.
      if (last === key || (last === null && consent.action === 'withdrawn')) {
        return
      }

      await recordHuaweiConsent(consent)
      await AsyncStorage.setItem(LAST_RECORDED_KEY, key)
    })
    .catch((error) => {
      console.warn('HUAWEI Health consent not recorded:', error)
    })
}

/** A sign-in succeeded with these scopes. */
export function recordHuaweiGranted(scopes: string[]) {
  record({ action: 'granted', scopes: [...scopes].sort() })
}

/**
 * The access was withdrawn in the app, in the HUAWEI Health app, or
 * refused by HUAWEI Health Kit.
 */
export function recordHuaweiWithdrawn(cause: HuaweiWithdrawalCause) {
  record({ action: 'withdrawn', cause })
}
