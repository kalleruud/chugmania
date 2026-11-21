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

export type SessionDateVote = {
  user: UserInfo
  dates: number[]
}

export type SessionWithSignups = Session & {
  signups: SessionSignup[]
  dateVotes: SessionDateVote[]
}

export function isDatePollOpen(
  session: Pick<Session, 'date' | 'status' | 'dateOptions' | 'dateVotingClosed'>
) {
  return (
    session.date === null &&
    session.status === 'tentative' &&
    !session.dateVotingClosed &&
    !!session.dateOptions?.length
  )
}

function isDateList(data: unknown): data is number[] {
  return Array.isArray(data) && data.every(d => Number.isFinite(d))
}

export type CreateSessionRequest = CreateSession & {
  type: 'CreateSessionRequest'
}

export function isCreateSessionRequest(
  data: unknown
): data is CreateSessionRequest {
  if (!isRecord(data)) return false
  return (
    data.type === 'CreateSessionRequest' &&
    typeof data.name === 'string' &&
    (data.id === undefined || typeof data.id === 'string')
  )
}

export type EditSessionRequest = Partial<CreateSession> & {
  type: 'EditSessionRequest'
  id: Session['id']
}

export function isEditSessionRequest(
  data: unknown
): data is EditSessionRequest {
  if (!isRecord(data)) return false
  return (
    data.type === 'EditSessionRequest' &&
    typeof data.id === 'string' &&
    (data.dateOptions === undefined ||
      data.dateOptions === null ||
      isDateList(data.dateOptions)) &&
    (data.dateVotingClosed === undefined ||
      typeof data.dateVotingClosed === 'boolean')
  )
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

export type DeleteSessionSignupRequest = {
  type: 'DeleteSessionSignupRequest'
  id: SessionSignup['id']
}

export function isDeleteSessionSignupRequest(
  data: unknown
): data is DeleteSessionSignupRequest {
  if (!isRecord(data)) return false
  return (
    data.type === 'DeleteSessionSignupRequest' && typeof data.id === 'string'
  )
}

export type VoteSessionDateRequest = {
  type: 'VoteSessionDateRequest'
  session: Session['id']
  dates: number[]
}

export function isVoteSessionDateRequest(
  data: unknown
): data is VoteSessionDateRequest {
  if (!isRecord(data)) return false
  return (
    data.type === 'VoteSessionDateRequest' &&
    typeof data.session === 'string' &&
    isDateList(data.dates)
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
