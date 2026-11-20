import { isRecord } from '../utils/utils'
import type { Match } from './match'
import type { TimeEntry } from './timeEntry'

export type EntryKind = 'match' | 'timeEntry'

export type EntryRef = { kind: EntryKind; id: string }

export type ActiveEntryOverrides = Record<string, EntryRef>

export type ActiveSource = 'override' | 'webhook' | 'tournament' | 'session'

export type QueuedEntry =
  | { kind: 'match'; entry: Match; source: ActiveSource }
  | { kind: 'timeEntry'; entry: TimeEntry; source: ActiveSource }

export type SetActiveEntryRequest = {
  type: 'SetActiveEntryRequest'
  session: string
  entry: EntryRef | null
}

function isEntryRef(data: unknown): data is EntryRef {
  return (
    isRecord(data) &&
    (data.kind === 'match' || data.kind === 'timeEntry') &&
    typeof data.id === 'string'
  )
}

export function isSetActiveEntryRequest(
  data: unknown
): data is SetActiveEntryRequest {
  return (
    isRecord(data) &&
    data.type === 'SetActiveEntryRequest' &&
    typeof data.session === 'string' &&
    (data.entry === null || isEntryRef(data.entry))
  )
}
