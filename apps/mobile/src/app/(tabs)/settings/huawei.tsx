import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Description,
  PrimaryButton,
  SettingsPage,
} from '@/components/settings/ui'
import { configureHuaweiHealth } from '@/services/huaweiHealth'

/** Connection to Huawei Health (waiting for Huawei's validation). */
export default function HuaweiSettingsScreen() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const configure = useCallback(async () => {
    setLoading(true)
    setMessage(null)

    try {
      await configureHuaweiHealth()
      setMessage(t('settings.huawei.configured'))
    } catch (error) {
      console.error('Huawei Health configuration failed:', error)
      setMessage(
        error instanceof Error
          ? error.message
          : t('settings.huawei.error'),
      )
    } finally {
      setLoading(false)
    }
  }, [t])

  return (
    <SettingsPage>
      <Description>{t('settings.huawei.description')}</Description>

      <PrimaryButton
        title={t('settings.huawei.configure')}
        onPress={configure}
        loading={loading}
      />

      {message && <Description>{message}</Description>}
    </SettingsPage>
  )
}
