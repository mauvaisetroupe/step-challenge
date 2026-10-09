import Constants from 'expo-constants'
import { router, type Href } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import TabScreenHeader from '@/components/TabScreenHeader'
import { NavRow } from '@/components/settings/ui'
import { LANGUAGE_NAMES, useFormatters, useLanguage } from '@/i18n'
import { useSleepHours } from '@/services/sleepHours'
import { useTheme, useThemedStyles, type Colors } from '@/theme'

type Entry = {
  title: string
  detail?: string
  href: Href
}

/**
 * Settings menu: one entry per section, each opening its own screen.
 */
export default function SettingsScreen() {
  const styles = useThemedStyles(createStyles)
  const { preference } = useTheme()
  const language = useLanguage()
  const { t } = useTranslation()
  const { formatDate } = useFormatters()
  const sleepHours = useSleepHours()

  const formatTime = (minute: number) =>
    formatDate(new Date(2000, 0, 1, Math.floor(minute / 60), minute % 60), {
      hour: '2-digit',
      minute: '2-digit',
    })

  const groups: { title: string; entries: Entry[] }[] = [
    {
      title: t('settings.groups.general'),
      entries: [
        {
          title: t('settings.account.title'),
          detail: t('settings.account.detail'),
          href: '/settings/account',
        },
        {
          title: t('settings.appearance.title'),
          detail: t(`settings.appearance.options.${preference}.label`),
          href: '/settings/appearance',
        },
        {
          title: t('settings.language.title'),
          detail:
            language.preference === 'system'
              ? t('settings.language.system')
              : LANGUAGE_NAMES[language.preference],
          href: '/settings/language',
        },
      ],
    },
    {
      title: t('settings.groups.steps'),
      entries: [
        {
          title: t('settings.sources.title'),
          detail: t('settings.sources.detail'),
          href: '/settings/sources',
        },
        {
          title: t('settings.activity.title'),
          detail: t('settings.activity.summary', {
            bed: formatTime(sleepHours.bed),
            wake: formatTime(sleepHours.wake),
          }),
          href: '/settings/activity',
        },
        {
          title: t('settings.sync.title'),
          detail: t('settings.sync.detail'),
          href: '/settings/sync',
        },
        {
          title: t('settings.huawei.title'),
          detail: t('settings.huawei.detail'),
          href: '/settings/huawei',
        },
        {
          title: t('settings.diagnostic.title'),
          detail: t('settings.diagnostic.detail'),
          href: '/settings/diagnostic',
        },
      ],
    },
    {
      title: t('settings.groups.information'),
      entries: [
        {
          title: t('settings.about.title'),
          detail: t('settings.about.versionDetail', {
            version: Constants.expoConfig?.version ?? t('settings.about.unknown'),
          }),
          href: '/settings/about',
        },
        {
          title: t('settings.legal.title'),
          detail: t('settings.legal.detail'),
          href: '/settings/legal',
        },
      ],
    },
  ]

  return (
    // Top edge only: keeps the content below the status bar (camera,
    // clock, battery); the tab bar handles the bottom.
    <SafeAreaView edges={['top']} style={styles.screen}>
      <TabScreenHeader title={t('tabs.settings')} />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {groups.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>

            <View style={styles.card}>
              {group.entries.map((entry, index) => (
                <NavRow
                  key={entry.title}
                  title={entry.title}
                  detail={entry.detail}
                  onPress={() => router.push(entry.href)}
                  last={index === group.entries.length - 1}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },

    container: {
      padding: 20,
      paddingBottom: 40,
    },

    group: {
      marginBottom: 24,
    },

    groupTitle: {
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: c.textSecondary,
      marginBottom: 8,
      marginLeft: 4,
    },

    card: {
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
    },
  })
