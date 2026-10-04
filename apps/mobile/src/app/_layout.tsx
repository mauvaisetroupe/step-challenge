import {
  DarkTheme,
  DefaultTheme,
  router,
  Slot,
  ThemeProvider,
} from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { useColorScheme } from 'react-native'

import { onSignedOut } from '@/api/client'
import { AnimatedSplashOverlay } from '@/components/animated-icon'
import { registerBackgroundStepSync } from '@/services/backgroundSync'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const colorScheme = useColorScheme()

  // The backend rejected the session (expired, revoked, account
  // deleted): go back to the sign-in screen.
  useEffect(
    () =>
      onSignedOut(() => {
        router.replace('/sign-in')
      }),
    [],
  )

  useEffect(() => {
    registerBackgroundStepSync().catch((error) => {
      console.error(
        'Failed to register background step sync:',
        error,
      )
    })
  }, [])

  return (
    <ThemeProvider
      value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
    >
      <AnimatedSplashOverlay />
      <Slot />
    </ThemeProvider>
  )
}