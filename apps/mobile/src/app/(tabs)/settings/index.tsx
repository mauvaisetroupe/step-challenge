import Constants from 'expo-constants'
import { router, type Href } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import TabScreenHeader from '@/components/TabScreenHeader'
import { NavRow } from '@/components/settings/ui'
import {
  APPEARANCE_LABELS,
  useTheme,
  useThemedStyles,
  type Colors,
} from '@/theme'

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

  const groups: { title: string; entries: Entry[] }[] = [
    {
      title: 'Général',
      entries: [
        {
          title: 'Compte',
          detail: 'Nom affiché, déconnexion, suppression',
          href: '/settings/account',
        },
        {
          title: 'Apparence',
          detail: APPEARANCE_LABELS[preference],
          href: '/settings/appearance',
        },
      ],
    },
    {
      title: 'Données de pas',
      entries: [
        {
          title: 'Synchronisation en arrière-plan',
          detail: 'Dernières exécutions',
          href: '/settings/sync',
        },
        {
          title: 'Huawei Health',
          detail: 'Montres Huawei',
          href: '/settings/huawei',
        },
        {
          title: 'Diagnostic',
          detail: 'Santé Connect, autorisations, serveur',
          href: '/settings/diagnostic',
        },
      ],
    },
    {
      title: 'Informations',
      entries: [
        {
          title: 'À propos',
          detail: `Version ${Constants.expoConfig?.version ?? 'inconnue'}`,
          href: '/settings/about',
        },
        {
          title: 'Informations légales',
          detail: "Conditions d'utilisation, confidentialité",
          href: '/settings/legal',
        },
      ],
    },
  ]

  return (
    // Top edge only: keeps the content below the status bar (camera,
    // clock, battery); the tab bar handles the bottom.
    <SafeAreaView edges={['top']} style={styles.screen}>
      <TabScreenHeader title="Paramètres" />

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
