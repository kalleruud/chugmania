export type BackendResponse = LoginSuccessResponse | RegisterSuccessResponse | ErrorResponse
  | ListTracksResponse | GetLeaderboardResponse | SubmitTimeResponse
  | ListTimesResponse | UpdateTimeResponse | DeleteTimeResponse
  | ListUsersResponse | UpdateUserResponse | DeleteUserResponse
  | WhoAmIResponse | UserTopTimesResponse

export type LoginSuccessResponse = {
  success: true
  token: string
}

export type RegisterSuccessResponse = {
  success: true
  token: string
}

export function isRegisterSuccessResponse(data: any): data is RegisterSuccessResponse {
  if (typeof data !== 'object') return false
  return data.success && data.token
}

export function isLoginSuccessResponse(
  data: any
): data is LoginSuccessResponse {
  if (typeof data !== 'object') return false
  return data.success && data.token
}

export type ErrorResponse = {
  success: false
  message: string
}

export function isErrorResponse(data: any): data is ErrorResponse {
  if (typeof data !== 'object') return false
  return data.success === false && data.message
}

// Tracks and leaderboard
import type { LeaderboardRow } from './track'
import type { Track } from './track'
import type { TimeEntryRow } from './track'

export type ListTracksResponse = {
  success: true
  tracks: Track[]
}
export function isListTracksResponse(data: any): data is ListTracksResponse {
  return !!data && data.success && Array.isArray(data.tracks)
}

export type GetLeaderboardResponse = {
  success: true
  trackId: string
  leaderboard: LeaderboardRow[]
}
export function isGetLeaderboardResponse(
  data: any
): data is GetLeaderboardResponse {
  return (
    !!data &&
    data.success &&
    typeof data.trackId === 'string' &&
    Array.isArray(data.leaderboard)
  )
}

export type SubmitTimeResponse = { success: true }
export function isSubmitTimeResponse(data: any): data is SubmitTimeResponse {
  return !!data && data.success === true
}

// Times management
export type ListTimesResponse = {
  success: true
  trackId: string
  times: TimeEntryRow[]
}
export function isListTimesResponse(data: any): data is ListTimesResponse {
  return !!data && data.success && typeof data.trackId === 'string' && Array.isArray(data.times)
}

export type UpdateTimeResponse = { success: true }
export type DeleteTimeResponse = { success: true }

// Users management
import type { UserInfo } from './user'
export type ListUsersResponse = { success: true; users: UserInfo[] }
export type UpdateUserResponse = { success: true }
export type DeleteUserResponse = { success: true }

// Auth utility
export type WhoAmIResponse = { success: true; user: UserInfo | null }

// User top times per track
export type UserTopTimesItem = { track: Track; bestTimeMs: number }
export type UserTopTimesResponse = {
  success: true
  userId: string
  results: UserTopTimesItem[]
}
