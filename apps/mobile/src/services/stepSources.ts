import {
  aggregateRecord,
  initialize,
  readRecords,
} from 'react-native-health-connect'

/**
 * Where the steps read by Step Challenge come from (Settings →
 * Diagnostics). Health Connect merges the data of every app that writes
 * steps (Garmin Connect, the phone…) and removes duplicates according to
 * the priority order set in its own settings: the total it gives is not
 * the sum of the sources.
 *
 * Read on the phone only; nothing is sent to the server.
 */

/** Apps that commonly write steps, by package name. */
const KNOWN_SOURCES: Record<string, string> = {
  'com.garmin.android.apps.connectmobile': 'Garmin Connect',
  'com.google.android.apps.fitness': 'Google Fit',
  'com.google.android.apps.healthdata': 'Health Connect',
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.fitbit.FitbitMobile': 'Fitbit',
  'com.huawei.health': 'Huawei Health',
  'com.xiaomi.wearable': 'Mi Fitness',
  'com.xiaomi.hm.health': 'Zepp Life',
  'com.huami.watch.hmwatchmanager': 'Zepp',
  'com.withings.wiscale2': 'Withings',
  'com.ouraring.oura': 'Oura',
  'fi.polar.polarflow': 'Polar Flow',
  'com.stt.android.suunto': 'Suunto',
  'com.strava': 'Strava',
}

/** Steps counted by the phone itself (Android 14 and later). */
const PHONE_SOURCE = 'android'

/** How far back to look for sources: one that wrote nothing today still shows. */
const SOURCE_DISCOVERY_DAYS = 30

/** Pages of raw records read to find the devices (1000 records each). */
const MAX_RECORD_PAGES = 3

export type StepSource = {
  packageName: string
  /** App name, or null for an unknown app (show the package name). */
  name: string | null
  /** Steps of this source today. */
  steps: number
  /** Devices declared by this source today ("Garmin Forerunner 255"). */
  devices: string[]
}

export type StepSourcesReport = {
  /** Today's total as merged by Health Connect: the one Step Challenge uses. */
  total: number
  /** Most steps first. */
  sources: StepSource[]
}

export function isPhoneSource(packageName: string) {
  return packageName === PHONE_SOURCE
}

function sourceName(packageName: string) {
  return KNOWN_SOURCES[packageName] ?? null
}

function startOfDay(date: Date) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function deviceName(device?: { manufacturer?: string; model?: string }) {
  const parts = [device?.manufacturer, device?.model]
    .map((part) => part?.trim())
    .filter(Boolean)

  // Some apps repeat the brand in the model ("Garmin Garmin Venu").
  if (
    parts.length === 2 &&
    parts[1]!.toLowerCase().startsWith(parts[0]!.toLowerCase())
  ) {
    return parts[1]!
  }

  return parts.join(' ') || null
}

/** Devices per source, from today's raw records. Best effort. */
async function readDevices(startTime: string, endTime: string) {
  const devices = new Map<string, Set<string>>()
  let pageToken: string | undefined

  for (let page = 0; page < MAX_RECORD_PAGES; page++) {
    const result = await readRecords('Steps', {
      timeRangeFilter: { operator: 'between', startTime, endTime },
      pageSize: 1000,
      pageToken,
    })

    for (const record of result.records) {
      const origin = record.metadata?.dataOrigin
      const name = deviceName(record.metadata?.device)

      if (origin && name) {
        if (!devices.has(origin)) {
          devices.set(origin, new Set())
        }

        devices.get(origin)!.add(name)
      }
    }

    pageToken = result.pageToken || undefined

    if (!pageToken) {
      break
    }
  }

  return devices
}

/**
 * Today's steps per source, and the merged total. Requires the Health
 * Connect steps permission.
 */
export async function getTodayStepSources(): Promise<StepSourcesReport> {
  await initialize()

  const now = new Date()
  const today = {
    operator: 'between' as const,
    startTime: startOfDay(now).toISOString(),
    endTime: now.toISOString(),
  }

  const discoveryStart = startOfDay(now)
  discoveryStart.setDate(discoveryStart.getDate() - (SOURCE_DISCOVERY_DAYS - 1))

  const [todayTotal, recent] = await Promise.all([
    aggregateRecord({ recordType: 'Steps', timeRangeFilter: today }),
    aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime: discoveryStart.toISOString(),
        endTime: now.toISOString(),
      },
    }),
  ])

  const origins = [
    ...new Set([...recent.dataOrigins, ...todayTotal.dataOrigins]),
  ]

  const devices = await readDevices(today.startTime, today.endTime).catch(
    (error) => {
      console.warn('Cannot read the step devices:', error)
      return new Map<string, Set<string>>()
    },
  )

  const sources = await Promise.all(
    origins.map(async (packageName): Promise<StepSource> => {
      const result = await aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter: today,
        dataOriginFilter: [packageName],
      })

      return {
        packageName,
        name: sourceName(packageName),
        steps: Number(result.COUNT_TOTAL ?? 0),
        devices: [...(devices.get(packageName) ?? [])].sort(),
      }
    }),
  )

  sources.sort((a, b) => b.steps - a.steps)

  return {
    total: Number(todayTotal.COUNT_TOTAL ?? 0),
    sources,
  }
}
