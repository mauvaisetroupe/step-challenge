import {
  clearSessionToken,
  getSessionToken,
} from '../auth/session'
import { API_URL } from './config'

/** The session is missing, expired or revoked: sign in again. */
export class UnauthenticatedError extends Error {
  constructor() {
    super('Session expirée, reconnecte-toi')
    this.name = 'UnauthenticatedError'
  }
}

/** The backend answered with an error status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    path: string,
  ) {
    super(`API error ${status}${code ? ` (${code})` : ''} on ${path}`)
    this.name = 'ApiError'
  }
}

type Listener = () => void

const signedOutListeners = new Set<Listener>()

/**
 * Called when the backend rejects the session (401), so that the app
 * can go back to the sign-in screen. Returns an unsubscribe function.
 */
export function onSignedOut(listener: Listener) {
  signedOutListeners.add(listener)

  return () => {
    signedOutListeners.delete(listener)
  }
}

async function readErrorCode(response: Response) {
  try {
    const body = await response.json()
    return typeof body?.error === 'string' ? body.error : undefined
  } catch {
    return undefined
  }
}

/**
 * Calls the Step Challenge API with the session token.
 *
 * - Adds `Authorization: Bearer <token>` when signed in.
 * - Sends and parses JSON.
 * - On 401, forgets the session, notifies onSignedOut listeners and
 *   throws UnauthenticatedError.
 * - On any other error status, throws ApiError with the backend error
 *   code (e.g. "display_name_required").
 *
 * Returns the parsed JSON body, or undefined when there is none.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    body?: unknown
    authenticated?: boolean
  } = {},
): Promise<T> {
  const { method = 'GET', body, authenticated = true } = init
  const headers: Record<string, string> = {}

  if (authenticated) {
    const token = await getSessionToken()

    if (!token) {
      throw new UnauthenticatedError()
    }

    headers.Authorization = `Bearer ${token}`
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 401 && authenticated) {
    await clearSessionToken()
    signedOutListeners.forEach((listener) => listener())
    throw new UnauthenticatedError()
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorCode(response), path)
  }

  // Some successes have no body (204, or 201 for a created report or
  // block): there is nothing to parse.
  const text = await response.text()

  return (text ? JSON.parse(text) : undefined) as T
}
