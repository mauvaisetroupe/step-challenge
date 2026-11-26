import AsyncStorage from '@react-native-async-storage/async-storage'
import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'

import { getSessionToken } from '../auth/session'
import { takeInstallInvitation } from '@/services/installInvitation'

/**
 * User id stored by app versions prior to Google sign-in (ADR 0001).
 * Nothing reads it anymore; it is removed from upgraded devices.
 * This cleanup can be dropped once all testers have upgraded.
 */
const LEGACY_USER_ID_KEY = '@step-challenge/user-id-v2'

export default function IndexScreen() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  // Installed from an invitation page (ADR 0015): open it right away.
  const [invitation, setInvitation] = useState<string | null>(null)

  useEffect(() => {
    AsyncStorage.removeItem(LEGACY_USER_ID_KEY).catch((error) => {
      console.warn('Legacy user id cleanup failed:', error)
    })
  }, [])

  useEffect(() => {
    Promise.all([
      getSessionToken().catch((error) => {
        console.error('Session read error:', error)
        return null
      }),
      takeInstallInvitation(),
    ]).then(([token, code]) => {
      setInvitation(code)
      setSignedIn(token !== null)
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

  // The invitation screen asks to sign in first when needed.
  if (invitation) {
    return <Redirect href={`/i/${invitation}`} />
  }

  return <Redirect href={signedIn ? '/home' : '/sign-in'} />
}
