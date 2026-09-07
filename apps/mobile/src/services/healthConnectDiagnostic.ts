import Constants from 'expo-constants'
import { Platform } from 'react-native'
import {
    getGrantedPermissions,
    getSdkStatus,
    initialize,
} from 'react-native-health-connect'

const API_URL = process.env.EXPO_PUBLIC_API_URL

export type DiagnosticStatus =
  | 'ok'
  | 'error'
  | 'warning'
  | 'unknown'

export interface DiagnosticItem {
  label: string
  value: string
  status: DiagnosticStatus
}

export interface HealthConnectDiagnostic {
  items: DiagnosticItem[]
  generatedAt: string
}

function formatSdkStatus(status: number | string) {
  switch (status) {
    case 1:
      return 'Non disponible'
    case 2:
      return 'Disponible après mise à jour'
    case 3:
      return 'Disponible'
    default:
      return String(status)
  }
}

async function checkBackend(): Promise<DiagnosticItem> {
  if (!API_URL) {
    return {
      label: 'Backend',
      value: 'URL non configurée',
      status: 'error',
    }
  }

  try {
    const response = await fetch(
      `${API_URL}/api/health`,
    )

    if (!response.ok) {
      return {
        label: 'Backend',
        value: `Erreur HTTP ${response.status}`,
        status: 'error',
      }
    }

    return {
      label: 'Backend',
      value: 'Accessible',
      status: 'ok',
    }
  } catch (error) {
    return {
      label: 'Backend',
      value:
        error instanceof Error
          ? error.message
          : 'Connexion impossible',
      status: 'error',
    }
  }
}

export async function getHealthConnectDiagnostic(): Promise<HealthConnectDiagnostic> {
  const items: DiagnosticItem[] = []

  items.push({
    label: 'Application',
    value:
      Constants.expoConfig?.version ??
      'Inconnue',
    status: 'ok',
  })

  items.push({
    label: 'Plateforme',
    value: Platform.OS,
    status:
      Platform.OS === 'android'
        ? 'ok'
        : 'warning',
  })

  items.push({
    label: 'Android',
    value:
      Platform.OS === 'android'
        ? String(Platform.Version)
        : 'Non applicable',
    status:
      Platform.OS === 'android'
        ? 'ok'
        : 'unknown',
  })

  items.push({
    label: 'Appareil',
    value:
      Constants.deviceName ??
      'Inconnu',
    status: 'ok',
  })

  if (Platform.OS !== 'android') {
    items.push({
      label: 'Health Connect',
      value: 'Disponible uniquement sur Android',
      status: 'warning',
    })

    items.push(await checkBackend())

    return {
      items,
      generatedAt: new Date().toISOString(),
    }
  }

  let sdkStatus: number | string | null = null

  try {
    sdkStatus = await getSdkStatus()

    items.push({
      label: 'Health Connect',
      value: formatSdkStatus(sdkStatus),
      status:
        sdkStatus === 3
          ? 'ok'
          : 'error',
    })
  } catch (error) {
    items.push({
      label: 'Health Connect',
      value:
        error instanceof Error
          ? error.message
          : 'Impossible de vérifier',
      status: 'error',
    })
  }

  let initialized = false

  try {
    initialized = await initialize()

    items.push({
      label: 'Initialisation',
      value: initialized
        ? 'OK'
        : 'Échec',
      status: initialized
        ? 'ok'
        : 'error',
    })
  } catch (error) {
    items.push({
      label: 'Initialisation',
      value:
        error instanceof Error
          ? error.message
          : 'Erreur inconnue',
      status: 'error',
    })
  }

  if (initialized) {
    try {
      const permissions =
        await getGrantedPermissions()

      const stepsPermission =
        permissions.some(
          (permission) =>
            permission.accessType === 'read' &&
            permission.recordType === 'Steps',
        )

      items.push({
        label: 'Permission Steps',
        value: stepsPermission
          ? 'Accordée'
          : 'Non accordée',
        status: stepsPermission
          ? 'ok'
          : 'error',
      })

      items.push({
        label: 'Permissions accordées',
        value:
          permissions.length === 0
            ? 'Aucune'
            : String(permissions.length),
        status:
          permissions.length > 0
            ? 'ok'
            : 'warning',
      })
    } catch (error) {
      items.push({
        label: 'Permissions',
        value:
          error instanceof Error
            ? error.message
            : 'Impossible de vérifier',
        status: 'error',
      })
    }
  } else {
    items.push({
      label: 'Permission Steps',
      value: 'Impossible à vérifier',
      status: 'unknown',
    })
  }

  items.push(await checkBackend())

  return {
    items,
    generatedAt: new Date().toISOString(),
  }
}

export function formatDiagnostic(
  diagnostic: HealthConnectDiagnostic,
) {
  const lines = [
    'Step Challenge - Diagnostic',
    '===========================',
    '',
  ]

  for (const item of diagnostic.items) {
    lines.push(
      `${item.label}: ${item.value}`,
    )
  }

  lines.push('')
  lines.push(
    `Généré le: ${diagnostic.generatedAt}`,
  )

  return lines.join('\n')
}