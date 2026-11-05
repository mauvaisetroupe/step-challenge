import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'

import type { BadgeReport } from '../api/badges'

/**
 * New badges: awarded by the backend since the badges were last seen in
 * the app, background syncs included. A dot on the More tab says so,
 * and the screen highlights them. The date of the last look stays on
 * the phone.
 */

const STORAGE_KEY = '@step-challenge/badges-last-seen'

/** Latest award known, ISO date. */
let latest: string | null = null
/** Level and points of the latest report, for the More menu. */
let summary: { level: number; points: number } | null = null
/** Latest award already seen, ISO date. */
let lastSeen: string | null = null
let loaded: Promise<void> | null = null
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((listener) => listener())
}

function load() {
  loaded ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((value) => {
      lastSeen = value
      notify()
    })
    .catch((error) => {
      console.error('Last seen badges unreadable:', error)
    })

  return loaded
}

/** Notes the latest award of a report just read from the backend. */
export function noteBadgeReport(report: BadgeReport) {
  const newest = report.earned.reduce<string | null>(
    (max, badge) => (!max || badge.createdAt > max ? badge.createdAt : max),
    null,
  )

  if (
    newest !== latest ||
    report.level !== summary?.level ||
    report.points !== summary?.points
  ) {
    latest = newest
    summary = { level: report.level, points: report.points }
    notify()
  }

  load()
}

/**
 * Marks every badge known as seen. Returns the previous date, so that
 * the screen can still highlight what was new when it opened.
 */
export async function markBadgesSeen() {
  await load()

  const previous = lastSeen

  if (latest && latest !== lastSeen) {
    lastSeen = latest
    notify()
    await AsyncStorage.setItem(STORAGE_KEY, latest)
  }

  return previous
}

function hasNewBadges() {
  return latest !== null && (lastSeen === null || latest > lastSeen)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  load()

  return () => {
    listeners.delete(listener)
  }
}

export function useHasNewBadges() {
  return useSyncExternalStore(subscribe, hasNewBadges)
}

/** Level and points last read from the backend; null before any read. */
export function useBadgeSummary() {
  return useSyncExternalStore(subscribe, () => summary)
}
