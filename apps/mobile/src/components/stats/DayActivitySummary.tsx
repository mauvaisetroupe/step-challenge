import { useTranslation } from 'react-i18next'
import { Linking, StyleSheet, Text, View } from 'react-native'

import RichText from '@/i18n/RichText'
import { WEEKLY_ACTIVITY_GOAL, type DayActivity } from '@/services/activity'
import { useTheme, useThemedStyles, type Colors } from '@/theme'

type Props = {
  activity: DayActivity
}

/** WHO fact sheet on physical activity, in French when available. */
function whoFactSheetUrl(language: string) {
  const path = language.startsWith('fr') ? '/fr' : ''

  return `https://www.who.int${path}/news-room/fact-sheets/detail/physical-activity`
}

/** 75 → "1 h 15", 45 → "45 min". */
export function useFormatDuration() {
  const { t } = useTranslation()

  return (minutes: number) =>
    minutes < 60
      ? t('stats.activity.minutes', { minutes })
      : t('stats.activity.hours', {
          hours: Math.floor(minutes / 60),
          minutes: String(minutes % 60).padStart(2, '0'),
        })
}

/**
 * Very active, active and inactive minutes of the day, and the activity
 * score (services/activity), under the day timeline.
 */
export default function DayActivitySummary({ activity }: Props) {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const { t, i18n } = useTranslation()
  const formatDuration = useFormatDuration()

  const tiles = [
    {
      key: 'veryActive',
      color: colors.activity,
      opacity: 1,
      minutes: activity.veryActiveMinutes,
    },
    {
      key: 'active',
      color: colors.activity,
      opacity: 0.45,
      minutes: activity.activeMinutes,
    },
    {
      key: 'inactive',
      color: colors.danger,
      opacity: 1,
      minutes: activity.inactiveMinutes,
    },
  ] as const

  return (
    <View style={styles.container}>
      <View style={styles.tiles}>
        {tiles.map((tile) => (
          <View key={tile.key} style={styles.tile}>
            <View
              style={[
                styles.marker,
                { backgroundColor: tile.color, opacity: tile.opacity },
              ]}
            />
            <Text style={styles.tileValue}>{formatDuration(tile.minutes)}</Text>
            <Text style={styles.tileLabel}>
              {t(`stats.activity.${tile.key}`)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.score}>
        <Text style={styles.scoreValue}>{activity.score}</Text>
        <Text style={styles.scoreLabel}>{t('stats.activity.score')}</Text>
      </View>

      <RichText
        text={t('stats.activity.detail', { skipInterpolation: true })}
        values={{ goal: String(WEEKLY_ACTIVITY_GOAL) }}
        style={styles.detail}
        boldStyle={styles.link}
        onBoldPress={() => {
          Linking.openURL(whoFactSheetUrl(i18n.language)).catch((error) =>
            console.error('Failed to open the WHO page:', error),
          )
        }}
      />
    </View>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      marginTop: 20,
      gap: 14,
    },

    tiles: {
      flexDirection: 'row',
      gap: 10,
    },

    tile: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      paddingVertical: 12,
      paddingHorizontal: 6,
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
    },

    marker: {
      width: 22,
      height: 5,
      borderRadius: 2,
      marginBottom: 4,
    },

    tileValue: {
      fontSize: 18,
      fontWeight: '700',
      color: c.text,
    },

    tileLabel: {
      fontSize: 12,
      color: c.textSecondary,
      textAlign: 'center',
    },

    score: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
      gap: 8,
    },

    scoreValue: {
      fontSize: 28,
      fontWeight: '800',
      color: c.activity,
    },

    scoreLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
    },

    detail: {
      fontSize: 12,
      lineHeight: 17,
      color: c.textMuted,
      textAlign: 'center',
    },

    link: {
      color: c.primary,
      textDecorationLine: 'underline',
    },
  })
