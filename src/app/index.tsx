import AsyncStorage from '@react-native-async-storage/async-storage'
import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'

const USER_ID_KEY = '@step-challenge/user-id-v2'

export default function IndexScreen() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    AsyncStorage.getItem(USER_ID_KEY)
      .then(setUserId)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
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

  if (userId) {
    return <Redirect href="/home" />
  }

  return <Redirect href="/onboarding" />
}