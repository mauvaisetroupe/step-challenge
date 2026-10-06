import {
  DarkTheme,
  DefaultTheme,
  router,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { onSignedOut } from '@/api/client'
import { LanguageProvider } from '@/i18n'
import { AnimatedSplashOverlay } from '@/components/animated-icon'
import { registerBackgroundStepSync } from '@/services/backgroundSync'
import { ThemeProvider, useTheme } from '@/theme'

SplashScreen.preventAutoHideAsync()

/**
 * Navigation (stack headers, screen backgrounds) in the colors of the
 * current appearance.
 */
function ThemedNavigation() {
  const { colors, scheme } = useTheme()
  const { t } = useTranslation()

  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme

    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.background,
        text: colors.text,
        border: colors.border,
      },
    }
  }, [colors, scheme])

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <AnimatedSplashOverlay />
      {/*
        Stack rather than Slot: screens opened from the tabs (friends,
        invitation) get a header with a back button.
      */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="friends"
          options={{ headerShown: true, title: t('friends.title') }}
        />
        <Stack.Screen
          name="i/[code]"
          options={{ headerShown: true, title: t('invitation.title') }}
        />
      </Stack>
    </NavigationThemeProvider>
  )
}

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
    // Language and appearance: phone settings, or the choices made in
    // Settings → Language (ADR 0007) and Settings → Appearance (app.json:
    // userInterfaceStyle "automatic").
    <LanguageProvider>
      <ThemeProvider>
        <ThemedNavigation />
      </ThemeProvider>
    </LanguageProvider>
  )
}
