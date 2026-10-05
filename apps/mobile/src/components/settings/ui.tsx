import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { useTheme, useThemedStyles, type Colors } from '@/theme'

/** Scrolling page of a settings detail screen. */
export function SettingsPage({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(createStyles)

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  )
}

/** Explanation under a page title or above an action. */
export function Description({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(createStyles)

  return <Text style={styles.description}>{children}</Text>
}

/** Small title inside a page. */
export function Subtitle({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(createStyles)

  return <Text style={styles.subtitle}>{children}</Text>
}

/** Rounded block grouping rows. */
export function Card({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(createStyles)

  return <View style={styles.card}>{children}</View>
}

/** Label and value on one line, inside a Card. */
export function InfoRow({
  label,
  value,
  last = false,
}: {
  label: string
  value: string
  last?: boolean
}) {
  const styles = useThemedStyles(createStyles)

  return (
    <View style={[styles.infoRow, last && styles.lastRow]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

/**
 * Tappable row with a chevron: menu entries, links. `detail` is shown
 * under the title (current value, short explanation).
 */
export function NavRow({
  title,
  detail,
  onPress,
  last = false,
}: {
  title: string
  detail?: string
  onPress: () => void
  last?: boolean
}) {
  const styles = useThemedStyles(createStyles)

  return (
    <Pressable
      style={({ pressed }) => [
        styles.navRow,
        last && styles.lastRow,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.navText}>
        <Text style={styles.navTitle}>{title}</Text>
        {detail ? (
          <Text style={styles.navDetail} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  )
}

type ButtonProps = {
  title: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
}

/** Main action of a page. */
export function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
}: ButtonProps) {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()

  return (
    <Pressable
      style={[styles.primaryButton, (loading || disabled) && styles.disabled]}
      onPress={onPress}
      disabled={loading || disabled}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <Text style={styles.primaryButtonText}>{title}</Text>
      )}
    </Pressable>
  )
}

/** Secondary action, outlined. */
export function SecondaryButton({
  title,
  onPress,
  disabled = false,
}: Omit<ButtonProps, 'loading'>) {
  const styles = useThemedStyles(createStyles)

  return (
    <Pressable
      style={[styles.secondaryButton, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.secondaryButtonText}>{title}</Text>
    </Pressable>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: c.background,
    },

    content: {
      padding: 20,
      paddingBottom: 40,
    },

    description: {
      fontSize: 15,
      lineHeight: 21,
      color: c.textSecondary,
      marginBottom: 14,
    },

    subtitle: {
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
      marginTop: 6,
      marginBottom: 8,
    },

    card: {
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      marginBottom: 14,
    },

    infoRow: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },

    lastRow: {
      borderBottomWidth: 0,
    },

    infoLabel: {
      fontSize: 15,
      color: c.textSecondary,
    },

    infoValue: {
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
      maxWidth: '60%',
      textAlign: 'right',
    },

    navRow: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },

    pressed: {
      opacity: 0.6,
    },

    navText: {
      flex: 1,
      paddingVertical: 10,
    },

    navTitle: {
      fontSize: 16,
      color: c.text,
    },

    navDetail: {
      marginTop: 2,
      fontSize: 13,
      color: c.textSecondary,
    },

    chevron: {
      fontSize: 24,
      color: c.textMuted,
    },

    primaryButton: {
      minHeight: 48,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
      marginBottom: 10,
    },

    primaryButtonText: {
      color: c.onPrimary,
      fontSize: 15,
      fontWeight: '600',
    },

    secondaryButton: {
      minHeight: 44,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.borderStrong,
      marginBottom: 10,
    },

    secondaryButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: c.text,
    },

    disabled: {
      opacity: 0.5,
    },
  })
