import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import type { BadgeReport } from '@/api/badges'
import { useFormatters } from '@/i18n'
import { useThemedStyles, type Colors } from '@/theme'

type Props = {
  report: Pick<
    BadgeReport,
    'level' | 'points' | 'levelPoints' | 'nextLevelPoints'
  >
}

/**
 * Progress inside the current level, from its first point to the first
 * point of the next level, with both bounds under the bar: it does not
 * start at 0.
 */
export default function LevelBar({ report }: Props) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const { formatNumber } = useFormatters()
  const span = report.nextLevelPoints - report.levelPoints
  const ratio =
    span > 0
      ? Math.min(1, Math.max(0, (report.points - report.levelPoints) / span))
      : 0

  return (
    <View>
      <View style={styles.track}>
        <View style={[styles.bar, { width: `${ratio * 100}%` }]} />
      </View>
      <View style={styles.bounds}>
        <Text style={styles.bound}>
          {t('badges.levelBound', {
            level: report.level,
            points: formatNumber(report.levelPoints),
          })}
        </Text>
        <Text style={styles.bound}>
          {t('badges.levelBound', {
            level: report.level + 1,
            points: formatNumber(report.nextLevelPoints),
          })}
        </Text>
      </View>
    </View>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    track: {
      height: 8,
      marginTop: 6,
      borderRadius: 4,
      overflow: 'hidden',
      backgroundColor: c.track,
    },

    bar: {
      height: '100%',
      borderRadius: 4,
      backgroundColor: c.primary,
    },

    bounds: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 4,
      marginBottom: 6,
    },

    bound: {
      fontSize: 12,
      color: c.textMuted,
    },
  })
