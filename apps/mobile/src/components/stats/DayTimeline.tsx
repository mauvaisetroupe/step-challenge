import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import Svg, {
  Circle,
  Line,
  Polygon,
  Polyline,
  Text as SvgText,
} from 'react-native-svg'

import { getFormatLocale } from '@/i18n'
import { useTheme, useThemedStyles, type Colors } from '@/theme'

type Props = {
  /** Steps per hour since midnight, the last entry being the current hour. */
  hourlySteps: number[]
  goal: number
  /** Current time, to end the curve at the current minute. */
  now: Date
  /** Message shown when there is no hourly data. */
  emptyMessage: string
}

const WIDTH = 340
const HEIGHT = 210
const LEFT = 38
const RIGHT = 12
const TOP = 14
const BOTTOM = 30
const CHART_WIDTH = WIDTH - LEFT - RIGHT
const CHART_HEIGHT = HEIGHT - TOP - BOTTOM

const HOUR_LABELS = [0, 4, 8, 12, 16, 20, 24]

/** 3500 → "3,5k" in French, "3.5k" in English; 10000 → "10k". */
function formatThousands(value: number) {
  if (value === 0) {
    return '0'
  }

  const thousands = value / 1000

  return `${new Intl.NumberFormat(getFormatLocale(), {
    maximumFractionDigits: 1,
  }).format(thousands)}k`
}

/**
 * Cumulative steps over the day, from midnight to now, against the daily
 * goal (dashed line). A check mark shows when the goal was reached.
 */
export default function DayTimeline({
  hourlySteps,
  goal,
  now,
  emptyMessage,
}: Props) {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const { t } = useTranslation()

  if (hourlySteps.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    )
  }

  // Cumulative total at the end of each hour; the current hour ends now.
  const currentHour = now.getHours() + now.getMinutes() / 60
  const points: { hour: number; steps: number }[] = [{ hour: 0, steps: 0 }]
  let total = 0

  hourlySteps.forEach((steps, hour) => {
    total += steps
    points.push({
      hour: Math.min(hour + 1, Math.max(currentHour, hour)),
      steps: total,
    })
  })

  // Four equal intervals on the vertical axis, above both the goal and
  // the total.
  const top = Math.max(goal, total) * 1.15
  const step = Math.ceil(top / 4 / 500) * 500
  const maxValue = step * 4

  const x = (hour: number) => LEFT + (hour / 24) * CHART_WIDTH
  const y = (steps: number) => TOP + CHART_HEIGHT - (steps / maxValue) * CHART_HEIGHT

  const line = points.map((p) => `${x(p.hour)},${y(p.steps)}`).join(' ')
  const last = points[points.length - 1]
  const area = `${line} ${x(last.hour)},${y(0)} ${x(0)},${y(0)}`

  // First moment the cumulative total reaches the goal, interpolated
  // between two hours.
  let goalHour: number | null = null

  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1]
    const current = points[i]

    if (previous.steps < goal && current.steps >= goal) {
      const ratio = (goal - previous.steps) / (current.steps - previous.steps)
      goalHour = previous.hour + ratio * (current.hour - previous.hour)
      break
    }
  }

  return (
    <View>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {[1, 2, 3, 4].map((i) => (
          <Line
            key={`grid-${i}`}
            x1={LEFT}
            x2={WIDTH - RIGHT}
            y1={y(step * i)}
            y2={y(step * i)}
            stroke={colors.border}
            strokeWidth={1}
          />
        ))}

        {[0, 1, 2, 3, 4].map((i) => (
          <SvgText
            key={`y-${i}`}
            x={LEFT - 6}
            y={y(step * i) + 3}
            fontSize={9}
            fill={colors.textSecondary}
            textAnchor="end"
          >
            {formatThousands(step * i)}
          </SvgText>
        ))}

        <Polygon points={area} fill={colors.primary} fillOpacity={0.15} />

        <Polyline
          points={line}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <Line
          x1={LEFT}
          x2={WIDTH - RIGHT}
          y1={y(goal)}
          y2={y(goal)}
          stroke={colors.text}
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />

        <Line
          x1={LEFT}
          x2={WIDTH - RIGHT}
          y1={y(0)}
          y2={y(0)}
          stroke={colors.borderStrong}
          strokeWidth={1}
        />

        {goalHour !== null && (
          <>
            <Circle
              cx={x(goalHour)}
              cy={y(goal)}
              r={9}
              fill={colors.card}
              stroke={colors.primary}
              strokeWidth={2}
            />
            <SvgText
              x={x(goalHour)}
              y={y(goal) + 4}
              fontSize={11}
              fontWeight="700"
              fill={colors.primary}
              textAnchor="middle"
            >
              ✓
            </SvgText>
          </>
        )}

        {HOUR_LABELS.map((hour) => (
          <SvgText
            key={`x-${hour}`}
            x={x(hour)}
            y={HEIGHT - 10}
            fontSize={9}
            fill={colors.textSecondary}
            textAnchor="middle"
          >
            {String(hour % 24).padStart(2, '0')}
          </SvgText>
        ))}
      </Svg>

      <View style={styles.legend}>
        <View style={styles.legendDash} />
        <Text style={styles.legendText}>{t('stats.goal')}</Text>
      </View>
    </View>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    empty: {
      minHeight: 120,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },

    emptyText: {
      fontSize: 14,
      color: c.textMuted,
      textAlign: 'center',
    },

    legend: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 4,
    },

    legendDash: {
      width: 22,
      borderTopWidth: 2,
      borderStyle: 'dashed',
      borderColor: c.text,
    },

    legendText: {
      fontSize: 13,
      color: c.textSecondary,
    },
  })
