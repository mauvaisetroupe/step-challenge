import type { TFunction } from 'i18next'
import { useEffect, useState } from 'react'

import { isPhoneStepCounterEnabled } from './phoneSteps'
import { isHealthConnectAvailable } from './stepSync'

/**
 * Where the steps come from without Health Connect (Huawei phone): ends
 * the message of every view that needs Health Connect.
 */
export function noHealthConnectNotice(t: TFunction) {
  return isPhoneStepCounterEnabled()
    ? t('noHealthConnect.phoneCounter')
    : t('noHealthConnect.noSource')
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
