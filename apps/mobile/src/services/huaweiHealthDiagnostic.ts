import { i18n } from '@/i18n'

import type { DiagnosticItem } from './healthConnectDiagnostic'
import {
  getHuaweiLast30Days,
  getHuaweiTodayHourlyDetail,
  signInHuaweiHealth,
} from './huaweiHealth'

/**
 * Huawei Health lines of the diagnostic: sign-in (scopes only, never
 * the tokens: the text is copied for support), the 30 days read
 * through the REST API, one `date: steps` per day, and how many hours
 * of today have steps.
 */
export async function getHuaweiHealthDiagnostic(): Promise<
  DiagnosticItem[]
> {
  const items: DiagnosticItem[] = []

  items.push({
    label: i18n.t('settings.sources.title'),
    value: i18n.t('settings.sources.options.huawei.label'),
    status: 'ok',
  })

  try {
    const { scopes } = await signInHuaweiHealth()

    items.push({
      label: i18n.t('diagnostic.huawei.authorization'),
      value: scopes.join(', '),
      status: 'ok',
    })

    const days = await getHuaweiLast30Days()
    const today = days[days.length - 1]

    items.push({
      label: i18n.t('diagnostic.huawei.todaySteps'),
      value: today ? `${today.steps} (${today.date})` : '—',
      status: today ? 'ok' : 'error',
    })

    items.push({
      label: i18n.t('diagnostic.huawei.history', { count: days.length }),
      value: days.map((day) => `${day.date}: ${day.steps}`).join(', '),
      status: days.length > 0 ? 'ok' : 'error',
    })

    // Daily totals only so far (Pixel): does this device upload hours?
    const hourly = await getHuaweiTodayHourlyDetail()

    items.push({
      label: i18n.t('diagnostic.huawei.hourly'),
      value: i18n.t('diagnostic.huawei.hourlyValue', hourly),
      status: hourly.withSteps > 0 ? 'ok' : 'unknown',
    })
  } catch (error) {
    items.push({
      label: 'HUAWEI Health Kit',
      value:
        error instanceof Error
          ? error.message
          : JSON.stringify(error),
      status: 'error',
    })
  }

  return items
}
