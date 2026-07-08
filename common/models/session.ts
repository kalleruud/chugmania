import type {
  SessionResponse,
  sessionSignups,
  sessions,
} from '../../backend/database/schema'
import { isRecord } from '../utils/utils'
import { type UserInfo } from './user'

export type Session = typeof sessions.$inferSelect
export type CreateSession = typeof sessions.$inferInsert

export type CreateSessionSignup = typeof sessionSignups.$inferInsert
export type SessionSignup = Omit<typeof sessionSignups.$inferSelect, 'user'> & {
  user: UserInfo
}

export type SessionWithSignups = Session & {
  signups: SessionSignup[]
}

export type CreateSessionRequest = CreateSession & {
  type: 'CreateSessionRequest'
}

export function isCreateSessionRequest(
  data: unknown
): data is CreateSessionRequest {
  if (!isRecord(data)) return false
  return data.type === 'CreateSessionRequest' && typeof data.name === 'string'
}

export type EditSessionRequest = Partial<CreateSession> & {
  type: 'EditSessionRequest'
  id: Session['id']
}

export function isEditSessionRequest(
  data: unknown
): data is EditSessionRequest {
  if (!isRecord(data)) return false
  return data.type === 'EditSessionRequest' && typeof data.id === 'string'
}

export type RsvpSessionRequest = {
  type: 'RsvpSessionRequest'
  session: Session['id']
  user: UserInfo['id']
  response: SessionResponse
}

export function isRsvpSessionRequest(
  data: unknown
): data is RsvpSessionRequest {
  if (!isRecord(data)) return false
  return (
    data.type === 'RsvpSessionRequest' &&
    typeof data.session === 'string' &&
    typeof data.user === 'string' &&
    typeof data.response === 'string'
  )
}

export type DeleteSessionRequest = {
  type: 'DeleteSessionRequest'
  id: Session['id']
}

export function isDeleteSessionRequest(
  data: unknown
): data is DeleteSessionRequest {
  if (!isRecord(data)) return false
  return data.type === 'DeleteSessionRequest' && typeof data.id === 'string'
}
