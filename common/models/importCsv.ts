import type * as schema from '../../backend/database/schema'
import { isRecord } from '../utils/utils'
import type { SuccessResponse } from './socket.io'

export type CsvTable = Exclude<
  keyof typeof schema,
  'webhookCaptures' | 'webhookEvents'
>

const csvTables: CsvTable[] = [
  'users',
  'tracks',
  'sessions',
  'sessionSignups',
  'timeEntries',
  'matches',
  'tournaments',
  'tournamentStages',
  'tournamentGroups',
  'tournamentPlayers',
  'tournamentMatches',
  'tournamentMatchSlots',
]

function isCsvTable(value: unknown): value is CsvTable {
  return csvTables.some(table => table === value)
}

export type ImportCsvRequest = {
  table: CsvTable
  content: string
}

export function isImportCsvRequest(data: unknown): data is ImportCsvRequest {
  if (!isRecord(data)) return false
  return isCsvTable(data.table) && typeof data.content === 'string'
}

export type ExportCsvRequest = {
  table: CsvTable
}

export function isExportCsvRequest(data: unknown): data is ExportCsvRequest {
  if (!isRecord(data)) return false
  return isCsvTable(data.table)
}

export type ImportCsvResponse = SuccessResponse & {
  created: number
  updated: number
}

export type ExportCsvResponse = SuccessResponse & {
  csv: string
}
