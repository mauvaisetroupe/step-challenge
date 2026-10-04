import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'

import { getSessionToken } from '../auth/session'

export default function IndexScreen() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

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
