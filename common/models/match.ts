import type { matches } from '../../backend/database/schema'
import { isRecord } from '../utils/is-record'

export type Match = typeof matches.$inferSelect
export type CreateMatch = typeof matches.$inferInsert

export type MatchStatus = 'planned' | 'completed' | 'cancelled'

export type CreateMatchRequest = {
  type: 'CreateMatchRequest'
} & CreateMatch

export function isCreateMatchRequest(data: unknown): data is CreateMatchRequest {
  if (!isRecord(data)) return false
  return data.type === 'CreateMatchRequest' && typeof data.track === 'string'
}

export type EditMatchRequest = Partial<CreateMatch> & {
  type: 'EditMatchRequest'
  id: Match['id']
}

export function isEditMatchRequest(data: unknown): data is EditMatchRequest {
  if (!isRecord(data)) return false
  return data.type === 'EditMatchRequest' && typeof data.id === 'string'
}

export type DeleteMatchRequest = {
  type: 'DeleteMatchRequest'
  id: Match['id']
}

export function isDeleteMatchRequest(data: unknown): data is DeleteMatchRequest {
  if (!isRecord(data)) return false
  return data.type === 'DeleteMatchRequest' && typeof data.id === 'string'
}
