import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  getHealthConnectLast30Days,
  syncStatsToServer,
} from '../../services/stepSync'
import TabScreenHeader from '../../components/TabScreenHeader'
import { useTheme, useThemedStyles, type Colors } from '@/theme'

export default function HomeScreen() {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()

  const [steps, setSteps] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSteps = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const stats = await getHealthConnectLast30Days()

      const today = new Date()
      const todayKey = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0'),
      ].join('-')

      const todayEntry = stats.find(
        (item) => item.date === todayKey,
      )

      setSteps(todayEntry?.steps ?? 0)

      // Synchronisation serveur en arrière-plan.
      // Elle ne bloque pas l'affichage de Home.
      syncStatsToServer(stats).catch((err) => {
        console.error(
          'Background step synchronization error:',
          err,
        )
      })
    } catch (err) {
      console.error('Health Connect step read error:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to read steps from Health Connect',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadSteps()
    }, [loadSteps]),
  )

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <TabScreenHeader title="Step Challenge" />

      <View style={styles.container}>
        <Text style={styles.subtitle}>Aujourd'hui</Text>

        {loading && (
          <ActivityIndicator
            size="large"
            color={colors.primary}
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
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: c.background,
    },

    subtitle: {
      color: c.textSecondary,
      fontSize: 20,
      marginBottom: 28,
    },

    stepsContainer: {
      alignItems: 'center',
    },

    steps: {
      color: c.text,
      fontSize: 56,
      fontWeight: '700',
    },

    label: {
      color: c.textSecondary,
      fontSize: 18,
      marginTop: 4,
    },

    error: {
      color: c.danger,
      fontSize: 16,
      textAlign: 'center',
      marginTop: 20,
    },
  })