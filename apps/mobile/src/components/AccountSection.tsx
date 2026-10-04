import { router } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
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

const MAX_DISPLAY_NAME_LENGTH = 50

/**
 * Account settings (ADR 0001): display name, sign-out and account
 * deletion (required by the Play Store for apps that create accounts).
 */
export default function AccountSection() {
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
      setError('Impossible de charger ton compte.')
    } finally {
      setBusy(null)
    }
  }, [])

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
      setMessage('Nom mis à jour.')
    } catch (err) {
      console.error('Display name update error:', err)
      setError("Impossible d'enregistrer le nom.")
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
      'Supprimer ton compte ?',
      'Ton compte, ton nom et tout ton historique de pas seront ' +
        'définitivement supprimés du serveur Step Challenge. ' +
        'Les données de Health Connect sur ton téléphone ne sont pas ' +
        'touchées.\n\nCette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
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
      setError('La suppression a échoué. Réessaie plus tard.')
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
          <Text style={styles.secondaryButtonText}>Réessayer</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.label}>Nom affiché</Text>

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

        <Text style={styles.hint}>
          Visible par les autres participants.
        </Text>

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
              {busy === 'saving' ? 'Enregistrement...' : 'Enregistrer'}
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
          {busy === 'signing-out' ? 'Déconnexion...' : 'Se déconnecter'}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.dangerButton, busy !== null && styles.disabled]}
        onPress={confirmDeleteAccount}
        disabled={busy !== null}
      >
        <Text style={styles.dangerButtonText}>
          {busy === 'deleting' ? 'Suppression...' : 'Supprimer mon compte'}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    paddingVertical: 20,
    alignItems: 'center',
  },

  card: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 14,
  },

  label: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 8,
  },

  input: {
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    color: '#111827',
    fontSize: 16,
  },

  hint: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 6,
  },

  primaryButton: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#208AEF',
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  secondaryButton: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F1F1',
  },

  secondaryButtonText: {
    color: '#111827',
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
    borderColor: '#DC2626',
  },

  dangerButtonText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '600',
  },

  disabled: {
    opacity: 0.5,
  },

  success: {
    color: '#15803D',
    fontSize: 14,
    marginTop: 10,
  },

  error: {
    color: '#DC2626',
    fontSize: 14,
    marginTop: 10,
  },
})
