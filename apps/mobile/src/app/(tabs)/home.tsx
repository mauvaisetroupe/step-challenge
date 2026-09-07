import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import {
  aggregateRecord,
  initialize,
  requestPermission,
} from 'react-native-health-connect'

import { syncSteps } from '../../api/steps'

const USER_ID_KEY = '@step-challenge/user-id-v2'

async function getUserId() {
  const userId = await AsyncStorage.getItem(USER_ID_KEY)

  if (!userId) {
    throw new Error('User profile not configured')
  }

  return userId
}

export default function HomeScreen() {
  const [steps, setSteps] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSteps = async () => {
    try {
      setLoading(true)
      setError(null)

      const initialized = await initialize()

      if (!initialized) {
        throw new Error('Health Connect is not available')
      }

      await requestPermission([
        {
          accessType: 'read',
          recordType: 'Steps',
        },
      ])

      const now = new Date()

      const startOfDay = new Date(now)
      startOfDay.setHours(0, 0, 0, 0)

      const result = await aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter: {
          operator: 'between',
          startTime: startOfDay.toISOString(),
          endTime: now.toISOString(),
        },
      })

      const todaySteps = result.COUNT_TOTAL ?? 0

      setSteps(todaySteps)

      const userId = await getUserId()

      await syncSteps(
        userId,
        now.toISOString().slice(0, 10),
        todaySteps,
      )

    } catch (err) {
      console.error('Step synchronization error:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to synchronize steps',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSteps()
  }, [])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Step Challenge</Text>

      <Text style={styles.subtitle}>Aujourd'hui</Text>

      {loading && (
        <ActivityIndicator
          size="large"
          color="#208AEF"
        />
      )}

      {!loading && error && (
        <Text style={styles.error}>{error}</Text>
      )}

      {!loading && !error && (
        <View style={styles.stepsContainer}>
          <Text style={styles.steps}>
            {steps?.toLocaleString('fr-FR')}
          </Text>

          <Text style={styles.label}>pas</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },

  title: {
    color: '#111827',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 12,
  },

  subtitle: {
    color: '#6B7280',
    fontSize: 20,
    marginBottom: 28,
  },

  stepsContainer: {
    alignItems: 'center',
  },

  steps: {
    color: '#111827',
    fontSize: 56,
    fontWeight: '700',
  },

  label: {
    color: '#6B7280',
    fontSize: 18,
    marginTop: 4,
  },

  error: {
    color: '#DC2626',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
})
