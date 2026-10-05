import { StyleSheet, Text, View } from 'react-native'

import type { Streaks } from '@/services/insights'
import { useThemedStyles, type Colors } from '@/theme'

import HomeCard, { Strong } from './HomeCard'

type Props = {
  streaks: Streaks | null
  goal: number
  error: boolean
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('fr-FR').format(value)
}

function days(count: number) {
  return count > 1 ? 'jours' : 'jour'
}

/**
 * Consecutive days at the goal, and the record since the user joined
 * (the history kept by Step Challenge).
 */
export default function StreakCard({ streaks, goal, error }: Props) {
  const styles = useThemedStyles(createStyles)
  const goalText = `${formatNumber(goal)} pas`

  if (error || !streaks) {
    return (
      <HomeCard icon="🔥" title="Série">
        <Text style={styles.text}>Série indisponible pour le moment.</Text>
      </HomeCard>
    )
  }

  const isRecord = streaks.current >= 2 && streaks.current === streaks.best

  return (
    <HomeCard icon="🔥" title="Série">
      {streaks.current > 0 ? (
        <>
          <View style={styles.valueRow}>
            <Text style={styles.value}>{streaks.current}</Text>
            <Text style={styles.unit}>{days(streaks.current)} d'affilée</Text>
          </View>

          <Text style={styles.text}>au-dessus de {goalText}</Text>

          {!streaks.includesToday && (
            <Text style={styles.hint}>
              Atteins {goalText} aujourd'hui pour la prolonger.
            </Text>
          )}

          {isRecord && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>C'est ton record !</Text>
            </View>
          )}
        </>
      ) : (
        <>
          <Text style={styles.text}>Pas de série en cours.</Text>
          <Text style={styles.hint}>
            Atteins {goalText} aujourd'hui pour en lancer une.
          </Text>
        </>
      )}

      <View style={styles.separator} />

      <Text style={styles.text}>
        Record :{' '}
        {streaks.best > 0 ? (
          <Strong>
            {streaks.best} {days(streaks.best)}
          </Strong>
        ) : (
          <Strong>aucun jour à {goalText}</Strong>
        )}
      </Text>
      <Text style={styles.since}>depuis ton arrivée sur Step Challenge</Text>
    </HomeCard>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    valueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
    },

    value: {
      fontSize: 40,
      fontWeight: '800',
      color: c.primary,
    },

    unit: {
      fontSize: 18,
      fontWeight: '600',
      color: c.text,
    },

    text: {
      fontSize: 16,
      lineHeight: 23,
      color: c.textSecondary,
    },

    hint: {
      marginTop: 6,
      fontSize: 14,
      color: c.textMuted,
    },

    badge: {
      alignSelf: 'flex-start',
      marginTop: 10,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: c.primarySoft,
    },

    badgeText: {
      fontSize: 13,
      fontWeight: '700',
      color: c.primary,
    },

    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginVertical: 14,
    },

    since: {
      marginTop: 2,
      fontSize: 13,
      color: c.textMuted,
    },
  })
