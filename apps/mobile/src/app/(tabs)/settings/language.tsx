import { getLocales } from 'expo-localization'
import { useTranslation } from 'react-i18next'

import RadioGroup, { type RadioOption } from '@/components/settings/RadioGroup'
import { Description, SettingsPage } from '@/components/settings/ui'
import {
  LANGUAGE_NAMES,
  LANGUAGES,
  useLanguage,
  type LanguagePreference,
} from '@/i18n'

/** Name of the phone language, in that language ("español"). */
function phoneLanguageName() {
  try {
    const tag = getLocales()[0]?.languageTag

    if (tag) {
      return new Intl.DisplayNames([tag], { type: 'language' }).of(tag) ?? tag
    }
  } catch {
    // Intl.DisplayNames is missing on some engines: no name then.
  }

  return null
}

/**
 * Language of the app (ADR 0007): the phone's, or one of the supported
 * languages, each named in its own language. Kept on this device.
 */
export default function LanguageSettingsScreen() {
  const { t } = useTranslation()
  const { preference, setPreference } = useLanguage()
  const phoneLanguage = phoneLanguageName()

  const options: RadioOption<LanguagePreference>[] = [
    {
      value: 'system',
      label: t('settings.language.system'),
      hint: phoneLanguage
        ? t('settings.language.systemHint', { language: phoneLanguage })
        : undefined,
    },
    ...LANGUAGES.map((language) => ({
      value: language,
      label: LANGUAGE_NAMES[language],
    })),
  ]

  return (
    <SettingsPage>
      <Description>{t('settings.language.description')}</Description>

      <RadioGroup
        options={options}
        selected={preference}
        onSelect={setPreference}
      />
    </SettingsPage>
  )
}
