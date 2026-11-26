import { router } from 'expo-router'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { signOut } from '@/api/auth'
import { ApiError } from '@/api/client'
import {
  acceptLegalDocuments,
  deleteAccount,
  getMe,
  type PendingConsent,
} from '@/api/me'
import { signOutFromGoogle } from '@/auth/google'
import { openPublicPage } from '@/constants/links'
import { useThemedStyles, type Colors } from '@/theme'

/**
 * Shows the app only once the user accepted the terms of use and the
 * privacy policy in force (ADR 0017): checked at start and each time
 * the app comes back to the foreground. Offline, or with an older API,
 * the app stays usable: the check waits for the next answer.
 */
export default function ConsentGate({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConsent[]>([])

  const check = useCallback(async () => {
    try {
      setPending((await getMe()).pendingConsents ?? [])
    } catch (error) {
      console.warn('Consent check failed:', error)
    }
  }, [])

  useEffect(() => {
    check()

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        check()
      }
    })

    return () => subscription.remove()
  }, [check])

  if (pending.length > 0) {
    return <ConsentScreen pending={pending} onChange={setPending} />
  }

  return children
}

type Props = {
  pending: PendingConsent[]
  onChange: (pending: PendingConsent[]) => void
}

/** Accept the documents, or leave: nothing else is reachable. */
function ConsentScreen({ pending, onChange }: Props) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accept = async () => {
    setBusy(true)
    setError(null)

    try {
      onChange((await acceptLegalDocuments(pending)).pendingConsents)
    } catch (err) {
      // A document changed while the user was reading: show the new
      // version to accept.
      if (err instanceof ApiError && err.code === 'legal_version_outdated') {
        onChange((err.body?.pendingConsents as PendingConsent[]) ?? pending)
        setError(t('consent.outdated'))
      } else {
        console.error('Consent failed:', err)
        setError(t('consent.error'))
      }
    } finally {
      setBusy(false)
    }
  }

  const leave = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)

    try {
      await action()
      await signOutFromGoogle()
      router.replace('/sign-in')
    } catch (err) {
      console.error('Leaving failed:', err)
      setError(t('consent.error'))
      setBusy(false)
    }
  }

  const confirmDeleteAccount = () => {
    Alert.alert(t('account.delete.title'), t('account.delete.message'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('account.delete.confirm'),
        style: 'destructive',
        onPress: () => leave(deleteAccount),
      },
    ])
  }

  // First time ever (no document accepted yet), or an update.
  const isUpdate = pending.length === 1

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: 32 + insets.top, paddingBottom: 32 + insets.bottom },
      ]}
    >
      <Text style={styles.title}>
        {t(refused ? 'consent.refusedTitle' : 'consent.title')}
      </Text>

      <Text style={styles.text}>
        {refused
          ? t('consent.refusedText')
          : isUpdate
            ? t(`consent.updated.${pending[0].document}`)
            : t('consent.text')}
      </Text>

      {pending.map(({ document }) => (
        <Pressable
          key={document}
          style={styles.link}
          onPress={() =>
            openPublicPage(document === 'terms' ? 'agreement' : 'privacy')
          }
        >
          <Text style={styles.linkText}>{t(`consent.read.${document}`)}</Text>
        </Pressable>
      ))}

      {error && <Text style={styles.error}>{error}</Text>}

      {busy ? (
        <ActivityIndicator style={styles.busy} />
      ) : refused ? (
        <>
          <Pressable style={styles.primaryButton} onPress={() => setRefused(false)}>
            <Text style={styles.primaryButtonText}>{t('consent.back')}</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => leave(signOut)}>
            <Text style={styles.secondaryButtonText}>
              {t('account.signOut')}
            </Text>
          </Pressable>

          <Pressable style={styles.dangerButton} onPress={confirmDeleteAccount}>
            <Text style={styles.dangerButtonText}>
              {t('account.delete.button')}
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <Pressable style={styles.primaryButton} onPress={accept}>
            <Text style={styles.primaryButtonText}>{t('consent.accept')}</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => setRefused(true)}>
            <Text style={styles.secondaryButtonText}>{t('consent.refuse')}</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },

    // Not wider than a phone on tablets.
    content: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
      width: '100%',
      maxWidth: 480,
      alignSelf: 'center',
    },

    title: {
      color: c.text,
      fontSize: 24,
      fontWeight: '700',
      marginBottom: 12,
    },

    text: {
      color: c.textSecondary,
      fontSize: 16,
      lineHeight: 23,
      marginBottom: 12,
    },

    link: {
      paddingVertical: 10,
    },

    linkText: {
      color: c.primary,
      fontSize: 16,
      fontWeight: '600',
      textDecorationLine: 'underline',
    },

    error: {
      color: c.danger,
      fontSize: 14,
      marginTop: 12,
    },

    busy: {
      marginTop: 28,
    },

    primaryButton: {
      marginTop: 24,
      minHeight: 52,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },

    primaryButtonText: {
      color: c.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },

    secondaryButton: {
      marginTop: 12,
      minHeight: 48,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceAlt,
    },

    secondaryButtonText: {
      color: c.text,
      fontSize: 15,
      fontWeight: '600',
    },

    dangerButton: {
      marginTop: 12,
      minHeight: 48,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.danger,
    },

    dangerButtonText: {
      color: c.danger,
      fontSize: 15,
      fontWeight: '600',
    },
  })
