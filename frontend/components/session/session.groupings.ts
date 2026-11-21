import type { SessionWithSignups } from '@common/models/session'
import { getSessionDate } from '@common/utils/date'
import type { Grouping } from '../grouped-list/grouping'
import { byMonth, byWeek, byYear } from '../grouped-list/groupings/date'

export const sessionGroupings = {
  year: byYear(getSessionDate),
  month: byMonth(getSessionDate),
  week: byWeek(getSessionDate),
} satisfies Record<string, Grouping<SessionWithSignups>>

export type SessionGroupingKey = keyof typeof sessionGroupings
