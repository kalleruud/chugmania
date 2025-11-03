import {
  tracks,
  type TrackLevel,
  type TrackType,
} from '../../backend/database/schema'

export const WS_BROADCAST_TRACKS = 'TrackBroadcast'
export type TrackBroadcast = Track[]

export type Track = typeof tracks.$inferSelect
export type CreateTrack = typeof tracks.$inferInsert

export const TRACK_LEVELS: TrackLevel[] = [
  'white',
  'green',
  'blue',
  'red',
  'black',
  'custom',
]
export const TRACK_TYPES: TrackType[] = ['drift', 'valley', 'lagoon', 'stadium']
