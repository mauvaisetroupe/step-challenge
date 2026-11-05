import { NativeTabs } from 'expo-router/unstable-native-tabs'

import { useTranslation } from 'react-i18next'

import { useHasNewBadges } from '@/services/newBadges'
import { useTheme } from '@/theme'

export default function TabsLayout() {
  const { colors } = useTheme()
  const { t } = useTranslation()
  // A dot on the Badges tab: badges awarded since the last look.
  const hasNewBadges = useHasNewBadges()

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
          {t('tabs.home')}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="stats">
        <NativeTabs.Trigger.Icon
          sf="chart.bar.fill"
          md="bar_chart"
        />
        <NativeTabs.Trigger.Label>
          {t('tabs.stats')}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="leaderboard">
        <NativeTabs.Trigger.Icon
          sf="trophy.fill"
          md="emoji_events"
        />
        <NativeTabs.Trigger.Label>
          {t('tabs.leaderboard')}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="badges">
        <NativeTabs.Trigger.Icon
          sf="rosette"
          md="military_tech"
        />
        <NativeTabs.Trigger.Label>
          {t('tabs.badges')}
        </NativeTabs.Trigger.Label>
        {hasNewBadges && <NativeTabs.Trigger.Badge />}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon
          sf="gearshape.fill"
          md="settings"
        />
        <NativeTabs.Trigger.Label>
          {t('tabs.settings')}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}