import type { ReactNode } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native'

import { RichText } from '@/i18n'
import { useThemedStyles, type Colors } from '@/theme'

type Props = {
  icon: string
  title: string
  children: ReactNode
  /** Makes the whole card tappable, with a chevron. */
  onPress?: () => void
}

/** Card of the home screen: an icon, a small title and its content. */
export default function HomeCard({ icon, title, children, onPress }: Props) {
  const styles = useThemedStyles(createStyles)

  const content = (
    <>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        {onPress && <Text style={styles.chevron}>›</Text>}
      </View>
      {children}
    </>
  )

  if (!onPress) {
    return <View style={styles.card}>{content}</View>
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      {content}
    </Pressable>
  )
}

/**
 * Translated sentence of a card, with <b>…</b> parts in bold (ADR 0007).
 */
export function CardText({
  text,
  values,
  style,
}: {
  text: string
  values?: Record<string, string>
  style?: StyleProp<TextStyle>
}) {
  const styles = useThemedStyles(createStyles)

  return (
    <RichText
      text={text}
      values={values}
      style={style}
      boldStyle={styles.strong}
    />
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: 18,
      padding: 18,
      marginBottom: 14,
    },

    pressed: {
      opacity: 0.7,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },

    icon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primarySoft,
    },

    iconText: {
      fontSize: 17,
    },

    title: {
      flex: 1,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: c.textSecondary,
    },

    chevron: {
      fontSize: 22,
      color: c.textMuted,
    },

    strong: {
      fontWeight: '700',
      color: c.text,
    },
  })
