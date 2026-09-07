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
import Svg, {
  Circle,
  Line,
  Polyline,
  Rect,
  Text as SvgText,
} from 'react-native-svg'

import {
  aggregateGroupByDuration,
  aggregateGroupByPeriod,
  initialize,
  requestPermission,
} from 'react-native-health-connect'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { getSteps } from '../../api/steps'

const USER_ID_KEY = '@step-challenge/user-id-v2'
const DAILY_GOAL = 10_000

type Period = '1d' | '7d' | '30d' | '1y'

type ChartPoint = {
  label: string
  value: number
}

type DayStat = {
  date: string
  steps: number
}

type MonthStat = {
  date: string
  steps: number
}

const PERIODS: { key: Period; label: string }[] = [
  { key: '1d', label: '1j' },
  { key: '7d', label: '7j' },
  { key: '30d', label: '30j' },
  { key: '1y', label: '1a' },
]

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

function formatNumber(value: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(value))
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })
}

function formatMonth(date: Date) {
  return date.toLocaleDateString('fr-FR', {
    month: 'short',
  })
}

function formatWeekDay(date: Date) {
  return date.toLocaleDateString('fr-FR', {
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

async function getHealthConnectMonthlyStats(
  startDate: Date,
  endDate: Date,
): Promise<MonthStat[]> {
  const result = await aggregateGroupByPeriod({
    recordType: 'Steps',
    timeRangeFilter: {
      operator: 'between',
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    },
      timeRangeSlicer: {
        period: 'MONTHS',
        length: 1,
      },
  })

  const stats = new Map<string, number>()

  for (const bucket of result) {
    const date = new Date(bucket.startTime)
    const key = `${date.getFullYear()}-${String(
      date.getMonth() + 1,
    ).padStart(2, '0')}`

    stats.set(
      key,
      Number(bucket.result?.COUNT_TOTAL ?? 0),
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

async function getHealthConnectIntradayStats(
  startDate: Date,
  endDate: Date,
): Promise<ChartPoint[]> {
  const result = await aggregateGroupByDuration({
    recordType: 'Steps',
    timeRangeFilter: {
      operator: 'between',
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    },
    timeRangeSlicer: {
      duration: 'HOURS',
      length: 1,
    },
  })

  return result.map((bucket) => {
    const date = new Date(bucket.startTime)

    return {
      label: date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
      }),
      value: Number(bucket.result?.COUNT_TOTAL ?? 0),
    }
  })
}

async function getWebDailyStats(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<DayStat[]> {
  const data = await getSteps(userId)

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

async function getWebMonthlyStats(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<MonthStat[]> {
  const data = await getSteps(userId)

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
  const [period, setPeriod] = useState<Period>('7d')
  const [dailyStats, setDailyStats] = useState<DayStat[]>([])
  const [monthlyStats, setMonthlyStats] = useState<MonthStat[]>([])
  const [intradayStats, setIntradayStats] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const now = new Date()

      if (Platform.OS === 'web') {
        const userId = await AsyncStorage.getItem(USER_ID_KEY)

        if (!userId) {
          throw new Error('Utilisateur introuvable')
        }

        if (period === '7d' || period === '30d') {
          const days = period === '7d' ? 7 : 30
          const startDate = getStartOfDay(getDaysAgo(now, days - 1))
          const endDate = new Date(now)
          endDate.setDate(endDate.getDate() + 1)
          endDate.setHours(0, 0, 0, 0)

          const stats = await getWebDailyStats(
            userId,
            startDate,
            endDate,
          )

          setDailyStats(stats)
          setMonthlyStats([])
          setIntradayStats([])

          return
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

          const stats = await getWebMonthlyStats(
            userId,
            startDate,
            endDate,
          )

          setMonthlyStats(stats)
          setDailyStats([])
          setIntradayStats([])

          return
        }

        setDailyStats([])
        setMonthlyStats([])
        setIntradayStats([])

        return
      }

      await initialize()

      await requestPermission([
        {
          accessType: 'read',
          recordType: 'Steps',
        },
      ])

      if (period === '1d') {
        const startDate = getStartOfDay(now)

        const stats = await getHealthConnectIntradayStats(
          startDate,
          now,
        )

        setIntradayStats(stats)
        setDailyStats([])
        setMonthlyStats([])

        return
      }

      if (period === '7d' || period === '30d') {
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
        setIntradayStats([])

        return
      }

      const startDate = getMonthsAgo(
        getMonthStart(now),
        11,
      )
      const endDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1,
      )

      const stats = await getHealthConnectMonthlyStats(
        startDate,
        endDate,
      )

      setMonthlyStats(stats)
      setDailyStats([])
      setIntradayStats([])
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger les statistiques',
      )
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const totalSteps = useMemo(() => {
    if (period === '1d') {
      return intradayStats.reduce(
        (total, item) => total + item.value,
        0,
      )
    }

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
    intradayStats,
  ])

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>Statistiques</Text>

      <View style={styles.periodSelector}>
        {PERIODS.map((item) => (
          <Pressable
            key={item.key}
            style={[
              styles.periodButton,
              period === item.key &&
                styles.periodButtonActive,
            ]}
            onPress={() => setPeriod(item.key)}
          >
            <Text
              style={[
                styles.periodButtonText,
                period === item.key &&
                  styles.periodButtonTextActive,
              ]}
            >
              {item.label}
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
              Réessayer
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.totalContainer}>
            <Text style={styles.totalValue}>
              {formatNumber(totalSteps)}
            </Text>

            <Text style={styles.totalLabel}>
              pas
            </Text>
          </View>

          <View style={styles.chartContainer}>
            {period === '1d' ? (
              <IntradayChart data={intradayStats} />
            ) : period === '1y' ? (
              <BarChart
                data={monthlyStats.map((item) => ({
                  label: formatMonth(
                    parseDateKey(item.date),
                  ),
                  value: item.steps,
                }))}
              />
            ) : (
              <BarChart
                data={dailyStats.map((item) => ({
                  label: formatShortDate(
                    parseDateKey(item.date),
                  ),
                  value: item.steps,
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
    </ScrollView>
  )
}

function DailyStatsList({
  stats,
}: {
  stats: DayStat[]
}) {
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
                  {formatWeekDay(date)}
                </Text>

                <View style={styles.stepsStatus}>
                  <Text style={styles.stepsValue}>
                    {formatNumber(item.steps)}
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
                  {formatShortDate(date)}
                </Text>

                <Text style={styles.percentText}>
                  {percent} %
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
                  {date.toLocaleDateString('fr-FR', {
                    month: 'long',
                  })}
                </Text>

                <View style={styles.stepsStatus}>
                  <Text style={styles.stepsValue}>
                    {formatNumber(item.steps)}
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
                  {percent} %
                </Text>
              </View>
            </View>
          )
        })}
    </View>
  )
}

function BarChart({
  data,
}: {
  data: ChartPoint[]
}) {
  if (data.length === 0) {
    return (
      <View style={styles.emptyChart}>
        <Text style={styles.emptyText}>
          Aucune donnée
        </Text>
      </View>
    )
  }

  const width = 340
  const height = 220
  const paddingLeft = 40
  const paddingRight = 10
  const paddingTop = 20
  const paddingBottom = 35

  const chartWidth =
    width - paddingLeft - paddingRight

  const chartHeight =
    height - paddingTop - paddingBottom

  const maxValue = Math.max(
    DAILY_GOAL,
    ...data.map((item) => item.value),
  )

  const barWidth = Math.max(
    4,
    (chartWidth / data.length) * 0.65,
  )

  const gap =
    chartWidth / data.length

  return (
    <Svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <Line
        x1={paddingLeft}
        y1={paddingTop + chartHeight}
        x2={width - paddingRight}
        y2={paddingTop + chartHeight}
        stroke="#d1d5db"
        strokeWidth={1}
      />

      {data.map((item, index) => {
        const barHeight =
          (item.value / maxValue) * chartHeight

        const x =
          paddingLeft +
          index * gap +
          (gap - barWidth) / 2

        const y =
          paddingTop +
          chartHeight -
          barHeight

        return (
          <React.Fragment key={`${item.label}-${index}`}>
            <Rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={3}
              fill="#111827"
            />

            {(data.length <= 7 ||
              index % Math.ceil(data.length / 7) ===
                0) && (
              <SvgText
                x={x + barWidth / 2}
                y={height - 10}
                fontSize={9}
                fill="#6b7280"
                textAnchor="middle"
              >
                {item.label}
              </SvgText>
            )}
          </React.Fragment>
        )
      })}
    </Svg>
  )
}

function IntradayChart({
  data,
}: {
  data: ChartPoint[]
}) {
  if (data.length === 0) {
    return (
      <View style={styles.emptyChart}>
        <Text style={styles.emptyText}>
          Aucune donnée aujourd'hui
        </Text>
      </View>
    )
  }

  // Transforme les pas horaires en cumul sur la journée
  let cumulative = 0

  const cumulativeData = data.map((item) => {
    cumulative += item.value

    return {
      label: item.label,
      value: cumulative,
    }
  })

  const width = 340
  const height = 220
  const paddingLeft = 40
  const paddingRight = 10
  const paddingTop = 20
  const paddingBottom = 35

  const chartWidth =
    width - paddingLeft - paddingRight

  const chartHeight =
    height - paddingTop - paddingBottom

  const maxValue = Math.max(
    DAILY_GOAL,
    ...cumulativeData.map((item) => item.value),
  )

  const points = cumulativeData
    .map((item, index) => {
      const x =
        paddingLeft +
        (index / Math.max(cumulativeData.length - 1, 1)) *
          chartWidth

      const y =
        paddingTop +
        chartHeight -
        (item.value / maxValue) * chartHeight

      return `${x},${y}`
    })
    .join(' ')

  return (
    <Svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Ligne objectif 10 000 */}
      <Line
        x1={paddingLeft}
        y1={
          paddingTop +
          chartHeight -
          (DAILY_GOAL / maxValue) * chartHeight
        }
        x2={width - paddingRight}
        y2={
          paddingTop +
          chartHeight -
          (DAILY_GOAL / maxValue) * chartHeight
        }
        stroke="#d1d5db"
        strokeWidth={1}
        strokeDasharray="4 4"
      />

      {/* Axe horizontal */}
      <Line
        x1={paddingLeft}
        y1={paddingTop + chartHeight}
        x2={width - paddingRight}
        y2={paddingTop + chartHeight}
        stroke="#d1d5db"
        strokeWidth={1}
      />

      {/* Courbe cumulative */}
      <Polyline
        points={points}
        fill="none"
        stroke="#111827"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Points */}
      {cumulativeData.map((item, index) => {
        const x =
          paddingLeft +
          (index / Math.max(cumulativeData.length - 1, 1)) *
            chartWidth

        const y =
          paddingTop +
          chartHeight -
          (item.value / maxValue) * chartHeight

        return (
          <Circle
            key={`${item.label}-${index}`}
            cx={x}
            cy={y}
            r={2.5}
            fill="#111827"
          />
        )
      })}

      {/* Heures */}
      {cumulativeData.map((item, index) => {
        if (
          index !== 0 &&
          index !== cumulativeData.length - 1 &&
          index % 4 !== 0
        ) {
          return null
        }

        const x =
          paddingLeft +
          (index / Math.max(cumulativeData.length - 1, 1)) *
            chartWidth

        return (
          <SvgText
            key={`label-${item.label}-${index}`}
            x={x}
            y={height - 10}
            fontSize={9}
            fill="#6b7280"
            textAnchor="middle"
          >
            {item.label}
          </SvgText>
        )
      })}
    </Svg>
  )
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
  },

  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
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
    backgroundColor: '#fff',
    shadowColor: '#000',
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
    color: '#6b7280',
  },

  periodButtonTextActive: {
    color: '#111827',
    fontWeight: '700',
  },

  totalContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },

  totalValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
  },

  totalLabel: {
    fontSize: 14,
    color: '#6b7280',
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
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 15,
  },

  retryButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#111827',
  },

  retryText: {
    color: '#fff',
    fontWeight: '600',
  },

  emptyChart: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyText: {
    color: '#9ca3af',
  },

  statsList: {
    marginTop: 4,
  },

  statItem: {
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
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
    color: '#111827',
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
    color: '#111827',
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
    borderColor: '#16a34a',
    backgroundColor: '#dcfce7',
  },

  statusCircleFailure: {
    borderColor: '#dc2626',
    backgroundColor: '#fee2e2',
  },

  statusIcon: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 16,
  },

  statusIconSuccess: {
    color: '#16a34a',
  },

  statusIconFailure: {
    color: '#dc2626',
  },

  statSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },

  dateText: {
    fontSize: 12,
    color: '#9ca3af',
    textTransform: 'capitalize',
  },

  percentText: {
    fontSize: 12,
    color: '#9ca3af',
  },
})