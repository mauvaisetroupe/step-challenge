import { router, useLocalSearchParams, type Href } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
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
import { useTheme, useThemedStyles, type Colors } from '@/theme'

const MAX_DISPLAY_NAME_LENGTH = 50

type Step =
  | { name: 'google' }
  | { name: 'display-name'; idToken: string }
  | { name: 'demo' }

function describeError(error: unknown, t: TFunction) {
  if (error instanceof GoogleSignInFailure) {
    console.error('Google sign-in error:', error.message)
    return t(`signIn.googleErrors.${error.reason}`, { code: error.code ?? '' })
  }

  console.error('Sign-in error:', error)

  return t('signIn.networkError')
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
 * devices, use the discreet demo access link and the access
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
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const { t } = useTranslation()

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
      setError(describeError(err, t))
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
      setError(t('signIn.nameRequired'))
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
      setError(describeError(err, t))
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

      setError(t(`signIn.demoErrors.${result.status}`))
    } catch (err) {
      setError(describeError(err, t))
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
        <Text style={styles.eyebrow}>{t('signIn.welcome')}</Text>

        <Text style={styles.title}>Step Challenge</Text>

        {step.name === 'google' ? (
          <>
            <Text style={styles.explanation}>{t('signIn.explanation')}</Text>

            {isGoogleSignInSupported ? (
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleGoogleSignIn}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>
                  {loading ? t('signIn.signingIn') : t('signIn.google')}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.explanation}>
                {t('signIn.googleErrors.unavailable')}
              </Text>
            )}
          </>
        ) : step.name === 'demo' ? (
          <>
            <Text style={styles.question}>{t('signIn.demo.title')}</Text>

            <Text style={styles.hint}>{t('signIn.demo.hint')}</Text>

            <TextInput
              style={styles.input}
              value={demoCode}
              onChangeText={(value) => {
                setDemoCode(value)
                setError(null)
              }}
              placeholder={t('signIn.demo.code')}
              placeholderTextColor={colors.textMuted}
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
                {loading ? t('signIn.signingIn') : t('signIn.demo.enter')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryLink}
              onPress={() => showStep({ name: 'google' })}
              disabled={loading}
            >
              <Text style={styles.secondaryLinkText}>{t('common.back')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.question}>{t('signIn.name.question')}</Text>

            <Text style={styles.hint}>{t('signIn.name.hint')}</Text>

            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={(value) => {
                setDisplayName(value)
                setError(null)
              }}
              placeholder={t('signIn.name.placeholder')}
              placeholderTextColor={colors.textMuted}
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
                {loading ? t('signIn.name.creating') : t('signIn.name.continue')}
              </Text>
            </TouchableOpacity>

            {/* Terms accepted before the display name, the only content a
                user creates, is visible to others (ADR 0004). */}
            <Text style={styles.terms}>
              {t('signIn.terms.before')}
              <Text
                style={styles.termsLink}
                onPress={() => openPublicPage(TERMS_URL)}
              >
                {t('signIn.terms.link')}
              </Text>
              {t('signIn.terms.after')}
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
          <Text style={styles.demoLinkText}>{t('signIn.demo.title')}</Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },

    content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
    },

    eyebrow: {
      color: c.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 1,
      textAlign: 'center',
      marginBottom: 12,
    },

    title: {
      color: c.text,
      fontSize: 32,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 56,
    },

    explanation: {
      color: c.textSecondary,
      fontSize: 16,
      lineHeight: 22,
      textAlign: 'center',
    },

    question: {
      color: c.text,
      fontSize: 20,
      fontWeight: '600',
      marginBottom: 8,
    },

    hint: {
      color: c.textSecondary,
      fontSize: 14,
      marginBottom: 12,
    },

    terms: {
      marginTop: 14,
      color: c.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
    },

    termsLink: {
      color: c.primary,
      textDecorationLine: 'underline',
    },

    input: {
      height: 52,
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.borderStrong,
      borderRadius: 10,
      paddingHorizontal: 16,
      color: c.text,
      fontSize: 18,
    },

    error: {
      color: c.danger,
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
      backgroundColor: c.primary,
    },

    buttonDisabled: {
      opacity: 0.45,
    },

    buttonText: {
      color: c.onPrimary,
      fontSize: 18,
      fontWeight: '600',
    },

    secondaryLink: {
      marginTop: 16,
      alignSelf: 'center',
      padding: 8,
    },

    secondaryLinkText: {
      color: c.textSecondary,
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
      color: c.textMuted,
      fontSize: 13,
    },
  })
