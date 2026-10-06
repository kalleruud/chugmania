import type { matches } from '../../backend/database/schema'
import { isRecord } from '../utils/utils'

export const MATCH_STAGE_CODES = {
  group: 'GS',
  eight: 'EF',
  quarter: 'QF',
  semi: 'SF',
  bronze: 'BF',
  final: 'F',
  loser_eight: 'LEF',
  loser_quarter: 'LQF',
  loser_semi: 'LSF',
  loser_bronze: 'LBF',
  loser_final: 'LF',
  grand_final: 'GF',
  grand_final_reset: 'GFR',
} as const

export type MatchStage = keyof typeof MATCH_STAGE_CODES | `round_${number}`

export function isMatchStage(value: unknown): value is MatchStage {
  if (typeof value !== 'string') return false
  if (Object.hasOwn(MATCH_STAGE_CODES, value)) return true
  if (!/^round_[1-9]\d*$/.test(value)) return false
  const size = Number(value.slice(6))
  return (
    Number.isSafeInteger(size) &&
    size >= 32 &&
    Number.isInteger(Math.log2(size))
  )
}

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
