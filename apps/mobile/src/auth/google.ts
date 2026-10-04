import {
  GoogleOneTapSignIn,
  isCancelledResponse,
  isErrorWithCode,
  isNoSavedCredentialFoundResponse,
  isSuccessResponse,
  statusCodes,
  type OneTapResponse,
} from 'react-native-nitro-google-signin'

/**
 * Google sign-in through Android Credential Manager (ADR 0001).
 *
 * Only the ID token is sent to the backend, which keeps the stable
 * subject identifier. The given name is used to prefill the display
 * name field; the user can change it before it is sent.
 */

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID

if (!webClientId) {
  throw new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not configured')
}

GoogleOneTapSignIn.configure({ webClientId })

export type GoogleCredential = {
  idToken: string
  givenName: string | null
}

export type GoogleSignInFailureReason =
  | 'configuration'
  | 'play-services'
  | 'unavailable'
  | 'unknown'

export class GoogleSignInFailure extends Error {
  constructor(
    readonly reason: GoogleSignInFailureReason,
    message: string,
  ) {
    super(message)
    this.name = 'GoogleSignInFailure'
  }
}

export const isGoogleSignInSupported = true

function toCredential(response: OneTapResponse): GoogleCredential | null {
  if (!isSuccessResponse(response)) {
    return null
  }

  return {
    idToken: response.data.idToken,
    givenName: response.data.user.givenName,
  }
}

/**
 * Asks Google for an ID token.
 *
 * Uses the explicit "Sign in with Google" dialog, which lists every
 * Google account on the device and offers to add one. The one-tap flow
 * (signIn) is not used: it only offers accounts already authorized for
 * the app, so a user could never switch to another account. Signed-in
 * users keep their session and never see this dialog.
 *
 * Returns null when the user dismisses the dialog.
 */
export async function signInWithGoogle(): Promise<GoogleCredential | null> {
  try {
    await GoogleOneTapSignIn.checkPlayServices()

    const response = await GoogleOneTapSignIn.presentExplicitSignIn()

    if (
      isCancelledResponse(response) ||
      isNoSavedCredentialFoundResponse(response)
    ) {
      return null
    }

    return toCredential(response)
  } catch (error) {
    if (!isErrorWithCode(error)) {
      throw error
    }

    switch (error.code) {
      case statusCodes.SIGN_IN_CANCELLED:
        return null

      case statusCodes.DEVELOPER_ERROR:
        throw new GoogleSignInFailure(
          'configuration',
          'Configuration Google invalide (client OAuth Android, package ou SHA-1).',
        )

      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        throw new GoogleSignInFailure(
          'play-services',
          'Les services Google Play sont absents ou à mettre à jour.',
        )

      default:
        throw new GoogleSignInFailure(
          'unknown',
          `Connexion Google impossible (${error.code}).`,
        )
    }
  }
}

/**
 * Disables automatic sign-in with the current Google account, so that
 * the next sign-in lets the user choose an account.
 */
export async function signOutFromGoogle() {
  try {
    await GoogleOneTapSignIn.signOut()
  } catch (error) {
    console.warn('Google sign-out failed:', error)
  }
}
