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

  if (!date || isNaN(date.getTime())) return ''

  // Format relative part using date-fns with Norwegian locale
  // This returns only the relative date part without time (i dag, i morgen, for 3 dager siden, etc.)
  return formatRelative(date, new Date(), { locale: nb })
}

/**
 * Format a date for display without relative formatting
 * @param input - Date object or ISO string
 * @returns Formatted date (e.g., "mandag 5. januar")
 */
export function formatDateOnly(input: Date | string): string {
  const dateTime =
    typeof input === 'string'
      ? DateTime.fromISO(input, { zone: DEFAULT_ZONE })
      : DateTime.fromJSDate(input, { zone: DEFAULT_ZONE })

  if (!dateTime.isValid) return ''

  const localized = dateTime.setZone(DEFAULT_ZONE).setLocale(DEFAULT_LOCALE)
  return localized.toFormat('cccc d. MMMM')
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

  if (!dateTime.isValid) return ''

  const localized = dateTime.setZone(DEFAULT_ZONE).setLocale(DEFAULT_LOCALE)
  return localized.toFormat('HH:mm')
}

/**
 * Legacy function - kept for backwards compatibility
 * Formats a lap timestamp with relative date and time
 *
 * @param input - Date object or ISO string
 * @param locale - Optional locale (kept for signature compatibility)
 * @returns Formatted timestamp
 * @deprecated Use formatDateRelative() instead
 */
export function formatLapTimestamp(
  input: Date | string,
  locale: string = DEFAULT_LOCALE
) {
  const dateTime =
    typeof input === 'string'
      ? DateTime.fromISO(input, { zone: DEFAULT_ZONE })
      : DateTime.fromJSDate(input, { zone: DEFAULT_ZONE })

  if (!dateTime.isValid) return ''

  const resolvedLocale = locale ?? DEFAULT_LOCALE
  const localized = dateTime.setZone(DEFAULT_ZONE).setLocale(resolvedLocale)
  const today = DateTime.now()
    .setZone(DEFAULT_ZONE)
    .setLocale(resolvedLocale)
    .startOf('day')
  const targetDay = localized.startOf('day')

  const diffDays = Math.round(targetDay.diff(today, 'days').days ?? 0)

  let dayLabel: string
  if (diffDays === 0) dayLabel = 'Today'
  else if (diffDays === -1) dayLabel = 'Yesterday'
  else if (diffDays === 1) dayLabel = 'Tomorrow'
  else if (Math.abs(diffDays) <= 7) {
    const abs = Math.abs(diffDays)
    const unit = abs === 1 ? 'day' : 'days'
    dayLabel = diffDays > 0 ? `In ${abs} ${unit}` : `${abs} ${unit} ago`
  } else dayLabel = localized.toLocaleString(DateTime.DATE_MED)

  const timeLabel = localized.toLocaleString(DateTime.TIME_SIMPLE)

  return `${dayLabel} · ${timeLabel}`
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
