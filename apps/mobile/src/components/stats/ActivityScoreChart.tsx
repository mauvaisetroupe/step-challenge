import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { getMySteps, type DayStat } from '@/api/steps'
import BarChart, { type ChartPoint } from '@/components/stats/BarChart'
import { useFormatDuration } from '@/components/stats/DayActivitySummary'
import { useFormatters, type Formatters } from '@/i18n'
import {
  DAILY_ACTIVITY_GOAL,
  storedDayScore,
  WEEKLY_ACTIVITY_GOAL,
} from '@/services/activity'
import { useTheme, useThemedStyles, type Colors } from '@/theme'

type Props = {
  period: '7d' | '30d' | '1y'
  /** False while the steps of the screen load (and sync today). */
  ready: boolean
}

/** Weeks of the 1-year view. */
const WEEKS = 52

function dateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${date.getFullYear()}-${month}-${day}`
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function shortDate(date: Date, f: Formatters) {
  return f.formatDate(date, { day: 'numeric', month: 'short' })
}

/**
 * Score and minutes per day or per week; null when no minutes were
 * ever sent.
 */
type Bucket = {
  start: Date
  score: number | null
  activeMinutes: number
  veryActiveMinutes: number
  inactiveMinutes: number
}

function buildBuckets(period: Props['period'], days: DayStat[]): Bucket[] {
  const byDate = new Map(days.map((day) => [day.date, day]))
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Sum of the days of [start, start + length[ that have minutes.
  const bucket = (start: Date, length: number): Bucket => {
    const result: Bucket = {
      start,
      score: null,
      activeMinutes: 0,
      veryActiveMinutes: 0,
      inactiveMinutes: 0,
    }

    for (let offset = 0; offset < length; offset++) {
      const day = byDate.get(dateKey(addDays(start, offset)))
      const score = day ? storedDayScore(day) : null

      if (day && score !== null) {
        result.score = (result.score ?? 0) + score
        result.activeMinutes += day.activeMinutes ?? 0
        result.veryActiveMinutes += day.veryActiveMinutes ?? 0
        result.inactiveMinutes += day.inactiveMinutes ?? 0
      }
    }

    return result
  }

  if (period !== '1y') {
    const count = period === '7d' ? 7 : 30

    return Array.from({ length: count }, (_, index) =>
      bucket(addDays(today, index - count + 1), 1),
    )
  }

  // Weeks from Monday, the current one last.
  const monday = addDays(today, -((today.getDay() + 6) % 7))

  return Array.from({ length: WEEKS }, (_, index) =>
    bucket(addDays(monday, (index - WEEKS + 1) * 7), 7),
  )
}

/**
 * Activity score (ADR 0010) of the 7-day, 30-day and 1-year views,
 * instead of the steps: per day against the daily share of the WHO goal, per
 * week over a year against the WHO goal itself. Read from the
 * database: days synced before the activity minutes have no bar.
 */
export default function ActivityScoreChart({ period, ready }: Props) {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const { t } = useTranslation()
  const formatters = useFormatters()
  const formatDuration = useFormatDuration()
  const [days, setDays] = useState<DayStat[] | null>(null)

  useEffect(() => {
    if (!ready) {
      return
    }

    const from = addDays(new Date(), period === '1y' ? -WEEKS * 7 : -31)
    let cancelled = false

    getMySteps(dateKey(from))
      .then((result) => {
        if (!cancelled) {
          setDays(result)
        }
      })
      .catch((error) => {
        // Best effort: the steps above are shown anyway.
        console.error('Activity score unavailable:', error)

        if (!cancelled) {
          setDays(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [period, ready])

  if (!days) {
    return null
  }

  const weekly = period === '1y'
  const goal = weekly ? WEEKLY_ACTIVITY_GOAL : DAILY_ACTIVITY_GOAL
  const buckets = buildBuckets(period, days)
  const withData = buckets.filter((bucket) => bucket.score !== null)

  const data: ChartPoint[] = withData.length
    ? buckets.map((bucket) => ({
        label: shortDate(bucket.start, formatters),
        value: bucket.score ?? 0,
        reached: (bucket.score ?? 0) >= goal,
      }))
    : []

  // Score per week: 7 days in the 7-day view, the average of the weeks
  // (or of the days, times 7) with data otherwise.
  const total = withData.reduce((sum, bucket) => sum + (bucket.score ?? 0), 0)
  const perWeek =
    period === '7d'
      ? total
      : Math.round(weekly ? total / withData.length : (total / withData.length) * 7)

  return (
    <View style={styles.container}>
      <BarChart
        data={data}
        goal={goal}
        showGoalLine
        color={colors.activity}
        emptyMessage={t('stats.activity.noData')}
      />

      {withData.length > 0 && (
        <Text style={styles.summary}>
          {t(
            period === '7d'
              ? 'stats.activity.weekTotal'
              : 'stats.activity.weekAverage',
            { score: perWeek, goal: WEEKLY_ACTIVITY_GOAL },
          )}
        </Text>
      )}

      {withData.length > 0 && (
        <View style={styles.list}>
          {[...buckets].reverse().map((bucket) => {
            const reached = bucket.score !== null && bucket.score >= goal

            return (
              <View key={bucket.start.getTime()} style={styles.item}>
                <View style={styles.mainRow}>
                  <Text style={styles.name}>
                    {weekly
                      ? t('stats.activity.weekOf', {
                          date: shortDate(bucket.start, formatters),
                        })
                      : formatters.formatDate(bucket.start, { weekday: 'long' })}
                  </Text>

                  <View style={styles.status}>
                    <Text style={styles.score}>
                      {bucket.score === null ? '—' : bucket.score}
                    </Text>

                    {bucket.score !== null && (
                      <View
                        style={[
                          styles.circle,
                          reached ? styles.circleSuccess : styles.circleFailure,
                        ]}
                      >
                        <Text
                          style={[
                            styles.icon,
                            reached ? styles.iconSuccess : styles.iconFailure,
                          ]}
                        >
                          {reached ? '✓' : '✕'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.subRow}>
                  <Text style={[styles.detail, styles.date]}>
                    {weekly ? '' : shortDate(bucket.start, formatters)}
                  </Text>

                  <Text style={styles.detail}>
                    {bucket.score === null
                      ? t('stats.activity.noMinutes')
                      : t('stats.activity.minutesDetail', {
                          veryActive: formatDuration(bucket.veryActiveMinutes),
                          active: formatDuration(bucket.activeMinutes),
                          inactive: formatDuration(bucket.inactiveMinutes),
                        })}
                  </Text>
                </View>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      marginBottom: 16,
    },

    summary: {
      fontSize: 13,
      color: c.textSecondary,
      textAlign: 'center',
    },

    // Same layout as the steps list of the Stats screen.
    list: {
      marginTop: 12,
    },

    item: {
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },

    mainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    name: {
      flex: 1,
      fontSize: 16,
      fontWeight: '500',
      color: c.text,
      textTransform: 'capitalize',
    },

    status: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    score: {
      fontSize: 16,
      fontWeight: '600',
      color: c.text,
      minWidth: 40,
      textAlign: 'right',
    },

    circle: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
    },

    circleSuccess: {
      borderColor: c.success,
      backgroundColor: c.successSoft,
    },

    circleFailure: {
      borderColor: c.danger,
      backgroundColor: c.dangerSoft,
    },

    icon: {
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 16,
    },

    iconSuccess: {
      color: c.success,
    },

    iconFailure: {
      color: c.danger,
    },

    subRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
      marginTop: 2,
    },

    detail: {
      fontSize: 12,
      color: c.textMuted,
    },

    date: {
      textTransform: 'capitalize',
    },
  })
