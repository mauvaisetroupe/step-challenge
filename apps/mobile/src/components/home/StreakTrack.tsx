import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useFormatters } from '@/i18n'
import type { StreakTrack as Track } from '@/services/insights'
import { useThemedStyles, type Colors } from '@/theme'

type Props = {
  track: Track
  /** Current streak, in days. */
  current: number
  /** Whether today already counts: otherwise the marker is outlined. */
  includesToday: boolean
  /** Best streak: a trophy marks it when it falls on the visible part. */
  best: number
}

// Room on each side for the circles, so that they are not cut.
const SIDE = 18
const MILESTONE_SIZE = 30
const CURRENT_SIZE = 36
const LINE_Y = 22

/**
 * Streak milestones on a line: the last ones reached (🔥), my position,
 * and the next one, greyed. Milestones are evenly spaced; my position is
 * placed proportionally between the last one reached and the next.
 */
export default function StreakTrack({
  track,
  current,
  includesToday,
  best,
}: Props) {
  const styles = useThemedStyles(createStyles)
  const { formatNumber } = useFormatters()
  const [width, setWidth] = useState(0)

  // Milestones shown: the ones reached (or 0 when none) and the next one.
  const stops = [...(track.reached.length > 0 ? track.reached : [0]), track.next]
  const step = 1 / (stops.length - 1)
  const lastReached = stops[stops.length - 2]

  /** Horizontal position (0 to 1) of a number of days between two stops. */
  const position = (days: number) =>
    (stops.length - 2 +
      (days - lastReached) / (track.next - lastReached)) *
    step

  const toPixels = (fraction: number) => SIDE + fraction * (width - 2 * SIDE)
  const currentX = toPixels(position(current))
  const showRecord = best > current && best < track.next

  return (
    <View
      style={styles.container}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {width > 0 && (
        <>
          {/* Whole track, dashed: the road ahead. */}
          <View
            style={[
              styles.dashedLine,
              { left: SIDE, width: width - 2 * SIDE },
            ]}
          />
          {/* Road already walked. */}
          <View
            style={[styles.filledLine, { left: SIDE, width: currentX - SIDE }]}
          />

          {stops.map((days, index) => {
            const x = toPixels(index * step)
            const isNext = index === stops.length - 1
            const isStart = days === 0

            return (
              <View key={days}>
                {!isStart && (
                  <View
                    style={[
                      styles.milestone,
                      isNext && styles.milestoneNext,
                      { left: x - MILESTONE_SIZE / 2 },
                    ]}
                  >
                    <Text style={[styles.flame, isNext && styles.flameNext]}>
                      🔥
                    </Text>
                  </View>
                )}
                <Text
                  style={[styles.label, isNext && styles.labelNext, { left: x - 30 }]}
                >
                  {formatNumber(days)}
                </Text>
              </View>
            )
          })}

          {showRecord && (
            <Text
              style={[styles.record, { left: toPixels(position(best)) - 10 }]}
            >
              🏆
            </Text>
          )}

          <View
            style={[
              styles.current,
              !includesToday && styles.currentPending,
              { left: currentX - CURRENT_SIZE / 2 },
            ]}
          >
            <Text
              style={[
                styles.currentText,
                !includesToday && styles.currentTextPending,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatNumber(current)}
            </Text>
          </View>
        </>
      )}
    </View>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      height: 64,
      marginTop: 14,
    },

    dashedLine: {
      position: 'absolute',
      top: LINE_Y - 1,
      borderTopWidth: 2,
      borderStyle: 'dashed',
      borderColor: c.borderStrong,
    },

    filledLine: {
      position: 'absolute',
      top: LINE_Y - 2,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.primary,
    },

    milestone: {
      position: 'absolute',
      top: LINE_Y - MILESTONE_SIZE / 2,
      width: MILESTONE_SIZE,
      height: MILESTONE_SIZE,
      borderRadius: MILESTONE_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primarySoft,
      borderWidth: 2,
      borderColor: c.primary,
    },

    milestoneNext: {
      backgroundColor: c.surfaceAlt,
      borderColor: c.borderStrong,
      borderStyle: 'dashed',
    },

    flame: {
      fontSize: 14,
    },

    flameNext: {
      opacity: 0.35,
    },

    label: {
      position: 'absolute',
      top: LINE_Y + MILESTONE_SIZE / 2 + 4,
      width: 60,
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '600',
      color: c.textSecondary,
    },

    labelNext: {
      color: c.textMuted,
    },

    record: {
      position: 'absolute',
      top: LINE_Y - 30,
      fontSize: 14,
    },

    current: {
      position: 'absolute',
      top: LINE_Y - CURRENT_SIZE / 2,
      width: CURRENT_SIZE,
      height: CURRENT_SIZE,
      borderRadius: CURRENT_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
      backgroundColor: c.primary,
      borderWidth: 3,
      borderColor: c.surface,
    },

    currentPending: {
      backgroundColor: c.surface,
      borderColor: c.primary,
      borderStyle: 'dashed',
    },

    currentText: {
      fontSize: 13,
      fontWeight: '800',
      color: c.onPrimary,
    },

    currentTextPending: {
      color: c.primary,
    },
  })
