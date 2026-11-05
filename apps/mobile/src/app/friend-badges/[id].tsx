import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import {
  getFriendBadges,
  isBadgesUnavailable,
  type BadgeReport,
} from '@/api/badges'
import BadgeReportView from '@/components/badges/BadgeReportView'
import { useLanguage } from '@/i18n'
import { useTheme, useThemedStyles, type Colors } from '@/theme'

/**
 * The badges of a friend, opened from the leaderboard. Visible to their
 * friends only: the backend answers 404 otherwise.
 */
export default function FriendBadgesScreen() {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const { t } = useTranslation()
  const { language } = useLanguage()
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>()

  const [report, setReport] = useState<BadgeReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let current = true

    getFriendBadges(id)
      .then((data) => {
        if (current) {
          setReport(data)
          setError(null)
        }
      })
      .catch((err) => {
        console.error('Friend badges read error:', err)

        if (current) {
          setError(
            isBadgesUnavailable(err)
              ? t('badges.unavailable')
              : t('badges.loadError'),
          )
        }
      })

    return () => {
      current = false
    }
    // language: reload in the new language.
  }, [id, t, language])

  return (
    <>
      <Stack.Screen
        options={{
          title: name ? t('badges.friendTitle', { name }) : t('badges.title'),
        }}
      />

      {report ? (
        <ScrollView contentContainerStyle={styles.content}>
          <BadgeReportView report={report} />
        </ScrollView>
      ) : (
        <View style={styles.centered}>
          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <ActivityIndicator size="large" color={colors.primary} />
          )}
        </View>
      )}
    </>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: c.background,
    },

    content: {
      padding: 16,
      paddingBottom: 32,
      backgroundColor: c.background,
    },

    error: {
      color: c.textSecondary,
      fontSize: 16,
      textAlign: 'center',
    },
  })
