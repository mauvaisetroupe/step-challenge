import AsyncStorage from '@react-native-async-storage/async-storage'
import { useLocales } from 'expo-localization'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import i18n, {
  isLanguage,
  languageFromLocales,
  type Language,
} from './i18n'

/** Language chosen in the settings. */
export type LanguagePreference = 'system' | Language

const STORAGE_KEY = 'language-preference'

type LanguageContextValue = {
  /** Language shown. */
  language: Language
  preference: LanguagePreference
  setPreference: (preference: LanguagePreference) => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function isPreference(value: unknown): value is LanguagePreference {
  return value === 'system' || isLanguage(value)
}

/**
 * Language of the app (ADR 0007): the phone's by default, or the choice
 * made in Settings → Language, kept on the device.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  // Re-renders when the phone languages change.
  const locales = useLocales()
  const [preference, setPreferenceState] =
    useState<LanguagePreference>('system')

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (isPreference(stored)) {
          setPreferenceState(stored)
        }
      })
      .catch((error) => {
        console.warn('Cannot read the language preference:', error)
      })
  }, [])

  const setPreference = useCallback((value: LanguagePreference) => {
    setPreferenceState(value)
    AsyncStorage.setItem(STORAGE_KEY, value).catch((error) => {
      console.warn('Cannot save the language preference:', error)
    })
  }, [])

  const language =
    preference === 'system' ? languageFromLocales(locales) : preference

  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language).catch((error) => {
        console.warn('Cannot change the language:', error)
      })
    }
  }, [language])

  const value = useMemo(
    () => ({ language, preference, setPreference }),
    [language, preference, setPreference],
  )

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const value = useContext(LanguageContext)

  if (!value) {
    throw new Error('useLanguage must be used inside LanguageProvider')
  }

  return value
}
