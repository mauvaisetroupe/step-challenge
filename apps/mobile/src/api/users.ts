import { API_URL } from './config'

// Legacy routes, removed from the backend (ADR 0001): replaced by the
// session-based API in the next commits.
const apiHeaders = { 'Content-Type': 'application/json' }

export type User = {
  id: string
  name: string
  created_at: string
}

export async function createUser(name: string) {
  const response = await fetch(`${API_URL}/api/users`, {
    method: 'POST',
    headers: apiHeaders,
    body: JSON.stringify({ name }),
  })

  if (response.status === 409) {
    throw new Error('Ce prénom est déjà utilisé')
  }

  if (!response.ok) {
    throw new Error(`User registration error: ${response.status}`)
  }

  return response.json() as Promise<User>
}

export async function getUserByName(name: string) {
  const response = await fetch(
    `${API_URL}/api/users/by-name/${encodeURIComponent(name)}`,
    {
      headers: apiHeaders,
    },
  )

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`User lookup error: ${response.status}`)
  }

  return response.json() as Promise<User>
}