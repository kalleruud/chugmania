import type { CreateTimeEntry } from './timeEntry'
import type { Track } from './track'

export type LoginRequest = {
  email: string
  password: string
}

export function isLoginRequest(data: any): data is LoginRequest {
  if (typeof data !== 'object') return false
  return data.email && data.password && !isRegisterRequest(data)
}

export type RegisterRequest = LoginRequest & {
  name: string
  shortName: string | null
}

export function isRegisterRequest(data: any): data is RegisterRequest {
  if (typeof data !== 'object') return false
  return data.email && data.password && data.name
}

export type GetLeaderboardRequest = {
  trackId: Track['id']
}

export function isGetLeaderboardRequest(
  data: any
): data is GetLeaderboardRequest {
  if (typeof data !== 'object') return false
  return data.trackId
}

export type PostLapTimeRequest = CreateTimeEntry

export function isPostLapTimeRequest(data: any): data is PostLapTimeRequest {
  if (typeof data !== 'object') return false
  return data.duration && data.user && data.track
}

export type ImportCsvTarget = 'users' | 'tracks' | 'timeEntries'

export type ImportCsvRequest = {
  target: ImportCsvTarget
  content: string
}

export function isImportCsvRequest(data: any): data is ImportCsvRequest {
  if (typeof data !== 'object' || data === null) return false
  return (
    typeof data.content === 'string' &&
    (data.target === 'users' ||
      data.target === 'tracks' ||
      data.target === 'timeEntries')
  )
}

export type GetTrackRequest = {
  trackId: Track['id']
}

export function isGetTrackRequest(data: any): data is GetTrackRequest {
  if (typeof data !== 'object') return false
  return data.trackId
}
