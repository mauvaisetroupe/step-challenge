import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useThemedStyles, type Colors } from '@/theme'

export type RadioOption<T extends string> = {
  value: T
  label: string
  hint?: string
}

type Props<T extends string> = {
  options: RadioOption<T>[]
  selected: T
  onSelect: (value: T) => void
}

/** A card of options, one of them selected (Appearance, Language). */
export default function RadioGroup<T extends string>({
  options,
  selected,
  onSelect,
}: Props<T>) {
  const styles = useThemedStyles(createStyles)

  return (
    <View style={styles.card} accessibilityRole="radiogroup">
      {options.map((option, index) => {
        const checked = option.value === selected

        return (
          <Pressable
            key={option.value}
            style={[styles.row, index === options.length - 1 && styles.lastRow]}
            onPress={() => onSelect(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
          >
            <View style={styles.text}>
              <Text style={styles.title}>{option.label}</Text>
              {option.hint && <Text style={styles.hint}>{option.hint}</Text>}
            </View>

            <View style={[styles.radio, checked && styles.radioSelected]}>
              {checked && <View style={styles.radioDot} />}
            </View>
          </Pressable>
        )
      })}
    </View>
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
