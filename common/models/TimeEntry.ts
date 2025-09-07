import { timeEntries } from '@database/schema'
import type { Track } from './track'
import type { UserInfo } from './user'

export type TimeEntry = typeof timeEntries.$inferSelect
export type CreateTimeEntry = typeof timeEntries.$inferInsert
export type TimeEntryGap = {
  next: number | null
  previous: number | null
  leader: number | null
}

type TimeEntryDetails = Omit<TimeEntry, 'user' | 'track'> & {
  user: UserInfo
  track: Track
  gap: TimeEntryGap
}
