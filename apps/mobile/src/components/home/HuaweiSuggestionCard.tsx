import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text } from 'react-native'

import { useThemedStyles, type Colors } from '@/theme'

import HomeCard from './HomeCard'

type Props = {
  onUseHuawei: () => void
  onDismiss: () => void
}

/**
 * Suggests Huawei Health as step source when its app is installed
 * (ADR 0013): the change itself is confirmed in Step source.
 */
export default function HuaweiSuggestionCard({ onUseHuawei, onDismiss }: Props) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()

  return (
    <HomeCard icon="⌚" title={t('home.huaweiSuggestion.title')}>
      <Text style={styles.text}>{t('home.huaweiSuggestion.text')}</Text>

      <Pressable style={styles.button} onPress={onUseHuawei}>
        <Text style={styles.buttonText}>{t('home.huaweiSuggestion.use')}</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={onDismiss}>
        <Text style={styles.secondaryButtonText}>
          {t('home.huaweiSuggestion.dismiss')}
        </Text>
      </Pressable>
    </HomeCard>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    text: {
      fontSize: 16,
      lineHeight: 23,
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

    secondaryButton: {
      marginTop: 4,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },

    secondaryButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: c.textSecondary,
    },
  })
