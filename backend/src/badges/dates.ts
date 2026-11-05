/**
 * Calendar arithmetic on YYYY-MM-DD dates, without time zone effects:
 * the dates come from PostgreSQL, already in the server time zone
 * (APP_TIMEZONE).
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** Days since 1970-01-01. */
export function dayNumber(date: string) {
  return Date.parse(`${date}T00:00:00Z`) / DAY_MS
}

export function dateOfDayNumber(day: number) {
  return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

export function addDays(date: string, days: number) {
  return dateOfDayNumber(dayNumber(date) + days)
}

/** 0 for Monday to 6 for Sunday. */
export function dayOfWeek(date: string) {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
}

/** Monday of the week of `date`, as date_trunc('week') in PostgreSQL. */
export function weekStart(date: string) {
  return addDays(date, -dayOfWeek(date))
}

/** ISO week, e.g. 2026-W45: the year is the one of its Thursday. */
export function weekKey(date: string) {
  const thursday = addDays(weekStart(date), 3)
  const year = thursday.slice(0, 4)
  const week =
    Math.floor((dayNumber(thursday) - dayNumber(`${year}-01-01`)) / 7) + 1

  return `${year}-W${String(week).padStart(2, '0')}`
}

/** YYYY-MM. */
export function monthKey(date: string) {
  return date.slice(0, 7)
}

export function monthStart(month: string) {
  return `${month}-01`
}

export function monthEnd(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)

  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10)
}

export function nextMonth(month: string) {
  return monthKey(addDays(monthEnd(month), 1))
}
