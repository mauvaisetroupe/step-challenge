import {
    HmsDataController,
    HmsHealthAccount,
} from '@hmscore/react-native-hms-health'

import { i18n } from '@/i18n'

import type { DiagnosticItem } from './healthConnectDiagnostic'

const STEP_READ_SCOPE =
  'https://www.huawei.com/healthkit/step.read'

const STEP_TOTAL_DATA_TYPE =
  'DT_CONTINUOUS_STEPS_DELTA'

export async function getHuaweiHealthDiagnostic(): Promise<
  DiagnosticItem[]
> {
  const items: DiagnosticItem[] = []

  items.push({
    label: 'Huawei Health Kit',
    value: i18n.t('diagnostic.huawei.moduleLoaded'),
    status: 'ok',
  })

  try {
    const signInResult =
      await HmsHealthAccount.signIn([
        STEP_READ_SCOPE,
      ])

    items.push({
      label: i18n.t('diagnostic.huawei.authorization'),
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
      label: i18n.t('diagnostic.huawei.todaySteps'),
      value: JSON.stringify(todayResult),
      status: 'ok',
    })

    // Raw daily totals over several windows, to find how far back the
    // history permission (1 month) reaches. Dates are YYYYMMDD numbers.
    for (const days of [0, 1, 7, 29, 30]) {
      const start = new Date()
      start.setDate(start.getDate() - days)
      const historyResult =
        await HmsDataController.readDailySummation(
          dataType,
          toHuaweiDate(start),
          toHuaweiDate(new Date()),
        )

      items.push({
        label: `readDailySummation (${days} j)`,
        value: JSON.stringify(summarizeDaily(historyResult)),
        status: 'ok',
      })
    }
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

function toHuaweiDate(date: Date): number {
  return (
    date.getFullYear() * 10000 +
    (date.getMonth() + 1) * 100 +
    date.getDate()
  )
}

/** Keeps the date and step count of each day; anything else stays raw. */
function summarizeDaily(result: unknown): unknown {
  const points = (
    result as {
      body?: {
        samplePoints?: {
          startTime?: string
          fieldValues?: Record<string, unknown>
        }[]
      }
    }
  )?.body?.samplePoints

  if (!Array.isArray(points)) {
    return result
  }

  return points.map(
    (point) =>
      `${point.startTime?.slice(0, 10)}: ${point.fieldValues?.['steps(i)']}`,
  )
}
