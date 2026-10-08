import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { getMySteps, type DayStat } from '@/api/steps'
import BarChart, { type ChartPoint } from '@/components/stats/BarChart'
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

/** Score per day or per week; null when no minutes were ever sent. */
type Bucket = { start: Date; score: number | null }

function buildBuckets(period: Props['period'], days: DayStat[]): Bucket[] {
  const scores = new Map(days.map((day) => [day.date, storedDayScore(day)]))
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (period !== '1y') {
    const count = period === '7d' ? 7 : 30

    return Array.from({ length: count }, (_, index) => {
      const start = addDays(today, index - count + 1)

      return { start, score: scores.get(dateKey(start)) ?? null }
    })
  }

  // Weeks from Monday, the current one last.
  const monday = addDays(today, -((today.getDay() + 6) % 7))

  return Array.from({ length: WEEKS }, (_, index) => {
    const start = addDays(monday, (index - WEEKS + 1) * 7)
    let score: number | null = null

    for (let day = 0; day < 7; day++) {
      const value = scores.get(dateKey(addDays(start, day)))

      if (value != null) {
        score = (score ?? 0) + value
      }
    }

    return { start, score }
  })
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
  })
