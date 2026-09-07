import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { getLeaderboard } from '../../api/steps'
import { syncLast30Days } from '../../services/stepSync'

type Period = 'week' | 'month'

type LeaderboardEntry = {
  id: string
  name: string
  steps: number
}

export default function LeaderboardScreen() {
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
      console.error('Leaderboard refresh error:', err)

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

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>🏆 Classement</Text>
      </View>

      <View style={styles.periodSelector}>
        <Pressable
          style={[
            styles.periodButton,
            period === 'week' && styles.periodButtonActive,
          ]}
          onPress={() => setPeriod('week')}
        >
          <Text
            style={[
              styles.periodText,
              period === 'week' && styles.periodTextActive,
            ]}
          >
            Semaine
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.periodButton,
            period === 'month' && styles.periodButtonActive,
          ]}
          onPress={() => setPeriod('month')}
        >
          <Text
            style={[
              styles.periodText,
              period === 'month' && styles.periodTextActive,
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
            refreshing && styles.refreshButtonDisabled,
          ]}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator
              size="small"
              color="#111827"
            />
          ) : (
            <>
              <Text style={styles.refreshIcon}>↻</Text>

              <Text style={styles.refreshText}>
                Actualiser
              </Text>
            </>
          )}
        </Pressable>
      </View>

      <Text style={styles.periodTitle}>{periodLabel}</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>

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
          {results.map((user, index) => (
            <View
              key={user.id}
              style={styles.row}
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

              <Text
                style={styles.name}
                numberOfLines={1}
              >
                {user.name}
              </Text>

              <Text style={styles.steps}>
                {user.steps.toLocaleString('fr-FR')} pas
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 32,
  },

  header: {
    marginBottom: 20,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
  },

  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#f1f1f1',
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
    backgroundColor: '#ffffff',
  },

  periodText: {
    fontSize: 15,
    fontWeight: '500',
  },

  periodTextActive: {
    fontWeight: '700',
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
    backgroundColor: '#f1f1f1',
  },

  refreshButtonDisabled: {
    opacity: 0.6,
  },

  refreshIcon: {
    fontSize: 22,
    lineHeight: 24,
  },

  refreshText: {
    fontSize: 15,
    fontWeight: '600',
  },

  periodTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },

  list: {
    gap: 8,
  },

  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    paddingHorizontal: 14,
  },

  rank: {
    width: 42,
    alignItems: 'center',
  },

  medal: {
    fontSize: 22,
  },

  rankNumber: {
    fontSize: 16,
    fontWeight: '600',
  },

  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },

  steps: {
    fontSize: 14,
    fontWeight: '600',
  },

  center: {
    paddingVertical: 40,
    alignItems: 'center',
  },

  error: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 15,
  },

  retryButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#111827',
  },

  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
})