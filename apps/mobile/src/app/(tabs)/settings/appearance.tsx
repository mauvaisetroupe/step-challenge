import { useTranslation } from 'react-i18next'

import RadioGroup from '@/components/settings/RadioGroup'
import { Description, SettingsPage } from '@/components/settings/ui'
import { useTheme, type AppearancePreference } from '@/theme'

const PREFERENCES: AppearancePreference[] = ['system', 'light', 'dark']

/** Light, dark, or the phone setting (kept on this device). */
export default function AppearanceSettingsScreen() {
  const { t } = useTranslation()
  const { preference, setPreference } = useTheme()

  return (
    <SettingsPage>
      <Description>{t('settings.appearance.description')}</Description>

      <RadioGroup
        options={PREFERENCES.map((value) => ({
          value,
          label: t(`settings.appearance.options.${value}.label`),
          hint: t(`settings.appearance.options.${value}.hint`),
        }))}
        selected={preference}
        onSelect={setPreference}
      />
    </SettingsPage>
  )
}
