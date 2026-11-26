import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'
import { Platform } from 'react-native'

import { isHuaweiHealthInstalled } from '../../modules/step-sync'
import { loadStepSource, useStepSource } from './stepSource'

/**
 * Suggestion of Huawei Health on the home screen (ADR 0013, amended on
 * 2026-11-26): Huawei watches don't write to Health Connect, so a user
 * with the Huawei Health app installed probably wants to read it.
 */

const DISMISSED_KEY = '@step-challenge/huawei-suggestion-dismissed'

/**
 * Shown while Huawei Health is installed, the source is still Health
 * Connect and the user didn't answer "No thanks". Nothing is shown
 * before the stored source is known: a Huawei user must not see it
 * flash.
 */
export function useHuaweiSuggestion() {
  const source = useStepSource()
  const [dismissed, setDismissed] = useState<boolean | null>(null)
  const [installed] = useState(
    () => Platform.OS === 'android' && isHuaweiHealthInstalled(),
  )

  useEffect(() => {
    if (!installed) {
      return
    }

    Promise.all([loadStepSource(), AsyncStorage.getItem(DISMISSED_KEY)])
      .then(([, raw]) => setDismissed(raw === 'true'))
      .catch((error) => {
        console.error('Huawei suggestion unreadable:', error)
        setDismissed(true)
      })
  }, [installed])

  const dismiss = useCallback(() => {
    setDismissed(true)
    AsyncStorage.setItem(DISMISSED_KEY, 'true').catch((error) => {
      console.error('Huawei suggestion not saved:', error)
    })
  }, [])

  return {
    visible: installed && dismissed === false && source === 'healthConnect',
    dismiss,
  }
}
