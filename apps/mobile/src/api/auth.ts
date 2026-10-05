import { clearSessionToken, setSessionToken } from '../auth/session'
import { ApiError, apiFetch } from './client'

export type User = {
  id: string
  name: string
  created_at: string
}

type SignInResponse = {
  sessionToken: string
  user: User
  isNewUser: boolean
}

export type SignInResult =
  | { status: 'signed-in'; user: User }
  | { status: 'display-name-required' }

/**
 * Exchanges a Google ID token for a Step Challenge session.
 *
 * Without display name, an unknown Google account is not created: the
 * backend answers display_name_required and the app asks for a name,
 * then calls again with the same ID token.
 */
export async function signInWithGoogleIdToken(
  idToken: string,
  displayName?: string,
): Promise<SignInResult> {
  try {
    const response = await apiFetch<SignInResponse>('/api/auth/google', {
      method: 'POST',
      authenticated: false,
      body: displayName ? { idToken, displayName } : { idToken },
    })

    await setSessionToken(response.sessionToken)

    return { status: 'signed-in', user: response.user }
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.code === 'display_name_required'
    ) {
      return { status: 'display-name-required' }
    }

    throw error
  }
}

export type DemoSignInResult =
  | { status: 'signed-in'; user: User }
  | { status: 'invalid-code' }
  | { status: 'unavailable' }
  | { status: 'too-many-attempts' }

/**
 * Signs in to the demo account of store reviewers with the access code
 * given in the Play Console (ADR 0006). The account already exists:
 * there is no display name to choose.
 */
export async function signInWithDemoCode(
  code: string,
): Promise<DemoSignInResult> {
  try {
    const response = await apiFetch<SignInResponse>('/api/auth/demo', {
      method: 'POST',
      authenticated: false,
      body: { code: code.trim() },
    })

    await setSessionToken(response.sessionToken)

    return { status: 'signed-in', user: response.user }
  } catch (error) {
    // 404: demo access is disabled on the server.
    const failures: Record<number, DemoSignInResult> = {
      401: { status: 'invalid-code' },
      404: { status: 'unavailable' },
      429: { status: 'too-many-attempts' },
    }

    if (error instanceof ApiError && failures[error.status]) {
      return failures[error.status]
    }

    throw error
  }
}

/**
 * Revokes the session on the backend, then forgets it locally even if
 * the backend cannot be reached.
 */
export async function signOut() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' })
  } catch (error) {
    console.warn('Logout request failed:', error)
  } finally {
    await clearSessionToken()
  }
}
