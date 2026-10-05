import AccountSection from '@/components/AccountSection'
import { SettingsPage } from '@/components/settings/ui'

/** Display name, sign-out and account deletion (ADR 0001). */
export default function AccountSettingsScreen() {
  return (
    <SettingsPage>
      <AccountSection />
    </SettingsPage>
  )
}
