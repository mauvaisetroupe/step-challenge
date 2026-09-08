const API_URL = process.env.EXPO_PUBLIC_API_URL
const API_KEY = process.env.EXPO_PUBLIC_API_KEY

console.log('API URL:', process.env.EXPO_PUBLIC_API_URL)
console.log(
  'API KEY configured:',
  Boolean(process.env.EXPO_PUBLIC_API_KEY),
)

if (!API_URL) {
  throw new Error('EXPO_PUBLIC_API_URL is not configured')
}

if (!API_KEY) {
  throw new Error('EXPO_PUBLIC_API_KEY is not configured')
}

const apiHeaders: HeadersInit = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
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
    headers: apiHeaders,
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

export async function getSteps(userId: string) {
  const response = await fetch(
    `${API_URL}/api/steps/${userId}`,
    {
      headers: apiHeaders,
    },
  )

  if (!response.ok) {
    throw new Error(`Backend error: ${response.status}`)
  }

  return response.json() as Promise<
    Array<{
      user_id: string
      date: string
      steps: number
      updated_at: string
    }>
  >
}

export async function getLeaderboard(
  period: 'week' | 'month',
) {
  const response = await fetch(
    `${API_URL}/api/leaderboard?period=${period}`,
    {
      headers: apiHeaders,
    },
  )

  if (!response.ok) {
    throw new Error(`Leaderboard error: ${response.status}`)
  }

  return response.json() as Promise<{
    period: 'week' | 'month'
    results: Array<{
      id: string
      name: string
      steps: number
    }>
  }>
}