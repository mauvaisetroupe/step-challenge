import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, Platform } from 'react-native'

import HuaweiAccessNotice from '@/components/HuaweiAccessNotice'
import StepSourcesList from '@/components/StepSourcesList'
import RadioGroup from '@/components/settings/RadioGroup'
import {
  Card,
  Description,
  InfoRow,
  NavRow,
  PrimaryButton,
  SecondaryButton,
  SettingsPage,
  Subtitle,
} from '@/components/settings/ui'
import { openPublicPage } from '@/constants/links'
import { useFormatters } from '@/i18n'
import {
  getHuaweiLast30Days,
  HuaweiAccessError,
  revokeHuaweiHealth,
  signInHuaweiHealth,
  type HuaweiAccessReason,
} from '@/services/huaweiHealth'
import { noHealthConnectNotice } from '@/services/noHealthConnectNotice'
import {
  loadStepSource,
  saveStepSource,
  type StepSource,
} from '@/services/stepSource'
import {
  getTodayStepSources,
  type StepSourcesReport,
} from '@/services/stepSources'
import {
  isHealthConnectAvailable,
  openHealthConnectSettingsIfAvailable,
  syncLast30Days,
} from '@/services/stepSync'
import { useTheme } from '@/theme'

const SOURCES: StepSource[] = ['healthConnect', 'huawei']

type HuaweiToday =
  | { steps: number; readAt: Date }
  | { error: string; reason?: HuaweiAccessReason }

/**
 * Where Step Challenge reads the steps (ADR 0013): Health Connect or
 * Huawei Health, one at a time, then the detail of the chosen one.
 *
 * For Health Connect, the apps writing to it today and the total it
 * keeps: answers "why doesn't Step Challenge show the same number as my
 * watch?", and leads to its settings, where the priority is set.
 */
export default function StepSourceSettingsScreen() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const { formatDate, formatNumber } = useFormatters()
  const [source, setSource] = useState<StepSource | null>(null)
  const [switching, setSwitching] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [sources, setSources] = useState<
    StepSourcesReport | { error: string } | null
  >(null)
  const [huaweiToday, setHuaweiToday] = useState<HuaweiToday | null>(null)
  const [loading, setLoading] = useState(false)
  // False on a phone without Health Connect (Huawei).
  const [healthConnect, setHealthConnect] = useState<boolean | null>(null)

  const load = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return
    }

    setLoading(true)

    const chosen = await loadStepSource()
    setSource(chosen)

    try {
      if (chosen === 'huawei') {
        const days = await getHuaweiLast30Days()

        setHuaweiToday({
          steps: days[days.length - 1]?.steps ?? 0,
          readAt: new Date(),
        })
        return
      }

      const available = await isHealthConnectAvailable()

      setHealthConnect(available)

      if (available) {
        setSources(await getTodayStepSources())
      }
    } catch (error) {
      console.error('Step source error:', error)

      const failure = {
        error:
          error instanceof Error ? error.message : t('diagnostic.unknownError'),
      }

      if (chosen === 'huawei') {
        setHuaweiToday({
          ...failure,
          reason: error instanceof HuaweiAccessError ? error.reason : undefined,
        })
      } else {
        setSources(failure)
      }
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

  const switchTo = useCallback(
    async (next: StepSource) => {
      const previous = source

      setSwitching(true)
      setMessage(null)

      try {
        // Huawei first asks the user: the source only changes once the
        // HUAWEI account agreed.
        if (next === 'huawei') {
          await signInHuaweiHealth()
        }

        await saveStepSource(next)
        setSource(next)
        setSources(null)
        setHuaweiToday(null)

        // The 30 days, read again in the new source.
        await syncLast30Days().catch((error) => {
          console.error('Sync after the source change failed:', error)
        })

        await load()

        // Back to Health Connect: Step Challenge gives up its access to
        // Huawei Health. A failure must not keep the user on Huawei.
        if (previous === 'huawei') {
          await revokeHuaweiHealth()
            .then(() => setMessage(t('settings.sources.revoked')))
            .catch((error) => {
              console.error('Huawei Health revocation failed:', error)
              setMessage(t('settings.sources.revokeFailed'))
            })
        }
      } catch (error) {
        console.error('Step source change failed:', error)
        setMessage(
          error instanceof Error
            ? error.message
            : t('settings.sources.switchError'),
        )
      } finally {
        setSwitching(false)
      }
    },
    [load, source, t],
  )

  const confirmSwitch = useCallback(
    (next: StepSource) => {
      if (next === source || switching) {
        return
      }

      Alert.alert(
        t('settings.sources.confirmTitle', {
          source: t(`settings.sources.options.${next}.label`),
        }),
        t('settings.sources.confirmMessage', {
          source: t(`settings.sources.options.${next}.label`),
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('settings.sources.confirm'),
            onPress: () => {
              switchTo(next)
            },
          },
        ],
      )
    },
    [source, switching, switchTo, t],
  )

  // Huawei's verification (scenario 3.2): an explicit way to withdraw
  // the access, besides choosing Health Connect.
  const confirmRevoke = () => {
    Alert.alert(
      t('settings.sources.revokeTitle'),
      t('settings.sources.revokeMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.sources.revoke'),
          style: 'destructive',
          onPress: () => {
            switchTo('healthConnect')
          },
        },
      ],
    )
  }

  if (Platform.OS !== 'android') {
    return (
      <SettingsPage>
        <Description>{t('settings.sources.androidOnly')}</Description>
      </SettingsPage>
    )
  }

  if (source === null) {
    return (
      <SettingsPage>
        <ActivityIndicator color={colors.primary} />
      </SettingsPage>
    )
  }

  return (
    <SettingsPage>
      <Description>{t('settings.sources.description')}</Description>

      <RadioGroup
        options={SOURCES.map((value) => ({
          value,
          label: t(`settings.sources.options.${value}.label`),
          hint: t(`settings.sources.options.${value}.hint`),
        }))}
        selected={source}
        onSelect={confirmSwitch}
      />

      {switching && <ActivityIndicator color={colors.primary} />}
      {message && <Description>{message}</Description>}

      {source === 'huawei' ? (
        <>
          <Subtitle>{t('settings.sources.options.huawei.label')}</Subtitle>

          {huaweiToday !== null &&
          'error' in huaweiToday &&
          huaweiToday.reason ? (
            <HuaweiAccessNotice reason={huaweiToday.reason} onRetry={load} />
          ) : (
            <Card>
              {huaweiToday === null ? (
                <ActivityIndicator color={colors.primary} />
              ) : 'error' in huaweiToday ? (
                <Description>{huaweiToday.error}</Description>
              ) : (
                <InfoRow
                  label={t('settings.sources.huaweiToday', {
                    time: formatDate(huaweiToday.readAt, { timeStyle: 'short' }),
                  })}
                  value={formatNumber(huaweiToday.steps)}
                  last
                />
              )}
            </Card>
          )}

          <Description>{t('settings.sources.huaweiHint')}</Description>

          <SecondaryButton
            title={t('settings.sources.refresh')}
            onPress={load}
            disabled={loading}
          />

          <SecondaryButton
            title={t('settings.sources.revoke')}
            onPress={confirmRevoke}
            disabled={switching}
          />
        </>
      ) : healthConnect === false ? (
        <>
          <Description>{t('settings.sources.noHealthConnect')}</Description>

          <Description>{noHealthConnectNotice(t)}</Description>
        </>
      ) : (
        <>
          <Subtitle>{t('settings.sources.options.healthConnect.label')}</Subtitle>

          <Description>{t('settings.sources.healthConnectDescription')}</Description>

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
            onPress={openHealthConnectSettingsIfAvailable}
          />

          <SecondaryButton
            title={t('settings.sources.refresh')}
            onPress={load}
            disabled={loading}
          />
        </>
      )}

      <Card>
        <NavRow
          title={t('settings.sources.help')}
          onPress={() =>
            openPublicPage(
              source === 'huawei' ? 'help/huawei' : 'help/health-connect',
            )
          }
          last
        />
      </Card>
    </SettingsPage>
  )
}
