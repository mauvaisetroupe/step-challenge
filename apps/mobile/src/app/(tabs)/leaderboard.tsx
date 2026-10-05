import { router } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  getLeaderboard,
  type LeaderboardEntry,
} from '../../api/steps'
import { displayName } from '../../api/friends'
import UserBadge from '../../components/UserBadge'
import { syncLast30Days } from '../../services/stepSync'
import TabScreenHeader from '../../components/TabScreenHeader'
import { useTheme, useThemedStyles, type Colors } from '@/theme'

type Period = 'week' | 'month'

export default function LeaderboardScreen() {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()

  const [period, setPeriod] = useState<Period>('week')
  const [results, setResults] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadLeaderboard = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await getLeaderboard(period)

      setResults(data.results)
    } catch {
      setError('Impossible de charger le classement.')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    loadLeaderboard()
  }, [loadLeaderboard])

  // Sending the last 30 days is idempotent (the backend keeps the
  // highest value per day), so the button is always available.
  const handleRefresh = async () => {
    if (refreshing) {
      return
    }

    setRefreshing(true)
    setError(null)

    try {
      await syncLast30Days()

      const data = await getLeaderboard(period)

      setResults(data.results)
    } catch (err) {
      console.error(
        'Leaderboard refresh error:',
        err,
      )

      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de mettre à jour les pas.',
      )
    } finally {
      setRefreshing(false)
    }
  }

  const periodLabel =
    period === 'week'
      ? 'Cette semaine'
      : 'Ce mois-ci'

  const refreshDisabled = refreshing

  return (
    // Top edge only: keeps the content below the status bar (camera,
    // clock, battery); the tab bar handles the bottom.
    <SafeAreaView edges={['top']} style={styles.screen}>
      <TabScreenHeader
        title="Classement"
        right={
          <Pressable
            style={styles.friendsButton}
            onPress={() => router.push('/friends')}
          >
            <Text style={styles.friendsButtonText}>👥 Amis</Text>
          </Pressable>
        }
      />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.periodSelector}>
          <Pressable
            style={[
              styles.periodButton,
              period === 'week' &&
                styles.periodButtonActive,
            ]}
            onPress={() => setPeriod('week')}
          >
            <Text
              style={[
                styles.periodText,
                period === 'week' &&
                  styles.periodTextActive,
              ]}
            >
              Semaine
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.periodButton,
              period === 'month' &&
                styles.periodButtonActive,
            ]}
            onPress={() => setPeriod('month')}
          >
            <Text
              style={[
                styles.periodText,
                period === 'month' &&
                  styles.periodTextActive,
              ]}
            >
              Mois
            </Text>
          </Pressable>
        </View>

        <View style={styles.refreshRow}>
          <Pressable
            style={[
              styles.refreshButton,
              refreshDisabled &&
                styles.refreshButtonDisabled,
            ]}
            onPress={handleRefresh}
            disabled={refreshDisabled}
          >
            {refreshing ? (
              <ActivityIndicator
                size="small"
                color={colors.text}
              />
            ) : (
              <>
                <Text style={styles.refreshIcon}>
                  ↻
                </Text>

                <Text style={styles.refreshText}>
                  Actualiser
                </Text>
              </>
            )}
          </Pressable>
        </View>

        <Text style={styles.periodTitle}>
          {periodLabel}
        </Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.error}>
              {error}
            </Text>

            <Pressable
              style={styles.retryButton}
              onPress={loadLeaderboard}
            >
              <Text style={styles.retryText}>
                Réessayer
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {results.length === 1 && results[0].isMe && (
              <Pressable
                style={styles.emptyCard}
                onPress={() => router.push('/friends')}
              >
                <Text style={styles.emptyTitle}>
                  Le classement se joue entre amis
                </Text>
                <Text style={styles.emptyText}>
                  Invite tes amis avec un lien : vous verrez vos pas
                  respectifs ici.
                </Text>
                <Text style={styles.emptyAction}>Inviter des amis →</Text>
              </Pressable>
            )}

            {results.map((user, index) => (
              <View
                key={user.id}
                style={[styles.row, user.isMe && styles.rowMe]}
              >
                <View style={styles.rank}>
                  {index < 3 ? (
                    <Text style={styles.medal}>
                      {index === 0
                        ? '🥇'
                        : index === 1
                          ? '🥈'
                          : '🥉'}
                    </Text>
                  ) : (
                    <Text style={styles.rankNumber}>
                      {index + 1}
                    </Text>
                  )}
                </View>

                <View style={styles.badge}>
                  <UserBadge userId={user.id} name={displayName(user)} />
                </View>

                <View style={styles.names}>
                  <Text
                    style={styles.name}
                    numberOfLines={1}
                  >
                    {displayName(user)}
                    {user.isMe && (
                      <Text style={styles.me}> · toi</Text>
                    )}
                  </Text>
                  {user.alias && user.alias !== user.name && (
                    <Text style={styles.realName} numberOfLines={1}>
                      {user.name}
                    </Text>
                  )}
                </View>

                <Text style={styles.steps}>
                  {user.steps.toLocaleString('fr-FR')} pas
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },

    container: {
      padding: 20,
      paddingBottom: 32,
    },

    friendsButton: {
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 10,
      justifyContent: 'center',
      backgroundColor: c.surfaceAlt,
    },

    friendsButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
    },

    emptyCard: {
      marginBottom: 8,
      padding: 16,
      borderRadius: 12,
      backgroundColor: c.primarySoft,
    },

    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: c.text,
    },

    emptyText: {
      marginTop: 4,
      fontSize: 14,
      lineHeight: 20,
      color: c.textSecondary,
    },

    emptyAction: {
      marginTop: 10,
      fontSize: 15,
      fontWeight: '600',
      color: c.primary,
    },

    names: {
      flex: 1,
      marginRight: 8,
    },

    realName: {
      fontSize: 12,
      color: c.textMuted,
    },

    periodSelector: {
      flexDirection: 'row',
      backgroundColor: c.surfaceAlt,
      borderRadius: 10,
      padding: 3,
      marginBottom: 12,
    },

    periodButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: 8,
    },

    periodButtonActive: {
      backgroundColor: c.background,
    },

    periodText: {
      fontSize: 15,
      fontWeight: '500',
      color: c.textSecondary,
    },

    periodTextActive: {
      fontWeight: '700',
      color: c.text,
    },

    refreshRow: {
      alignItems: 'flex-end',
      marginBottom: 20,
    },

    refreshButton: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: c.surfaceAlt,
    },

    refreshButtonDisabled: {
      opacity: 0.45,
    },

    refreshIcon: {
      fontSize: 22,
      lineHeight: 24,
      color: c.text,
    },

    refreshText: {
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
    },

    periodTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 12,
      color: c.text,
    },

    list: {
      gap: 8,
    },

    row: {
      minHeight: 60,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
    },

    rowMe: {
      backgroundColor: c.primarySoft,
      borderWidth: 1,
      borderColor: c.primary,
    },

    me: {
      color: c.primary,
      fontWeight: '700',
    },

    rank: {
      width: 42,
      alignItems: 'center',
    },

    medal: {
      fontSize: 22,
    },

    badge: {
      marginRight: 10,
    },

    rankNumber: {
      fontSize: 16,
      fontWeight: '600',
      color: c.text,
    },

    name: {
      fontSize: 16,
      fontWeight: '600',
      color: c.text,
    },

    steps: {
      fontSize: 14,
      fontWeight: '600',
      color: c.text,
    },

    center: {
      paddingVertical: 40,
      alignItems: 'center',
    },

    error: {
      fontSize: 15,
      textAlign: 'center',
      marginBottom: 15,
      color: c.danger,
    },

    retryButton: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: c.primary,
    },

    retryText: {
      color: c.onPrimary,
      fontWeight: '600',
    },
  })