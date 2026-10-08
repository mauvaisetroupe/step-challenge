import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg'

import { useTheme, useThemedStyles, type Colors } from '@/theme'

export type ChartPoint = {
  label: string
  value: number
  /** Goal reached: full color bar; otherwise a lighter one. */
  reached: boolean
}

type Props = {
  data: ChartPoint[]
  /** The vertical axis goes at least up to the goal. */
  goal: number
  /** Dashed line at the goal (activity score). */
  showGoalLine?: boolean
  /** Message when there is nothing to show. */
  emptyMessage?: string
  /** Bar color: the steps blue by default. */
  color?: string
}

const WIDTH = 340
const HEIGHT = 220
const PADDING_LEFT = 40
const PADDING_RIGHT = 10
const PADDING_TOP = 20
const PADDING_BOTTOM = 35
const CHART_WIDTH = WIDTH - PADDING_LEFT - PADDING_RIGHT
const CHART_HEIGHT = HEIGHT - PADDING_TOP - PADDING_BOTTOM

/** Bars of the Stats views: steps per day or month, activity score. */
export default function BarChart({
  data,
  goal,
  showGoalLine = false,
  emptyMessage,
  color,
}: Props) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const { colors } = useTheme()

  if (data.length === 0) {
    return (
      <View style={styles.emptyChart}>
        <Text style={styles.emptyText}>
          {emptyMessage ?? t('stats.noData')}
        </Text>
      </View>
    )
  }

  const maxValue = Math.max(goal, ...data.map((item) => item.value))
  const barWidth = Math.max(2, (CHART_WIDTH / data.length) * 0.65)
  const gap = CHART_WIDTH / data.length
  const y = (value: number) =>
    PADDING_TOP + CHART_HEIGHT - (value / maxValue) * CHART_HEIGHT

  return (
    <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
      <Line
        x1={PADDING_LEFT}
        y1={PADDING_TOP + CHART_HEIGHT}
        x2={WIDTH - PADDING_RIGHT}
        y2={PADDING_TOP + CHART_HEIGHT}
        stroke={colors.borderStrong}
        strokeWidth={1}
      />

      {data.map((item, index) => {
        const barHeight = (item.value / maxValue) * CHART_HEIGHT
        const x = PADDING_LEFT + index * gap + (gap - barWidth) / 2

        return (
          <React.Fragment key={`${item.label}-${index}`}>
            <Rect
              x={x}
              y={y(item.value)}
              width={barWidth}
              height={barHeight}
              rx={Math.min(3, barWidth / 2)}
              // Goal reached: full color; otherwise a lighter one.
              fill={color ?? colors.primary}
              fillOpacity={item.reached ? 1 : 0.35}
            />

            {(data.length <= 7 ||
              index % Math.ceil(data.length / 7) === 0) && (
              <SvgText
                x={x + barWidth / 2}
                y={HEIGHT - 10}
                fontSize={9}
                fill={colors.textSecondary}
                textAnchor="middle"
              >
                {item.label}
              </SvgText>
            )}
          </React.Fragment>
        )
      })}

      {showGoalLine && (
        <>
          <Line
            x1={PADDING_LEFT}
            x2={WIDTH - PADDING_RIGHT}
            y1={y(goal)}
            y2={y(goal)}
            stroke={colors.text}
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          <SvgText
            x={PADDING_LEFT - 6}
            y={y(goal) + 3}
            fontSize={9}
            fill={colors.textSecondary}
            textAnchor="end"
          >
            {goal}
          </SvgText>
        </>
      )}
    </Svg>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    emptyChart: {
      height: HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },

    emptyText: {
      color: c.textMuted,
      textAlign: 'center',
    },
  })
