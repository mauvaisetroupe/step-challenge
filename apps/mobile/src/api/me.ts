import { clearSessionToken } from '../auth/session'
import type { User } from './auth'
import { apiFetch } from './client'

export async function getMe() {
  return apiFetch<User>('/api/me')
}

export async function updateDisplayName(displayName: string) {
  return apiFetch<User>('/api/me', {
    method: 'PATCH',
    body: { displayName },
  })
}

/**
 * Deletes the account on the backend (sessions, Google link and steps),
 * then forgets the local session.
 */
export async function deleteAccount() {
  await apiFetch('/api/me', { method: 'DELETE' })
  await clearSessionToken()
}
