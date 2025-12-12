import { DateTime } from 'luxon'
import type { SessionStatus } from '../../backend/database/schema'

const DEFAULT_LOCALE = 'nb-NO'
const DEFAULT_ZONE = 'Europe/Oslo'

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

export function isOngoing(session: { date: Date; status: SessionStatus }) {
  return (
    !isPast(session) && !isUpcoming(session) && session.status !== 'cancelled'
  )
}

export function isPast(session: { date: Date; status: SessionStatus }) {
  const endDate = DateTime.fromJSDate(getEndOfDate(new Date(session.date)))
  return endDate.diffNow().milliseconds <= 0
}

export function isUpcoming(session: { date: Date; status: SessionStatus }) {
  const startDate = DateTime.fromJSDate(new Date(session.date))
  return startDate.diffNow().milliseconds > 0
}
