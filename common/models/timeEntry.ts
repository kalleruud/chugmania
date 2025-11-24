import { timeEntries } from '../../backend/database/schema'

export type TimeEntry = typeof timeEntries.$inferSelect
export type CreateTimeEntry = typeof timeEntries.$inferInsert

export type CreateTimeEntryRequest = {
  type: 'CreateTimeEntryRequest'
} & CreateTimeEntry

export function isCreateTimeEntryRequest(data: any): data is CreateTimeEntry {
  if (typeof data !== 'object' || data === null) return false
  return (
    data.type === 'CreateTimeEntryRequest' &&
    typeof data.user === 'string' &&
    typeof data.track === 'string'
  )
}

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
