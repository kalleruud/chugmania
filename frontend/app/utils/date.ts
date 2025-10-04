import { DateTime } from 'luxon'

const DEFAULT_LOCALE = 'nb-NO'
const DEFAULT_ZONE = 'Europe/Oslo'

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
