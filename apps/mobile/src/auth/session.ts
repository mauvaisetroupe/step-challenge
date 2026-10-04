import * as SecureStore from 'expo-secure-store'

/**
 * Session token storage (ADR 0001).
 *
 * The token is kept in SecureStore (Android Keystore), never in
 * AsyncStorage. It is lost when the app is uninstalled: the user then
 * signs in with Google again.
 */

const SESSION_TOKEN_KEY = 'step-challenge.session-token'

let cachedToken: string | null | undefined

export async function getSessionToken() {
  if (cachedToken === undefined) {
    cachedToken = await SecureStore.getItemAsync(SESSION_TOKEN_KEY)
  }

  return cachedToken
}

export async function setSessionToken(token: string) {
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token)
  cachedToken = token
}

export async function clearSessionToken() {
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY)
  cachedToken = null
}
