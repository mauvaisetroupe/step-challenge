import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import {
  Description,
  PrimaryButton,
  SettingsPage,
  Subtitle,
} from '@/components/settings/ui'
import {
  getBackgroundSyncStatus,
  syncNow,
  type BackgroundSyncRun,
} from '@/services/backgroundSync'
import { useFormatters } from '@/i18n'
import { useThemedStyles, type Colors } from '@/theme'

/** History of the background step sync, and a "Sync now" button. */
export default function SyncSettingsScreen() {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const { formatDateTime } = useFormatters()
  const [history, setHistory] = useState<BackgroundSyncRun[]>([])
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<BackgroundSyncRun | null>(null)

  const load = useCallback(async () => {
    const status = await getBackgroundSyncStatus()
    setHistory(status.history)
  }, [])

  // Reloaded each time the screen is shown: the background task may have
  // run meanwhile.
  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const sync = useCallback(async () => {
    setSyncing(true)
    setResult(null)

    try {
      setResult(await syncNow())
      await load()
    } finally {
      setSyncing(false)
    }
  }, [load])

  return (
    <SettingsPage>
      <Description>{t('settings.sync.description')}</Description>

      <PrimaryButton
        title={t('settings.sync.syncNow')}
        onPress={sync}
        loading={syncing}
      />

      {result && (
        <Text
          style={[
            styles.result,
            result.status === 'success' ? styles.success : styles.error,
          ]}
        >
          {result.status === 'success'
            ? t('settings.sync.syncedNow', { count: result.syncedDays ?? 0 })
            : t('settings.sync.failedNow', { error: result.error ?? '' })}
        </Text>
      )}

      <Subtitle>{t('settings.sync.detail')}</Subtitle>

      {history.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t('settings.sync.empty')}</Text>
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
                  {formatDateTime(new Date(run.timestamp))}
                </Text>
                <Text
                  style={[
                    styles.trigger,
                    run.trigger === 'manual' ? styles.manual : styles.automatic,
                  ]}
                >
                  {run.trigger === 'manual'
                    ? t('settings.sync.manual')
                    : t('settings.sync.automatic')}
                </Text>
                {run.error && (
                  <Text style={styles.errorDetail} numberOfLines={3}>
                    {run.error}
                  </Text>
                )}
              </View>

              <Text style={styles.days}>
                {run.status === 'success'
                  ? t('settings.sync.days', { count: run.syncedDays ?? 0 })
                  : t('settings.sync.failed')}
              </Text>
            </View>
          ))}
        </View>
      )}

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

    result: {
      marginBottom: 16,
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },

    errorDetail: {
      marginTop: 2,
      fontSize: 12,
      color: c.textMuted,
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
