import { tracks } from "../../backend/database/schema"
import type { TimeEntry } from "./TimeEntry"
import type { UserInfo } from "./user"

export type Track = typeof tracks.$inferSelect
export type CreateTrack = typeof tracks.$inferInsert

export type TopTime = {
  timeEntry: TimeEntry
  user: UserInfo
}

export type TrackSummary = {
  track: Track
  lapCount: number
  topTimes: TopTime[]
}
