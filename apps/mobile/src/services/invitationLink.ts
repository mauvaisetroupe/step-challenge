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
