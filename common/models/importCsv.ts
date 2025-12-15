import type * as schema from '../../backend/database/schema'
import type { SuccessResponse } from './socket.io'

export type ImportCsvRequest = {
  table: keyof typeof schema
  content: string
}

export function isImportCsvRequest(data: any): data is ImportCsvRequest {
  if (typeof data !== 'object' || data === null) return false
  return data.table && data.content
}

export type ExportCsvRequest = {
  table: keyof typeof schema
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
