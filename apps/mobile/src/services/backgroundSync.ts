import * as BackgroundTask from 'expo-background-task'
import * as TaskManager from 'expo-task-manager'

import { syncLast30Days } from './stepSync'

const STEP_SYNC_TASK = 'step-challenge-sync'

TaskManager.defineTask(STEP_SYNC_TASK, async () => {
  console.log('Background step sync started')

  try {
    await syncLast30Days()

    console.log('Background step sync completed')

    return BackgroundTask.BackgroundTaskResult.Success
  } catch (error) {
    console.error('Background step sync failed:', error)

    return BackgroundTask.BackgroundTaskResult.Failed
  }
})

console.log('Background task definition loaded')

export async function registerBackgroundStepSync() {
  console.log('Registering background step sync')

  const isRegistered =
    await TaskManager.isTaskRegisteredAsync(STEP_SYNC_TASK)

  console.log('Already registered:', isRegistered)

  if (isRegistered) {
    return
  }

  await BackgroundTask.registerTaskAsync(STEP_SYNC_TASK, {
    minimumInterval: 24 * 60,
  })

  console.log('Background step sync registered')
}