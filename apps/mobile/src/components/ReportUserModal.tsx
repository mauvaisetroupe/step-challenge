import { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import {
  REPORT_REASONS,
  reportUser,
  type ReportReason,
} from '../api/moderation'

const MAX_COMMENT_LENGTH = 500

export type ReportTarget = {
  id: string
  /** Name shown to me (alias for a friend). */
  name: string
  /** Code of the invitation I received from them, when not a friend. */
  invitationCode?: string
}

type ReportUserModalProps = {
  target: ReportTarget | null
  onClose: () => void
  /** Blocks the reported person; offered once the report is sent. */
  onBlock: (target: ReportTarget) => Promise<void>
}

/**
 * Reports a user to the maintainer (ADR 0004): reason and optional
 * comment. The reported person is not told. Once sent, blocking is
 * offered, not automatic: one may report a name without wanting to lose
 * a friend. The thank-you is shown in the modal itself: an Alert opened
 * while the modal closes would not show on Android.
 */
export default function ReportUserModal({
  target,
  onClose,
  onBlock,
}: ReportUserModalProps) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setReason(null)
    setComment('')
    setSent(false)
    setError(null)
  }, [target])

  const block = async () => {
    if (!target) {
      return
    }

    setBlocking(true)
    setError(null)

    try {
      await onBlock(target)
      onClose()
    } catch (err) {
      console.error('Block error:', err)
      setError('Impossible de bloquer cette personne.')
    } finally {
      setBlocking(false)
    }
  }

  const send = async () => {
    if (!target || !reason) {
      return
    }

    setSending(true)
    setError(null)

    try {
      await reportUser({
        userId: target.id,
        reason,
        comment: comment.trim() || undefined,
        invitationCode: target.invitationCode,
      })
      setSent(true)
    } catch (err) {
      console.error('Report error:', err)
      setError("Impossible d'envoyer le signalement. Réessaie plus tard.")
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      visible={target !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          {sent ? (
            <View>
              <Text style={styles.title}>Merci</Text>
              <Text style={styles.hint}>
                Ton signalement a bien été envoyé.
              </Text>
              <Text style={styles.body}>
                Veux-tu aussi bloquer {target?.name} ? Vous ne serez plus
                amis, et cette personne ne pourra plus devenir ton amie, même
                avec un lien d'invitation. Elle n'est pas prévenue.
              </Text>

              {error && <Text style={styles.error}>{error}</Text>}

              <Pressable
                style={[styles.destructiveButton, blocking && styles.disabled]}
                onPress={block}
                disabled={blocking}
              >
                <Text style={styles.primaryButtonText}>
                  {blocking ? 'Blocage...' : `Bloquer ${target?.name ?? ''}`}
                </Text>
              </Pressable>

              <Pressable
                style={styles.secondaryButton}
                onPress={onClose}
                disabled={blocking}
              >
                <Text style={styles.secondaryButtonText}>Fermer</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.title}>Signaler {target?.name}</Text>
              <Text style={styles.hint}>
                Ton signalement est lu par l'équipe de Step Challenge. La
                personne signalée n'est pas prévenue.
              </Text>

              {REPORT_REASONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={styles.reason}
                  onPress={() => setReason(option.value)}
                  disabled={sending}
                >
                  <View
                    style={[
                      styles.radio,
                      reason === option.value && styles.radioSelected,
                    ]}
                  />
                  <Text style={styles.reasonText}>{option.label}</Text>
                </Pressable>
              ))}

              <TextInput
                style={styles.input}
                value={comment}
                onChangeText={setComment}
                placeholder="Précisions (facultatif)"
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={MAX_COMMENT_LENGTH}
                editable={!sending}
              />

              {error && <Text style={styles.error}>{error}</Text>}

              <Pressable
                style={[
                  styles.primaryButton,
                  (!reason || sending) && styles.disabled,
                ]}
                onPress={send}
                disabled={!reason || sending}
              >
                <Text style={styles.primaryButtonText}>
                  {sending ? 'Envoi...' : 'Envoyer le signalement'}
                </Text>
              </Pressable>

              <Pressable style={styles.secondaryButton} onPress={onClose}>
                <Text style={styles.secondaryButtonText}>Annuler</Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },

  card: {
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
  },

  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },

  hint: {
    marginTop: 4,
    marginBottom: 10,
    fontSize: 14,
    color: '#6B7280',
  },

  body: {
    fontSize: 15,
    lineHeight: 21,
    color: '#111827',
  },

  destructiveButton: {
    marginTop: 16,
    minHeight: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
  },

  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
  },

  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9CA3AF',
  },

  radioSelected: {
    borderWidth: 6,
    borderColor: '#208AEF',
  },

  reasonText: {
    flexShrink: 1,
    fontSize: 15,
    color: '#111827',
  },

  input: {
    marginTop: 8,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    textAlignVertical: 'top',
  },

  error: {
    marginTop: 10,
    fontSize: 14,
    color: '#DC2626',
  },

  primaryButton: {
    marginTop: 16,
    minHeight: 46,
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
    marginTop: 8,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryButtonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },

  disabled: {
    opacity: 0.5,
  },
})
