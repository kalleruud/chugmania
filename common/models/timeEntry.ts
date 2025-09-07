import { timeEntries } from '@database/schema'
import type { Track } from './track'
import type { UserInfo } from './user'

export type TimeEntry = typeof timeEntries.$inferSelect
export type CreateTimeEntry = typeof timeEntries.$inferInsert
export type TimeEntryGap =
  | {
      position?: number
      next?: number
      previous?: number
      leader?: number
    }
  | {
      position?: 1
      next?: never
      previous?: number
      leader?: never
    }

export type TimeEntryDetails = Omit<TimeEntry, 'user' | 'track'> & {
  user: UserInfo
  track: Track
  gap: TimeEntryGap
}
