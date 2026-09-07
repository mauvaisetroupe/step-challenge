import { useEffect, useState } from 'react'
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native'
import { getLeaderboard } from '../../api/steps'

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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadLeaderboard = async () => {
      setLoading(true)
      setError(null)

      try {
        const data = await getLeaderboard(period)

        if (!cancelled) {
          setResults(data.results)
        }
      } catch {
        if (!cancelled) {
          setError('Impossible de charger le classement.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadLeaderboard()

    return () => {
      cancelled = true
    }
  }, [period])

  const periodLabel = period === 'week' ? 'Cette semaine' : 'Ce mois-ci'

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>🏆 Classement</Text>

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

      <Text style={styles.periodTitle}>{periodLabel}</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {results.map((user, index) => (
            <View key={user.id} style={styles.row}>
              <View style={styles.rank}>
                {index < 3 ? (
                  <Text style={styles.medal}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                  </Text>
                ) : (
                  <Text style={styles.rankNumber}>{index + 1}</Text>
                )}
              </View>

              <Text style={styles.name} numberOfLines={1}>
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#f1f1f1',
    borderRadius: 10,
    padding: 3,
    marginBottom: 24,
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
  },
})