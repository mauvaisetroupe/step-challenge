import { Card, NavRow, SettingsPage } from '@/components/settings/ui'
import { openPublicPage, PRIVACY_URL, TERMS_URL } from '@/constants/links'

/** Terms of use and privacy policy, on the public site (ADR 0004). */
export default function LegalSettingsScreen() {
  return (
    <SettingsPage>
      <Card>
        <NavRow
          title="Conditions d'utilisation"
          onPress={() => openPublicPage(TERMS_URL)}
        />
        <NavRow
          title="Politique de confidentialité"
          onPress={() => openPublicPage(PRIVACY_URL)}
          last
        />
      </Card>
    </SettingsPage>
  )
}
