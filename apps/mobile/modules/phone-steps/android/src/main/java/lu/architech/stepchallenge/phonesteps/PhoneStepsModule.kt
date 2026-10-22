package lu.architech.stepchallenge.phonesteps

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Reads the phone's hardware step counter (TYPE_STEP_COUNTER): steps
 * since the last boot, counted even when the app is closed. Fallback for
 * phones without Health Connect (Huawei), until Health Kit is approved;
 * the day-by-day bookkeeping is in services/phoneSteps.ts.
 */
class PhoneStepsModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context unavailable" }
      .applicationContext

  private val sensorManager: SensorManager?
    get() = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager?

  override fun definition() = ModuleDefinition {
    Name("PhoneSteps")

    Function("isAvailable") {
      sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
    }

    /**
     * Current counter and boot time (ms since the epoch, to detect a
     * reboot), or null without sensor or reading within the timeout.
     * Requires ACTIVITY_RECOGNITION (Android 10+).
     */
    AsyncFunction("read") { promise: Promise ->
      val manager = sensorManager
      val sensor = manager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

      if (manager == null || sensor == null) {
        promise.resolve(null)
        return@AsyncFunction
      }

      val handler = Handler(Looper.getMainLooper())
      var done = false

      val listener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
          if (done) return
          done = true
          manager.unregisterListener(this)
          handler.removeCallbacksAndMessages(null)
          promise.resolve(
            mapOf(
              "steps" to event.values[0].toDouble(),
              "bootTime" to (System.currentTimeMillis() - SystemClock.elapsedRealtime()).toDouble(),
            ),
          )
        }

        override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) = Unit
      }

      // The current value is delivered right after registration.
      handler.post {
        if (!manager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL)) {
          done = true
          promise.resolve(null)
          return@post
        }

        handler.postDelayed({
          if (!done) {
            done = true
            manager.unregisterListener(listener)
            promise.resolve(null)
          }
        }, READ_TIMEOUT_MS)
      }
    }
  }

  private companion object {
    const val READ_TIMEOUT_MS = 5_000L
  }
}
