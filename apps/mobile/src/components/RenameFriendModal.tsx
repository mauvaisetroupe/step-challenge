import { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import type { Friend } from '../api/friends'
import { useThemedStyles, type Colors } from '@/theme'

const MAX_ALIAS_LENGTH = 50

type RenameFriendModalProps = {
  friend: Friend | null
  saving: boolean
  error: string | null
  onSave: (alias: string) => void
  onReset: () => void
  onClose: () => void
}

/**
 * Lets me give a friend an alias that only I see (ADR 0002). Android has
 * no native prompt dialog, hence this modal.
 */
export default function RenameFriendModal({
  friend,
  saving,
  error,
  onSave,
  onReset,
  onClose,
}: RenameFriendModalProps) {
  const styles = useThemedStyles(createStyles)

  const [alias, setAlias] = useState('')

  useEffect(() => {
    setAlias(friend?.alias ?? friend?.name ?? '')
  }, [friend])

  const trimmed = alias.trim()

  return (
    <Modal
      visible={friend !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Renommer</Text>
          <Text style={styles.hint}>
            Ce nom n'est visible que par toi.
            {friend ? ` Son nom : ${friend.name}.` : ''}
          </Text>

          <TextInput
            style={styles.input}
            value={alias}
            onChangeText={setAlias}
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={MAX_ALIAS_LENGTH}
            returnKeyType="done"
            onSubmitEditing={() => trimmed && onSave(trimmed)}
            editable={!saving}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.primaryButton, (!trimmed || saving) && styles.disabled]}
            onPress={() => onSave(trimmed)}
            disabled={!trimmed || saving}
          >
            <Text style={styles.primaryButtonText}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Text>
          </Pressable>

          {friend?.alias && (
            <Pressable
              style={styles.secondaryButton}
              onPress={onReset}
              disabled={saving}
            >
              <Text style={styles.secondaryButtonText}>
                Revenir à « {friend.name} »
              </Text>
            </Pressable>
          )}

          <Pressable style={styles.secondaryButton} onPress={onClose}>
            <Text style={styles.secondaryButtonText}>Annuler</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'center',
      padding: 24,
      backgroundColor: c.overlay,
    },

    card: {
      backgroundColor: c.card,
      borderRadius: 14,
      padding: 20,
    },

    title: {
      fontSize: 20,
      fontWeight: '700',
      color: c.text,
    },

    hint: {
      marginTop: 4,
      marginBottom: 14,
      fontSize: 14,
      color: c.textSecondary,
    },

    input: {
      height: 48,
      borderWidth: 1,
      borderColor: c.borderStrong,
      borderRadius: 10,
      paddingHorizontal: 14,
      fontSize: 16,
      color: c.text,
    },

    error: {
      marginTop: 10,
      fontSize: 14,
      color: c.danger,
    },

    primaryButton: {
      marginTop: 16,
      minHeight: 46,
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
      marginTop: 8,
      minHeight: 44,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },

    secondaryButtonText: {
      color: c.text,
      fontSize: 15,
      fontWeight: '600',
    },

    disabled: {
      opacity: 0.5,
    },
  })
