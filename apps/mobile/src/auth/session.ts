import * as SecureStore from 'expo-secure-store'

import { clearNativeSync, configureNativeSync } from '../../modules/step-sync'
import { API_URL } from '../api/config'

/**
 * Session token storage (ADR 0001).
 *
 * The token is kept in SecureStore (Android Keystore), never in
 * AsyncStorage. It is lost when the app is uninstalled: the user then
 * signs in with Google again.
 *
 * It is also given to the native background sync (ADR 0009), which runs
 * without JavaScript and keeps its own encrypted copy.
 */

const SESSION_TOKEN_KEY = 'step-challenge.session-token'

let cachedToken: string | null | undefined

export async function getSessionToken() {
  if (cachedToken === undefined) {
    cachedToken = await SecureStore.getItemAsync(SESSION_TOKEN_KEY)

    // Signed in before ADR 0009, or the copy was cleared: keep the
    // native background sync up to date at each app start.
    if (cachedToken) {
      configureNativeSync(API_URL, cachedToken)
    }
  }

  return cachedToken
}

export async function setSessionToken(token: string) {
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token)
  cachedToken = token
  configureNativeSync(API_URL, token)
}

export async function clearSessionToken() {
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY)
  cachedToken = null
  clearNativeSync()
}
