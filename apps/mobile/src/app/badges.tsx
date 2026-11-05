import { useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import {
  getMyBadges,
  isBadgesUnavailable,
  type BadgeReport,
} from '@/api/badges'
import BadgeReportView from '@/components/badges/BadgeReportView'
import { useLanguage } from '@/i18n'
import { markBadgesSeen, noteBadgeReport } from '@/services/newBadges'
import { useTheme, useThemedStyles, type Colors } from '@/theme'

/**
 * My badges, points and level (docs/reference/badges.md), opened from
 * the level card of the home screen, my row in the leaderboard or the
 * More menu: the badges are an extra, not a tab. Opening the screen
 * marks the new badges as seen; they stay highlighted until the next
 * visit.
 */
export default function BadgesScreen() {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const { t } = useTranslation()
  // The texts come translated from the backend: read again after a
  // change of language.
  const { language } = useLanguage()

  const [report, setReport] = useState<BadgeReport | null>(null)
  const [newSince, setNewSince] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const loading = useRef(false)

  const load = useCallback(async () => {
    if (loading.current) {
      return
    }

    loading.current = true

    try {
      const data = await getMyBadges()

      noteBadgeReport(data)
      setNewSince(await markBadgesSeen())
      setReport(data)
      setError(null)
    } catch (err) {
      console.error('Badges read error:', err)
      setError(
        isBadgesUnavailable(err)
          ? t('badges.unavailable')
          : t('badges.loadError'),
      )
    } finally {
      loading.current = false
    }
  }, [t])

  useFocusEffect(
    useCallback(() => {
      load()
      // language: reload in the new language.
    }, [load, language]),
  )

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  return (
    <View style={styles.screen}>
      {!report && !error ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          {error && !report ? (
            <View style={styles.centered}>
              <Text style={styles.error}>{error}</Text>
              <Pressable style={styles.retryButton} onPress={load}>
                <Text style={styles.retryText}>{t('common.retry')}</Text>
              </Pressable>
            </View>
          ) : (
            report && <BadgeReportView report={report} newSince={newSince} />
          )}
        </ScrollView>
      )}
    </View>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },

    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      gap: 12,
    },

    content: {
      padding: 16,
      paddingBottom: 32,
    },

    error: {
      color: c.textSecondary,
      fontSize: 16,
      textAlign: 'center',
    },

    retryButton: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: c.surfaceAlt,
    },

    retryText: {
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
    },
  })
