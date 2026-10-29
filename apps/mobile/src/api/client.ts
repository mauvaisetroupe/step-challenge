import {
  clearSessionToken,
  getSessionToken,
} from '../auth/session'
import { i18n } from '@/i18n'

import { API_URL } from './config'

/** The session is missing, expired or revoked: sign in again. */
export class UnauthenticatedError extends Error {
  constructor() {
    super(i18n.t('errors.sessionExpired'))
    this.name = 'UnauthenticatedError'
  }
}

/**
 * The backend did not answer in time (REQUEST_TIMEOUT_MS): bad network,
 * or a dead connection that Android kept open.
 */
export class TimeoutError extends Error {
  constructor(readonly path: string) {
    super(i18n.t('errors.timeout'))
    this.name = 'TimeoutError'
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

/**
 * Longest wait for a request, answer body included. React Native sets no
 * timeout on Android: a request on a dead connection (switch from Wi-Fi
 * to mobile data, poor network) would otherwise never end.
 */
const REQUEST_TIMEOUT_MS = 15_000

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
 * - Without an answer after REQUEST_TIMEOUT_MS, aborts the request and
 *   throws TimeoutError.
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

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
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
  } catch (error) {
    if (controller.signal.aborted) {
      throw new TimeoutError(path)
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}
