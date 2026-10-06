// Hermes does not always provide Intl.PluralRules, which i18next needs
// for plurals and ordinals: polyfilled only when missing or incomplete.
import 'intl-pluralrules'

import { getLocales, type Locale } from 'expo-localization'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import fr from './locales/fr.json'

/**
 * Languages of the app (ADR 0007), each named in its own language for
 * Settings → Language. Adding a language: its file in locales/, and a
 * line here and in `resources`.
 */
export const LANGUAGE_NAMES = {
  fr: 'Français',
  en: 'English',
} as const

export type Language = keyof typeof LANGUAGE_NAMES

export const LANGUAGES = Object.keys(LANGUAGE_NAMES) as Language[]

/** For a phone language the app does not support. */
export const FALLBACK_LANGUAGE: Language = 'en'

export const resources = {
  en: { translation: en },
  fr: { translation: fr },
} as const

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && value in LANGUAGE_NAMES
}

/**
 * First language of the phone that the app supports: someone with
 * Spanish then French gets French. On Android 13 and later, this is
 * the language chosen for the app in the phone settings, if any.
 */
export function languageFromLocales(locales: Locale[]): Language {
  for (const locale of locales) {
    if (isLanguage(locale.languageCode)) {
      return locale.languageCode
    }
  }

  return FALLBACK_LANGUAGE
}

export function getSystemLanguage(): Language {
  try {
    return languageFromLocales(getLocales())
  } catch (error) {
    console.warn('Cannot read the phone languages:', error)
    return FALLBACK_LANGUAGE
  }
}

i18n.use(initReactI18next).init({
  resources,
  lng: getSystemLanguage(),
  fallbackLng: FALLBACK_LANGUAGE,
  supportedLngs: LANGUAGES,
  interpolation: {
    // React already escapes the values.
    escapeValue: false,
  },
})

export default i18n
