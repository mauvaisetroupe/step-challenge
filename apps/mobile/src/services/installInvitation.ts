import AsyncStorage from '@react-native-async-storage/async-storage'
import { getInstallReferrerAsync } from 'expo-application'
import { Platform } from 'react-native'

import { invitationFromInstallReferrer } from './invitationLink'

/**
 * Invitation carried through the install by Google Play (ADR 0015): a
 * guest without the app installs it from the invitation page, and the
 * app opens the invitation at first launch, without going back to the
 * link.
 */

const READ_KEY = '@step-challenge/install-referrer-read'

/** The start screen waits for it: never longer than this. */
const TIMEOUT_MS = 3_000

/**
 * Invitation code of the install ("K7F3-M9QX"), the first time only:
 * Google Play keeps the referrer 90 days, and an invitation already
 * handled must not come back. Null otherwise, also on any error (no
 * Play Store, AppGallery, emulator): it never blocks the start.
 */
export async function takeInstallInvitation() {
  if (Platform.OS !== 'android') {
    return null
  }

  try {
    if (await AsyncStorage.getItem(READ_KEY)) {
      return null
    }

    await AsyncStorage.setItem(READ_KEY, 'true')

    let timer: ReturnType<typeof setTimeout> | undefined

    const referrer = await Promise.race([
      getInstallReferrerAsync(),
      new Promise<string>((resolve) => {
        timer = setTimeout(() => resolve(''), TIMEOUT_MS)
      }),
    ]).finally(() => clearTimeout(timer))

    return invitationFromInstallReferrer(referrer)
  } catch (error) {
    console.warn('Install referrer unreadable:', error)
    return null
  }
}
