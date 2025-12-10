import { formatRelative } from 'date-fns'
import { nb } from 'date-fns/locale'
import { DateTime } from 'luxon'

const DEFAULT_LOCALE = 'nb-NO'
const DEFAULT_ZONE = 'Europe/Oslo'

/**
 * Format a date with relative display (today, tomorrow, in 4 days, 6 days ago, etc.)
 * Falls back to full date format for dates beyond 1 week.
 *
 * @param input - Date object or ISO string
 * @returns Formatted relative date (e.g., "i dag", "i morgen", "for 3 dager siden")
 */
export function formatDateRelative(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input

  if (!date || Number.isNaN(date.getTime())) return ''

  // Format relative part using date-fns with Norwegian locale
  // This returns only the relative date part without time (i dag, i morgen, for 3 dager siden, etc.)
  return formatRelative(date, new Date(), { locale: nb })
}

/**
 * Format a date with full date and year
 * @param input - Date object or ISO string
 * @returns Formatted date (e.g., "mandag 5. januar 2025")
 */
export function formatDateWithYear(input: Date | string): string {
  const dateTime =
    typeof input === 'string'
      ? DateTime.fromISO(input, { zone: DEFAULT_ZONE })
      : DateTime.fromJSDate(input, { zone: DEFAULT_ZONE })

  if (!dateTime.isValid) return ''

  const localized = dateTime.setZone(DEFAULT_ZONE).setLocale(DEFAULT_LOCALE)
  return localized.toFormat('cccc d. MMMM yyyy')
}

export function formatYear(input: Date | string): string {
  const dateTime =
    typeof input === 'string'
      ? DateTime.fromISO(input, { zone: DEFAULT_ZONE })
      : DateTime.fromJSDate(input, { zone: DEFAULT_ZONE })

  if (!dateTime.isValid) return ''

  const localized = dateTime.setZone(DEFAULT_ZONE).setLocale(DEFAULT_LOCALE)
  return localized.toFormat('yyyy')
}

/**
 * Format a time for display
 * @param input - Date object or ISO string
 * @returns Formatted time (e.g., "14:30")
 */
export function formatTimeOnly(input: Date | string): string {
  const dateTime =
    typeof input === 'string'
      ? DateTime.fromISO(input, { zone: DEFAULT_ZONE })
      : DateTime.fromJSDate(input, { zone: DEFAULT_ZONE })

  if (!dateTime.isValid) return 'Invalid date: ' + input

  const localized = dateTime.setZone(DEFAULT_ZONE).setLocale(DEFAULT_LOCALE)
  return localized.toFormat('HH:mm')
}

export function getEndOfDate(date: Date): Date {
  return DateTime.fromJSDate(date)
    .plus({ days: 1 })
    .set({ hour: 3, minute: 59, second: 59, millisecond: 999 })
    .toJSDate()
}

export function isOngoing(session: { date: Date }) {
  return !isPast(session) && !isUpcoming(session)
}

export function isPast({ date }: { date: Date }) {
  const endDate = DateTime.fromJSDate(getEndOfDate(new Date(date)))
  return endDate.diffNow().milliseconds <= 0
}

export function isUpcoming({ date }: { date: Date }) {
  const startDate = DateTime.fromJSDate(new Date(date))
  return startDate.diffNow().milliseconds > 0
}
