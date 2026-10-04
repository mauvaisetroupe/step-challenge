import {
  DefaultTheme,
  router,
  Stack,
  ThemeProvider,
} from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'

import { onSignedOut } from '@/api/client'
import { AnimatedSplashOverlay } from '@/components/animated-icon'
import { registerBackgroundStepSync } from '@/services/backgroundSync'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
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
    // Light theme only: the screens are designed for a light background
    // (app.json forces userInterfaceStyle to "light").
    <ThemeProvider value={DefaultTheme}>
      <AnimatedSplashOverlay />
      {/*
        Stack rather than Slot: screens opened from the tabs (friends,
        invitation) get a header with a back button.
      */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="friends"
          options={{ headerShown: true, title: 'Amis' }}
        />
        <Stack.Screen
          name="i/[code]"
          options={{ headerShown: true, title: 'Invitation' }}
        />
      </Stack>
    </ThemeProvider>
  )
}