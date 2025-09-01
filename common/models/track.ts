import { tracks, timeEntries } from '../../backend/database/schema'
import type { UserInfo } from './user'

export type Track = typeof tracks.$inferSelect
export type TrackInsert = typeof tracks.$inferInsert

export type TimeEntry = typeof timeEntries.$inferSelect

export type LeaderboardRow = {
  user: Pick<UserInfo, 'id' | 'name' | 'shortName' | 'role'>
  bestTimeMs: number
}

export type TimeEntryRow = {
  id: TimeEntry['id']
  user: Pick<UserInfo, 'id' | 'name' | 'shortName' | 'role'>
  track: TimeEntry['track']
  session: TimeEntry['session']
  duration: number
  comment: string | null
  createdAt: TimeEntry['createdAt']
}
