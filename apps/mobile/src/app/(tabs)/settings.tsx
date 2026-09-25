import * as Clipboard from 'expo-clipboard'

import Constants from 'expo-constants'

import { useCallback, useEffect, useState } from 'react'

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import {
  getBackgroundSyncStatus,
  triggerBackgroundStepSyncForTesting,
  type BackgroundSyncRun,
} from '../../services/backgroundSync'

import {
  formatDiagnostic,
  getHealthConnectDiagnostic,
  type DiagnosticItem,
  type HealthConnectDiagnostic,
} from '../../services/healthConnectDiagnostic'

type BackgroundSyncStatus = {
  history: BackgroundSyncRun[]
}

export default function SettingsScreen() {
  const [diagnostic, setDiagnostic] =
    useState<HealthConnectDiagnostic | null>(
      null,
    )

  const [loading, setLoading] =
    useState(false)

  const [copied, setCopied] =
    useState(false)

  const [backgroundSync, setBackgroundSync] =
    useState<BackgroundSyncStatus>({
      history: [],
    })

  const loadBackgroundSyncStatus =
    useCallback(async () => {
      const status =
        await getBackgroundSyncStatus()

      setBackgroundSync(status)
    }, [])

  useEffect(() => {
    loadBackgroundSyncStatus()
  }, [loadBackgroundSyncStatus])

  const triggerBackgroundSync =
    useCallback(async () => {
      try {
        console.log(
          'Calling manual background task test',
        )

        await triggerBackgroundStepSyncForTesting()

        await loadBackgroundSyncStatus()
      } catch (error) {
        console.error(
          'Background task test failed:',
          error,
        )
      }
    }, [loadBackgroundSyncStatus])

  const runDiagnostic = useCallback(
    async () => {
      setLoading(true)
      setCopied(false)

      try {
        const result =
          await getHealthConnectDiagnostic()

        setDiagnostic(result)
      } catch (error) {
        console.error(
          'Diagnostic error:',
          error,
        )

        setDiagnostic({
          items: [
            {
              label: 'Diagnostic',
              value:
                error instanceof Error
                  ? error.message
                  : 'Erreur inconnue',
              status: 'error',
            },
          ],
          generatedAt:
            new Date().toISOString(),
        })
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const copyDiagnostic = async () => {
    if (!diagnostic) {
      return
    }

    await Clipboard.setStringAsync(
      formatDiagnostic(diagnostic),
    )

    setCopied(true)

    setTimeout(() => {
      setCopied(false)
    }, 2000)
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>
        Paramètres
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          À propos
        </Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>
              Application
            </Text>

            <Text style={styles.value}>
              Step Challenge
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>
              Version
            </Text>

            <Text style={styles.value}>
              {Constants.expoConfig?.version ??
                'Inconnue'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Synchronisation en arrière-plan
        </Text>

        <Text style={styles.description}>
          La synchronisation vérifie régulièrement
          les 30 derniers jours de données.
        </Text>

        <Text style={styles.historyTitle}>
          Dernières exécutions
        </Text>

        {backgroundSync.history.length === 0 ? (
          <View style={styles.historyEmpty}>
            <Text style={styles.historyEmptyText}>
              Aucune exécution enregistrée
            </Text>
          </View>
        ) : (
          <View style={styles.historyCard}>
            {backgroundSync.history.map(
              (run, index) => (
                <View
                  key={`${run.timestamp}-${index}`}
                  style={[
                    styles.historyRow,
                    index ===
                      backgroundSync.history
                        .length -
                        1 &&
                      styles.lastHistoryRow,
                  ]}
                >
                  <Text
                    style={[
                      styles.historyStatus,
                      run.status ===
                        'success' &&
                        styles.successValue,
                      run.status ===
                        'failed' &&
                        styles.errorValue,
                    ]}
                  >
                    {run.status ===
                    'success'
                      ? '✓'
                      : '✕'}
                  </Text>

                  <View style={styles.historyMain}>
                    <Text
                      style={styles.historyDate}
                    >
                      {new Date(
                        run.timestamp,
                      ).toLocaleString('fr-FR')}
                    </Text>

                    <Text
                      style={[
                        styles.historyTrigger,
                        run.trigger ===
                          'manual' &&
                          styles.manualTrigger,
                        run.trigger ===
                          'background' &&
                          styles.backgroundTrigger,
                      ]}
                    >
                      {run.trigger ===
                      'manual'
                        ? '🔵 MANUEL'
                        : '🟢 AUTOMATIQUE'}
                    </Text>
                  </View>

                  <Text
                    style={styles.historyDays}
                  >
                    {run.status ===
                    'success'
                      ? `${run.syncedDays ?? 0} j`
                      : 'Échec'}
                  </Text>
                </View>
              ),
            )}
          </View>
        )}

        <Pressable
          style={styles.refreshButton}
          onPress={loadBackgroundSyncStatus}
        >
          <Text style={styles.refreshButtonText}>
            Actualiser
          </Text>
        </Pressable>

        <Pressable
          style={styles.refreshButton}
          onPress={triggerBackgroundSync}
        >
          <Text style={styles.refreshButtonText}>
            Tester la synchronisation
          </Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Diagnostic
        </Text>

        <Text style={styles.description}>
          Vérifie la connexion à Health Connect,
          les permissions et l'accès au serveur.
        </Text>

        <Pressable
          style={[
            styles.primaryButton,
            loading &&
              styles.primaryButtonDisabled,
          ]}
          onPress={runDiagnostic}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator
              color="#ffffff"
            />
          ) : (
            <Text style={styles.primaryButtonText}>
              Lancer le diagnostic
            </Text>
          )}
        </Pressable>

        {diagnostic && (
          <View style={styles.diagnosticCard}>
            {diagnostic.items.map(
              (item, index) => (
                <DiagnosticRow
                  key={`${item.label}-${index}`}
                  item={item}
                />
              ),
            )}

            <View style={styles.separator} />

            <Text style={styles.generatedAt}>
              Diagnostic généré le{' '}
              {new Date(
                diagnostic.generatedAt,
              ).toLocaleString('fr-FR')}
            </Text>

            <Pressable
              style={styles.copyButton}
              onPress={copyDiagnostic}
            >
              <Text style={styles.copyButtonText}>
                {copied
                  ? '✓ Diagnostic copié'
                  : 'Copier le diagnostic'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

function DiagnosticRow({
  item,
}: {
  item: DiagnosticItem
}) {
  const icon =
    item.status === 'ok'
      ? '✓'
      : item.status === 'error'
        ? '✕'
        : item.status === 'warning'
          ? '!'
          : '?'

  return (
    <View style={styles.diagnosticRow}>
      <View
        style={[
          styles.status,
          item.status === 'ok' &&
            styles.statusOk,
          item.status === 'error' &&
            styles.statusError,
          item.status === 'warning' &&
            styles.statusWarning,
          item.status === 'unknown' &&
            styles.statusUnknown,
        ]}
      >
        <Text style={styles.statusText}>
          {icon}
        </Text>
      </View>

      <Text style={styles.diagnosticLabel}>
        {item.label}
      </Text>

      <Text
        style={styles.diagnosticValue}
        numberOfLines={3}
      >
        {item.value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 28,
  },

  section: {
    marginBottom: 28,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },

  description: {
    fontSize: 15,
    lineHeight: 21,
    color: '#6B7280',
    marginBottom: 14,
  },

  card: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 14,
  },

  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  lastRow: {
    borderBottomWidth: 0,
  },

  label: {
    fontSize: 15,
    color: '#6B7280',
  },

  value: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    maxWidth: '60%',
    textAlign: 'right',
  },

  successValue: {
    color: '#15803D',
  },

  errorValue: {
    color: '#DC2626',
  },

  refreshButton: {
    marginTop: 10,
    minHeight: 44,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },

  refreshButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },

  historyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },

  historyCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 14,
  },

  historyRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  lastHistoryRow: {
    borderBottomWidth: 0,
  },

  historyStatus: {
    width: 28,
    fontSize: 16,
    fontWeight: '700',
  },

  historyMain: {
    flex: 1,
    justifyContent: 'center',
  },

  historyDate: {
    fontSize: 14,
    color: '#374151',
  },

  historyTrigger: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },

  manualTrigger: {
    color: '#2563EB',
  },

  backgroundTrigger: {
    color: '#15803D',
  },

  historyDays: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 8,
  },

  historyEmpty: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 14,
  },

  historyEmptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },

  primaryButton: {
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },

  primaryButtonDisabled: {
    opacity: 0.6,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  diagnosticCard: {
    marginTop: 14,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 14,
  },

  diagnosticRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  status: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusOk: {
    backgroundColor: '#DCFCE7',
  },

  statusError: {
    backgroundColor: '#FEE2E2',
  },

  statusWarning: {
    backgroundColor: '#FEF3C7',
  },

  statusUnknown: {
    backgroundColor: '#E5E7EB',
  },

  statusText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },

  diagnosticLabel: {
    width: 125,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  diagnosticValue: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    textAlign: 'right',
  },

  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },

  generatedAt: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
  },

  copyButton: {
    minHeight: 44,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
  },

  copyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
})