import {
    HmsDataController,
    HmsHealthAccount,
} from '@hmscore/react-native-hms-health'

import type { DiagnosticItem } from './healthConnectDiagnostic'

const STEP_READ_SCOPE =
  'https://www.huawei.com/healthkit/step.read'

const STEP_TOTAL_DATA_TYPE =
  'DT_CONTINUOUS_STEPS_TOTAL'

export async function getHuaweiHealthDiagnostic(): Promise<
  DiagnosticItem[]
> {
  const items: DiagnosticItem[] = []

  items.push({
    label: 'Huawei Health Kit',
    value: 'Module chargé',
    status: 'ok',
  })

  try {
    const signInResult =
      await HmsHealthAccount.signIn([
        STEP_READ_SCOPE,
      ])

    items.push({
      label: 'Autorisation Huawei',
      value: JSON.stringify(signInResult),
      status: 'ok',
    })

    const initResult =
      await HmsDataController.initDataController()

    items.push({
      label: 'Data Controller',
      value: JSON.stringify(initResult),
      status: initResult.isSuccess ? 'ok' : 'error',
    })

    const dataType = {
      dataType: STEP_TOTAL_DATA_TYPE,
    }

    const todayResult =
      await HmsDataController.readTodaySummation(
        dataType,
      )

    items.push({
      label: 'Pas aujourd’hui',
      value: JSON.stringify(todayResult),
      status: 'ok',
    })
  } catch (error) {
    items.push({
      label: 'Huawei Health Kit',
      value:
        error instanceof Error
          ? error.message
          : JSON.stringify(error),
      status: 'error',
    })
  }

  return items
}