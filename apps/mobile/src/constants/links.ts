import { openBrowserAsync } from 'expo-web-browser'

import { i18n } from '@/i18n'

/**
 * Public site (ADR 0005): legal pages and help. Not the API, which has
 * its own hostname (EXPO_PUBLIC_API_URL).
 */
const PUBLIC_SITE_URL = 'https://step.architech.lu'

/** Pages of the public site opened from the app. */
export type PublicPage = 'agreement' | 'privacy'

// Languages of the public site: English at the root (the addresses
// declared to Google Play and Huawei), the others under /<language>/.
const SITE_LANGUAGES = ['en', 'fr']

/**
 * Address of a page of the public site in the app language, in English
 * when the site does not have that language.
 */
export function publicPageUrl(page: PublicPage) {
  const language = i18n.resolvedLanguage ?? 'en'

  return language !== 'en' && SITE_LANGUAGES.includes(language)
    ? `${PUBLIC_SITE_URL}/${language}/${page}.html`
    : `${PUBLIC_SITE_URL}/${page}.html`
}

/** Opens a page of the public site in the in-app browser. */
export function openPublicPage(page: PublicPage) {
  const url = publicPageUrl(page)

  return openBrowserAsync(url).catch((error) => {
    console.error('Cannot open page:', url, error)
  })
}
