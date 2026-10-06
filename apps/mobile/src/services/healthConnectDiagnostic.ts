import Constants from 'expo-constants'
import { Platform } from 'react-native'
import {
  getGrantedPermissions,
  getSdkStatus,
  initialize,
} from 'react-native-health-connect'

import { API_URL } from '../api/config'
import { getFormatters, i18n } from '@/i18n'

const t = i18n.t

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
      return t('diagnostic.sdk.unavailable')
    case 2:
      return t('diagnostic.sdk.updateRequired')
    case 3:
      return t('diagnostic.sdk.available')
    default:
      return String(status)
  }
}

async function checkBackend(): Promise<DiagnosticItem> {
  try {
    const response = await fetch(`${API_URL}/api/health`)

    if (!response.ok) {
      return {
        label: 'Backend',
        value: t('diagnostic.httpError', { status: response.status }),
        status: 'error',
      }
    }

    return {
      label: 'Backend',
      value: t('diagnostic.reachable'),
      status: 'ok',
    }
  } catch (error) {
    return {
      label: 'Backend',
      value:
        error instanceof Error
          ? error.message
          : t('diagnostic.connectionFailed'),
      status: 'error',
    }
  }
}

export async function getHealthConnectDiagnostic(): Promise<HealthConnectDiagnostic> {
  const items: DiagnosticItem[] = []

  items.push({
    label: t('diagnostic.labels.app'),
    value:
      Constants.expoConfig?.version ??
      t('diagnostic.unknown'),
    status: 'ok',
  })

  items.push({
    label: t('diagnostic.labels.platform'),
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
        : t('diagnostic.notApplicable'),
    status:
      Platform.OS === 'android'
        ? 'ok'
        : 'unknown',
  })

  items.push({
    label: t('diagnostic.labels.device'),
    value:
      Constants.deviceName ??
      t('diagnostic.unknown'),
    status: 'ok',
  })

  if (Platform.OS !== 'android') {
    items.push({
      label: 'Health Connect',
      value: t('diagnostic.androidOnly'),
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
          : t('diagnostic.cannotCheck'),
      status: 'error',
    })
  }

  let initialized = false

  try {
    initialized = await initialize()

    items.push({
      label: t('diagnostic.labels.initialization'),
      value: initialized
        ? t('diagnostic.ok')
        : t('diagnostic.failed'),
      status: initialized
        ? 'ok'
        : 'error',
    })
  } catch (error) {
    items.push({
      label: t('diagnostic.labels.initialization'),
      value:
        error instanceof Error
          ? error.message
          : t('diagnostic.unknownError'),
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
        label: t('diagnostic.labels.stepsPermission'),
        value: stepsPermission
          ? t('diagnostic.granted')
          : t('diagnostic.notGranted'),
        status: stepsPermission
          ? 'ok'
          : 'error',
      })

      items.push({
        label: t('diagnostic.labels.grantedPermissions'),
        value:
          permissions.length === 0
            ? t('diagnostic.none')
            : String(permissions.length),
        status:
          permissions.length > 0
            ? 'ok'
            : 'warning',
      })
    } catch (error) {
      items.push({
        label: t('diagnostic.labels.permissions'),
        value:
          error instanceof Error
            ? error.message
            : t('diagnostic.cannotCheck'),
        status: 'error',
      })
    }
  } else {
    items.push({
      label: t('diagnostic.labels.stepsPermission'),
      value: t('diagnostic.cannotCheck'),
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
    t('diagnostic.generatedAt', {
      date: getFormatters().formatDateTime(new Date(diagnostic.generatedAt)),
    }),
  )

  return lines.join('\n')
}