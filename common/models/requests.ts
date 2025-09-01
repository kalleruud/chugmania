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

export type ListTracksRequest = {}
export function isListTracksRequest(data: any): data is ListTracksRequest {
  return typeof data === 'object'
}

export type GetLeaderboardRequest = { trackId: string }
export function isGetLeaderboardRequest(data: any): data is GetLeaderboardRequest {
  if (typeof data !== 'object') return false
  return typeof data.trackId === 'string'
}

export type SubmitTimeRequest = {
  trackId: string
  time: string // e.g. "1:23.45"
  userId?: string // only admins/mods may specify others
  sessionId?: string
  comment?: string | null
}
export function isSubmitTimeRequest(data: any): data is SubmitTimeRequest {
  if (typeof data !== 'object') return false
  return typeof data.trackId === 'string' && typeof data.time === 'string'
}

// Times management
export type ListTimesRequest = { trackId: string; userId?: string }
export function isListTimesRequest(data: any): data is ListTimesRequest {
  return !!data && typeof data.trackId === 'string'
}

export type UpdateTimeRequest = {
  timeEntryId: string
  time?: string
  comment?: string | null
}
export function isUpdateTimeRequest(data: any): data is UpdateTimeRequest {
  if (typeof data !== 'object') return false
  return typeof data.timeEntryId === 'string'
}

export type DeleteTimeRequest = { timeEntryId: string }
export function isDeleteTimeRequest(data: any): data is DeleteTimeRequest {
  return !!data && typeof data.timeEntryId === 'string'
}

// Users management
import type { UserRole } from '../../backend/database/schema'
export type ListUsersRequest = {}
export function isListUsersRequest(data: any): data is ListUsersRequest {
  return typeof data === 'object'
}

export type UpdateUserRequest = {
  userId: string
  name?: string
  shortName?: string | null
  role?: UserRole
}
export function isUpdateUserRequest(data: any): data is UpdateUserRequest {
  return !!data && typeof data.userId === 'string'
}

export type DeleteUserRequest = { userId: string }
export function isDeleteUserRequest(data: any): data is DeleteUserRequest {
  return !!data && typeof data.userId === 'string'
}

// Auth utility
export type WhoAmIRequest = {}
export function isWhoAmIRequest(data: any): data is WhoAmIRequest {
  return typeof data === 'object'
}

// User top times per track
export type UserTopTimesRequest = { userId: string }
export function isUserTopTimesRequest(data: any): data is UserTopTimesRequest {
  return !!data && typeof data.userId === 'string'
}
