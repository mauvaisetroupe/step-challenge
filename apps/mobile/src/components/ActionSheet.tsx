import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useThemedStyles, type Colors } from '@/theme'

// Android: an Alert opened while a Modal is closing is attached to the
// closing window and disappears with it (Modal onDismiss is iOS only).
// The action runs once the slide animation is over.
const DISMISS_DELAY_MS = 300

export type Action = {
  label: string
  onPress: () => void
  destructive?: boolean
}

type ActionSheetProps = {
  title: string | null
  actions: Action[]
  onClose: () => void
}

/**
 * List of actions sliding from the bottom of the screen. Replaces
 * Alert.alert when there are more than three choices: Android alerts
 * show at most three buttons.
 */
export default function ActionSheet({
  title,
  actions,
  onClose,
}: ActionSheetProps) {
  const styles = useThemedStyles(createStyles)

  const insets = useSafeAreaInsets()

  return (
    <Modal
      visible={title !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: 12 + insets.bottom }]}
          // Taps inside the sheet must not close it.
          onPress={() => {}}
        >
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>

          {actions.map((action) => (
            <Pressable
              key={action.label}
              style={styles.action}
              onPress={() => {
                onClose()
                setTimeout(action.onPress, DISMISS_DELAY_MS)
              }}
            >
              <Text
                style={[
                  styles.actionText,
                  action.destructive && styles.destructive,
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}

          <View style={styles.separator} />

          <Pressable style={styles.action} onPress={onClose}>
            <Text style={styles.cancelText}>Annuler</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: c.overlay,
    },

    sheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingTop: 16,
      paddingHorizontal: 20,
    },

    title: {
      marginBottom: 8,
      fontSize: 17,
      fontWeight: '700',
      color: c.text,
    },

    action: {
      minHeight: 50,
      justifyContent: 'center',
    },

    actionText: {
      fontSize: 16,
      color: c.text,
    },

    destructive: {
      color: c.danger,
    },

    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.surfaceAlt,
      marginVertical: 4,
    },

    cancelText: {
      fontSize: 16,
      fontWeight: '600',
      color: c.textSecondary,
    },
  })
