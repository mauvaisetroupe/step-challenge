import { Stack } from 'expo-router'
import { useTranslation } from 'react-i18next'

/**
 * Settings tab: a menu (index) and one detail screen per section, with
 * a back button. The menu keeps the fixed title of the tab screens.
 */
export default function SettingsLayout() {
  const { t } = useTranslation()

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="account"
        options={{ title: t('settings.account.title') }}
      />
      <Stack.Screen
        name="appearance"
        options={{ title: t('settings.appearance.title') }}
      />
      <Stack.Screen
        name="language"
        options={{ title: t('settings.language.title') }}
      />
      <Stack.Screen name="sync" options={{ title: t('settings.sync.title') }} />
      <Stack.Screen
        name="huawei"
        options={{ title: t('settings.huawei.title') }}
      />
      <Stack.Screen
        name="diagnostic"
        options={{ title: t('settings.diagnostic.title') }}
      />
      <Stack.Screen
        name="about"
        options={{ title: t('settings.about.title') }}
      />
      <Stack.Screen
        name="legal"
        options={{ title: t('settings.legal.title') }}
      />
    </Stack>
  )
}
