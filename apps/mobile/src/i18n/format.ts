import { getLocales } from 'expo-localization'

import i18n from './i18n'

/**
 * Locale used to format numbers and dates: the app language, with the
 * phone's region when the phone uses that language (fr-BE, en-GB…), so
 * that dates follow local habits.
 */
export function getFormatLocale() {
  const language = i18n.language

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

/** 12345 → "12 345" in French, "12,345" in English. */
export function formatNumber(value: number) {
  return new Intl.NumberFormat(getFormatLocale()).format(value)
}

export function formatDate(
  date: Date,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(getFormatLocale(), options).format(date)
}

/** Date and time, for logs shown to the user. */
export function formatDateTime(date: Date) {
  return formatDate(date, { dateStyle: 'short', timeStyle: 'medium' })
}
