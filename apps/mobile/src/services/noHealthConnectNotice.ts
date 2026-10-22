import type { TFunction } from 'i18next'
import { useEffect, useState } from 'react'

import { HUAWEI_HEALTH_READY } from './huaweiHealthReady'
import { isPhoneStepCounterEnabled } from './phoneSteps'
import { isHealthConnectAvailable } from './stepSync'

/**
 * Where the steps come from without Health Connect (Huawei phone), and
 * that Huawei Health is coming: ends the message of every view that
 * needs Health Connect.
 */
export function noHealthConnectNotice(t: TFunction) {
  return [
    isPhoneStepCounterEnabled()
      ? t('noHealthConnect.phoneCounter')
      : t('noHealthConnect.noSource'),
    HUAWEI_HEALTH_READY ? null : t('settings.huawei.comingSoonShort'),
  ]
    .filter(Boolean)
    .join(' ')
}

/** Health Connect availability, null until known. */
export function useHealthConnectAvailable() {
  const [available, setAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true

    isHealthConnectAvailable().then((value) => {
      if (mounted) {
        setAvailable(value)
      }
    })

    return () => {
      mounted = false
    }
  }, [])

  return available
}
