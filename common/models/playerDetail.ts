import type { TimeEntry } from './timeEntry'
import type { Track } from './track'
import type { UserInfo } from './user'

export type PlayerTrackLap = {
  entry: TimeEntry
  position: number | null
  totalEntries: number
}

export type PlayerTrackGroup = {
  track: Track
  laps: PlayerTrackLap[]
}

export type PlayerDetail = {
  user: UserInfo
  tracks: PlayerTrackGroup[]
}
