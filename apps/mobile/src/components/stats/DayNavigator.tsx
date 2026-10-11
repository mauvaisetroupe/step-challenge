import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useFormatters } from '@/i18n'
import { useThemedStyles, type Colors } from '@/theme'

type Props = {
  /** Midnight of the day shown. */
  day: Date
  /** Midnight of today. */
  today: Date
  /** Days that can be shown, today included. */
  maxDays: number
  onChange: (day: Date) => void
}

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/** Previous and next day around the date of the 1-day view. */
export default function DayNavigator({ day, today, maxDays, onChange }: Props) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const formatters = useFormatters()

  const oldest = addDays(today, -(maxDays - 1))
  const canGoBack = day > oldest
  const canGoForward = day < today

  const label =
    day.getTime() === today.getTime()
      ? t('stats.day.today')
      : day.getTime() === addDays(today, -1).getTime()
        ? t('stats.day.yesterday')
        : formatters.formatDate(day, { weekday: 'long' })

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.arrow}
        onPress={() => onChange(addDays(day, -1))}
        disabled={!canGoBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('stats.day.previous')}
      >
        <Text style={[styles.arrowText, !canGoBack && styles.disabled]}>
          ‹
        </Text>
      </Pressable>

      <View style={styles.labels}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.date}>
          {formatters.formatDate(day, { day: 'numeric', month: 'long' })}
        </Text>
      </View>

      <Pressable
        style={styles.arrow}
        onPress={() => onChange(addDays(day, 1))}
        disabled={!canGoForward}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('stats.day.next')}
      >
        <Text style={[styles.arrowText, !canGoForward && styles.disabled]}>
          ›
        </Text>
      </Pressable>
    </View>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: -8,
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
      fontSize: 16,
      fontWeight: '700',
      color: c.text,
      textTransform: 'capitalize',
    },

    date: {
      fontSize: 12,
      color: c.textSecondary,
    },
  })
