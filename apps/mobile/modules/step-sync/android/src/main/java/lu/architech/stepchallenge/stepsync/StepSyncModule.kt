package lu.architech.stepchallenge.stepsync

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JavaScript API of the native background sync (ADR 0009). The worker
 * itself runs without JavaScript: these functions only configure it.
 */
class StepSyncModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context unavailable" }
      .applicationContext

  override fun definition() = ModuleDefinition {
    Name("StepSync")

    /** API address and session token used by the worker. */
    Function("configure") { apiUrl: String, token: String ->
      SyncStore(context).saveConfig(apiUrl, token)
    }

    /** Signed out: forget the token and stop the sync. */
    Function("clear") {
      SyncStore(context).clear()
      StepSyncScheduler.cancel(context)
    }

    Function("schedule") { intervalMinutes: Int ->
      StepSyncScheduler.schedule(context, intervalMinutes.toLong())
    }

    /** Background runs, most recent first, as a JSON array. */
    Function("getHistory") {
      SyncStore(context).historyJson()
    }
  }
}
