import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { formatNumber } from '@/i18n'
import type { Streaks } from '@/services/insights'
import { useThemedStyles, type Colors } from '@/theme'

import HomeCard, { CardText } from './HomeCard'

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

  return (
    <HomeCard icon="🔥" title={title}>
      {streaks.current > 0 ? (
        <>
          <View style={styles.valueRow}>
            <Text style={styles.value}>{formatNumber(streaks.current)}</Text>
            <Text style={styles.unit}>
              {t('home.streak.daysInARow', { count: streaks.current })}
            </Text>
          </View>

          <Text style={styles.text}>
            {t('home.streak.aboveGoal', goalValues)}
          </Text>

          {!streaks.includesToday && (
            <Text style={styles.hint}>
              {t('home.streak.extend', goalValues)}
            </Text>
          )}

          {isRecord && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{t('home.streak.isRecord')}</Text>
            </View>
          )}
        </>
      ) : (
        <>
          <Text style={styles.text}>{t('home.streak.none')}</Text>
          <Text style={styles.hint}>{t('home.streak.start', goalValues)}</Text>
        </>
      )}

      <View style={styles.separator} />

      {streaks.best > 0 ? (
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
