import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { useFormatters } from '@/i18n'
import { stepSourceLabel } from '@/services/healthConnectDiagnostic'
import type { SourceSurplus } from '@/services/stepSources'
import { useThemedStyles, type Colors } from '@/theme'

/** Periods listed; the smaller ones are summed into "other moments". */
const MAX_PERIODS = 5

/**
 * Why Step Challenge counts more steps than the watch on a day: the
 * moments when another source (the phone) counted steps that the main
 * one did not (services/stepSurplus).
 */
export default function StepSurplusExplanation({
  surplus,
}: {
  surplus: SourceSurplus
}) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const formatters = useFormatters()

  const formatTime = (date: Date) =>
    formatters.formatDate(date, { hour: '2-digit', minute: '2-digit' })

  const labels = new Map(
    surplus.others.map((source) => [source.packageName, stepSourceLabel(source)]),
  )

  // The largest periods, shown in the order of the day.
  const largest = surplus.periods
    .slice()
    .sort((a, b) => b.steps - a.steps)
    .slice(0, MAX_PERIODS)
  const shown = surplus.periods.filter((period) => largest.includes(period))
  const otherSteps = surplus.periods
    .filter((period) => !largest.includes(period))
    .reduce((total, period) => total + period.steps, 0)

  const main = stepSourceLabel(surplus.main)

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {t('stats.surplus.title', {
          steps: formatters.formatNumber(surplus.steps),
          source: main,
        })}
      </Text>

      <Text style={styles.text}>
        {t('stats.surplus.description', { source: main })}
      </Text>

      {shown.map((period) => (
        <View key={period.start.getTime()} style={styles.row}>
          <Text style={styles.time}>
            {formatTime(period.start)} – {formatTime(period.end)}
          </Text>
          <Text style={styles.sources} numberOfLines={1}>
            {period.sources.map((id) => labels.get(id) ?? id).join(', ')}
          </Text>
          <Text style={styles.steps}>
            {formatters.formatNumber(period.steps)}
          </Text>
        </View>
      ))}

      {otherSteps > 0 && (
        <View style={styles.row}>
          <Text style={[styles.time, styles.others]}>
            {t('stats.surplus.otherMoments', {
              count: surplus.periods.length - shown.length,
            })}
          </Text>
          <Text style={styles.steps}>{formatters.formatNumber(otherSteps)}</Text>
        </View>
      )}

      <Text style={styles.hint}>
        {t('stats.surplus.hint', { source: main })}
      </Text>
    </View>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      marginTop: 12,
      padding: 14,
      borderRadius: 12,
      backgroundColor: c.surface,
      gap: 6,
    },

    title: {
      fontSize: 15,
      fontWeight: '700',
      color: c.text,
    },

    text: {
      fontSize: 13,
      lineHeight: 18,
      color: c.textSecondary,
      marginBottom: 4,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 28,
    },

    time: {
      fontSize: 14,
      fontWeight: '600',
      color: c.text,
      fontVariant: ['tabular-nums'],
    },

    others: {
      flex: 1,
      fontWeight: '500',
      color: c.textSecondary,
    },

    sources: {
      flex: 1,
      fontSize: 13,
      color: c.textSecondary,
    },

    steps: {
      fontSize: 14,
      fontWeight: '600',
      color: c.text,
      fontVariant: ['tabular-nums'],
    },

    hint: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 17,
      color: c.textMuted,
    },
  })
