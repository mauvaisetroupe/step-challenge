import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import {
  badgeIcon,
  type BadgeReport,
  type EarnedBadge,
} from '@/api/badges'
import { useFormatters } from '@/i18n'
import { parseDateKey } from '@/services/leaderboardPeriods'
import { useThemedStyles, type Colors } from '@/theme'

type Props = {
  report: BadgeReport
  /**
   * Badges awarded after this ISO date are flagged "new"; null flags
   * none.
   */
  newSince?: string | null
}

/** Progress from 0 to 1, for a bar. */
function ratio(value: number, target: number) {
  return target > 0 ? Math.min(1, Math.max(0, value / target)) : 0
}

/**
 * Level, badges in progress, earned and still to unlock. Used for my
 * badges and for a friend's.
 */
export default function BadgeReportView({ report, newSince = null }: Props) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const { formatNumber, formatDate } = useFormatters()
  const toNext = report.nextLevelPoints - report.points

  const isNew = (badge: EarnedBadge) =>
    newSince !== null && badge.createdAt > newSince

  return (
    <View style={styles.container}>
      <View style={styles.levelCard}>
        <Text style={styles.level}>
          {t('badges.level', { level: report.level })}
        </Text>
        <Text style={styles.points}>
          {t('badges.points', {
            count: report.points,
            points: formatNumber(report.points),
          })}
        </Text>
        <View style={styles.track}>
          <View
            style={[
              styles.bar,
              {
                width: `${ratio(
                  report.points - report.levelPoints,
                  report.nextLevelPoints - report.levelPoints,
                ) * 100}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.hint}>
          {t('badges.toNextLevel', {
            count: toNext,
            points: formatNumber(toNext),
            level: report.level + 1,
          })}
        </Text>
      </View>

      {report.inProgress.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('badges.inProgress')}</Text>
          {report.inProgress.map((badge) => (
            <View key={`${badge.id} ${badge.occurrence}`} style={styles.row}>
              <Text style={styles.icon}>{badgeIcon(badge.family)}</Text>
              <View style={styles.body}>
                <Text style={styles.name}>{badge.name}</Text>
                <Text style={styles.detail}>
                  {badge.period ? `${badge.period} · ` : ''}
                  {badge.description}
                </Text>
                <View style={styles.track}>
                  <View
                    style={[
                      styles.bar,
                      { width: `${ratio(badge.value, badge.target) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.detail}>
                  {t('badges.progress', {
                    value: formatNumber(badge.value),
                    target: formatNumber(badge.target),
                  })}
                </Text>
              </View>
              <Text style={styles.reward}>
                {t('badges.reward', { points: badge.points })}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('badges.earned')}</Text>
        {report.earned.length === 0 && (
          <Text style={styles.detail}>{t('badges.none')}</Text>
        )}
        {report.earned.map((badge) => (
          <View
            key={`${badge.id} ${badge.occurrence}`}
            style={[styles.row, isNew(badge) && styles.rowNew]}
          >
            <Text style={styles.icon}>{badgeIcon(badge.family)}</Text>
            <View style={styles.body}>
              <View style={styles.nameLine}>
                <Text style={styles.name}>
                  {badge.name}
                  {badge.count > 1 &&
                    ` ${t('badges.times', { n: badge.count })}`}
                </Text>
                {isNew(badge) && (
                  <Text style={styles.newTag}>{t('badges.new')}</Text>
                )}
              </View>
              <Text style={styles.detail}>
                {badge.period ??
                  t('badges.earnedOn', {
                    date: formatDate(parseDateKey(badge.earnedOn), {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }),
                  })}
              </Text>
            </View>
            <Text style={styles.reward}>
              {t('badges.reward', { points: badge.points })}
            </Text>
          </View>
        ))}
      </View>

      {report.locked.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('badges.locked')}</Text>
          {report.locked.map((badge) => (
            <View key={badge.id} style={[styles.row, styles.rowLocked]}>
              <Text style={styles.icon}>{badgeIcon(badge.family)}</Text>
              <View style={styles.body}>
                <Text style={styles.name}>{badge.name}</Text>
                <Text style={styles.detail}>{badge.description}</Text>
              </View>
              <Text style={styles.reward}>
                {t('badges.reward', { points: badge.points })}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      gap: 20,
    },

    levelCard: {
      padding: 18,
      borderRadius: 18,
      backgroundColor: c.primarySoft,
      gap: 6,
    },

    level: {
      fontSize: 28,
      fontWeight: '800',
      color: c.text,
    },

    points: {
      fontSize: 16,
      color: c.textSecondary,
    },

    hint: {
      fontSize: 13,
      color: c.textSecondary,
    },

    track: {
      height: 8,
      marginVertical: 6,
      borderRadius: 4,
      overflow: 'hidden',
      backgroundColor: c.track,
    },

    bar: {
      height: '100%',
      borderRadius: 4,
      backgroundColor: c.primary,
    },

    section: {
      gap: 8,
    },

    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: c.textSecondary,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor: c.surface,
    },

    rowNew: {
      borderWidth: 2,
      borderColor: c.primary,
    },

    rowLocked: {
      opacity: 0.55,
    },

    icon: {
      fontSize: 26,
    },

    body: {
      flex: 1,
      gap: 2,
    },

    nameLine: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },

    name: {
      fontSize: 16,
      fontWeight: '600',
      color: c.text,
    },

    newTag: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 6,
      overflow: 'hidden',
      fontSize: 11,
      fontWeight: '700',
      color: c.onPrimary,
      backgroundColor: c.primary,
    },

    detail: {
      fontSize: 13,
      lineHeight: 18,
      color: c.textSecondary,
    },

    reward: {
      fontSize: 14,
      fontWeight: '700',
      color: c.primary,
    },
  })
