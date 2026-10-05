import { NativeTabs } from 'expo-router/unstable-native-tabs'

import { useTheme } from '@/theme'

export default function TabsLayout() {
  const { colors } = useTheme()

  return (
    <NativeTabs
      labelVisibilityMode="labeled"
      backgroundColor={colors.background}
      tintColor={colors.primary}
      indicatorColor={colors.primarySoft}
      iconColor={{ default: colors.textSecondary, selected: colors.primary }}
      labelStyle={{
        default: { color: colors.textSecondary },
        selected: { color: colors.primary },
      }}
    >
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Icon
          sf="house.fill"
          md="home"
        />
        <NativeTabs.Trigger.Label>
          Accueil
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="stats">
        <NativeTabs.Trigger.Icon
          sf="chart.bar.fill"
          md="bar_chart"
        />
        <NativeTabs.Trigger.Label>
          Stats
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="leaderboard">
        <NativeTabs.Trigger.Icon
          sf="trophy.fill"
          md="emoji_events"
        />
        <NativeTabs.Trigger.Label>
          Classement
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon
          sf="gearshape.fill"
          md="settings"
        />
        <NativeTabs.Trigger.Label>
          Paramètres
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}