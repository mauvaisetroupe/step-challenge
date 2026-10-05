import { useCallback, useState } from 'react'

import {
  Description,
  PrimaryButton,
  SettingsPage,
} from '@/components/settings/ui'
import { configureHuaweiHealth } from '@/services/huaweiHealth'

/** Connection to Huawei Health (waiting for Huawei's validation). */
export default function HuaweiSettingsScreen() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const configure = useCallback(async () => {
    setLoading(true)
    setMessage(null)

    try {
      await configureHuaweiHealth()
      setMessage('Huawei Health est configuré.')
    } catch (error) {
      console.error('Huawei Health configuration failed:', error)
      setMessage(
        error instanceof Error
          ? error.message
          : 'Erreur de configuration Huawei Health',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <SettingsPage>
      <Description>
        Connecte Step Challenge à Huawei Health pour permettre la lecture de
        tes pas.
      </Description>

      <PrimaryButton
        title="Configurer Huawei Health"
        onPress={configure}
        loading={loading}
      />

      {message && <Description>{message}</Description>}
    </SettingsPage>
  )
}
