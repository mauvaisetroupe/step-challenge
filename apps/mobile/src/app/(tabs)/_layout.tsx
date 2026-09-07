import { NativeTabs } from 'expo-router/unstable-native-tabs'

export default function TabsLayout() {
  return (
    <NativeTabs>
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
    </NativeTabs>
  )
  
}