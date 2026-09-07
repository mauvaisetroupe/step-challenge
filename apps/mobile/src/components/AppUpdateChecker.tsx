import { useEffect } from 'react'
import { Alert, Linking } from 'react-native'

import { checkForAppUpdate } from '../services/appUpdate'

export default function AppUpdateChecker() {
  useEffect(() => {
    let mounted = true

    const checkUpdate = async () => {
      try {
        const update = await checkForAppUpdate()

        if (!mounted || !update) {
          return
        }

        Alert.alert(
          'Mise à jour disponible',
          `Une nouvelle version (${update.latestVersion}) est disponible.`,
          [
            {
              text: 'Plus tard',
              style: 'cancel',
            },
            {
              text: 'Mettre à jour',
              onPress: () => {
                Linking.openURL(update.url)
              },
            },
          ],
        )
      } catch (error) {
        console.error(
          'App update check error:',
          error,
        )
      }
    }

    checkUpdate()

    return () => {
      mounted = false
    }
  }, [])

  return null
}