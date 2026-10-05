import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { WeekRank } from '@/services/insights'
import { useThemedStyles, type Colors } from '@/theme'

import HomeCard, { Strong } from './HomeCard'

type Props = {
  rank: WeekRank | null
  error: boolean
  onOpenLeaderboard: () => void
  onInviteFriends: () => void
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('fr-FR').format(value)
}

/** 1 → "1ᵉʳ", 3 → "3ᵉ". */
function ordinal(rank: number) {
  return rank === 1 ? '1ᵉʳ' : `${rank}ᵉ`
}

/**
 * My rank in this week's friends leaderboard, and how far the person
 * just ahead is (or my lead when I am first).
 */
export default function WeekRankCard({
  rank,
  error,
  onOpenLeaderboard,
  onInviteFriends,
}: Props) {
  const styles = useThemedStyles(createStyles)

  if (error || !rank) {
    return (
      <HomeCard icon="🏆" title="Cette semaine">
        <Text style={styles.text}>Classement indisponible pour le moment.</Text>
      </HomeCard>
    )
  }

  if (rank.total === 1) {
    return (
      <HomeCard icon="🏆" title="Cette semaine">
        <Text style={styles.text}>
          Le défi commence avec tes amis : invite-les pour comparer vos pas.
        </Text>

        <Pressable style={styles.button} onPress={onInviteFriends}>
          <Text style={styles.buttonText}>Inviter des amis</Text>
        </Pressable>
      </HomeCard>
    )
  }

  return (
    <HomeCard icon="🏆" title="Cette semaine" onPress={onOpenLeaderboard}>
      <View style={styles.rankRow}>
        <Text style={styles.rank}>{ordinal(rank.rank)}</Text>
        <Text style={styles.total}>sur {rank.total}</Text>
      </View>

      {rank.ahead ? (
        <Text style={styles.text}>
          Plus que <Strong>{formatNumber(rank.ahead.stepsToPass)} pas</Strong>{' '}
          pour dépasser <Strong>{rank.ahead.name}</Strong> 🏃
        </Text>
      ) : rank.behind && rank.behind.lead > 0 ? (
        <Text style={styles.text}>
          Tu es en tête, avec{' '}
          <Strong>{formatNumber(rank.behind.lead)} pas</Strong> d'avance sur{' '}
          <Strong>{rank.behind.name}</Strong> 🥇
        </Text>
      ) : rank.behind ? (
        <Text style={styles.text}>
          À égalité avec <Strong>{rank.behind.name}</Strong> : chaque pas
          compte ! 🤝
        </Text>
      ) : null}
    </HomeCard>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    rankRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
      marginBottom: 6,
    },

    rank: {
      fontSize: 40,
      fontWeight: '800',
      color: c.primary,
    },

    total: {
      fontSize: 18,
      fontWeight: '600',
      color: c.textSecondary,
    },

    text: {
      fontSize: 16,
      lineHeight: 23,
      color: c.textSecondary,
    },

    button: {
      marginTop: 14,
      minHeight: 44,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },

    buttonText: {
      fontSize: 15,
      fontWeight: '600',
      color: c.onPrimary,
    },
  })
