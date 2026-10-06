import Constants from 'expo-constants'
import { useTranslation } from 'react-i18next'

import { Card, InfoRow, SettingsPage } from '@/components/settings/ui'

export default function AboutSettingsScreen() {
  const { t } = useTranslation()

  return (
    <SettingsPage>
      <Card>
        <InfoRow label={t('settings.about.app')} value="Step Challenge" />
        <InfoRow
          label={t('settings.about.version')}
          value={Constants.expoConfig?.version ?? t('settings.about.unknown')}
          last
        />
      </Card>
    </SettingsPage>
  )
}
