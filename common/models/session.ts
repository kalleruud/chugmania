import type {
  SessionResponse,
  sessionSignups,
  sessions,
} from '../../backend/database/schema'
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
  data: any
): data is CreateSessionRequest {
  if (typeof data !== 'object' || data === null) return false
  return data.type === 'CreateSessionRequest' && typeof data.name === 'string'
}

export type EditSessionRequest = Partial<CreateSession> & {
  type: 'EditSessionRequest'
  id: Session['id']
}

export function isEditSessionRequest(data: any): data is EditSessionRequest {
  if (typeof data !== 'object' || data === null) return false
  return data.type === 'EditSessionRequest' && typeof data.id === 'string'
}

export type RsvpSessionRequest = {
  type: 'RsvpSessionRequest'
  session: Session['id']
  user: UserInfo['id']
  response: SessionResponse
}

export function isRsvpSessionRequest(data: any): data is RsvpSessionRequest {
  if (typeof data !== 'object' || data === null) return false
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
  data: any
): data is DeleteSessionRequest {
  if (typeof data !== 'object' || data === null) return false
  return data.type === 'DeleteSessionRequest' && typeof data.id === 'string'
}
