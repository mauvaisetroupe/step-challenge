import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { useTheme, useThemedStyles, type Colors } from '@/theme'

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
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const { t } = useTranslation()

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
      setError(t('friends.block.error'))
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
      setError(t('report.error'))
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
              <Text style={styles.title}>{t('report.thanks')}</Text>
              <Text style={styles.hint}>{t('report.sent')}</Text>
              <Text style={styles.body}>
                {t('report.offerBlock', { name: target?.name ?? '' })}
              </Text>

              {error && <Text style={styles.error}>{error}</Text>}

              <Pressable
                style={[styles.destructiveButton, blocking && styles.disabled]}
                onPress={block}
                disabled={blocking}
              >
                <Text style={styles.primaryButtonText}>
                  {blocking
                    ? t('report.blocking')
                    : t('report.block', { name: target?.name ?? '' })}
                </Text>
              </Pressable>

              <Pressable
                style={styles.secondaryButton}
                onPress={onClose}
                disabled={blocking}
              >
                <Text style={styles.secondaryButtonText}>
                  {t('common.close')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.title}>
                {t('report.title', { name: target?.name ?? '' })}
              </Text>
              <Text style={styles.hint}>{t('report.hint')}</Text>

              {REPORT_REASONS.map((option) => (
                <Pressable
                  key={option}
                  style={styles.reason}
                  onPress={() => setReason(option)}
                  disabled={sending}
                >
                  <View
                    style={[
                      styles.radio,
                      reason === option && styles.radioSelected,
                    ]}
                  />
                  <Text style={styles.reasonText}>
                    {t(`report.reasons.${option}`)}
                  </Text>
                </Pressable>
              ))}

              <TextInput
                style={styles.input}
                value={comment}
                onChangeText={setComment}
                placeholder={t('report.comment')}
                placeholderTextColor={colors.textMuted}
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
                  {sending ? t('report.sending') : t('report.send')}
                </Text>
              </Pressable>

              <Pressable style={styles.secondaryButton} onPress={onClose}>
                <Text style={styles.secondaryButtonText}>{t('common.cancel')}</Text>
              </Pressable>
            </ScrollView>
          )}
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
      maxHeight: '90%',
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
      marginBottom: 10,
      fontSize: 14,
      color: c.textSecondary,
    },

    body: {
      fontSize: 15,
      lineHeight: 21,
      color: c.text,
    },

    destructiveButton: {
      marginTop: 16,
      minHeight: 46,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.danger,
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
      borderColor: c.borderStrong,
    },

    radioSelected: {
      borderWidth: 6,
      borderColor: c.primary,
    },

    reasonText: {
      flexShrink: 1,
      fontSize: 15,
      color: c.text,
    },

    input: {
      marginTop: 8,
      minHeight: 80,
      borderWidth: 1,
      borderColor: c.borderStrong,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      color: c.text,
      textAlignVertical: 'top',
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
