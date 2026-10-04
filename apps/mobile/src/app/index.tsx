import AsyncStorage from '@react-native-async-storage/async-storage'
import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'

import { getSessionToken } from '../auth/session'

/**
 * User id stored by app versions prior to Google sign-in (ADR 0001).
 * Nothing reads it anymore; it is removed from upgraded devices.
 * This cleanup can be dropped once all testers have upgraded.
 */
const LEGACY_USER_ID_KEY = '@step-challenge/user-id-v2'

export default function IndexScreen() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

  useEffect(() => {
    AsyncStorage.removeItem(LEGACY_USER_ID_KEY).catch((error) => {
      console.warn('Legacy user id cleanup failed:', error)
    })
  }, [])

  useEffect(() => {
    getSessionToken()
      .then((token) => setSignedIn(token !== null))
      .catch((error) => {
        console.error('Session read error:', error)
        setSignedIn(false)
      })
  }, [])

  if (signedIn === null) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return <Redirect href={signedIn ? '/home' : '/sign-in'} />
}
