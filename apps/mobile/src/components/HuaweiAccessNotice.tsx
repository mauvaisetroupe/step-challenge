import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import {
  revokeHuaweiHealth,
  signInHuaweiHealth,
  type HuaweiAccessReason,
} from '@/services/huaweiHealth'
import { useThemedStyles, type Colors } from '@/theme'

type Props = {
  reason: HuaweiAccessReason
  /** Reads the steps again once the user acted. */
  onRetry: () => void
}

/**
 * Why HUAWEI Health can't be read, and what to do about it (Huawei's
 * verification, scenarios 3.3 to 3.5): authorize again, or turn the
 * HUAWEI Health Kit switch back on in the HUAWEI Health app.
 */
export default function HuaweiAccessNotice({ reason, onRetry }: Props) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  const act = async () => {
    setBusy(true)

    try {
      // Step Challenge unticked in HUAWEI Health's list keeps the
      // HUAWEI ID consent: sign-in gives tokens the REST API rejects.
      // Withdrawing it first brings the consent screen back.
      if (reason === 'switchOff') {
        await revokeHuaweiHealth()
      }

      // Shows HUAWEI's consent screen when consent is missing.
      await signInHuaweiHealth()

      onRetry()
    } catch (error) {
      console.error('HUAWEI Health authorization failed:', error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.notice}>
      <Text style={styles.title}>{t(`huaweiAccess.${reason}.title`)}</Text>
      <Text style={styles.text}>{t(`huaweiAccess.${reason}.text`)}</Text>

      <Pressable
        style={[styles.button, busy && styles.disabled]}
        onPress={act}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={styles.buttonText.color} />
        ) : (
          <Text style={styles.buttonText}>
            {t(`huaweiAccess.${reason}.action`)}
          </Text>
        )}
      </Pressable>
    </View>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    notice: {
      alignSelf: 'stretch',
      padding: 16,
      borderRadius: 16,
      backgroundColor: c.surfaceAlt,
    },

    title: {
      fontSize: 16,
      fontWeight: '600',
      color: c.text,
    },

    text: {
      marginTop: 6,
      fontSize: 15,
      lineHeight: 21,
      color: c.textSecondary,
    },

    button: {
      marginTop: 14,
      minHeight: 44,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },

    buttonText: {
      fontSize: 15,
      fontWeight: '600',
      color: c.onPrimary,
    },

    disabled: {
      opacity: 0.6,
    },
  })
