import { isRecord } from '../utils/is-record'
import type { SuccessResponse } from './socket.io'

export type CsvTable =
  | 'users'
  | 'tracks'
  | 'sessions'
  | 'timeEntries'
  | 'sessionSignups'
  | 'matches'
  | 'tournaments'
  | 'groups'
  | 'groupPlayers'
  | 'tournamentMatches'

const CSV_TABLES: readonly CsvTable[] = [
  'users',
  'tracks',
  'sessions',
  'timeEntries',
  'sessionSignups',
  'matches',
  'tournaments',
  'groups',
  'groupPlayers',
  'tournamentMatches',
]

export type ImportCsvRequest = {
  table: CsvTable
  content: string
}

export function isImportCsvRequest(data: unknown): data is ImportCsvRequest {
  if (!isRecord(data)) return false
  return (
    typeof data.table === 'string' &&
    CSV_TABLES.includes(data.table as CsvTable) &&
    typeof data.content === 'string'
  )
}

export type ExportCsvRequest = {
  table: CsvTable
}

export function isExportCsvRequest(data: unknown): data is ExportCsvRequest {
  if (!isRecord(data)) return false
  return (
    typeof data.table === 'string' &&
    CSV_TABLES.includes(data.table as CsvTable)
  )
}

export type ImportCsvResponse = SuccessResponse & {
  created: number
  updated: number
}

export type ExportCsvResponse = SuccessResponse & {
  csv: string
}
