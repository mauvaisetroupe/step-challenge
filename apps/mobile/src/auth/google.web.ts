/**
 * Web variant: Google sign-in uses a native Android module and is not
 * available on the web yet (the web client of ADR 0001 will use Google
 * Identity Services and a session cookie).
 */

import type {
  GoogleCredential,
  GoogleSignInFailureReason,
} from './google'

export type { GoogleCredential, GoogleSignInFailureReason }

/**
 * The message is technical, for the logs; the sign-in screen shows a
 * translated text chosen from the reason (ADR 0007).
 */
export class GoogleSignInFailure extends Error {
  constructor(
    readonly reason: GoogleSignInFailureReason,
    message: string,
    /** Error code of the Google module, for 'unknown'. */
    readonly code?: string,
  ) {
    super(message)
    this.name = 'GoogleSignInFailure'
  }
}

export const isGoogleSignInSupported = false

export async function signInWithGoogle(): Promise<GoogleCredential | null> {
  throw new GoogleSignInFailure(
    'unavailable',
    'Sign-in is only available in the Android app.',
  )
}

export async function signOutFromGoogle() {}
