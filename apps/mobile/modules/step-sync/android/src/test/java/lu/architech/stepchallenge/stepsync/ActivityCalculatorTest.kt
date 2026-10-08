package lu.architech.stepchallenge.stepsync

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * The shared fixtures (ADR 0010): the TypeScript calculation must give
 * the same results, see src/services/activity.test.ts.
 */
class ActivityCalculatorTest {
  private val fixtures: JSONArray by lazy {
    // Gradle runs the unit tests from the module's android/ directory.
    JSONObject(File("../test-fixtures/activity-days.json").readText()).getJSONArray("days")
  }

  @Test
  fun sharedFixtures() {
    for (index in 0 until fixtures.length()) {
      val day = fixtures.getJSONObject(index)
      val name = day.getString("name")
      val expected = day.getJSONObject("expected")

      val steps = mutableListOf<Long>()
      val runs = day.getJSONArray("runs")
      for (run in 0 until runs.length()) {
        val (minutes, perMinute) = runs.getJSONArray(run).let { it.getInt(0) to it.getLong(1) }
        repeat(minutes) { steps.add(perMinute) }
      }

      assertEquals("$name: a fixture day lasts 1440 minutes", 1440, steps.size)

      val activity = ActivityCalculator.compute(steps.toLongArray())

      val periods = expected.getJSONArray("inactivePeriods").let { array ->
        (0 until array.length()).map { array.getJSONArray(it).let { p -> p.getInt(0) to p.getInt(1) } }
      }

      assertEquals("$name: inactive periods", periods, activity.inactivePeriods)
      assertEquals("$name: active", expected.getInt("activeMinutes"), activity.activeMinutes)
      assertEquals("$name: very active", expected.getInt("veryActiveMinutes"), activity.veryActiveMinutes)
      assertEquals("$name: inactive", expected.getInt("inactiveMinutes"), activity.inactiveMinutes)
    }
  }
}
