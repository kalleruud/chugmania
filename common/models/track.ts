import { tracks, type TrackLevel, type TrackType } from "../../backend/database/schema"
import type { TimeEntry } from "./TimeEntry"
import type { UserInfo } from "./user"

export type Track = typeof tracks.$inferSelect
export type CreateTrack = typeof tracks.$inferInsert

export const TRACK_LEVELS: TrackLevel[] = ['white', 'green', 'blue', 'red', 'black', 'custom']
export const TRACK_TYPES: TrackType[] = ['drift', 'valley', 'lagoon', 'stadium']

export type TopTime = {
  timeEntry: TimeEntry
  user: UserInfo
}

export type TrackSummary = {
  track: Track
  lapCount: number
  topTimes: TopTime[]
}
