import { DEFAULT_LOCALE, DEFAULT_ZONE } from '@common/utils/date'
import { DateTime } from 'luxon'

export default function DateValue({
  value,
  dateOnly = false,
}: Readonly<{ value: DateTime; dateOnly?: boolean }>) {
  return (
    <time dateTime={value.toISO() ?? undefined} className='tabular-nums'>
      {value
        .setZone(DEFAULT_ZONE)
        .setLocale(DEFAULT_LOCALE)
        .toLocaleString(
          dateOnly ? DateTime.DATE_MED : DateTime.DATETIME_MED_WITH_SECONDS
        )}
    </time>
  )
}
