import { NativeTabs } from 'expo-router/unstable-native-tabs'

export default function TabsLayout() {
  return (
    <NativeTabs labelVisibilityMode="labeled">
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