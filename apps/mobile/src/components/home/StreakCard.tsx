import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { useFormatters } from '@/i18n'
import { computeStreakTrack, type Streaks } from '@/services/insights'
import { useThemedStyles, type Colors } from '@/theme'

import HomeCard, { CardText } from './HomeCard'
import StreakTrack from './StreakTrack'

type Props = {
  streaks: Streaks | null
  goal: number
  error: boolean
}

/**
 * Consecutive days at the goal, and the record since the user joined
 * (the history kept by Step Challenge).
 */
export default function StreakCard({ streaks, goal, error }: Props) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const { formatNumber } = useFormatters()
  const title = t('home.streak.title')
  const goalValues = { goal: formatNumber(goal) }

  if (error || !streaks) {
    return (
      <HomeCard icon="🔥" title={title}>
        <Text style={styles.text}>{t('home.streak.unavailable')}</Text>
      </HomeCard>
    )
  }

  const isRecord = streaks.current >= 2 && streaks.current === streaks.best
  const track = computeStreakTrack(streaks.current)
  const trackView = (
    <StreakTrack
      track={track}
      current={streaks.current}
      includesToday={streaks.includesToday}
      best={streaks.best}
    />
  )

  const streakTitle =
    streaks.current > 0
      ? t('home.streak.titleDays', {
          count: streaks.current,
          days: formatNumber(streaks.current),
        })
      : title

  return (
    <HomeCard icon="🔥" title={streakTitle}>
      {streaks.current > 0 ? (
        <>
          {trackView}

          {/* The track shows the next milestone; a sentence only when the
              streak is at stake today. */}
          {!streaks.includesToday && (
            <Text style={styles.hint}>
              {t('home.streak.extend', {
                ...goalValues,
                next: formatNumber(streaks.current + 1),
              })}
            </Text>
          )}
        </>
      ) : (
        <>
          <Text style={styles.text}>{t('home.streak.none')}</Text>
          {trackView}
          <Text style={styles.hint}>{t('home.streak.start', goalValues)}</Text>
        </>
      )}

      <View style={styles.separator} />

      {isRecord ? (
        <Text style={styles.recordNow}>
          🏆{' '}
          {t('home.streak.isRecord', {
            count: streaks.current,
            days: formatNumber(streaks.current),
          })}
        </Text>
      ) : streaks.best > 0 ? (
        <CardText
          style={styles.text}
          text={t('home.streak.record', {
            count: streaks.best,
            skipInterpolation: true,
          })}
          values={{ days: formatNumber(streaks.best) }}
        />
      ) : (
        <CardText
          style={styles.text}
          text={t('home.streak.noRecord', { skipInterpolation: true })}
          values={goalValues}
        />
      )}
      <Text style={styles.since}>{t('home.streak.since')}</Text>
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

    hint: {
      marginTop: 6,
      fontSize: 14,
      color: c.textMuted,
    },



    recordNow: {
      fontSize: 16,
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
