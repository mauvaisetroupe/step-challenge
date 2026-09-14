import {
  DarkTheme,
  DefaultTheme,
  Slot,
  ThemeProvider,
} from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { useColorScheme } from 'react-native'

import { AnimatedSplashOverlay } from '@/components/animated-icon'
import AppUpdateChecker from '@/components/AppUpdateChecker'
import { registerBackgroundStepSync } from '@/services/backgroundSync'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const colorScheme = useColorScheme()

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
      <AppUpdateChecker />
      <Slot />
    </ThemeProvider>
  )
}