import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import {
  aggregateGroupByPeriod,
  initialize,
  requestPermission,
} from 'react-native-health-connect'

import { getMySteps } from '../../api/steps'
import { HEALTH_PERMISSIONS, syncTodaySteps } from '../../services/stepSync'
import { stepSourceLabel } from '@/services/healthConnectDiagnostic'
import { getTodayStepSources } from '@/services/stepSources'
import TabScreenHeader from '../../components/TabScreenHeader'
import { useFormatters, type Formatters } from '@/i18n'
import ActivityScoreChart from '@/components/stats/ActivityScoreChart'
import BarChart from '@/components/stats/BarChart'
import DayActivitySummary from '@/components/stats/DayActivitySummary'
import DayTimeline from '@/components/stats/DayTimeline'
import { summarizeDayActivity } from '@/services/activity'
import {
  findInactivePeriods,
  hourlyStepsFromSlices,
  type StepSlice,
} from '@/services/inactivity'
import { getHealthConnectStepSlices } from '@/services/stepSlices'
import { useTheme, useThemedStyles, type Colors } from '@/theme'

const DAILY_GOAL = 10_000

type Period = '1d' | '7d' | '30d' | '1y'

type DayStat = {
  date: string
  steps: number
}

type MonthStat = {
  date: string
  steps: number
}

const PERIODS: Period[] = ['1d', '7d', '30d', '1y']

/** What the 7-day, 30-day and 1-year views show (ADR 0010). */
type Metric = 'steps' | 'score'

const METRICS: Metric[] = ['steps', 'score']

function getStartOfDay(date: Date) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatSteps(value: number, f: Formatters) {
  return f.formatNumber(Math.round(value))
}

function formatShortDate(date: Date, f: Formatters) {
  return f.formatDate(date, {
    day: 'numeric',
    month: 'short',
  })
}

function formatMonth(date: Date, f: Formatters) {
  return f.formatDate(date, {
    month: 'short',
  })
}

function formatWeekDay(date: Date, f: Formatters) {
  return f.formatDate(date, {
    weekday: 'long',
  })
}

function getDaysAgo(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function getMonthsAgo(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() - months, 1)
}

function getMonthDays(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate()
}

function getPercent(steps: number, goal = DAILY_GOAL) {
  return Math.round((steps / goal) * 100)
}

function getMonthPercent(steps: number, date: Date) {
  const goal = DAILY_GOAL * getMonthDays(date)
  return Math.round((steps / goal) * 100)
}

async function getHealthConnectDailyStats(
  startDate: Date,
  endDate: Date,
): Promise<DayStat[]> {
  const result = await aggregateGroupByPeriod({
    recordType: 'Steps',
    timeRangeFilter: {
      operator: 'between',
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    },
    timeRangeSlicer: {
      period: 'DAYS',
      length: 1,
    },
  })

  const stats = new Map<string, number>()

  for (const bucket of result) {
    const date = new Date(bucket.startTime)
    const key = formatDateKey(date)

    stats.set(
      key,
      Number(bucket.result?.COUNT_TOTAL ?? 0),
    )
  }

  const days: DayStat[] = []

  const current = new Date(startDate)

  while (current < endDate) {
    const key = formatDateKey(current)

    days.push({
      date: key,
      steps: stats.get(key) ?? 0,
    })

    current.setDate(current.getDate() + 1)
  }

  return days
}

async function getDatabaseDailyStats(
  startDate: Date,
  endDate: Date,
): Promise<DayStat[]> {
  const data = await getMySteps(formatDateKey(startDate))

  const stats = new Map<string, number>()

  for (const item of data) {
    const key = String(item.date).slice(0, 10)

    stats.set(key, Number(item.steps ?? 0))
  }

  const days: DayStat[] = []

  const current = new Date(startDate)

  while (current < endDate) {
    const key = formatDateKey(current)

    days.push({
      date: key,
      steps: stats.get(key) ?? 0,
    })

    current.setDate(current.getDate() + 1)
  }

  return days
}

async function getDatabaseMonthlyStats(
  startDate: Date,
  endDate: Date,
): Promise<MonthStat[]> {
  const data = await getMySteps(formatDateKey(startDate))

  const stats = new Map<string, number>()

  for (const item of data) {
    const date = parseDateKey(String(item.date).slice(0, 10))

    if (date < startDate || date >= endDate) {
      continue
    }

    const key = `${date.getFullYear()}-${String(
      date.getMonth() + 1,
    ).padStart(2, '0')}`

    stats.set(
      key,
      (stats.get(key) ?? 0) + Number(item.steps ?? 0),
    )
  }

  const months: MonthStat[] = []

  const current = new Date(startDate)

  while (current < endDate) {
    const key = `${current.getFullYear()}-${String(
      current.getMonth() + 1,
    ).padStart(2, '0')}`

    months.push({
      date: formatDateKey(current),
      steps: stats.get(key) ?? 0,
    })

    current.setMonth(current.getMonth() + 1)
  }

  return months
}

export default function StatsScreen() {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const { t } = useTranslation()
  const formatters = useFormatters()

  const [period, setPeriod] = useState<Period>('7d')
  const [metric, setMetric] = useState<Metric>('steps')
  const [dailyStats, setDailyStats] = useState<DayStat[]>([])
  const [monthlyStats, setMonthlyStats] = useState<MonthStat[]>([])
  // 1-day view: steps per minute (Android).
  const [daySlices, setDaySlices] = useState<StepSlice[]>([])
  const inactivePeriods = useMemo(
    () => findInactivePeriods(daySlices),
    [daySlices],
  )
  // Names of today's step sources, under the 1-day view (Android).
  const [sourceNames, setSourceNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const now = new Date()

      // Source of each view:
      //
      // - 1 day, 7 days, 30 days: Health Connect, on Android. It is the
      //   reference for recent days and gives the hourly detail.
      // - 1 year: the Step Challenge database (GET /api/me/steps), on
      //   Android too, summed per month here. Health Connect only lets an
      //   app read data from 30 days before its first permission, and its
      //   history does not follow the user to a new phone: a year read
      //   from it would be wrong. Step Challenge does not try to replace
      //   the watch's own history: this is the only view that reads the
      //   database.
      // - On the web (no Health Connect), the views read the database;
      //   the 1-day view has no hourly detail.

      if (Platform.OS !== 'web') {
        try {
          await initialize()

          await requestPermission(HEALTH_PERMISSIONS)

          // Sends today's Health Connect total to the backend before
          // displaying: the 1-year view then includes today.
          await syncTodaySteps()
        } catch (err) {
          // The other views need Health Connect. The 1-year view reads
          // the database: it is shown even when Health Connect is
          // unavailable or today's sync fails (permission refused, no
          // network), without today's latest steps.
          if (period !== '1y') {
            throw err
          }

          console.error('Sync before the 1-year view failed:', err)
        }
      }

      if (period === '1y') {
        const startDate = getMonthsAgo(
          getMonthStart(now),
          11,
        )
        const endDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          1,
        )

        const stats = await getDatabaseMonthlyStats(
          startDate,
          endDate,
        )

        setMonthlyStats(stats)
        setDailyStats([])
        setDaySlices([])

        return
      }

      if (Platform.OS === 'web') {
        if (period === '7d' || period === '30d') {
          const days = period === '7d' ? 7 : 30
          const startDate = getStartOfDay(getDaysAgo(now, days - 1))
          const endDate = new Date(now)
          endDate.setDate(endDate.getDate() + 1)
          endDate.setHours(0, 0, 0, 0)

          const stats = await getDatabaseDailyStats(
            startDate,
            endDate,
          )

          setDailyStats(stats)
          setMonthlyStats([])
          setDaySlices([])

          return
        }

        // 1 day: no hourly detail on the web.
        setDaySlices([])
        setDailyStats([])
        setMonthlyStats([])

        return
      }

      if (period === '1d') {
        const slices = await getHealthConnectStepSlices(
          getStartOfDay(now),
          now,
        )

        setDaySlices(slices)

        setDailyStats([])
        setMonthlyStats([])

        // Best effort: the link to the sources screen works without names.
        getTodayStepSources()
          .then((report) =>
            setSourceNames(
              report.sources
                .filter((source) => source.steps > 0)
                .map(stepSourceLabel),
            ),
          )
          .catch((err) => {
            console.error('Step sources error:', err)
            setSourceNames([])
          })

        return
      }

      const days = period === '7d' ? 7 : 30
      const startDate = getStartOfDay(
        getDaysAgo(now, days - 1),
      )
      const endDate = new Date(now)

      const stats = await getHealthConnectDailyStats(
        startDate,
        endDate,
      )

      setDailyStats(stats)
      setMonthlyStats([])
      setDaySlices([])
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : t('stats.loadError'),
      )
    } finally {
      setLoading(false)
    }
  }, [period, t])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const totalSteps = useMemo(() => {
    if (period === '1y') {
      return monthlyStats.reduce(
        (total, item) => total + item.steps,
        0,
      )
    }

    return dailyStats.reduce(
      (total, item) => total + item.steps,
      0,
    )
  }, [
    period,
    dailyStats,
    monthlyStats,
  ])

  return (
    // Top edge only: keeps the content below the status bar (camera,
    // clock, battery); the tab bar handles the bottom.
    <SafeAreaView edges={['top']} style={styles.container}>
      <TabScreenHeader title={t('stats.title')} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <View style={styles.periodSelector}>
          {PERIODS.map((item) => (
            <Pressable
              key={item}
              style={[
                styles.periodButton,
                period === item &&
                  styles.periodButtonActive,
              ]}
              onPress={() => setPeriod(item)}
            >
              <Text
                style={[
                  styles.periodButtonText,
                  period === item &&
                    styles.periodButtonTextActive,
                ]}
              >
                {t(`stats.periods.${item}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" />
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>

            <Pressable
              style={styles.retryButton}
              onPress={loadStats}
            >
              <Text style={styles.retryText}>
                {t('common.retry')}
              </Text>
            </Pressable>
          </View>
        ) : period === '1d' ? (
          <>
            <DayTimeline
              hourlySteps={
                daySlices.length > 0
                  ? hourlyStepsFromSlices(daySlices, new Date())
                  : []
              }
              inactivePeriods={inactivePeriods}
              goal={DAILY_GOAL}
              now={new Date()}
              emptyMessage={
                Platform.OS === 'web'
                  ? t('stats.hourlyAndroidOnly')
                  : t('stats.noStepsToday')
              }
            />

            {daySlices.length > 0 && (
              <DayActivitySummary
                activity={summarizeDayActivity(daySlices, inactivePeriods)}
              />
            )}

            {Platform.OS === 'android' && (
              <Pressable
                style={styles.sourcesLink}
                onPress={() => router.push('/settings/sources')}
                hitSlop={8}
              >
                {sourceNames.length > 0 && (
                  <Text style={styles.sourcesText} numberOfLines={1}>
                    {t('stats.sources', { names: sourceNames.join(', ') })}
                  </Text>
                )}
                <Text style={styles.sourcesAction}>
                  {t('stats.seeSources')}
                </Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <View style={styles.metricSelector}>
              {METRICS.map((item) => (
                <Pressable
                  key={item}
                  style={[
                    styles.metricButton,
                    metric === item && [
                      styles.periodButtonActive,
                      // Underlined with its chart color: steps blue,
                      // activity teal.
                      {
                        borderBottomColor:
                          item === 'steps' ? colors.primary : colors.activity,
                      },
                    ],
                  ]}
                  onPress={() => setMetric(item)}
                >
                  <Text
                    style={[
                      styles.metricButtonText,
                      metric === item && styles.periodButtonTextActive,
                    ]}
                  >
                    {t(`stats.metrics.${item}`)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {metric === 'score' ? (
              <ActivityScoreChart period={period} ready={!loading} />
            ) : (
              <>
                <View style={styles.totalContainer}>
                  <Text style={styles.totalValue}>
                    {formatSteps(totalSteps, formatters)}
                  </Text>

                  <Text style={styles.totalLabel}>
                    {t('stats.stepsUnit', { count: Math.round(totalSteps) })}
                  </Text>
                </View>

                <View style={styles.chartContainer}>
                  {period === '1y' ? (
                    <BarChart
                      goal={DAILY_GOAL}
                      data={monthlyStats.map((item) => ({
                        label: formatMonth(parseDateKey(item.date), formatters),
                        value: item.steps,
                        reached:
                          getMonthPercent(item.steps, parseDateKey(item.date)) >= 100,
                      }))}
                    />
                  ) : (
                    <BarChart
                      goal={DAILY_GOAL}
                      data={dailyStats.map((item) => ({
                        label: formatShortDate(parseDateKey(item.date), formatters),
                        value: item.steps,
                        reached: item.steps >= DAILY_GOAL,
                      }))}
                    />
                  )}
                </View>

                {period === '7d' || period === '30d' ? (
                  <DailyStatsList stats={dailyStats} />
                ) : null}

                {period === '1y' ? (
                  <MonthlyStatsList stats={monthlyStats} />
                ) : null}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function DailyStatsList({
  stats,
}: {
  stats: DayStat[]
}) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const formatters = useFormatters()

  return (
    <View style={styles.statsList}>
      {stats
        .slice()
        .reverse()
        .map((item) => {
          const date = parseDateKey(item.date)
          const percent = getPercent(item.steps)
          const reached = item.steps >= DAILY_GOAL

          return (
            <View
              key={item.date}
              style={styles.statItem}
            >
              <View style={styles.statMainRow}>
                <Text style={styles.dayName}>
                  {formatWeekDay(date, formatters)}
                </Text>

                <View style={styles.stepsStatus}>
                  <Text style={styles.stepsValue}>
                    {formatSteps(item.steps, formatters)}
                  </Text>

                  <View
                    style={[
                      styles.statusCircle,
                      reached
                        ? styles.statusCircleSuccess
                        : styles.statusCircleFailure,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusIcon,
                        reached
                          ? styles.statusIconSuccess
                          : styles.statusIconFailure,
                      ]}
                    >
                      {reached ? '✓' : '✕'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.statSubRow}>
                <Text style={styles.dateText}>
                  {formatShortDate(date, formatters)}
                </Text>

                <Text style={styles.percentText}>
                  {t('stats.percent', {
                    percent: formatters.formatNumber(percent),
                  })}
                </Text>
              </View>
            </View>
          )
        })}
    </View>
  )
}

function MonthlyStatsList({
  stats,
}: {
  stats: MonthStat[]
}) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const formatters = useFormatters()

  return (
    <View style={styles.statsList}>
      {stats
        .slice()
        .reverse()
        .map((item) => {
          const date = parseDateKey(item.date)
          const percent = getMonthPercent(
            item.steps,
            date,
          )
          const reached =
            percent >= 100

          return (
            <View
              key={item.date}
              style={styles.statItem}
            >
              <View style={styles.statMainRow}>
                <Text style={styles.dayName}>
                  {formatters.formatDate(date, {
                    month: 'long',
                  })}
                </Text>

                <View style={styles.stepsStatus}>
                  <Text style={styles.stepsValue}>
                    {formatSteps(item.steps, formatters)}
                  </Text>

                  <View
                    style={[
                      styles.statusCircle,
                      reached
                        ? styles.statusCircleSuccess
                        : styles.statusCircleFailure,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusIcon,
                        reached
                          ? styles.statusIconSuccess
                          : styles.statusIconFailure,
                      ]}
                    >
                      {reached ? '✓' : '✕'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.statSubRow}>
                <Text style={styles.dateText}>
                  {date.getFullYear()}
                </Text>

                <Text style={styles.percentText}>
                  {t('stats.percent', {
                    percent: formatters.formatNumber(percent),
                  })}
                </Text>
              </View>
            </View>
          )
        })}
    </View>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    sourcesLink: {
      marginTop: 16,
      alignItems: 'center',
      gap: 2,
    },

    sourcesText: {
      fontSize: 13,
      color: c.textSecondary,
    },

    sourcesAction: {
      fontSize: 14,
      fontWeight: '600',
      color: c.primary,
    },

    container: {
      flex: 1,
      backgroundColor: c.background,
    },

    content: {
      padding: 20,
      paddingBottom: 40,
    },

    periodSelector: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderRadius: 10,
      padding: 3,
      marginBottom: 24,
    },

    periodButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 9,
      borderRadius: 8,
    },

    periodButtonActive: {
      backgroundColor: c.card,
      shadowColor: c.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 3,
      shadowOffset: {
        width: 0,
        height: 1,
      },
      elevation: 2,
    },

    periodButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: c.textSecondary,
    },

    periodButtonTextActive: {
      color: c.text,
      fontWeight: '700',
    },


    metricSelector: {
      flexDirection: 'row',
      alignSelf: 'center',
      backgroundColor: c.surface,
      borderRadius: 10,
      padding: 3,
      marginBottom: 20,
    },

    metricButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
      paddingHorizontal: 16,
      borderRadius: 8,
      // Transparent when not selected: no shift on selection.
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },

    metricButtonText: {
      fontSize: 13,
      fontWeight: '500',
      color: c.textSecondary,
    },

    totalContainer: {
      alignItems: 'center',
      marginBottom: 10,
    },

    totalValue: {
      fontSize: 32,
      fontWeight: '700',
      color: c.text,
    },

    totalLabel: {
      fontSize: 14,
      color: c.textSecondary,
      marginTop: 2,
    },

    chartContainer: {
      width: '100%',
      marginBottom: 18,
    },

    loading: {
      height: 250,
      alignItems: 'center',
      justifyContent: 'center',
    },

    errorContainer: {
      alignItems: 'center',
      paddingVertical: 50,
    },

    errorText: {
      color: c.danger,
      textAlign: 'center',
      marginBottom: 15,
    },

    retryButton: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: c.primary,
    },

    retryText: {
      color: c.onPrimary,
      fontWeight: '600',
    },

    statsList: {
      marginTop: 4,
    },

    statItem: {
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },

    statMainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    dayName: {
      flex: 1,
      fontSize: 16,
      fontWeight: '500',
      color: c.text,
      textTransform: 'capitalize',
    },

    stepsStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    stepsValue: {
      fontSize: 16,
      fontWeight: '600',
      color: c.text,
      minWidth: 70,
      textAlign: 'right',
    },

    statusCircle: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
    },

    statusCircleSuccess: {
      borderColor: c.success,
      backgroundColor: c.successSoft,
    },

    statusCircleFailure: {
      borderColor: c.danger,
      backgroundColor: c.dangerSoft,
    },

    statusIcon: {
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 16,
    },

    statusIconSuccess: {
      color: c.success,
    },

    statusIconFailure: {
      color: c.danger,
    },

    statSubRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 2,
    },

    dateText: {
      fontSize: 12,
      color: c.textMuted,
      textTransform: 'capitalize',
    },

    percentText: {
      fontSize: 12,
      color: c.textMuted,
    },
  })