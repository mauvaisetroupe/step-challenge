import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'

import { exportMyData } from '@/api/me'

/**
 * Downloads all the user's personal data (ADR 0017, right of access),
 * writes it to a JSON file in the cache and opens the share sheet, to
 * save it or send it.
 */
export async function shareMyData(dialogTitle: string) {
  const data = await exportMyData()
  const day = new Date().toISOString().slice(0, 10)
  const file = new File(Paths.cache, `step-challenge-export-${day}.json`)

  // Replaces a previous export of the same day.
  file.create({ overwrite: true })
  file.write(JSON.stringify(data, null, 2))

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle,
  })
}
