package lu.architech.stepchallenge.stepsync

/**
 * Activity minutes of a day (ADR 0010), from its steps per minute.
 *
 * Same rules, same results as src/services/inactivity.ts and
 * src/services/activity.ts: both are checked against the shared
 * fixtures of modules/step-sync/test-fixtures/activity-days.json.
 */
internal object ActivityCalculator {
  /** Minimum length of an inactive period, in minutes. */
  const val INACTIVE_MINUTES = 60

  /** Steps that break an inactive period (about a minute of walking)… */
  const val BREAK_STEPS = 100L

  /** …within this window, in minutes. */
  const val BREAK_WINDOW_MINUTES = 15

  /** Below this, a minute is not walking, even next to a walk. */
  const val MIN_WALKING_STEPS_PER_MINUTE = 20L

  /** Steps per minute from which a minute is active (moderate). */
  const val ACTIVE_CADENCE = 100L

  /** Steps per minute from which a minute is very active (vigorous). */
  const val VERY_ACTIVE_CADENCE = 130L

  /**
   * Sleep hours, in minutes since midnight: no inactivity is counted
   * then. Bed time after wake time crosses midnight; the same value for
   * both means none.
   */
  data class SleepHours(val bed: Int, val wake: Int) {
    fun contains(minuteOfDay: Int) = when {
      bed == wake -> false
      bed > wake -> minuteOfDay >= bed || minuteOfDay < wake
      else -> minuteOfDay >= bed && minuteOfDay < wake
    }
  }

  val DEFAULT_SLEEP_HOURS = SleepHours(bed = 23 * 60, wake = 6 * 60)

  data class DayActivity(
    val activeMinutes: Int,
    val veryActiveMinutes: Int,
    val inactiveMinutes: Int,
    /** [start, end) in minutes since the start of the day. */
    val inactivePeriods: List<Pair<Int, Int>>,
  )

  /**
   * `minuteOfDay[i]`: clock minute of `stepsPerMinute[i]` (they differ
   * from the index on daylight saving days).
   */
  fun compute(
    stepsPerMinute: LongArray,
    minuteOfDay: IntArray = IntArray(stepsPerMinute.size) { it },
    sleepHours: SleepHours? = null,
  ): DayActivity {
    var activeMinutes = 0
    var veryActiveMinutes = 0

    for (steps in stepsPerMinute) {
      if (steps >= VERY_ACTIVE_CADENCE) {
        veryActiveMinutes++
      } else if (steps >= ACTIVE_CADENCE) {
        activeMinutes++
      }
    }

    val periods = inactivePeriods(stepsPerMinute, minuteOfDay, sleepHours)

    return DayActivity(
      activeMinutes = activeMinutes,
      veryActiveMinutes = veryActiveMinutes,
      inactiveMinutes = periods.sumOf { (start, end) -> end - start },
      inactivePeriods = periods,
    )
  }

  /**
   * Periods of at least INACTIVE_MINUTES without walking, between the
   * first and the last step of the day, outside the sleep hours.
   */
  private fun inactivePeriods(
    steps: LongArray,
    minuteOfDay: IntArray,
    sleepHours: SleepHours?,
  ): List<Pair<Int, Int>> {
    val first = steps.indexOfFirst { it > 0 }
    val last = steps.indexOfLast { it > 0 }

    if (first < 0) {
      return emptyList()
    }

    // A minute is active when it is walking and belongs to a window of
    // BREAK_WINDOW_MINUTES with at least BREAK_STEPS steps.
    val active = BooleanArray(steps.size)

    for (index in 0..steps.size - BREAK_WINDOW_MINUTES) {
      var sum = 0L
      for (offset in 0 until BREAK_WINDOW_MINUTES) sum += steps[index + offset]

      if (sum >= BREAK_STEPS) {
        for (offset in 0 until BREAK_WINDOW_MINUTES) {
          if (steps[index + offset] >= MIN_WALKING_STEPS_PER_MINUTE) {
            active[index + offset] = true
          }
        }
      }
    }

    val periods = mutableListOf<Pair<Int, Int>>()
    var runStart: Int? = null

    fun closeRun(end: Int) {
      val start = runStart
      if (start != null && end - start >= INACTIVE_MINUTES) {
        periods.add(start to end)
      }
      runStart = null
    }

    for (index in first..last) {
      val asleep = sleepHours?.contains(minuteOfDay[index]) == true

      // Walking, or sleeping: not inactive.
      if (active[index] || asleep) {
        closeRun(index)
      } else if (runStart == null) {
        runStart = index
      }
    }

    closeRun(last + 1)

    return periods
  }
}
