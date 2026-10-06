import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Platform } from 'react-native'
import { openHealthConnectSettings } from 'react-native-health-connect'

import StepSourcesList from '@/components/StepSourcesList'
import {
  Card,
  Description,
  PrimaryButton,
  SecondaryButton,
  SettingsPage,
} from '@/components/settings/ui'
import {
  getTodayStepSources,
  type StepSourcesReport,
} from '@/services/stepSources'
import { useTheme } from '@/theme'

/**
 * Where today's steps come from: the apps writing to Health Connect
 * (watch, phone…) and the total it keeps. Answers "why doesn't Step
 * Challenge show the same number as my watch?", and leads to the Health
 * Connect settings, where the priority between sources is set.
 *
 * Also the natural place for choosing the step provider (Health Connect
 * or Huawei Health) once Huawei is available.
 */
export default function StepSourcesSettingsScreen() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const [sources, setSources] = useState<
    StepSourcesReport | { error: string } | null
  >(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return
    }

    setLoading(true)

    try {
      setSources(await getTodayStepSources())
    } catch (error) {
      console.error('Step sources error:', error)
      setSources({
        error:
          error instanceof Error ? error.message : t('diagnostic.unknownError'),
      })
    } finally {
      setLoading(false)
    }
  }, [t])

  // Reloaded when coming back from the Health Connect settings.
  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  if (Platform.OS !== 'android') {
    return (
      <SettingsPage>
        <Description>{t('settings.sources.androidOnly')}</Description>
      </SettingsPage>
    )
  }

  return (
    <SettingsPage>
      <Description>{t('settings.sources.description')}</Description>

      <Card>
        {sources ? (
          <StepSourcesList sources={sources} />
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </Card>

      <Description>{t('diagnostic.sources.hint')}</Description>

      <PrimaryButton
        title={t('settings.sources.openHealthConnect')}
        onPress={() => openHealthConnectSettings()}
      />

      <SecondaryButton
        title={t('settings.sources.refresh')}
        onPress={load}
        disabled={loading}
      />
    </SettingsPage>
  )
}
