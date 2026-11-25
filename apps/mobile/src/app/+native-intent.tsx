import { toAppPath } from '@/services/invitationLink'

/**
 * Links received from the system, before Expo Router navigates:
 * invitation links of the site lose their /step-challenge prefix
 * (ADR 0014). Must never throw: the app would crash.
 */
export function redirectSystemPath({ path }: { path: string }) {
  try {
    return toAppPath(path)
  } catch {
    return path
  }
}
