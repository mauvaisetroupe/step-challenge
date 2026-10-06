import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { useFormatters } from '@/i18n'
import { useThemedStyles, type Colors } from '@/theme'

/** History of the background step sync, and a manual test run. */
export default function SyncSettingsScreen() {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const { formatDateTime } = useFormatters()
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
      <Description>{t('settings.sync.description')}</Description>

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

      <SecondaryButton title={t('settings.sync.refresh')} onPress={load} />
      <SecondaryButton title={t('settings.sync.test')} onPress={triggerSync} />
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
