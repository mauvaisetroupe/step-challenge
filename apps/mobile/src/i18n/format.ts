import { getLocales } from 'expo-localization'
import { useMemo } from 'react'

import i18n, { type Language } from './i18n'
import { useLanguage } from './LanguageProvider'

/**
 * Locale used to format numbers and dates: the app language, with the
 * phone's region when the phone uses that language (fr-BE, en-GB…), so
 * that dates follow local habits.
 */
export function formatLocaleFor(language: string) {
  try {
    const match = getLocales().find(
      (locale) => locale.languageCode === language,
    )

    if (match) {
      return match.languageTag
    }
  } catch {
    // Falls back to the language alone.
  }

  return language
}

function makeFormatters(locale: string) {
  return {
    locale,

    /** 12345 → "12 345" in French, "12,345" in English. */
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(value),

    formatDate: (date: Date, options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, options).format(date),

    /** Date and time, for logs shown to the user. */
    formatDateTime: (date: Date) =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(date),
  }
}

export type Formatters = ReturnType<typeof makeFormatters>

/**
 * Formatters of the current language, for components: they change with
 * the language, so that the screens (and the React Compiler's memoized
 * values) follow it.
 */
export function useFormatters(): Formatters {
  const { language } = useLanguage()

  return useMemo(() => makeFormatters(formatLocaleFor(language)), [language])
}

/** Formatters of the current language, outside components. */
export function getFormatters(language: Language | string = i18n.language) {
  return makeFormatters(formatLocaleFor(language))
}
