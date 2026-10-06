import { StyleSheet, Text, View } from 'react-native'

/**
 * Colors with enough contrast for white text (WCAG AA), spread across
 * the color wheel so that neighbours in a leaderboard are easy to tell
 * apart.
 */
const BADGE_COLORS = [
  '#1D4ED8', // blue
  '#7C3AED', // violet
  '#BE185D', // pink
  '#B45309', // amber
  '#047857', // green
  '#0E7490', // cyan
  '#C2410C', // orange
  '#4338CA', // indigo
  '#A21CAF', // fuchsia
  '#0F766E', // teal
  '#B91C1C', // red
  '#4D7C0F', // olive
] as const

/**
 * FNV-1a hash of a string, as an unsigned 32-bit integer.
 */
function hash(value: string) {
  let result = 0x811c9dc5

  for (let i = 0; i < value.length; i++) {
    result ^= value.charCodeAt(i)
    result = Math.imul(result, 0x01000193)
  }

  return result >>> 0
}

/**
 * Color of a user, derived from their id (ADR 0002, "Reconnaître ses
 * amis"): it does not change when the user renames themselves, and two
 * users with the same name usually get different colors.
 */
export function getUserColor(userId: string) {
  return BADGE_COLORS[hash(userId) % BADGE_COLORS.length]
}

function getInitial(name: string) {
  // Array.from splits by code point, so accented letters and emoji are
  // not cut in half.
  return Array.from(name.trim())[0]?.toLocaleUpperCase() ?? '?'
}

type UserBadgeProps = {
  userId: string
  name: string
  size?: number
}

/**
 * Round badge with the user's initial, colored from their id.
 */
export default function UserBadge({
  userId,
  name,
  size = 36,
}: UserBadgeProps) {
  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: getUserColor(userId),
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[styles.initial, { fontSize: size * 0.45 }]}>
        {getInitial(name)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  initial: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
})
