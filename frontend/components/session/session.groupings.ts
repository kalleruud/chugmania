import type { SessionWithSignups } from '@common/models/session'
import type { Grouping } from '../grouped-list/grouping'
import { byMonth, byWeek, byYear } from '../grouped-list/groupings/date'

const sessionDate = (session: SessionWithSignups) => session.date

export const sessionGroupings = {
  year: byYear(sessionDate),
  month: byMonth(sessionDate),
  week: byWeek(sessionDate),
} satisfies Record<string, Grouping<SessionWithSignups>>

export type SessionGroupingKey = keyof typeof sessionGroupings
