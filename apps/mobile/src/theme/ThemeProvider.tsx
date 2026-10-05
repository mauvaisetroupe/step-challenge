import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Appearance, StyleSheet, useColorScheme } from 'react-native'

import { darkColors, lightColors, type Colors } from './colors'

/** Appearance chosen in the settings. */
export type AppearancePreference = 'system' | 'light' | 'dark'

export type Scheme = 'light' | 'dark'

/** Names shown in Settings → Appearance. */
export const APPEARANCE_LABELS: Record<AppearancePreference, string> = {
  system: 'Système',
  light: 'Clair',
  dark: 'Sombre',
}

const STORAGE_KEY = 'appearance-preference'

type ThemeContextValue = {
  colors: Colors
  scheme: Scheme
  preference: AppearancePreference
  setPreference: (preference: AppearancePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function isPreference(value: unknown): value is AppearancePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

/**
 * Applies the preference to the whole app, native components included
 * (tab bar, status bar, system dialogs): 'unspecified' follows the
 * phone setting again.
 */
function applyToNative(preference: AppearancePreference) {
  try {
    Appearance.setColorScheme(
      preference === 'system' ? 'unspecified' : preference,
    )
  } catch (error) {
    // Not supported on every platform (web): the colors still follow
    // the preference through the context.
    console.warn('Appearance.setColorScheme failed:', error)
  }
}

/**
 * Light or dark appearance of the app: follows the phone setting by
 * default, or the choice made in Settings → Appearance, kept on the
 * device.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme()
  const [preference, setPreferenceState] =
    useState<AppearancePreference>('system')

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (isPreference(stored)) {
          setPreferenceState(stored)
          applyToNative(stored)
        }
      })
      .catch((error) => {
        console.warn('Cannot read the appearance preference:', error)
      })
  }, [])

  const setPreference = useCallback((value: AppearancePreference) => {
    setPreferenceState(value)
    applyToNative(value)
    AsyncStorage.setItem(STORAGE_KEY, value).catch((error) => {
      console.warn('Cannot save the appearance preference:', error)
    })
  }, [])

  const scheme: Scheme =
    preference === 'system'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : preference

  const value = useMemo(
    () => ({
      colors: scheme === 'dark' ? darkColors : lightColors,
      scheme,
      preference,
      setPreference,
    }),
    [scheme, preference, setPreference],
  )

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  )
}

export function useTheme() {
  const value = useContext(ThemeContext)

  if (!value) {
    throw new Error('useTheme must be used inside ThemeProvider')
  }

  return value
}

/**
 * Styles that depend on the colors, recomputed only when the
 * appearance changes:
 *
 *   const styles = useThemedStyles(createStyles)
 *   const createStyles = (c: Colors) => StyleSheet.create({ ... })
 */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (colors: Colors) => T,
) {
  const { colors } = useTheme()

  return useMemo(() => factory(colors), [factory, colors])
}
