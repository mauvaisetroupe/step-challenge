const API_URL = 'http://192.168.1.109:3000'

export async function createUser(name: string) {
  const response = await fetch(`${API_URL}/api/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  })

  if (!response.ok) {
    throw new Error(`User registration error: ${response.status}`)
  }

  return response.json() as Promise<{
    id: string
    name: string
    created_at: string
  }>
}

export async function syncSteps(
  userId: string,
  date: string,
  steps: number,
) {
  const response = await fetch(`${API_URL}/api/steps`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      date,
      steps,
    }),
  })

  if (!response.ok) {
    throw new Error(`Backend error: ${response.status}`)
  }
}