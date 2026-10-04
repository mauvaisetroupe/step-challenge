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

export class GoogleSignInFailure extends Error {
  constructor(
    readonly reason: GoogleSignInFailureReason,
    message: string,
  ) {
    super(message)
    this.name = 'GoogleSignInFailure'
  }
}

export const isGoogleSignInSupported = false

export async function signInWithGoogle(): Promise<GoogleCredential | null> {
  throw new GoogleSignInFailure(
    'unavailable',
    "La connexion n'est disponible que dans l'application Android.",
  )
}

export async function signOutFromGoogle() {}
