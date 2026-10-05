import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useThemedStyles, type Colors } from '@/theme'

type Props = {
  title: string
  // Action shown on the right of the title (button…).
  right?: ReactNode
}

/**
 * Fixed title of a tab screen, above its scrolling content, separated
 * from it by a thin shadow.
 *
 * The screen wraps it in a top-edge SafeAreaView, so the title stays
 * below the status bar (camera, clock, battery).
 */
export default function TabScreenHeader({ title, right }: Props) {
  const styles = useThemedStyles(createStyles)

  return (
    <View style={styles.header}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      {right}
    </View>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 56,
      paddingHorizontal: 20,
      paddingVertical: 8,
      backgroundColor: c.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      // Android shadow; zIndex keeps it above the scrolling content.
      elevation: 3,
      zIndex: 1,
    },

    title: {
      flexShrink: 1,
      fontSize: 28,
      fontWeight: '700',
      color: c.text,
    },
  })
