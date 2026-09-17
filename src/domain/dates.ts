/**
 * Calendar-date arithmetic.
 *
 * Install dates, warranty ends and due dates are calendar dates ("YYYY-MM-DD"),
 * not instants. They are compared as UTC day numbers rather than local Date
 * objects so a DST boundary falling between two dates cannot skew a day count,
 * and so the same helpers give the same answer on the server and in the browser.
 */

export type DateOnly = string

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
export const MS_PER_DAY = 86_400_000

/** A "YYYY-MM-DD" string as a UTC-midnight timestamp, or null if unparseable. */
export function toUtcDay(value: string | null | undefined): number | null {
  if (!value) return null
  const match = DATE_ONLY.exec(value)
  if (!match) return null
  const [, year, month, day] = match
  const ms = Date.UTC(Number(year), Number(month) - 1, Number(day))
  return Number.isNaN(ms) ? null : ms
}

/** The local calendar day of `now`, as the same kind of UTC-midnight timestamp. */
export function todayAsUtcDay(now: number = Date.now()): number {
  const d = new Date(now)
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Today as "YYYY-MM-DD" in the local calendar. */
export function todayDateOnly(now: number = Date.now()): DateOnly {
  return toDateOnly(todayAsUtcDay(now))
}

/** A UTC-midnight timestamp back to "YYYY-MM-DD". */
export function toDateOnly(utcDay: number): DateOnly {
  return new Date(utcDay).toISOString().slice(0, 10)
}

/** Whole days from `from` to `to`. Negative when `to` is in the past. */
export function daysBetween(from: DateOnly | number, to: DateOnly | number): number | null {
  const a = typeof from === 'number' ? from : toUtcDay(from)
  const b = typeof to === 'number' ? to : toUtcDay(to)
  if (a === null || b === null) return null
  return Math.round((b - a) / MS_PER_DAY)
}

/** Whole days between a date and today. Negative once the date has passed. */
export function daysFromToday(date: DateOnly | null | undefined, now: number = Date.now()): number | null {
  const day = toUtcDay(date)
  if (day === null) return null
  return Math.round((day - todayAsUtcDay(now)) / MS_PER_DAY)
}

export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year'

export const RECURRENCE_UNITS: readonly RecurrenceUnit[] = ['day', 'week', 'month', 'year'] as const

/**
 * The client-side twin of the database's `add_interval()`.
 *
 * Month and year steps clamp to the end of the target month, so 31 January
 * plus one month is 28 February rather than spilling into March - which is
 * what Postgres does, and what anyone reading "monthly" expects.
 */
export function addInterval(date: DateOnly, value: number, unit: RecurrenceUnit): DateOnly | null {
  const day = toUtcDay(date)
  if (day === null || !Number.isFinite(value)) return null

  if (unit === 'day') return toDateOnly(day + value * MS_PER_DAY)
  if (unit === 'week') return toDateOnly(day + value * 7 * MS_PER_DAY)

  const d = new Date(day)
  const year = d.getUTCFullYear() + (unit === 'year' ? value : 0)
  const month = d.getUTCMonth() + (unit === 'month' ? value : 0)
  const dayOfMonth = d.getUTCDate()

  const target = new Date(Date.UTC(year, month, 1))
  const lastDayOfTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate()

  target.setUTCDate(Math.min(dayOfMonth, lastDayOfTargetMonth))
  return toDateOnly(target.getTime())
}

/** "every 3 months", "yearly", "every 10 days". */
export function describeInterval(value: number, unit: RecurrenceUnit): string {
  if (value === 1) {
    const each: Record<RecurrenceUnit, string> = {
      day: 'daily',
      week: 'weekly',
      month: 'monthly',
      year: 'yearly',
    }
    return each[unit]
  }
  return `every ${value} ${unit}s`
}
