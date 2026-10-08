import Constants from 'expo-constants'
import { useTranslation } from 'react-i18next'
import { Linking, Platform } from 'react-native'

import {
  Card,
  Description,
  InfoRow,
  SecondaryButton,
  SettingsPage,
} from '@/components/settings/ui'

/**
 * Store app page, also for the dev variant (its own package is not on
 * the Store). Testers of a closed test see the test version there.
 */
const PLAY_STORE_PACKAGE = 'lu.architech.stepchallenge'

async function openPlayStore() {
  try {
    await Linking.openURL(`market://details?id=${PLAY_STORE_PACKAGE}`)
  } catch {
    // No Play Store app: the web page.
    await Linking.openURL(
      `https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE}`,
    )
  }
}

export default function AboutSettingsScreen() {
  const { t } = useTranslation()

  return (
    <SettingsPage>
      <Card>
        <InfoRow label={t('settings.about.app')} value="Step Challenge" />
        <InfoRow
          label={t('settings.about.version')}
          value={Constants.expoConfig?.version ?? t('settings.about.unknown')}
          last
        />
      </Card>

      {Platform.OS === 'android' && (
        <>
          <SecondaryButton
            title={t('settings.about.update')}
            onPress={() => {
              openPlayStore().catch((error) => {
                console.error('Failed to open the Play Store:', error)
              })
            }}
          />
          <Description>{t('settings.about.updateDetail')}</Description>
        </>
      )}
    </SettingsPage>
  )
}
