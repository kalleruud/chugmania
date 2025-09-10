import type { LeaderboardEntry } from './timeEntry'
import type { Track } from './track'

export type Leaderboard = {
  track: Track
  totalEntries: number
  entries: LeaderboardEntry[]
}
