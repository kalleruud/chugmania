import { tracks } from "@database/schema"
import type { TimeEntry } from "./TimeEntry"

export type Track = typeof tracks.$inferSelect
export type CreateTrack = typeof tracks.$inferInsert

export type TopTime = Omit<TimeEntry, 'track' | 'updatedAt' | 'createdAt' | 'deletedAt'> &{
  user: {
    id: string
    name: string
  }
}

export type TrackSummary = Omit<Track, 'updatedAt' | 'createdAt' | 'deletedAt'> & {
  lapCount: number
  topTimes: TopTime[]
}
