import { useTranslation } from 'react-i18next'
import { StyleSheet, Text } from 'react-native'

import type { BadgeReport } from '@/api/badges'
import LevelBar from '@/components/badges/LevelBar'
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
      <LevelBar report={report} />
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
    text: {
      fontSize: 15,
      lineHeight: 21,
      color: c.textSecondary,
    },
  })
