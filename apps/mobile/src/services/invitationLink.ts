/**
 * Invitation links (ADR 0014): https://sport.architech.lu/step-challenge/i/<code>.
 * The app's route is /i/[code]: the /step-challenge prefix of the site
 * section is removed before Expo Router navigates. Tested in
 * invitationLink.test.ts.
 */

const SECTION_INVITATION = /^\/step-challenge(\/i\/[^/?#]+)\/?(?:[?#].*)?$/

/**
 * App path for a link received from the system, `path` unchanged when it
 * is not an invitation of the site. Expo Router passes either a full URL
 * or a path: both are accepted.
 */
export function toAppPath(path: string) {
  let pathname = path

  try {
    pathname = new URL(path, 'https://sport.architech.lu').pathname
  } catch {
    return path
  }

  const match = pathname.match(SECTION_INVITATION)

  return match ? match[1] : path
}

const INSTALL_REFERRER_INVITATION = /(?:^|&)invite=([^&]*)/

const CODE = /^[0-9A-HJKMNP-TV-Z]{8}$/

/**
 * Invitation code carried through the install by Google Play (ADR 0015):
 * the invitation page links to the store with
 * `referrer=invite%3DK7F3M9QX`, and the installed app reads back
 * `invite=K7F3M9QX`. Returns "K7F3-M9QX", or null for any other
 * referrer (an ordinary install: utm_source=google-play&…).
 */
export function invitationFromInstallReferrer(referrer: string) {
  const match = referrer.match(INSTALL_REFERRER_INVITATION)

  if (!match) {
    return null
  }

  let code: string

  try {
    code = decodeURIComponent(match[1]).toUpperCase().replace(/-/g, '')
  } catch {
    return null
  }

  return CODE.test(code) ? `${code.slice(0, 4)}-${code.slice(4)}` : null
}
