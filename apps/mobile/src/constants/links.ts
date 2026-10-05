import { openBrowserAsync } from 'expo-web-browser'

/**
 * Public site (ADR 0005): legal pages and help. Not the API, which has
 * its own hostname (EXPO_PUBLIC_API_URL).
 */
const PUBLIC_SITE_URL = 'https://step.architech.lu'

// URLs declared in the Play Console and to Huawei: they keep working once
// the site moves to Hugo (redirected to /en/…).
export const TERMS_URL = `${PUBLIC_SITE_URL}/agreement.html`
export const PRIVACY_URL = `${PUBLIC_SITE_URL}/privacy.html`

/** Opens a page of the public site in the in-app browser. */
export function openPublicPage(url: string) {
  return openBrowserAsync(url).catch((error) => {
    console.error('Cannot open page:', url, error)
  })
}
