package lu.architech.stepchallenge.stepsync

import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
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

    /**
     * API address and session token used by the worker. A new sign-in
     * schedules the sync again: signing out cancelled it, and the app
     * only schedules it at start.
     */
    Function("configure") { apiUrl: String, token: String ->
      val store = SyncStore(context)
      store.saveConfig(apiUrl, token)
      store.intervalMinutes()?.let { StepSyncScheduler.schedule(context, it) }
    }

    /** Signed out: forget the token and stop the sync. */
    Function("clear") {
      SyncStore(context).clear()
      StepSyncScheduler.cancel(context)
    }

    Function("schedule") { intervalMinutes: Int ->
      SyncStore(context).saveIntervalMinutes(intervalMinutes.toLong())
      StepSyncScheduler.schedule(context, intervalMinutes.toLong())
    }

    /** Sleep hours, in minutes since midnight: no inactivity then. */
    Function("setSleepHours") { bedMinute: Int, wakeMinute: Int ->
      SyncStore(context).saveSleepHours(ActivityCalculator.SleepHours(bedMinute, wakeMinute))
    }

    /** Step source chosen by the user: "healthConnect" or "huawei" (ADR 0013). */
    Function("setStepSource") { source: String ->
      SyncStore(context).saveStepSource(source)
    }

    /**
     * Whether the Huawei Health app is installed, to suggest it as step
     * source (ADR 0013). Visible thanks to <queries> in the manifest.
     */
    Function("isHuaweiHealthInstalled") {
      try {
        context.packageManager.getPackageInfo(HUAWEI_HEALTH_PACKAGE, 0)
        true
      } catch (e: PackageManager.NameNotFoundException) {
        false
      }
    }

    /**
     * Thaws HMS Core's Health Kit process (com.huawei.hwid.container1),
     * which Android freezes on non-Huawei phones: a query to a provider
     * it hosts wakes it up (docs/explanation/huawei-integration.md,
     * section 16). Called before a HUAWEI sign-in or revocation.
     * Returns whether the provider answered.
     */
    AsyncFunction("wakeHuaweiHms") {
      try {
        context.contentResolver
          .query(Uri.parse(HMS_PROBE_URI), null, null, null, null)
          ?.close()
        true
      } catch (e: Exception) {
        false
      }
    }

    /** Background runs, most recent first, as a JSON array. */
    Function("getHistory") {
      SyncStore(context).historyJson()
    }
  }

  private companion object {
    const val HUAWEI_HEALTH_PACKAGE = "com.huawei.health"
    const val HMS_PROBE_URI = "content://com.huawei.android.sns.sdk/probe"
  }
}
