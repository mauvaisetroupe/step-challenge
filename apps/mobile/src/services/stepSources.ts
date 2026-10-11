import {
  aggregateRecord,
  initialize,
  readRecords,
} from 'react-native-health-connect'

import type { StepSlice } from './inactivity'
import { getDayRange, getHealthConnectStepSlices } from './stepSlices'
import { findStepSurplus, type StepSurplus } from './stepSurplus'

/**
 * Where the steps read by Step Challenge come from (Settings → Step
 * sources, Stats → 1 day, Settings → Diagnostics). Health Connect merges the data of every app that writes
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

/**
 * Steps counted by the phone itself. Android 14 declares them as
 * "android"; recent versions (seen on Android 17) as
 * "com.android.healthconnect.phone.<id>", with an id specific to the
 * device.
 */
const PHONE_SOURCE = 'android'
const PHONE_SOURCE_PREFIX = 'com.android.healthconnect.phone'

/** How far back to look for sources: one that wrote nothing today still shows. */
const SOURCE_DISCOVERY_DAYS = 30

/** Pages of raw records read to find the devices (1000 records each). */
const MAX_RECORD_PAGES = 3

export type StepSource = {
  packageName: string
  /** App name, or null for an unknown app (show the package name). */
  name: string | null
  /** Steps of this source on the day. */
  steps: number
  /** Devices declared by this source on the day ("Garmin Forerunner 255"). */
  devices: string[]
}

export type StepSourcesReport = {
  /** The day's total as merged by Health Connect: the one Step Challenge uses. */
  total: number
  /** Most steps first. */
  sources: StepSource[]
}

export function isPhoneSource(packageName: string) {
  return (
    packageName === PHONE_SOURCE ||
    packageName.startsWith(PHONE_SOURCE_PREFIX)
  )
}

function sourceName(packageName: string) {
  return KNOWN_SOURCES[packageName] ?? null
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

/** Devices per source, from the day's raw records. Best effort. */
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
 * Steps per source on a day (today: until now), and the merged total.
 * Requires the Health Connect steps permission.
 */
export async function getStepSources(day: Date): Promise<StepSourcesReport> {
  await initialize()

  const { start, end } = getDayRange(day)
  const range = {
    operator: 'between' as const,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  }

  const discoveryStart = new Date(start)
  discoveryStart.setDate(discoveryStart.getDate() - (SOURCE_DISCOVERY_DAYS - 1))

  const [dayTotal, recent] = await Promise.all([
    aggregateRecord({ recordType: 'Steps', timeRangeFilter: range }),
    aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime: discoveryStart.toISOString(),
        endTime: end.toISOString(),
      },
    }),
  ])

  const origins = [
    ...new Set([...recent.dataOrigins, ...dayTotal.dataOrigins]),
  ]

  const devices = await readDevices(range.startTime, range.endTime).catch(
    (error) => {
      console.warn('Cannot read the step devices:', error)
      return new Map<string, Set<string>>()
    },
  )

  const sources = await Promise.all(
    origins.map(async (packageName): Promise<StepSource> => {
      const result = await aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter: range,
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
    total: Number(dayTotal.COUNT_TOTAL ?? 0),
    sources,
  }
}

/** Today's steps per source, and the merged total. */
export function getTodayStepSources() {
  return getStepSources(new Date())
}

export type SourceSurplus = StepSurplus & {
  /** The source with the most steps on the day: usually the watch. */
  main: StepSource
  /** The other sources with steps on the day, by package name. */
  others: StepSource[]
}

/**
 * Steps of the merged total above the main source, and when they were
 * counted (services/stepSurplus). Null with a single source or none.
 * `merged` are the day's merged slices, already read for the curve.
 */
export async function getSourceSurplus(
  day: Date,
  report: StepSourcesReport,
  merged: StepSlice[],
): Promise<SourceSurplus | null> {
  const [main, ...others] = report.sources.filter((source) => source.steps > 0)

  if (!main || others.length === 0) {
    return null
  }

  const { start, end } = getDayRange(day)
  const [mainSlices, ...otherSlices] = await Promise.all(
    [main, ...others].map((source) =>
      getHealthConnectStepSlices(start, end, [source.packageName]),
    ),
  )

  const surplus = findStepSurplus(
    merged,
    mainSlices,
    others.map((source, index) => ({
      id: source.packageName,
      slices: otherSlices[index],
    })),
  )

  return { ...surplus, main, others }
}
