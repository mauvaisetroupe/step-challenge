import { Stack } from 'expo-router'

/**
 * Settings tab: a menu (index) and one detail screen per section, with
 * a back button. The menu keeps the fixed title of the tab screens.
 */
export default function SettingsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="account" options={{ title: 'Compte' }} />
      <Stack.Screen name="appearance" options={{ title: 'Apparence' }} />
      <Stack.Screen
        name="sync"
        options={{ title: 'Synchronisation en arrière-plan' }}
      />
      <Stack.Screen name="huawei" options={{ title: 'Huawei Health' }} />
      <Stack.Screen name="diagnostic" options={{ title: 'Diagnostic' }} />
      <Stack.Screen name="about" options={{ title: 'À propos' }} />
      <Stack.Screen name="legal" options={{ title: 'Informations légales' }} />
    </Stack>
  )
}
