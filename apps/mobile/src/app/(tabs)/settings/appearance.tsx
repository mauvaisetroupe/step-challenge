import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Description, SettingsPage } from '@/components/settings/ui'
import {
  APPEARANCE_LABELS,
  useTheme,
  useThemedStyles,
  type AppearancePreference,
  type Colors,
} from '@/theme'

const OPTIONS: { value: AppearancePreference; hint: string }[] = [
  { value: 'system', hint: 'Suit le réglage du téléphone' },
  { value: 'light', hint: 'Toujours clair' },
  { value: 'dark', hint: 'Toujours sombre' },
]

/** Light, dark, or the phone setting (kept on this device). */
export default function AppearanceSettingsScreen() {
  const styles = useThemedStyles(createStyles)
  const { preference, setPreference } = useTheme()

  return (
    <SettingsPage>
      <Description>
        Choisis l'apparence de l'application. Ce choix est gardé sur ce
        téléphone.
      </Description>

      <View style={styles.card} accessibilityRole="radiogroup">
        {OPTIONS.map((option, index) => {
          const selected = option.value === preference

          return (
            <Pressable
              key={option.value}
              style={[
                styles.row,
                index === OPTIONS.length - 1 && styles.lastRow,
              ]}
              onPress={() => setPreference(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
            >
              <View style={styles.text}>
                <Text style={styles.title}>
                  {APPEARANCE_LABELS[option.value]}
                </Text>
                <Text style={styles.hint}>{option.hint}</Text>
              </View>

              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected && <View style={styles.radioDot} />}
              </View>
            </Pressable>
          )
        })}
      </View>
    </SettingsPage>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
    },

    row: {
      minHeight: 60,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },

    lastRow: {
      borderBottomWidth: 0,
    },

    text: {
      flex: 1,
    },

    title: {
      fontSize: 16,
      color: c.text,
    },

    hint: {
      marginTop: 2,
      fontSize: 13,
      color: c.textSecondary,
    },

    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: c.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },

    radioSelected: {
      borderColor: c.primary,
    },

    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: c.primary,
    },
  })
