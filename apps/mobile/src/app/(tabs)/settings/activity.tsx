import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Card, Description, SettingsPage } from '@/components/settings/ui'
import { useFormatters } from '@/i18n'
import {
  saveSleepHours,
  SLEEP_HOURS_STEP,
  useSleepHours,
  type SleepHours,
} from '@/services/sleepHours'
import { requestActivityBackfill } from '@/services/stepSync'
import { useThemedStyles, type Colors } from '@/theme'

const DAY_MINUTES = 24 * 60

/**
 * Settings → Activity: the sleep hours, during which no inactivity is
 * counted (services/inactivity).
 */
export default function ActivitySettingsScreen() {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const { formatDate } = useFormatters()
  const sleepHours = useSleepHours()

  const formatTime = (minute: number) =>
    formatDate(new Date(2000, 0, 1, Math.floor(minute / 60), minute % 60), {
      hour: '2-digit',
      minute: '2-digit',
    })

  const change = (field: keyof SleepHours, delta: number) => {
    const value =
      (sleepHours[field] + delta * SLEEP_HOURS_STEP + DAY_MINUTES) % DAY_MINUTES

    // The 30 days are recomputed with the new hours at the next sync.
    saveSleepHours({ ...sleepHours, [field]: value })
      .then(requestActivityBackfill)
      .catch((error) => console.error('Failed to save the sleep hours:', error))
  }

  const rows: { field: keyof SleepHours; label: string }[] = [
    { field: 'bed', label: t('settings.activity.bed') },
    { field: 'wake', label: t('settings.activity.wake') },
  ]

  return (
    <SettingsPage>
      <Description>{t('settings.activity.description')}</Description>

      <Card>
        {rows.map((row, index) => (
          <View
            key={row.field}
            style={[styles.row, index === rows.length - 1 && styles.lastRow]}
          >
            <Text style={styles.label}>{row.label}</Text>

            <View style={styles.stepper}>
              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                onPress={() => change(row.field, -1)}
                accessibilityRole="button"
                accessibilityLabel={t('settings.activity.earlier', {
                  label: row.label,
                })}
                hitSlop={6}
              >
                <Text style={styles.buttonText}>−</Text>
              </Pressable>

              <Text style={styles.value}>{formatTime(sleepHours[row.field])}</Text>

              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                onPress={() => change(row.field, 1)}
                accessibilityRole="button"
                accessibilityLabel={t('settings.activity.later', {
                  label: row.label,
                })}
                hitSlop={6}
              >
                <Text style={styles.buttonText}>+</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </Card>

      <Description>{t('settings.activity.detail')}</Description>
    </SettingsPage>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },

    lastRow: {
      borderBottomWidth: 0,
    },

    label: {
      fontSize: 16,
      color: c.text,
    },

    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },

    button: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },

    pressed: {
      opacity: 0.6,
    },

    buttonText: {
      fontSize: 20,
      fontWeight: '600',
      color: c.primary,
    },

    value: {
      minWidth: 56,
      textAlign: 'center',
      fontSize: 17,
      fontWeight: '600',
      color: c.text,
      fontVariant: ['tabular-nums'],
    },
  })
