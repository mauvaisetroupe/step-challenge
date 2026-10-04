/**
 * Web variant of the session storage: in memory only.
 *
 * expo-secure-store has no web implementation, and storing a bearer
 * token in localStorage would expose it to XSS. The web client will use
 * an HttpOnly cookie set by the backend (ADR 0001, "Client web"); until
 * then, a web session does not survive a page reload.
 */

let token: string | null = null

export async function getSessionToken() {
  return token
}

export async function setSessionToken(value: string) {
  token = value
}

export async function clearSessionToken() {
  token = null
}
