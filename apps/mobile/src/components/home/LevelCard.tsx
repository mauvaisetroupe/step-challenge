import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import type { BadgeReport } from '@/api/badges'
import { useFormatters } from '@/i18n'
import { useThemedStyles, type Colors } from '@/theme'

import HomeCard from './HomeCard'

type Props = {
  report: BadgeReport
  onOpenBadges: () => void
}

/** My badge level and the points before the next one. */
export default function LevelCard({ report, onOpenBadges }: Props) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const { formatNumber } = useFormatters()
  const toNext = report.nextLevelPoints - report.points
  const span = report.nextLevelPoints - report.levelPoints
  const ratio = span > 0 ? (report.points - report.levelPoints) / span : 0

  return (
    <HomeCard
      icon="🏅"
      title={t('home.level.title', {
        level: report.level,
        points: t('badges.points', {
          count: report.points,
          points: formatNumber(report.points),
        }),
      })}
      onPress={onOpenBadges}
    >
      <View style={styles.track}>
        <View style={[styles.bar, { width: `${Math.min(1, ratio) * 100}%` }]} />
      </View>
      <Text style={styles.text}>
        {t('badges.toNextLevel', {
          count: toNext,
          points: formatNumber(toNext),
          level: report.level + 1,
        })}
      </Text>
    </HomeCard>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    track: {
      height: 8,
      marginBottom: 8,
      borderRadius: 4,
      overflow: 'hidden',
      backgroundColor: c.track,
    },

    bar: {
      height: '100%',
      borderRadius: 4,
      backgroundColor: c.primary,
    },

    text: {
      fontSize: 15,
      lineHeight: 21,
      color: c.textSecondary,
    },
  })
