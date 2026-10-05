import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import {
  Description,
  SecondaryButton,
  SettingsPage,
  Subtitle,
} from '@/components/settings/ui'
import {
  getBackgroundSyncStatus,
  triggerBackgroundStepSyncForTesting,
  type BackgroundSyncRun,
} from '@/services/backgroundSync'
import { useThemedStyles, type Colors } from '@/theme'

/** History of the background step sync, and a manual test run. */
export default function SyncSettingsScreen() {
  const styles = useThemedStyles(createStyles)
  const [history, setHistory] = useState<BackgroundSyncRun[]>([])

  const load = useCallback(async () => {
    const status = await getBackgroundSyncStatus()
    setHistory(status.history)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const triggerSync = useCallback(async () => {
    try {
      await triggerBackgroundStepSyncForTesting()
      await load()
    } catch (error) {
      console.error('Background task test failed:', error)
    }
  }, [load])

  return (
    <SettingsPage>
      <Description>
        La synchronisation vérifie régulièrement les 30 derniers jours de
        données.
      </Description>

      <Subtitle>Dernières exécutions</Subtitle>

      {history.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Aucune exécution enregistrée</Text>
        </View>
      ) : (
        <View style={styles.card}>
          {history.map((run, index) => (
            <View
              key={`${run.timestamp}-${index}`}
              style={[styles.row, index === history.length - 1 && styles.lastRow]}
            >
              <Text
                style={[
                  styles.status,
                  run.status === 'success' ? styles.success : styles.error,
                ]}
              >
                {run.status === 'success' ? '✓' : '✕'}
              </Text>

              <View style={styles.main}>
                <Text style={styles.date}>
                  {new Date(run.timestamp).toLocaleString('fr-FR')}
                </Text>
                <Text
                  style={[
                    styles.trigger,
                    run.trigger === 'manual' ? styles.manual : styles.automatic,
                  ]}
                >
                  {run.trigger === 'manual' ? 'MANUEL' : 'AUTOMATIQUE'}
                </Text>
              </View>

              <Text style={styles.days}>
                {run.status === 'success' ? `${run.syncedDays ?? 0} j` : 'Échec'}
              </Text>
            </View>
          ))}
        </View>
      )}

      <SecondaryButton title="Actualiser" onPress={load} />
      <SecondaryButton title="Tester la synchronisation" onPress={triggerSync} />
    </SettingsPage>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      marginBottom: 14,
    },

    row: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },

    lastRow: {
      borderBottomWidth: 0,
    },

    status: {
      width: 28,
      fontSize: 16,
      fontWeight: '700',
    },

    success: {
      color: c.success,
    },

    error: {
      color: c.danger,
    },

    main: {
      flex: 1,
      justifyContent: 'center',
    },

    date: {
      fontSize: 14,
      color: c.text,
    },

    trigger: {
      fontSize: 11,
      fontWeight: '700',
      marginTop: 2,
    },

    manual: {
      color: c.primary,
    },

    automatic: {
      color: c.success,
    },

    days: {
      fontSize: 14,
      fontWeight: '600',
      color: c.textSecondary,
      marginLeft: 8,
    },

    empty: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 14,
    },

    emptyText: {
      fontSize: 14,
      color: c.textMuted,
      textAlign: 'center',
    },
  })
