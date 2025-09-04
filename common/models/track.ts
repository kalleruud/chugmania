import type { TrackLevel, TrackType } from '@database/types'
export type { TrackLevel, TrackType }

export type TopTime = {
  user: {
    id: string
    name: string
  }
  duration: number
}

export type TrackSummary = {
  id: string
  number: number
  level: TrackLevel
  type: TrackType
  lapCount: number
  topTimes: TopTime[]
}

export type Track = TrackSummary
