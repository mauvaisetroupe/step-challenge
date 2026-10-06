import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import UserBadge from '@/components/UserBadge'
import { useFormatters } from '@/i18n'
import type { WeekRank } from '@/services/insights'
import { useThemedStyles, type Colors } from '@/theme'

type Props = {
  rank: WeekRank
}

// Room on each side, so that badges and names are not cut.
const SIDE = 22
// Same size for everyone; my badge stands out by its blue ring.
const BADGE_SIZE = 30
const LINE_Y = 40

/**
 * This week's leaderboard on a line: only the last (left end), me and
 * the first (right end), so that it stays readable (two badges when I am
 * first or last). I am placed between them according to my steps. Names
 * above the badges, steps below. The gap to the friend just ahead is in
 * the sentence under the track.
 */
export default function WeekTrack({ rank }: Props) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const { formatNumber } = useFormatters()
  const [width, setWidth] = useState(0)

  const steps = rank.people.map((person) => person.steps)
  const min = Math.min(...steps)
  const max = Math.max(...steps)

  // The last at the left end, the first at the right end; everyone tied:
  // in the middle.
  const fraction = (value: number) =>
    max === min ? 0.5 : (value - min) / (max - min)
  const toPixels = (value: number) =>
    SIDE + fraction(value) * (width - 2 * SIDE)

  const me = rank.people.find((person) => person.isMe)
  const last = rank.people[0]
  const leader = rank.people[rank.people.length - 1]

  // Unique people shown; me last, so that my badge is drawn on top.
  const shown = [last, leader]
    .filter((person) => person && !person.isMe)
    .filter((person, index, list) => list.indexOf(person) === index)
  const ordered = [...shown, ...(me ? [me] : [])]

  return (
    <View
      style={styles.container}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {width > 0 && (
        <>
          <View
            style={[styles.line, { left: SIDE, width: width - 2 * SIDE }]}
          />

          {ordered.map((person) => {
            const size = BADGE_SIZE
            const x = toPixels(person.steps)
            const label = labelPosition(x, width)

            return (
              <View key={person.id}>
                <View
                  style={[
                    styles.badge,
                    person.isMe && styles.badgeMe,
                    { left: x - size / 2 - 2, top: LINE_Y - size / 2 - 2 },
                  ]}
                >
                  <UserBadge userId={person.id} name={person.name} size={size} />
                </View>

                <Text
                  style={[
                    styles.name,
                    person.isMe && styles.nameMe,
                    label,
                  ]}
                  numberOfLines={1}
                >
                  {person.isMe ? t('home.weekRank.you') : person.name}
                </Text>

                <Text
                  style={[
                    styles.steps,
                    person.isMe && styles.stepsMe,
                    label,
                  ]}
                  numberOfLines={1}
                >
                  {formatNumber(person.steps)}
                </Text>
              </View>
            )
          })}
        </>
      )}
    </View>
  )
}

const LABEL_WIDTH = 90

/**
 * Texts are centered on their badge, except near the ends of the track,
 * where they are aligned inwards so that a long name stays in the card.
 */
function labelPosition(x: number, width: number) {
  if (x - LABEL_WIDTH / 2 < 0) {
    return { left: 0, textAlign: 'left' as const }
  }

  if (x + LABEL_WIDTH / 2 > width) {
    return { left: width - LABEL_WIDTH, textAlign: 'right' as const }
  }

  return { left: x - LABEL_WIDTH / 2 }
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      height: 88,
      marginTop: 6,
      marginBottom: 4,
    },

    line: {
      position: 'absolute',
      top: LINE_Y - 2,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.surfaceAlt,
    },


    badge: {
      position: 'absolute',
      padding: 2,
      borderRadius: 999,
      backgroundColor: c.surface,
    },

    badgeMe: {
      backgroundColor: c.primary,
    },

    // Names above the badges, steps below.
    name: {
      position: 'absolute',
      top: LINE_Y - BADGE_SIZE / 2 - 22,
      width: LABEL_WIDTH,
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '600',
      color: c.textSecondary,
    },

    nameMe: {
      fontWeight: '800',
      color: c.primary,
    },

    steps: {
      position: 'absolute',
      top: LINE_Y + BADGE_SIZE / 2 + 4,
      width: LABEL_WIDTH,
      textAlign: 'center',
      fontSize: 12,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
    },

    stepsMe: {
      fontWeight: '700',
      color: c.text,
    },
  })
