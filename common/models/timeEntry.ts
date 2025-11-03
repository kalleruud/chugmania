import { timeEntries } from '../../backend/database/schema'

export type TimeEntry = typeof timeEntries.$inferSelect
export type CreateTimeEntry = typeof timeEntries.$inferInsert
export type LeaderboardEntryGap =
  | {
      position?: number
      next?: number
      previous?: number
      leader?: number
    }
  | {
      position?: 1
      next?: number
      previous?: never
      leader?: never
    }

export type LeaderboardEntry = Omit<TimeEntry, 'track'> & {
  gap: LeaderboardEntryGap
}
