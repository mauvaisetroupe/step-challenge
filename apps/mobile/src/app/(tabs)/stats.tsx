import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Svg, {
  Circle,
  Line,
  Path,
  Text as SvgText,
} from 'react-native-svg'

import { getStepSamples } from '../../api/steps'

type StepSample = {
  user_id: string
  recorded_at: string
  steps: number
}

const USER_ID_KEY = '@step-challenge/user-id-v2'

async function getUserId() {
  const userId = await AsyncStorage.getItem(USER_ID_KEY)

  if (!userId) {
    throw new Error('User profile not configured')
  }

  return userId
}

export default function StatsScreen() {
  const [samples, setSamples] = useState<StepSample[]>([])
  const [loading, setLoading] = useState(true)

  const loadSamples = useCallback(async () => {
    try {
      setLoading(true)

      const userId = await getUserId()
      const data = await getStepSamples(userId)

      setSamples(data)
    } catch (error) {
      console.error('Failed to load step samples', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSamples()
  }, [loadSamples])

  const screenWidth = Dimensions.get('window').width
  const chartWidth = Math.max(screenWidth - 48, 280)
  const chartHeight = 240

  const graphLeft = 42
  const graphRight = chartWidth - 12
  const graphTop = 20
  const graphBottom = chartHeight - 35

  const graphWidth = graphRight - graphLeft
  const graphHeight = graphBottom - graphTop

  const maxSteps = Math.max(
    ...samples.map((sample) => sample.steps),
    1,
  )

  const points = samples.map((sample, index) => {
    const x =
      samples.length === 1
        ? graphLeft
        : graphLeft +
          (index / (samples.length - 1)) * graphWidth

    const y =
      graphBottom -
      (sample.steps / maxSteps) * graphHeight

    return {
      x,
      y,
      sample,
    }
  })

  const path =
    points.length > 0
      ? points
          .map((point, index) => {
            return `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
          })
          .join(' ')
      : ''

  const lastSample = samples[samples.length - 1]

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>Stats</Text>

      <View style={styles.periodSelector}>
        <View style={[styles.period, styles.periodActive]}>
          <Text style={styles.periodActiveText}>1j</Text>
        </View>

        <View style={styles.period}>
          <Text style={styles.periodText}>7j</Text>
        </View>

        <View style={styles.period}>
          <Text style={styles.periodText}>4s</Text>
        </View>

        <View style={styles.period}>
          <Text style={styles.periodText}>1a</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Aujourd'hui</Text>

          {!loading && lastSample && (
            <View style={styles.totalContainer}>
              <Text style={styles.total}>
                {lastSample.steps.toLocaleString('fr-FR')}
              </Text>
              <Text style={styles.totalLabel}>pas</Text>
            </View>
          )}
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator />
          </View>
        ) : samples.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Pas encore de données aujourd'hui
            </Text>
          </View>
        ) : (
          <View style={styles.chartContainer}>
            <Svg
              width={chartWidth}
              height={chartHeight}
            >
              {[0, 0.25, 0.5, 0.75, 1].map((value) => {
                const y =
                  graphBottom - value * graphHeight

                const label = Math.round(
                  maxSteps * value,
                ).toLocaleString('fr-FR')

                return (
                  <View key={value}>
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
                  </View>
                )
              })}

              {path && (
                <Path
                  d={path}
                  fill="none"
                  stroke="#208AEF"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {points.map((point, index) => (
                <Circle
                  key={`${point.sample.recorded_at}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  fill="#208AEF"
                />
              ))}

              {points.length > 0 && (
                <>
                  <SvgText
                    x={graphLeft}
                    y={chartHeight - 8}
                    fontSize="10"
                    fill="#9CA3AF"
                    textAnchor="middle"
                  >
                    {new Date(
                      samples[0].recorded_at,
                    ).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </SvgText>

                  <SvgText
                    x={graphRight}
                    y={chartHeight - 8}
                    fontSize="10"
                    fill="#9CA3AF"
                    textAnchor="middle"
                  >
                    {new Date(
                      samples[samples.length - 1]
                        .recorded_at,
                    ).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </SvgText>
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
    backgroundColor: '#F8FAFC',
  },

  content: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },

  title: {
    color: '#111827',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 24,
  },

  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },

  period: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 9,
  },

  periodActive: {
    backgroundColor: '#FFFFFF',
  },

  periodText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '600',
  },

  periodActiveText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  cardTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
  },

  totalContainer: {
    alignItems: 'flex-end',
  },

  total: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '700',
  },

  totalLabel: {
    color: '#6B7280',
    fontSize: 12,
  },

  chartContainer: {
    alignItems: 'center',
  },

  loading: {
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },

  empty: {
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyText: {
    color: '#6B7280',
    fontSize: 15,
  },
})