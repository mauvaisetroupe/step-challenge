/**
 * Past leaderboards (previous week or month): when their result can
 * still change, and when the home screen recalls last week's.
 */

/**
 * Days after the end of a period during which its leaderboard can still
 * change: the steps of the last evening reach the server at the next
 * sync of each friend (opening the app, or the background sync every 6
 * hours).
 */
export const LATE_SYNC_DAYS = 2

/** YYYY-MM-DD shifted by `days`, without time zone effects. */
function addDays(date: string, days: number) {
  const result = new Date(`${date}T00:00:00Z`)

  result.setUTCDate(result.getUTCDate() + days)

  return result.toISOString().slice(0, 10)
}

/**
 * The period ending on `end` can still change on `today` (both
 * YYYY-MM-DD): until LATE_SYNC_DAYS days after its end, the current
 * period included.
 */
export function isProvisional(end: string, today: string) {
  return today <= addDays(end, LATE_SYNC_DAYS)
}

/**
 * The home screen recalls last week's result from Monday to the day
 * it is final (Wednesday): whoever did not look on Sunday evening still
 * learns how the week ended.
 */
export function showsLastWeekRecap(today: Date) {
  // getDay(): 0 for Sunday, 1 for Monday.
  const dayOfWeek = (today.getDay() + 6) % 7

  return dayOfWeek <= LATE_SYNC_DAYS
}

/** Midnight of a YYYY-MM-DD date, local time, for formatting. */
export function parseDateKey(date: string) {
  const [year, month, day] = date.split('-').map(Number)

  return new Date(year, month - 1, day)
}
