import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { useFormatters } from '@/i18n'
import { stepSourceLabel } from '@/services/healthConnectDiagnostic'
import type { StepSourcesReport } from '@/services/stepSources'
import { useThemedStyles, type Colors } from '@/theme'

/**
 * Today's steps per app writing to Health Connect, and the total it
 * keeps after removing duplicates (the one Step Challenge uses).
 */
export default function StepSourcesList({
  sources,
}: {
  sources: StepSourcesReport | { error: string }
}) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const { formatNumber } = useFormatters()

  if ('error' in sources) {
    return <Text style={styles.hint}>{sources.error}</Text>
  }

  if (sources.sources.length === 0) {
    return <Text style={styles.hint}>{t('diagnostic.sources.none')}</Text>
  }

  return (
    <View>
      {sources.sources.map((source) => (
        <View key={source.packageName} style={styles.row}>
          <View style={styles.names}>
            <Text style={styles.name}>{stepSourceLabel(source)}</Text>
            <Text style={styles.detail} numberOfLines={2}>
              {source.devices.length > 0
                ? source.devices.join(', ')
                : source.packageName}
            </Text>
          </View>
          <Text style={styles.steps}>{formatNumber(source.steps)}</Text>
        </View>
      ))}

      <View style={[styles.row, styles.totalRow]}>
        <Text style={[styles.name, styles.names]}>
          {t('diagnostic.sources.kept')}
        </Text>
        <Text style={[styles.steps, styles.total]}>
          {formatNumber(sources.total)}
        </Text>
      </View>
    </View>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    row: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    totalRow: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      marginTop: 4,
    },

    names: {
      flex: 1,
    },

    name: {
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
    },

    detail: {
      marginTop: 2,
      fontSize: 12,
      color: c.textMuted,
    },

    steps: {
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
      fontVariant: ['tabular-nums'],
    },

    total: {
      color: c.primary,
      fontWeight: '700',
    },

    hint: {
      fontSize: 13,
      lineHeight: 18,
      color: c.textSecondary,
    },
  })
