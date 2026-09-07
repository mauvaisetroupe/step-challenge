import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import {
  aggregateGroupByDuration,
  aggregateGroupByPeriod,
  initialize,
  requestPermission,
} from 'react-native-health-connect'
import Svg, {
  Circle,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg'

type Period = '1d' | '7d' | '30d' | '1y'

type ChartPoint = {
  date: Date
  steps: number
}

const PERIODS: Array<{ key: Period; label: string }> = [
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

function getLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getPeriodRange(period: Period) {
  const end = new Date()

  if (period === '1d') {
    return {
      start: getStartOfDay(end),
      end,
    }
  }

  const start = getStartOfDay(end)

  if (period === '7d') {
    start.setDate(start.getDate() - 6)
  } else if (period === '30d') {
    start.setDate(start.getDate() - 29)
  } else {
    start.setFullYear(start.getFullYear() - 1)
    start.setDate(start.getDate() + 1)
  }

  return {
    start,
    end,
  }
}

async function ensureHealthConnect() {
  const initialized = await initialize()

  if (!initialized) {
    throw new Error('Health Connect is not available')
  }

  await requestPermission([
    {
      accessType: 'read',
      recordType: 'Steps',
    },
  ])
}

async function getIntradayData(): Promise<ChartPoint[]> {
  const { start, end } = getPeriodRange('1d')

  const result = await aggregateGroupByDuration({
    recordType: 'Steps',
    timeRangeFilter: {
      operator: 'between',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    },
    timeRangeSlicer: {
      duration: 'HOURS',
      length: 1,
    },
  })

  return result.map((bucket) => ({
    date: new Date(bucket.startTime),
    steps: bucket.result.COUNT_TOTAL ?? 0,
  }))
}

async function getDailyData(days: 7 | 30): Promise<ChartPoint[]> {
  const period: Period = days === 7 ? '7d' : '30d'
  const { start, end } = getPeriodRange(period)

  const result = await aggregateGroupByPeriod({
    recordType: 'Steps',
    timeRangeFilter: {
      operator: 'between',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    },
    timeRangeSlicer: {
      period: 'DAYS',
      length: 1,
    },
  })

  return result.map((bucket) => ({
    date: new Date(bucket.startTime),
    steps: bucket.result.COUNT_TOTAL ?? 0,
  }))
}

async function getMonthlyData(): Promise<ChartPoint[]> {
  const { start, end } = getPeriodRange('1y')

  const result = await aggregateGroupByPeriod({
    recordType: 'Steps',
    timeRangeFilter: {
      operator: 'between',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    },
    timeRangeSlicer: {
      period: 'MONTHS',
      length: 1,
    },
  })

  return result.map((bucket) => ({
    date: new Date(bucket.startTime),
    steps: bucket.result.COUNT_TOTAL ?? 0,
  }))
}

export default function StatsScreen() {
  const [period, setPeriod] = useState<Period>('1d')
  const [data, setData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      await ensureHealthConnect()

      let result: ChartPoint[]

      switch (period) {
        case '1d':
          result = await getIntradayData()
          break

        case '7d':
          result = await getDailyData(7)
          break

        case '30d':
          result = await getDailyData(30)
          break

        case '1y':
          result = await getMonthlyData()
          break
      }

      setData(result)
    } catch (err) {
      console.error('Failed to load statistics', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load statistics',
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
      return data.length > 0
        ? data[data.length - 1].steps
        : 0
    }

    return data.reduce((total, point) => total + point.steps, 0)
  }, [data, period])

  const screenWidth = Dimensions.get('window').width
  const chartWidth = Math.max(screenWidth - 48, 300)
  const chartHeight = 250

  const graphLeft = 48
  const graphRight = chartWidth - 12
  const graphTop = 20
  const graphBottom = chartHeight - 40

  const graphWidth = graphRight - graphLeft
  const graphHeight = graphBottom - graphTop

  const maxSteps = Math.max(
    ...data.map((point) => point.steps),
    1,
  )

  const intradayPoints = data.map((point) => {
    const startOfDay = getStartOfDay(new Date())
    const endOfDay = new Date(startOfDay)
    endOfDay.setDate(endOfDay.getDate() + 1)

    const elapsed =
      point.date.getTime() - startOfDay.getTime()

    const duration =
      endOfDay.getTime() - startOfDay.getTime()

    const x =
      graphLeft +
      Math.max(0, Math.min(1, elapsed / duration)) *
        graphWidth

    const y =
      graphBottom -
      (point.steps / maxSteps) * graphHeight

    return {
      ...point,
      x,
      y,
    }
  })

  const intradayPath =
    intradayPoints.length > 0
      ? intradayPoints
          .map(
            (point, index) =>
              `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`,
          )
          .join(' ')
      : ''

  const barWidth =
    data.length > 0
      ? Math.max(
          4,
          Math.min(24, (graphWidth / data.length) * 0.6),
        )
      : 0

  const bars = data.map((point, index) => {
    const slotWidth = graphWidth / Math.max(data.length, 1)

    const x =
      graphLeft +
      index * slotWidth +
      (slotWidth - barWidth) / 2

    const height =
      (point.steps / maxSteps) * graphHeight

    const y = graphBottom - height

    return {
      ...point,
      x,
      y,
      height,
    }
  })

  const gridValues = [0, 0.25, 0.5, 0.75, 1]

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>Stats</Text>

      <View style={styles.periodSelector}>
        {PERIODS.map((item) => {
          const active = item.key === period

          return (
            <View
              key={item.key}
              style={[
                styles.period,
                active && styles.periodActive,
              ]}
              onTouchEnd={() => setPeriod(item.key)}
            >
              <Text
                style={[
                  styles.periodText,
                  active && styles.periodActiveText,
                ]}
              >
                {item.label}
              </Text>
            </View>
          )
        })}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>
              {period === '1d'
                ? "Aujourd'hui"
                : period === '7d'
                  ? '7 derniers jours'
                  : period === '30d'
                    ? '30 derniers jours'
                    : '12 derniers mois'}
            </Text>

            {!loading && !error && (
              <Text style={styles.total}>
                {totalSteps.toLocaleString('fr-FR')}
                <Text style={styles.totalLabel}> pas</Text>
              </Text>
            )}
          </View>
        </View>

        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" />
          </View>
        )}

        {!loading && error && (
          <View style={styles.empty}>
            <Text style={styles.error}>{error}</Text>
          </View>
        )}

        {!loading && !error && data.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Pas encore de données
            </Text>
          </View>
        )}

        {!loading && !error && data.length > 0 && (
          <View style={styles.chartContainer}>
            <Svg width={chartWidth} height={chartHeight}>
              {gridValues.map((value) => {
                const y =
                  graphBottom - value * graphHeight

                const label = Math.round(
                  maxSteps * value,
                ).toLocaleString('fr-FR')

                return (
                  <React.Fragment key={value}>
                    <Line
                      x1={graphLeft}
                      y1={y}
                      x2={graphRight}
                      y2={y}
                      stroke="#E5E7EB"
                      strokeWidth="1"
                    />

                    <SvgText
                      x={graphLeft - 8}
                      y={y + 4}
                      fontSize="10"
                      fill="#9CA3AF"
                      textAnchor="end"
                    >
                      {label}
                    </SvgText>
                  </React.Fragment>
                )
              })}

              {period === '1d' && (
                <>
                  {intradayPath && (
                    <Path
                      d={intradayPath}
                      fill="none"
                      stroke="#208AEF"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {intradayPoints.map((point, index) => (
                    <Circle
                      key={`${point.date.toISOString()}-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r="4"
                      fill="#208AEF"
                    />
                  ))}

                  {[0, 6, 12, 18, 24].map((hour) => {
                    const x =
                      graphLeft +
                      (hour / 24) * graphWidth

                    return (
                      <SvgText
                        key={hour}
                        x={x}
                        y={chartHeight - 12}
                        fontSize="10"
                        fill="#9CA3AF"
                        textAnchor={
                          hour === 0
                            ? 'start'
                            : hour === 24
                              ? 'end'
                              : 'middle'
                        }
                      >
                        {String(hour).padStart(2, '0')}h
                      </SvgText>
                    )
                  })}
                </>
              )}

              {period !== '1d' && (
                <>
                  {bars.map((bar, index) => (
                    <Rect
                      key={`${bar.date.toISOString()}-${index}`}
                      x={bar.x}
                      y={bar.y}
                      width={barWidth}
                      height={bar.height}
                      rx="3"
                      fill="#208AEF"
                    />
                  ))}

                  {bars.map((bar, index) => {
                    let label = ''

                    if (period === '1y') {
                      label = bar.date.toLocaleDateString(
                        'fr-FR',
                        { month: 'short' },
                      )
                    } else {
                      label = bar.date.toLocaleDateString(
                        'fr-FR',
                        {
                          day: 'numeric',
                          month: 'short',
                        },
                      )
                    }

                    const showLabel =
                      period === '7d' ||
                      period === '30d'
                        ? index %
                            Math.max(
                              1,
                              Math.ceil(data.length / 6),
                            ) === 0
                        : index % 2 === 0

                    if (!showLabel) {
                      return null
                    }

                    return (
                      <SvgText
                        key={`label-${index}`}
                        x={bar.x + barWidth / 2}
                        y={chartHeight - 12}
                        fontSize="9"
                        fill="#9CA3AF"
                        textAnchor="middle"
                      >
                        {label}
                      </SvgText>
                    )
                  })}
                </>
              )}
            </Svg>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  content: {
    padding: 24,
    paddingBottom: 40,
  },

  title: {
    color: '#111827',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 20,
  },

  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    padding: 3,
    marginBottom: 20,
  },

  period: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
    borderRadius: 8,
  },

  periodActive: {
    backgroundColor: '#FFFFFF',
  },

  periodText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },

  periodActiveText: {
    color: '#111827',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },

  cardHeader: {
    marginBottom: 8,
  },

  cardTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '600',
  },

  total: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 6,
  },

  totalLabel: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '400',
  },

  chartContainer: {
    alignItems: 'center',
    marginTop: 8,
  },

  loading: {
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
  },

  empty: {
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  emptyText: {
    color: '#6B7280',
    fontSize: 15,
    textAlign: 'center',
  },

  error: {
    color: '#DC2626',
    fontSize: 15,
    textAlign: 'center',
  },
})