import { openBrowserAsync } from 'expo-web-browser'

import { i18n } from '@/i18n'

/**
 * Public site (ADR 0014): legal pages and help, in the Step Challenge
 * section of the sport apps site. Not the API, which has its own
 * hostname (EXPO_PUBLIC_API_URL).
 */
const PUBLIC_SITE_URL = 'https://sport.architech.lu'

const SECTION = 'step-challenge'

/**
 * Pages of the public site opened from the app. A trailing slash is a
 * section index (help/), the others are .html pages.
 */
export type PublicPage =
  | 'agreement'
  | 'privacy'
  | 'help/'
  | 'help/health-connect'
  | 'help/huawei'
  | 'help/invite-friends'

// Languages of the public site: English at the root (the addresses
// declared to Google Play and Huawei), the others under /<language>/,
// before the section.
const SITE_LANGUAGES = ['en', 'fr']

/**
 * Address of a page of the public site in the app language, in English
 * when the site does not have that language.
 */
export function publicPageUrl(page: PublicPage) {
  const language = i18n.resolvedLanguage ?? 'en'
  const path = page.endsWith('/') ? page : `${page}.html`

  return language !== 'en' && SITE_LANGUAGES.includes(language)
    ? `${PUBLIC_SITE_URL}/${language}/${SECTION}/${path}`
    : `${PUBLIC_SITE_URL}/${SECTION}/${path}`
}

/** Opens a page of the public site in the in-app browser. */
export function openPublicPage(page: PublicPage) {
  const url = publicPageUrl(page)

  return openBrowserAsync(url).catch((error) => {
    console.error('Cannot open page:', url, error)
  })
}
