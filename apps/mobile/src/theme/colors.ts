/**
 * Colors of the app, for the light and dark appearances.
 *
 * Screens never hard-code a color: they read these tokens through
 * useTheme() or useThemedStyles(), so that both appearances work.
 */

/** Blue of the app icon. */
export const BRAND_BLUE = '#1389FC'

export type Colors = {
  /** Screen background. */
  background: string
  /** Cards, rows, list items. */
  surface: string
  /** Secondary buttons, inputs, selected segment background. */
  surfaceAlt: string
  border: string
  /** Input and outlined button borders. */
  borderStrong: string

  text: string
  textSecondary: string
  textMuted: string

  /** Main actions, links, charts, goal reached. */
  primary: string
  /** Text and icons on a primary background. */
  onPrimary: string
  /** Light background of a primary element (highlighted row, code). */
  primarySoft: string

  danger: string
  dangerSoft: string
  success: string
  successSoft: string
  warning: string
  warningSoft: string

  /** Background of a progress ring or bar. */
  track: string
  /** Progress below the goal: neutral, not a success color. */
  progress: string

  /** Shadow of floating elements (only visible in light mode). */
  shadow: string
  /** Darkened background behind a modal. */
  overlay: string
}

export const lightColors: Colors = {
  background: '#FFFFFF',
  surface: '#F6F7F9',
  surfaceAlt: '#ECEEF1',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',

  text: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',

  primary: BRAND_BLUE,
  onPrimary: '#FFFFFF',
  primarySoft: '#E8F3FF',

  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  success: '#15803D',
  successSoft: '#DCFCE7',
  warning: '#B45309',
  warningSoft: '#FEF3C7',

  track: '#E5E7EB',
  progress: '#6B7280',

  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.4)',
}

export const darkColors: Colors = {
  background: '#0B0E13',
  surface: '#161A21',
  surfaceAlt: '#20252E',
  border: '#272D37',
  borderStrong: '#3A4250',

  text: '#F3F4F6',
  textSecondary: '#A3ABB8',
  textMuted: '#6E7685',

  // Slightly lighter than the icon blue: readable on a dark background.
  primary: '#3D9DFF',
  onPrimary: '#FFFFFF',
  primarySoft: '#0F2A4A',

  danger: '#F87171',
  dangerSoft: '#3A1717',
  success: '#4ADE80',
  successSoft: '#112E1C',
  warning: '#FBBF24',
  warningSoft: '#3A2C0C',

  track: '#272D37',
  progress: '#A3ABB8',

  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.6)',
}
