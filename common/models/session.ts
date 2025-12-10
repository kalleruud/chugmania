import type { sessionSignups, sessions } from '../../backend/database/schema'
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

export type RsvpSessionRequest = CreateSessionSignup & {
  type: 'RsvpSessionRequest'
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
