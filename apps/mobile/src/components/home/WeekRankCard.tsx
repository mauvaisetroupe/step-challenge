import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useFormatters } from '@/i18n'
import type { WeekRank } from '@/services/insights'
import { useThemedStyles, type Colors } from '@/theme'

import HomeCard, { CardText } from './HomeCard'

type Props = {
  rank: WeekRank | null
  error: boolean
  onOpenLeaderboard: () => void
  onInviteFriends: () => void
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
  const { t } = useTranslation()
  const { formatNumber } = useFormatters()
  const title = t('home.weekRank.title')

  if (error || !rank) {
    return (
      <HomeCard icon="🏆" title={title}>
        <Text style={styles.text}>{t('home.weekRank.unavailable')}</Text>
      </HomeCard>
    )
  }

  if (rank.total === 1) {
    return (
      <HomeCard icon="🏆" title={title}>
        <Text style={styles.text}>{t('home.weekRank.alone')}</Text>

        <Pressable style={styles.button} onPress={onInviteFriends}>
          <Text style={styles.buttonText}>{t('home.weekRank.invite')}</Text>
        </Pressable>
      </HomeCard>
    )
  }

  return (
    <HomeCard icon="🏆" title={title} onPress={onOpenLeaderboard}>
      <View style={styles.rankRow}>
        <Text style={styles.rank}>
          {t('home.weekRank.rank', { count: rank.rank, ordinal: true })}
        </Text>
        <Text style={styles.total}>
          {t('home.weekRank.total', { total: rank.total })}
        </Text>
      </View>

      {rank.ahead ? (
        <CardText
          style={styles.text}
          text={t('home.weekRank.toPass', {
            count: rank.ahead.stepsToPass,
            skipInterpolation: true,
          })}
          values={{
            steps: formatNumber(rank.ahead.stepsToPass),
            name: rank.ahead.name,
          }}
        />
      ) : rank.behind && rank.behind.lead > 0 ? (
        <CardText
          style={styles.text}
          text={t('home.weekRank.lead', {
            count: rank.behind.lead,
            skipInterpolation: true,
          })}
          values={{
            steps: formatNumber(rank.behind.lead),
            name: rank.behind.name,
          }}
        />
      ) : rank.behind ? (
        <CardText
          style={styles.text}
          text={t('home.weekRank.tie', { skipInterpolation: true })}
          values={{ name: rank.behind.name }}
        />
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
