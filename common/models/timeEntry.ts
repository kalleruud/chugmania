import type { timeEntries } from '../../backend/database/schema'
import { isRecord } from '../utils/is-record'
import type { SuccessResponse } from './socket.io'
import type { Track } from './track'
import type { User } from './user'

export type TimeEntry = typeof timeEntries.$inferSelect
export type CreateTimeEntry = typeof timeEntries.$inferInsert

export type CreateTimeEntryRequest = {
  type: 'CreateTimeEntryRequest'
} & CreateTimeEntry

export function isCreateTimeEntryRequest(
  data: unknown
): data is CreateTimeEntry {
  if (!isRecord(data)) return false
  return (
    data.type === 'CreateTimeEntryRequest' &&
    typeof data.user === 'string' &&
    typeof data.track === 'string'
  )
}

export type EditTimeEntryRequest = Partial<CreateTimeEntry> & {
  type: 'EditTimeEntryRequest'
  id: TimeEntry['id']
}

export function isEditTimeEntryRequest(
  data: unknown
): data is EditTimeEntryRequest {
  if (!isRecord(data)) return false
  return data.type === 'EditTimeEntryRequest' && typeof data.id === 'string'
}

export type LeaderboardEntryGap =
  | {
      position: number
      next?: number
      previous?: number
      leader?: number
    }
  | {
      position: 1
      next?: number
      previous: undefined
      leader: undefined
    }

export type LeaderboardEntry = Omit<TimeEntry, 'track'> & {
  gap?: LeaderboardEntryGap
}

export type AbsoluteTimeEntriesRequest = {
  type: 'AbsoluteTimeEntriesRequest'
} & (
  | {
      user: User['id']
    }
  | {
      track: Track['id']
    }
)

export type AbsoluteTimeEntriesResponse = SuccessResponse & {
  entries: LeaderboardEntry[]
}
