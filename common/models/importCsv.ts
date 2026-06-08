import type { SuccessResponse } from './socket.io'

export type ImportCsvRequest = {
  table: ExportCsvRequest['table']
  content: string
}

export function isImportCsvRequest(data: any): data is ImportCsvRequest {
  if (typeof data !== 'object' || data === null) return false
  return data.table && data.content
}

export type ExportCsvRequest = {
  table:
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
    | 'unconfirmedLaps'
}

export function isExportCsvRequest(data: any): data is ExportCsvRequest {
  if (typeof data !== 'object' || data === null) return false
  return data.table && typeof data.table === 'string'
}

export type ImportCsvResponse = SuccessResponse & {
  created: number
  updated: number
}

export type ExportCsvResponse = SuccessResponse & {
  csv: string
}
