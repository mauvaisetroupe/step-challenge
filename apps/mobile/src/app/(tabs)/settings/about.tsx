import Constants from 'expo-constants'

import { Card, InfoRow, SettingsPage } from '@/components/settings/ui'

export default function AboutSettingsScreen() {
  return (
    <SettingsPage>
      <Card>
        <InfoRow label="Application" value="Step Challenge" />
        <InfoRow
          label="Version"
          value={Constants.expoConfig?.version ?? 'Inconnue'}
          last
        />
      </Card>
    </SettingsPage>
  )
}
