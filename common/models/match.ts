import type { matches } from '../../backend/database/schema'
import { isRecord } from '../utils/utils'

export type Match = typeof matches.$inferSelect & {
  tournament?: {
    id: string
    groupId: string | null
    label: string
    slot1: string
    slot2: string
    editableSlots: ('user1' | 'user2')[]
    readOnly: boolean
    awarded: boolean
  }
}
export type CreateMatch = typeof matches.$inferInsert

export type MatchStatus = 'planned' | 'completed' | 'cancelled'

export type CreateMatchRequest = {
  type: 'CreateMatchRequest'
} & CreateMatch

export function isCreateMatchRequest(
  data: unknown
): data is CreateMatchRequest {
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

export function isDeleteMatchRequest(
  data: unknown
): data is DeleteMatchRequest {
  if (!isRecord(data)) return false
  return data.type === 'DeleteMatchRequest' && typeof data.id === 'string'
}
