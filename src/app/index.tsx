import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import {
  aggregateRecord,
  initialize,
  requestPermission,
} from 'react-native-health-connect'
import { createUser, getSteps, syncSteps } from '../api/steps'

const USER_ID_KEY = '@step-challenge/user-id-v2'



async function getUserId() {
  const existingId = await AsyncStorage.getItem(USER_ID_KEY)

  if (existingId) {
    return existingId
  }

  const user = await createUser('Lionel')

  await AsyncStorage.setItem(USER_ID_KEY, user.id)

  console.log('User registered:', user.id)

  return user.id

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

      const storedSteps = await getSteps(userId)
      console.log('Steps from backend:', storedSteps)

      console.log('Steps synchronized:', {
        userId,
        steps: todaySteps,
      })
    } catch (err) {
      console.error('Step synchronization error:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to synchronize steps'
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

      {loading && <ActivityIndicator size="large" />}

      {!loading && error && (
        <Text style={styles.error}>{error}</Text>
      )}

      {!loading && !error && (
        <>
          <Text style={styles.steps}>
            {steps?.toLocaleString('fr-FR')}
          </Text>

          <Text style={styles.label}>pas</Text>
        </>
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
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 40,
  },
  subtitle: {
    fontSize: 20,
    marginBottom: 12,
  },
  steps: {
    fontSize: 56,
    fontWeight: '700',
  },
  label: {
    fontSize: 18,
    marginTop: 4,
  },
  error: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
})