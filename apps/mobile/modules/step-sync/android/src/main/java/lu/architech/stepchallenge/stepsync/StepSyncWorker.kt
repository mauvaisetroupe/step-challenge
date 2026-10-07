package lu.architech.stepchallenge.stepsync

import android.content.Context
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.Period

/**
 * Background step sync (ADR 0009): reads the daily step totals of the
 * last 30 days from Health Connect and sends them to the API, without
 * JavaScript. Run by WorkManager about every 6 hours.
 *
 * Same data as src/services/stepSync.ts: 30 days, days in local time,
 * the server keeps the highest total per day.
 */
class StepSyncWorker(context: Context, params: WorkerParameters) :
  CoroutineWorker(context, params) {

  override suspend fun doWork(): Result {
    val store = SyncStore(applicationContext)
    val apiUrl = store.apiUrl()
    val token = store.token()

    // Signed out: nothing to sync, and nothing to record.
    if (apiUrl == null || token == null) {
      Log.i(TAG, "Skipped: not signed in")
      return Result.success()
    }

    val run = JSONObject()
      .put("timestamp", Instant.now().toString())
      .put("trigger", "background")

    try {
      val updatedDays = send(apiUrl, token, readLast30Days())
      run.put("status", "success").put("syncedDays", updatedDays)
      Log.i(TAG, "Synced: $updatedDays day(s) updated")
    } catch (error: Exception) {
      if (error is SessionExpiredException) {
        // The session is no longer valid: stop until the next sign-in,
        // which configures and schedules the sync again.
        store.clear()
        StepSyncScheduler.cancel(applicationContext)
      }

      run.put("status", "failed").put("error", error.message ?: error.toString())
      Log.w(TAG, "Failed: ${error.message}")
    }

    store.addRun(run)

    // Periodic work: the next run comes anyway; no retry storm.
    return Result.success()
  }

  private suspend fun readLast30Days(): List<Pair<LocalDate, Long>> {
    if (HealthConnectClient.getSdkStatus(applicationContext) != HealthConnectClient.SDK_AVAILABLE) {
      throw IllegalStateException("Health Connect is not available")
    }

    val client = HealthConnectClient.getOrCreate(applicationContext)
    val required = setOf(
      HealthPermission.getReadPermission(StepsRecord::class),
      HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND,
    )
    val missing = required - client.permissionController.getGrantedPermissions()

    // No dialog in the background: the user grants them in the app.
    if (missing.isNotEmpty()) {
      throw IllegalStateException("Missing Health Connect permission: ${missing.joinToString()}")
    }

    val today = LocalDate.now()
    val firstDay = today.minusDays(HISTORY_DAYS - 1)

    val buckets = client.aggregateGroupByPeriod(
      AggregateGroupByPeriodRequest(
        metrics = setOf(StepsRecord.COUNT_TOTAL),
        timeRangeFilter = TimeRangeFilter.between(firstDay.atStartOfDay(), LocalDateTime.now()),
        timeRangeSlicer = Period.ofDays(1),
      ),
    )

    val steps = buckets.associate {
      it.startTime.toLocalDate() to (it.result[StepsRecord.COUNT_TOTAL] ?: 0L)
    }

    // One entry per day, 0 when Health Connect has nothing for it.
    return (0 until HISTORY_DAYS).map { offset ->
      val day = firstDay.plusDays(offset)
      day to (steps[day] ?: 0L)
    }
  }

  /** Sends the days, 31 at most per request. Returns the days updated. */
  private suspend fun send(
    apiUrl: String,
    token: String,
    days: List<Pair<LocalDate, Long>>,
  ): Int = withContext(Dispatchers.IO) {
    var updated = 0

    for (chunk in days.chunked(MAX_DAYS_PER_REQUEST)) {
      val body = JSONObject().put(
        "days",
        JSONArray(chunk.map { (date, steps) -> JSONObject().put("date", date.toString()).put("steps", steps) }),
      )

      val connection = (URL("$apiUrl/api/me/steps").openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = TIMEOUT_MS
        readTimeout = TIMEOUT_MS
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("Authorization", "Bearer $token")
      }

      try {
        connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }

        when (val code = connection.responseCode) {
          401 -> throw SessionExpiredException()
          in 200..299 -> {
            val response = connection.inputStream.bufferedReader().use { it.readText() }
            updated += JSONObject(response).optJSONArray("updatedDates")?.length() ?: 0
          }
          else -> throw IllegalStateException("Server error (HTTP $code)")
        }
      } finally {
        connection.disconnect()
      }
    }

    updated
  }

  private class SessionExpiredException : Exception("Session expired (HTTP 401): sign in again")

  private companion object {
    const val TAG = "StepSyncWorker"
    const val HISTORY_DAYS = 30L
    const val MAX_DAYS_PER_REQUEST = 31
    const val TIMEOUT_MS = 30_000
  }
}
