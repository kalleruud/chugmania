import type { matches } from '../../backend/database/schema'

export type Match = typeof matches.$inferSelect
export type CreateMatch = typeof matches.$inferInsert

export type CreateMatchRequest = {
  type: 'CreateMatchRequest'
} & CreateMatch

export function isCreateMatchRequest(data: any): data is CreateMatchRequest {
  if (typeof data !== 'object' || data === null) return false
  return data.type === 'CreateMatchRequest' && typeof data.track === 'string'
}

export type EditMatchRequest = Partial<CreateMatch> & {
  type: 'EditMatchRequest'
  id: Match['id']
}

export function isEditMatchRequest(data: any): data is EditMatchRequest {
  if (typeof data !== 'object' || data === null) return false
  return data.type === 'EditMatchRequest' && typeof data.id === 'string'
}

export type DeleteMatchRequest = {
  type: 'DeleteMatchRequest'
  id: Match['id']
}

export function isDeleteMatchRequest(data: any): data is DeleteMatchRequest {
  if (typeof data !== 'object' || data === null) return false
  return data.type === 'DeleteMatchRequest' && typeof data.id === 'string'
}
