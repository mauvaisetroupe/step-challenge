import { useTranslation } from 'react-i18next'
import { StyleSheet, Text } from 'react-native'

import { useFormatters } from '@/i18n'
import type { WeekRank } from '@/services/insights'
import { useThemedStyles, type Colors } from '@/theme'

import HomeCard, { CardText } from './HomeCard'
import WeekNeighbours from './WeekNeighbours'

const MEDALS = ['🥇', '🥈', '🥉']

type Props = {
  rank: WeekRank
  /** The result can still change (steps of Sunday evening still coming). */
  provisional: boolean
  onOpenLeaderboard: () => void
}

/**
 * How last week ended, at the start of the new one: whoever did not look
 * on Sunday evening learns their final rank and who won.
 */
export default function LastWeekCard({
  rank,
  provisional,
  onOpenLeaderboard,
}: Props) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const { formatNumber } = useFormatters()

  const title = t('home.lastWeek.titleRank', {
    rank: t('home.weekRank.rank', { count: rank.rank, ordinal: true }),
    total: rank.total,
  })
  const winner = rank.people[0]
  const me = rank.people.find((person) => person.isMe)

  return (
    <HomeCard
      icon={MEDALS[rank.rank - 1] ?? '🏁'}
      title={title}
      onPress={onOpenLeaderboard}
    >
      <WeekNeighbours rank={rank} />

      {rank.rank === 1 && me ? (
        <CardText
          style={styles.text}
          text={t('home.lastWeek.won', {
            count: me.steps,
            skipInterpolation: true,
          })}
          values={{ steps: formatNumber(me.steps) }}
        />
      ) : (
        <CardText
          style={styles.text}
          text={t('home.lastWeek.winner', {
            count: winner.steps,
            skipInterpolation: true,
          })}
          values={{ steps: formatNumber(winner.steps), name: winner.name }}
        />
      )}

      {provisional && (
        <Text style={styles.provisional}>{t('leaderboard.provisional')}</Text>
      )}
    </HomeCard>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    text: {
      fontSize: 16,
      lineHeight: 23,
      color: c.textSecondary,
    },

    provisional: {
      marginTop: 8,
      fontSize: 13,
      color: c.textMuted,
    },
  })
