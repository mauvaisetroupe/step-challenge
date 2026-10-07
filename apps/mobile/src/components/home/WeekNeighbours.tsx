import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import UserBadge from '@/components/UserBadge'
import { useFormatters } from '@/i18n'
import { computeNeighbours, type WeekRank } from '@/services/insights'
import { useThemedStyles, type Colors } from '@/theme'

const MEDALS = ['🥇', '🥈', '🥉']

/**
 * The leaderboard around me: the friend just ahead, me and the friend
 * just behind, in the style of the leaderboard screen. Answers "who can
 * I catch?" and "who can catch me?".
 */
export default function WeekNeighbours({ rank }: { rank: WeekRank }) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const { formatNumber } = useFormatters()

  return (
    <View style={styles.list}>
      {computeNeighbours(rank).map((person) => (
        <View
          key={person.id}
          style={[styles.row, person.isMe && styles.rowMe]}
        >
          <Text
            style={person.position <= 3 ? styles.medal : styles.position}
          >
            {MEDALS[person.position - 1] ?? person.position}
          </Text>

          <UserBadge userId={person.id} name={person.name} size={30} />

          <Text
            style={[styles.name, person.isMe && styles.nameMe]}
            numberOfLines={1}
          >
            {person.isMe ? t('home.weekRank.you') : person.name}
          </Text>

          <Text style={[styles.steps, person.isMe && styles.stepsMe]}>
            {formatNumber(person.steps)}
          </Text>

          {/* Gap with me: "+2 300" ahead of me, "−1 850" behind. */}
          <Text
            style={[
              styles.difference,
              person.difference > 0 && styles.ahead,
            ]}
          >
            {person.isMe || person.difference === 0
              ? ''
              : `${person.difference > 0 ? '+' : '−'}${formatNumber(
                  Math.abs(person.difference),
                )}`}
          </Text>
        </View>
      ))}
    </View>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    list: {
      gap: 6,
      marginTop: 4,
      marginBottom: 12,
    },

    row: {
      minHeight: 46,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: c.surfaceAlt,
    },

    rowMe: {
      backgroundColor: c.primarySoft,
    },

    medal: {
      width: 26,
      textAlign: 'center',
      fontSize: 18,
    },

    position: {
      width: 26,
      textAlign: 'center',
      fontSize: 15,
      fontWeight: '700',
      color: c.textSecondary,
    },

    name: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
    },

    nameMe: {
      fontWeight: '800',
      color: c.primary,
    },

    steps: {
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
      fontVariant: ['tabular-nums'],
    },

    stepsMe: {
      fontWeight: '800',
    },

    difference: {
      width: 64,
      textAlign: 'right',
      fontSize: 13,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
    },

    ahead: {
      color: c.textSecondary,
      fontWeight: '600',
    },
  })
