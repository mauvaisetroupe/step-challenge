import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { LeaderboardPeriod } from '@/api/steps'
import { useFormatters } from '@/i18n'
import { isProvisional, parseDateKey } from '@/services/leaderboardPeriods'
import { useThemedStyles, type Colors } from '@/theme'

type Props = {
  period: LeaderboardPeriod
  /** 0 for the current period, 1 for the previous one. */
  offset: number
  /** First and last day of the period, YYYY-MM-DD, once loaded. */
  start?: string
  end?: string
  /** The API serves past leaderboards. */
  canGoBack: boolean
  /** Today, YYYY-MM-DD. */
  today: string
  onChange: (offset: number) => void
}

/**
 * Current or previous day, week or month of the leaderboard, with its
 * dates; a past result that can still change is flagged as provisional.
 * Today's leaderboard says how fresh it is: each friend's steps are
 * those of their last sync.
 */
export default function PeriodNavigator({
  period,
  offset,
  start,
  end,
  canGoBack,
  today,
  onChange,
}: Props) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const { formatDate } = useFormatters()

  const label = {
    day: [t('leaderboard.today'), t('leaderboard.yesterday')],
    week: [t('leaderboard.thisWeek'), t('leaderboard.lastWeek')],
    month: [t('leaderboard.thisMonth'), t('leaderboard.lastMonth')],
  }[period][offset]

  // A day shows a single date, with its weekday.
  const dates =
    start && end
      ? period === 'day'
        ? formatDate(parseDateKey(start), {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })
        : [start, end]
            .map((date) =>
              formatDate(parseDateKey(date), { day: 'numeric', month: 'short' }),
            )
            .join(' – ')
      : null

  const provisional = offset > 0 && end != null && isProvisional(end, today)
  const back = canGoBack && offset === 0
  const forward = offset > 0

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.arrow}
        onPress={() => onChange(offset + 1)}
        disabled={!back}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('leaderboard.previous')}
      >
        <Text style={[styles.arrowText, !back && styles.disabled]}>‹</Text>
      </Pressable>

      <View style={styles.labels}>
        <Text style={styles.label}>{label}</Text>
        {dates && <Text style={styles.dates}>{dates}</Text>}
        {provisional && (
          <Text style={styles.provisional}>{t('leaderboard.provisional')}</Text>
        )}
        {period === 'day' && offset === 0 && (
          <Text style={styles.provisional}>{t('leaderboard.todayFreshness')}</Text>
        )}
      </View>

      <Pressable
        style={styles.arrow}
        onPress={() => onChange(offset - 1)}
        disabled={!forward}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('leaderboard.next')}
      >
        <Text style={[styles.arrowText, !forward && styles.disabled]}>›</Text>
      </Pressable>
    </View>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },

    arrow: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },

    arrowText: {
      fontSize: 32,
      lineHeight: 36,
      color: c.primary,
    },

    disabled: {
      color: c.borderStrong,
    },

    labels: {
      flex: 1,
      alignItems: 'center',
    },

    label: {
      fontSize: 20,
      fontWeight: '700',
      color: c.text,
    },

    dates: {
      marginTop: 2,
      fontSize: 13,
      color: c.textSecondary,
    },

    provisional: {
      marginTop: 4,
      fontSize: 12,
      textAlign: 'center',
      color: c.textMuted,
    },
  })
