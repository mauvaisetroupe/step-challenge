package lu.architech.stepchallenge.stepsync

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/** Schedules the periodic background sync with WorkManager (ADR 0009). */
internal object StepSyncScheduler {
  private const val WORK_NAME = "step-challenge-native-sync"

  // Work scheduled by expo-background-task in app versions before ADR 0009.
  private const val LEGACY_WORK_TAG = "expo.modules.backgroundtask.BackgroundTaskWork"

  fun schedule(context: Context, intervalMinutes: Long) {
    val workManager = WorkManager.getInstance(context)

    workManager.cancelAllWorkByTag(LEGACY_WORK_TAG)

    val request = PeriodicWorkRequestBuilder<StepSyncWorker>(intervalMinutes, TimeUnit.MINUTES)
      .setConstraints(
        Constraints.Builder()
          .setRequiredNetworkType(NetworkType.CONNECTED)
          .build(),
      )
      .build()

    // UPDATE keeps the current schedule and applies a new interval.
    workManager.enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.UPDATE, request)
  }

  fun cancel(context: Context) {
    WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
  }
}
