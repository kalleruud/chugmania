import loc from '@common/locale/locales'
import { DEFAULT_LOCALE, DEFAULT_ZONE } from '@common/utils/date'
import { DateTime } from 'luxon'
import type { Grouping } from '../grouping'

type DateAccessor<T> = (item: T) => Date | string

function toDateTime(value: Date | string): DateTime {
  return DateTime.fromJSDate(new Date(value), { zone: DEFAULT_ZONE }).setLocale(
    DEFAULT_LOCALE
  )
}

export function byYear<T>(getDate: DateAccessor<T>): Grouping<T> {
  return {
    key: item => toDateTime(getDate(item)).toFormat('yyyy'),
    label: key => key,
  }
}

export function byMonth<T>(getDate: DateAccessor<T>): Grouping<T> {
  return {
    key: item => toDateTime(getDate(item)).toFormat('yyyy-MM'),
    label: key =>
      DateTime.fromFormat(key, 'yyyy-MM', { locale: DEFAULT_LOCALE }).toFormat(
        'LLLL yyyy'
      ),
  }
}

export function byWeek<T>(getDate: DateAccessor<T>): Grouping<T> {
  return {
    key: item => toDateTime(getDate(item)).toFormat("kkkk-'W'WW"),
    label: key => {
      const week = DateTime.fromFormat(key, "kkkk-'W'WW")
      return loc.no.common.week(week.weekNumber, week.weekYear)
    },
  }
}
