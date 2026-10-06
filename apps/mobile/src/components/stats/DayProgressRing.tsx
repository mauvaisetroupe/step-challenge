import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'

import { useFormatters } from '@/i18n'
import { useTheme, useThemedStyles, type Colors } from '@/theme'

type Props = {
  steps: number
  goal: number
}

const SIZE = 220
const STROKE = 16
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Today's steps as a ring: an arc proportional to steps / goal, in a
 * neutral color, that closes and turns blue once the goal is reached.
 */
export default function DayProgressRing({ steps, goal }: Props) {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const { t } = useTranslation()
  const { formatNumber } = useFormatters()

  const reached = steps >= goal
  const progress = Math.min(1, Math.max(0, steps / goal))
  const percent = Math.round((steps / goal) * 100)
  const arcColor = reached ? colors.primary : colors.progress

  return (
    <View style={styles.container}>
      <View style={styles.ring}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={colors.track}
            strokeWidth={STROKE}
            fill="none"
          />

          {progress > 0 && (
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={arcColor}
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={`${CIRCUMFERENCE * progress} ${CIRCUMFERENCE}`}
              strokeLinecap={reached ? 'butt' : 'round'}
              // Starts at the top and turns clockwise.
              rotation={-90}
              origin={`${SIZE / 2}, ${SIZE / 2}`}
            />
          )}
        </Svg>

        <View style={styles.center} pointerEvents="none">
          <Text style={styles.steps} adjustsFontSizeToFit numberOfLines={1}>
            {formatNumber(Math.round(steps))}
          </Text>
          <Text style={styles.goal}>{formatNumber(goal)}</Text>
          {reached && <Text style={styles.check}>✓</Text>}
        </View>
      </View>

      <Text style={styles.percent}>
        {t('home.ring.percentOfGoal', { percent: formatNumber(percent) })}
      </Text>
    </View>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      marginBottom: 20,
    },

    ring: {
      width: SIZE,
      height: SIZE,
    },

    center: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: STROKE + 16,
    },

    steps: {
      fontSize: 44,
      fontWeight: '600',
      color: c.text,
    },

    goal: {
      marginTop: 2,
      fontSize: 22,
      color: c.textSecondary,
    },

    check: {
      marginTop: 4,
      fontSize: 22,
      fontWeight: '700',
      color: c.primary,
    },

    percent: {
      marginTop: 12,
      fontSize: 15,
      color: c.textSecondary,
    },
  })
