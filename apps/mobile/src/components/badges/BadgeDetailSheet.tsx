import { useTranslation } from 'react-i18next'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  badgeIcon,
  type BadgeInProgress,
  type EarnedBadge,
  type LockedBadge,
} from '@/api/badges'
import { useFormatters } from '@/i18n'
import { parseDateKey } from '@/services/leaderboardPeriods'
import { useThemedStyles, type Colors } from '@/theme'

export type SelectedBadge =
  | { status: 'earned'; badge: EarnedBadge }
  | { status: 'inProgress'; badge: BadgeInProgress }
  | { status: 'locked'; badge: LockedBadge }

type Props = {
  selected: SelectedBadge | null
  onClose: () => void
}

/**
 * Detail of a badge, sliding from the bottom: what it rewards, its
 * points and, once earned, every time it was earned.
 */
export default function BadgeDetailSheet({ selected, onClose }: Props) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const { formatNumber, formatDate } = useFormatters()
  const insets = useSafeAreaInsets()

  const formatDay = (date: string) =>
    formatDate(parseDateKey(date), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

  const badge = selected?.badge

  return (
    <Modal
      visible={selected !== null}
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
          {selected && badge && (
            <>
              <View style={styles.header}>
                <Text style={styles.icon}>{badgeIcon(badge.family)}</Text>
                <View style={styles.headerText}>
                  <Text style={styles.name}>{badge.name}</Text>
                  <Text style={styles.points}>
                    {t('badges.reward', { points: badge.points })}
                  </Text>
                </View>
              </View>

              <Text style={styles.description}>{badge.description}</Text>

              {selected.status === 'inProgress' && (
                <Text style={styles.status}>
                  {selected.badge.period ? `${selected.badge.period} · ` : ''}
                  {t('badges.progress', {
                    value: formatNumber(selected.badge.value),
                    target: formatNumber(selected.badge.target),
                  })}
                </Text>
              )}

              {selected.status === 'locked' && (
                <Text style={styles.status}>{t('badges.detail.notYet')}</Text>
              )}

              {selected.status === 'earned' && (
                <>
                  <Text style={styles.sectionTitle}>
                    {t('badges.detail.earnedTimes', {
                      count: selected.badge.count,
                    })}
                  </Text>
                  <ScrollView style={styles.history}>
                    {selected.badge.occurrences.map((occurrence) => (
                      <View
                        key={occurrence.occurrence || occurrence.earnedOn}
                        style={styles.occurrence}
                      >
                        <View style={styles.occurrenceText}>
                          <Text style={styles.occurrenceLabel}>
                            {occurrence.period ?? formatDay(occurrence.earnedOn)}
                          </Text>
                          {occurrence.period && (
                            <Text style={styles.occurrenceDetail}>
                              {t('badges.earnedOn', {
                                date: formatDay(occurrence.earnedOn),
                              })}
                            </Text>
                          )}
                          {occurrence.description !== badge.description && (
                            <Text style={styles.occurrenceDetail}>
                              {occurrence.description}
                            </Text>
                          )}
                        </View>
                        <Text style={styles.points}>
                          {t('badges.reward', { points: occurrence.points })}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </>
              )}
            </>
          )}

          <Pressable style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>{t('common.close')}</Text>
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
      maxHeight: '80%',
      backgroundColor: c.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingTop: 20,
      paddingHorizontal: 20,
      gap: 12,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },

    icon: {
      fontSize: 40,
    },

    headerText: {
      flex: 1,
      gap: 2,
    },

    name: {
      fontSize: 19,
      fontWeight: '700',
      color: c.text,
    },

    points: {
      fontSize: 14,
      fontWeight: '700',
      color: c.primary,
    },

    description: {
      fontSize: 15,
      lineHeight: 21,
      color: c.text,
    },

    status: {
      fontSize: 14,
      color: c.textSecondary,
    },

    sectionTitle: {
      marginTop: 4,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: c.textSecondary,
    },

    history: {
      flexGrow: 0,
    },

    occurrence: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },

    occurrenceText: {
      flex: 1,
      gap: 2,
    },

    occurrenceLabel: {
      fontSize: 15,
      color: c.text,
    },

    occurrenceDetail: {
      fontSize: 13,
      color: c.textSecondary,
    },

    close: {
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },

    closeText: {
      fontSize: 16,
      fontWeight: '600',
      color: c.primary,
    },
  })
