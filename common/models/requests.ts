import * as schema from '../../backend/database/schema'
import type { Session, SessionSignup } from './session'
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

export type RegisterRequest = Omit<
  UserInfo,
  'id' | 'role' | 'updatedAt' | 'createdAt' | 'deletedAt'
> &
  LoginRequest

export function isRegisterRequest(data: any): data is RegisterRequest {
  if (typeof data !== 'object' || data !== null) return false
  return (
    typeof data.email === 'string' &&
    typeof data.password === 'string' &&
    typeof data.firstName === 'string' &&
    typeof data.lastName === 'string' &&
    typeof data.shortName === 'string'
  )
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
  if (typeof data !== 'object' || data === null) return false
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

export type ExportCsvRequest = {
  table: keyof typeof schema
}

export function isExportCsvRequest(data: any): data is ExportCsvRequest {
  if (typeof data !== 'object' || data === null) return false
  return data.table && typeof data.table === 'string'
}

export type GetTrackRequest = {
  trackId: Track['id']
}

export function isGetTrackRequest(data: any): data is GetTrackRequest {
  if (typeof data !== 'object') return false
  return data.trackId
}

export type GetPlayerDetailsRequest = {
  playerId: UserInfo['id']
}

export function isGetPlayerDetailsRequest(
  data: any
): data is GetPlayerDetailsRequest {
  if (typeof data !== 'object' || data === null) return false
  return typeof data.playerId === 'string'
}

export type CreateSessionRequest = {
  name: string
  date: string
  location?: string
  description?: string
}

export function isCreateSessionRequest(
  data: any
): data is CreateSessionRequest {
  if (typeof data !== 'object' || data === null) return false
  const hasName = typeof data.name === 'string'
  const hasDate = typeof data.date === 'string'
  return hasName && hasDate
}

export type UpdateSessionRequest = {
  id: Session['id']
  name?: string
  date?: string
  location?: string
  description?: string
}

export function isUpdateSessionRequest(
  data: any
): data is UpdateSessionRequest {
  if (typeof data !== 'object' || data === null) return false
  return typeof data.id === 'string'
}

export type DeleteSessionRequest = {
  id: Session['id']
}

export function isDeleteSessionRequest(
  data: any
): data is DeleteSessionRequest {
  if (typeof data !== 'object' || data === null) return false
  return typeof data.id === 'string'
}

export type CancelSessionRequest = {
  id: Session['id']
}

export function isCancelSessionRequest(
  data: any
): data is CancelSessionRequest {
  if (typeof data !== 'object' || data === null) return false
  return typeof data.id === 'string'
}

export type SessionSignupRequest = {
  session: Session['id']
  response: SessionSignup['response']
}

export function isSessionSignupRequest(
  data: any
): data is SessionSignupRequest {
  if (typeof data !== 'object' || data === null) return false
  const isSessionIdValid = typeof data.session === 'string'
  const isResponseValid =
    data.response === 'yes' ||
    data.response === 'no' ||
    data.response === 'maybe'
  return isSessionIdValid && isResponseValid
}

export type UpdateUserRequest = RegisterRequest & {
  type: 'UpdateUserRequest'
  id: UserInfo['id']
  newPassword?: RegisterRequest['password']
}

export function isUpdateUserRequest(data: any): data is UpdateUserRequest {
  if (typeof data !== 'object' || data === null) return false
  return data.type === 'UpdateUserRequest'
}
