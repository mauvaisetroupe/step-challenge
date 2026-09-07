const API_URL = process.env.EXPO_PUBLIC_API_URL

if (!API_URL) {
  throw new Error('EXPO_PUBLIC_API_URL is not configured')
}

export interface AppVersion {
  version: string
  url: string
}

export async function getLatestVersion(): Promise<AppVersion> {
  const response = await fetch(
    `${API_URL}/download/version.json`,
  )

  if (!response.ok) {
    throw new Error(
      `Version check error: ${response.status}`,
    )
  }

  return response.json() as Promise<AppVersion>
}