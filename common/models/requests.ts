import * as schema from '../../backend/database/schema'
import type { CreateTimeEntry } from './timeEntry'
import type { Track } from './track'
import { type UserInfo } from './user'

export type LoginRequest = {
  email: UserInfo['email']
  password: string
}

export function isLoginRequest(data: any): data is LoginRequest {
  if (typeof data !== 'object') return false
  return data.email && data.password && !isRegisterRequest(data)
}

export type RegisterRequest = LoginRequest & {
  name: UserInfo['name']
  shortName: UserInfo['shortName']
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

export type ImportCsvRequest = {
  table: keyof typeof schema
  content: string
}

export function isImportCsvRequest(data: any): data is ImportCsvRequest {
  if (typeof data !== 'object' || data === null) return false
  return data.table && data.content
}

export type GetTrackRequest = {
  trackId: Track['id']
}

export function isGetTrackRequest(data: any): data is GetTrackRequest {
  if (typeof data !== 'object') return false
  return data.trackId
}
