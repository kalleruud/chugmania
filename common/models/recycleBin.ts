import { isRecord } from '../utils/utils'
import type { Match } from './match'
import type { SessionWithSignups } from './session'
import type { TimeEntry } from './timeEntry'
import type { Track } from './track'
import type { UserInfo } from './user'

export const recycleTables: RecycleTable[] = [
  'users',
  'tracks',
  'sessions',
  'timeEntries',
  'matches',
  'sessionSignups',
  'tournaments',
  'tournamentStages',
  'tournamentGroups',
  'tournamentPlayers',
  'tournamentMatches',
  'tournamentMatchSlots',
  'webhookCaptures',
  'webhookEvents',
]

export type RecycleTable =
  | 'users'
  | 'tracks'
  | 'sessions'
  | 'timeEntries'
  | 'matches'
  | 'sessionSignups'
  | 'tournaments'
  | 'tournamentStages'
  | 'tournamentGroups'
  | 'tournamentPlayers'
  | 'tournamentMatches'
  | 'tournamentMatchSlots'
  | 'webhookCaptures'
  | 'webhookEvents'

type Entity =
  | { table: 'users'; record: UserInfo }
  | { table: 'tracks'; record: Track }
  | { table: 'sessions'; record: SessionWithSignups }
  | { table: 'timeEntries'; record: TimeEntry }
  | { table: 'matches'; record: Match }
  | {
      table: Exclude<
        RecycleTable,
        'users' | 'tracks' | 'sessions' | 'timeEntries' | 'matches'
      >
      record: { id: string; label: string }
    }

export type RecycleItem = Entity & { id: string; deletedAt: Date }
export type RecycleRequest = {
  table: RecycleTable
  id: string
  action: 'restore' | 'delete'
}

export type RecycleRecordRequest = Pick<RecycleRequest, 'table' | 'id'>

export function isRecycleRecordRequest(
  value: unknown
): value is RecycleRecordRequest {
  return (
    isRecord(value) &&
    typeof value.table === 'string' &&
    recycleTables.some(table => table === value.table) &&
    typeof value.id === 'string'
  )
}

export function isRecycleRequest(value: unknown): value is RecycleRequest {
  return (
    isRecord(value) &&
    (value.action === 'restore' || value.action === 'delete') &&
    isRecycleRecordRequest(value)
  )
}
