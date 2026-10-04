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
