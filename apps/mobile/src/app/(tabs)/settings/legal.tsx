import { useTranslation } from 'react-i18next'

import { Card, NavRow, SettingsPage } from '@/components/settings/ui'
import { openPublicPage, PRIVACY_URL, TERMS_URL } from '@/constants/links'

/** Terms of use and privacy policy, on the public site (ADR 0004). */
export default function LegalSettingsScreen() {
  const { t } = useTranslation()

  return (
    <SettingsPage>
      <Card>
        <NavRow
          title={t('settings.legal.terms')}
          onPress={() => openPublicPage(TERMS_URL)}
        />
        <NavRow
          title={t('settings.legal.privacy')}
          onPress={() => openPublicPage(PRIVACY_URL)}
          last
        />
      </Card>
    </SettingsPage>
  )
}
