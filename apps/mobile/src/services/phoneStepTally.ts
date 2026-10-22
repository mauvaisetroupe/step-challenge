import type { PhoneStepReading } from '../../modules/phone-steps'

/**
 * Day-by-day tally of the phone step counter (fallback without Health
 * Connect, see phoneSteps.ts). The counter only gives the steps since
 * the last boot: each reading adds the steps since the previous one.
 *
 * Deliberately simple, until Health Kit replaces it:
 * - the steps between the last reading of a day and the first reading
 *   of the next one all go to the earlier day (never more than walked
 *   on a day, but the morning before the first opening counts for the
 *   day before);
 * - after a reboot, the steps between the last reading and the reboot
 *   are lost;
 * - nothing is counted before the first reading.
 */

export type PhoneStepTally = {
  /** Local calendar date of `steps`, YYYY-MM-DD. */
  day: string
  /** Steps counted on `day` so far. */
  steps: number
  /** Last reading. */
  counter: number
  bootTime: number
}

/** Boot times computed from two clocks drift a little. */
const BOOT_TIME_TOLERANCE_MS = 60_000

/**
 * Adds a reading to the tally. Returns the new tally and the day totals
 * to send (the backend keeps the highest value of each day).
 */
export function addPhoneStepReading(
  tally: PhoneStepTally | null,
  reading: PhoneStepReading,
  today: string,
): { tally: PhoneStepTally; days: { date: string; steps: number }[] } {
  const counter = Math.round(reading.steps)

  if (!tally) {
    return {
      tally: { day: today, steps: 0, counter, bootTime: reading.bootTime },
      days: [{ date: today, steps: 0 }],
    }
  }

  const rebooted =
    Math.abs(reading.bootTime - tally.bootTime) > BOOT_TIME_TOLERANCE_MS ||
    counter < tally.counter
  const delta = rebooted ? counter : counter - tally.counter

  if (tally.day === today) {
    const steps = tally.steps + delta

    return {
      tally: { day: today, steps, counter, bootTime: reading.bootTime },
      days: [{ date: today, steps }],
    }
  }

  return {
    tally: { day: today, steps: 0, counter, bootTime: reading.bootTime },
    days: [
      { date: tally.day, steps: tally.steps + delta },
      { date: today, steps: 0 },
    ],
  }
}
