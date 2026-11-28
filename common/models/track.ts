import type { tracks } from '../../backend/database/schema'
import { isRecord } from '../utils/utils'

export type Game = 'next' | 'turbo'
export type Platform = 'pc' | 'ps4' | 'xb1'
export type Track = typeof tracks.$inferSelect
export type CreateTrack = typeof tracks.$inferInsert

export const MAX_TRACK_NICKNAME_LENGTH = 40

export function getTrackName(track: Pick<Track, 'name' | 'nickname'>): string {
  return track.nickname ?? track.name
}

export type EditTrackRequest = {
  type: 'EditTrackRequest'
  id: Track['id']
  nickname: string | null
}

export function isEditTrackRequest(data: unknown): data is EditTrackRequest {
  return (
    isRecord(data) &&
    data.type === 'EditTrackRequest' &&
    typeof data.id === 'string' &&
    (data.nickname === null || typeof data.nickname === 'string')
  )
}

export type ImportTrackRequest = {
  type: 'ImportTrackRequest'
  url: string
}

export function isImportTrackRequest(
  data: unknown
): data is ImportTrackRequest {
  return (
    isRecord(data) &&
    data.type === 'ImportTrackRequest' &&
    typeof data.url === 'string'
  )
}
