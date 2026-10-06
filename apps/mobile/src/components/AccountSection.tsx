import { router } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { signOut, type User } from '../api/auth'
import { deleteAccount, getMe, updateDisplayName } from '../api/me'
import { signOutFromGoogle } from '../auth/google'
import { useThemedStyles, type Colors } from '@/theme'

const MAX_DISPLAY_NAME_LENGTH = 50

/**
 * Account settings (ADR 0001): display name, sign-out and account
 * deletion (required by the Play Store for apps that create accounts).
 */
export default function AccountSection() {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()

  const [user, setUser] = useState<User | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState<
    null | 'loading' | 'saving' | 'signing-out' | 'deleting'
  >('loading')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setBusy('loading')
    setError(null)

    try {
      const me = await getMe()

      setUser(me)
      setDisplayName(me.name)
    } catch (err) {
      console.error('Account load error:', err)
      setError(t('account.loadError'))
    } finally {
      setBusy(null)
    }
  }, [t])

  useEffect(() => {
    load()
  }, [load])

  const trimmedName = displayName.trim()
  const nameChanged = user !== null && trimmedName !== user.name

  const handleSaveName = async () => {
    if (!trimmedName || !nameChanged) {
      return
    }

    setBusy('saving')
    setError(null)
    setMessage(null)

    try {
      const updated = await updateDisplayName(trimmedName)

      setUser(updated)
      setDisplayName(updated.name)
      setMessage(t('account.nameSaved'))
    } catch (err) {
      console.error('Display name update error:', err)
      setError(t('account.nameError'))
    } finally {
      setBusy(null)
    }
  }

  const leave = async () => {
    await signOutFromGoogle()
    router.replace('/sign-in')
  }

  const handleSignOut = async () => {
    setBusy('signing-out')

    try {
      await signOut()
      await leave()
    } finally {
      setBusy(null)
    }
  }

  const confirmDeleteAccount = () => {
    Alert.alert(
      t('account.delete.title'),
      t('account.delete.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('account.delete.confirm'),
          style: 'destructive',
          onPress: handleDeleteAccount,
        },
      ],
    )
  }

  const handleDeleteAccount = async () => {
    setBusy('deleting')
    setError(null)

    try {
      await deleteAccount()
      await leave()
    } catch (err) {
      console.error('Account deletion error:', err)
      setError(t('account.delete.error'))
    } finally {
      setBusy(null)
    }
  }

  if (busy === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    )
  }

  if (!user) {
    return (
      <View style={styles.card}>
        <Text style={styles.error}>{error}</Text>

        <Pressable style={styles.secondaryButton} onPress={load}>
          <Text style={styles.secondaryButtonText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.label}>{t('account.displayName')}</Text>

        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={(value) => {
            setDisplayName(value)
            setMessage(null)
            setError(null)
          }}
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          returnKeyType="done"
          onSubmitEditing={handleSaveName}
          editable={busy === null}
        />

        <Text style={styles.hint}>{t('account.displayNameHint')}</Text>

        {nameChanged && (
          <Pressable
            style={[
              styles.primaryButton,
              (!trimmedName || busy !== null) && styles.disabled,
            ]}
            onPress={handleSaveName}
            disabled={!trimmedName || busy !== null}
          >
            <Text style={styles.primaryButtonText}>
              {busy === 'saving' ? t('common.saving') : t('common.save')}
            </Text>
          </Pressable>
        )}

        {message && <Text style={styles.success}>{message}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <Pressable
        style={[styles.secondaryButton, busy !== null && styles.disabled]}
        onPress={handleSignOut}
        disabled={busy !== null}
      >
        <Text style={styles.secondaryButtonText}>
          {busy === 'signing-out'
            ? t('account.signingOut')
            : t('account.signOut')}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.dangerButton, busy !== null && styles.disabled]}
        onPress={confirmDeleteAccount}
        disabled={busy !== null}
      >
        <Text style={styles.dangerButtonText}>
          {busy === 'deleting'
            ? t('account.delete.deleting')
            : t('account.delete.button')}
        </Text>
      </Pressable>
    </View>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    center: {
      paddingVertical: 20,
      alignItems: 'center',
    },

    card: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 14,
    },

    label: {
      fontSize: 15,
      color: c.textSecondary,
      marginBottom: 8,
    },

    input: {
      height: 48,
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.borderStrong,
      borderRadius: 10,
      paddingHorizontal: 14,
      color: c.text,
      fontSize: 16,
    },

    hint: {
      fontSize: 13,
      color: c.textMuted,
      marginTop: 6,
    },

    primaryButton: {
      marginTop: 12,
      minHeight: 44,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },

    primaryButtonText: {
      color: c.onPrimary,
      fontSize: 15,
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

    disabled: {
      opacity: 0.5,
    },

    success: {
      color: c.success,
      fontSize: 14,
      marginTop: 10,
    },

    error: {
      color: c.danger,
      fontSize: 14,
      marginTop: 10,
    },
  })
