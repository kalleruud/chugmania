import type { TrackLevel, TrackType } from './track'
import type { UserInfo } from './user'

export type PlayerTopResult = {
  trackId: string
  trackNumber: number
  trackLevel: TrackLevel
  trackType: TrackType
  position: number
  duration: number | null
}

export type PlayerSummary = {
  user: UserInfo
  averagePosition: number | null
  totalTracks: number
  topResults: PlayerTopResult[]
}
