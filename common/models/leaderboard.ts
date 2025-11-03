import type { LeaderboardEntry } from './timeEntry'
import type { Track } from './track'

export type Leaderboard = {
  id: Track['id']
  entries: LeaderboardEntry[]
}

export const WS_BROADCAST_LEADERBOARDS = 'LeaderboardBroadcast'
export type LeaderboardBroadcast = Leaderboard[]
