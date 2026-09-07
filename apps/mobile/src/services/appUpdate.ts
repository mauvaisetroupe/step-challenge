import Constants from 'expo-constants'

import { getLatestVersion } from '../api/version'

function parseVersion(version: string) {
  return version
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0)
}

function isNewerVersion(
  latest: string,
  current: string,
) {
  const latestParts = parseVersion(latest)
  const currentParts = parseVersion(current)

  const length = Math.max(
    latestParts.length,
    currentParts.length,
  )

  for (let i = 0; i < length; i++) {
    const latestPart = latestParts[i] ?? 0
    const currentPart = currentParts[i] ?? 0

    if (latestPart > currentPart) {
      return true
    }

    if (latestPart < currentPart) {
      return false
    }
  }

  return false
}

export async function checkForAppUpdate() {
  const currentVersion =
    Constants.expoConfig?.version

  if (!currentVersion) {
    return null
  }

  const latest = await getLatestVersion()

  if (
    !isNewerVersion(
      latest.version,
      currentVersion,
    )
  ) {
    return null
  }

  return {
    currentVersion,
    latestVersion: latest.version,
    url: latest.url,
  }
}