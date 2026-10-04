import { API_URL, apiHeaders } from './config'

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