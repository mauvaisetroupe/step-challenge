import { router, useLocalSearchParams, type Href } from 'expo-router'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

import { signInWithDemoCode, signInWithGoogleIdToken } from '../api/auth'
import {
  GoogleSignInFailure,
  isGoogleSignInSupported,
  signInWithGoogle,
} from '../auth/google'
import { openPublicPage, TERMS_URL } from '../constants/links'

const MAX_DISPLAY_NAME_LENGTH = 50

type Step =
  | { name: 'google' }
  | { name: 'display-name'; idToken: string }
  | { name: 'demo' }

const DEMO_ERRORS = {
  'invalid-code': "Code d'accès incorrect.",
  unavailable: "L'accès démonstration n'est pas disponible.",
  'too-many-attempts': 'Trop de tentatives. Réessaie dans une heure.',
} as const

function describeError(error: unknown) {
  if (error instanceof GoogleSignInFailure) {
    return error.message
  }

  console.error('Sign-in error:', error)

  return 'Connexion impossible. Vérifie ta connexion internet et réessaie.'
}

/**
 * Sign-in screen (ADR 0001).
 *
 * 1. Google sign-in, then the ID token is sent without display name:
 *    a returning user is signed in directly.
 * 2. For a new account only, the user chooses a display name (prefilled
 *    with the Google given name) and the same ID token is sent again.
 *
 * Store reviewers, who cannot sign in with Google from their test
 * devices, use the discreet "Accès démonstration" link and the access
 * code given in the Play Console (ADR 0006).
 */
/**
 * Where to go after signing in. `next` lets an invitation link opened
 * before signing in resume afterwards; only invitation paths are
 * accepted, so that a crafted link cannot redirect anywhere else.
 */
function destinationAfterSignIn(next: string | undefined): Href {
  return next && /^\/i\/[0-9A-Za-z -]{1,32}$/.test(next)
    ? (next as Href)
    : '/home'
}

export default function SignInScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>()

  const [step, setStep] = useState<Step>({ name: 'google' })
  const [displayName, setDisplayName] = useState('')
  const [demoCode, setDemoCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true)
      setError(null)

      const credential = await signInWithGoogle()

      if (!credential) {
        return
      }

      const result = await signInWithGoogleIdToken(credential.idToken)

      if (result.status === 'signed-in') {
        router.replace(destinationAfterSignIn(next))
        return
      }

      setDisplayName(credential.givenName ?? '')
      setStep({ name: 'display-name', idToken: credential.idToken })
    } catch (err) {
      setError(describeError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAccount = async () => {
    if (step.name !== 'display-name') {
      return
    }

    const name = displayName.trim()

    if (!name) {
      setError('Entre ton prénom')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const result = await signInWithGoogleIdToken(step.idToken, name)

      if (result.status === 'signed-in') {
        router.replace(destinationAfterSignIn(next))
      }
    } catch (err) {
      setError(describeError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleDemoSignIn = async () => {
    if (!demoCode.trim()) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      const result = await signInWithDemoCode(demoCode)

      if (result.status === 'signed-in') {
        router.replace(destinationAfterSignIn(next))
        return
      }

      setError(DEMO_ERRORS[result.status])
    } catch (err) {
      setError(describeError(err))
    } finally {
      setLoading(false)
    }
  }

  const showStep = (nextStep: Step) => {
    setError(null)
    setStep(nextStep)
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.eyebrow}>BIENVENUE</Text>

        <Text style={styles.title}>Step Challenge</Text>

        {step.name === 'google' ? (
          <>
            <Text style={styles.explanation}>
              Connecte-toi avec ton compte Google. Step Challenge ne
              conserve qu'un identifiant technique : ni ton e-mail, ni
              ta photo.
            </Text>

            {isGoogleSignInSupported ? (
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleGoogleSignIn}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Connexion...' : 'Se connecter avec Google'}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.explanation}>
                La connexion n'est disponible que dans l'application
                Android.
              </Text>
            )}
          </>
        ) : step.name === 'demo' ? (
          <>
            <Text style={styles.question}>Accès démonstration</Text>

            <Text style={styles.hint}>
              Réservé aux examinateurs des boutiques d'applications : saisis
              le code d'accès fourni avec les instructions d'examen.
            </Text>

            <TextInput
              style={styles.input}
              value={demoCode}
              onChangeText={(value) => {
                setDemoCode(value)
                setError(null)
              }}
              placeholder="Code d'accès"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              maxLength={200}
              returnKeyType="go"
              onSubmitEditing={handleDemoSignIn}
              editable={!loading}
            />

            <TouchableOpacity
              style={[
                styles.button,
                (!demoCode.trim() || loading) && styles.buttonDisabled,
              ]}
              onPress={handleDemoSignIn}
              disabled={!demoCode.trim() || loading}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Connexion...' : 'Entrer'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryLink}
              onPress={() => showStep({ name: 'google' })}
              disabled={loading}
            >
              <Text style={styles.secondaryLinkText}>Retour</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.question}>Comment tu t'appelles ?</Text>

            <Text style={styles.hint}>
              C'est le nom que verront les autres participants. Tu pourras
              le changer plus tard.
            </Text>

            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={(value) => {
                setDisplayName(value)
                setError(null)
              }}
              placeholder="Ton prénom"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
              maxLength={MAX_DISPLAY_NAME_LENGTH}
              returnKeyType="done"
              onSubmitEditing={handleCreateAccount}
              editable={!loading}
            />

            <TouchableOpacity
              style={[
                styles.button,
                (!displayName.trim() || loading) && styles.buttonDisabled,
              ]}
              onPress={handleCreateAccount}
              disabled={!displayName.trim() || loading}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Création...' : 'Continuer'}
              </Text>
            </TouchableOpacity>

            {/* Terms accepted before the display name, the only content a
                user creates, is visible to others (ADR 0004). */}
            <Text style={styles.terms}>
              En créant ton compte, tu acceptes les{' '}
              <Text
                style={styles.termsLink}
                onPress={() => openPublicPage(TERMS_URL)}
              >
                conditions d'utilisation
              </Text>
              .
            </Text>
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      {step.name === 'google' && (
        <TouchableOpacity
          style={styles.demoLink}
          onPress={() => showStep({ name: 'demo' })}
          disabled={loading}
        >
          <Text style={styles.demoLinkText}>Accès démonstration</Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  eyebrow: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 12,
  },

  title: {
    color: '#111827',
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 56,
  },

  explanation: {
    color: '#4B5563',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },

  question: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },

  hint: {
    color: '#6B7280',
    fontSize: 14,
    marginBottom: 12,
  },

  terms: {
    marginTop: 14,
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },

  termsLink: {
    color: '#208AEF',
    textDecorationLine: 'underline',
  },

  input: {
    height: 52,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 16,
    color: '#111827',
    fontSize: 18,
  },

  error: {
    color: '#DC2626',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },

  button: {
    marginTop: 24,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#208AEF',
  },

  buttonDisabled: {
    opacity: 0.45,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },

  secondaryLink: {
    marginTop: 16,
    alignSelf: 'center',
    padding: 8,
  },

  secondaryLinkText: {
    color: '#6B7280',
    fontSize: 15,
  },

  // Discreet on purpose (ADR 0006): reviewers are guided to it by the
  // review instructions, other users have no reason to notice it.
  demoLink: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
  },

  demoLinkText: {
    color: '#9CA3AF',
    fontSize: 13,
  },
})
