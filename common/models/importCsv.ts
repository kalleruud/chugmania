import type * as schema from '../../backend/database/schema'
import { isRecord } from '../utils/utils'
import type { SuccessResponse } from './socket.io'

export type CsvTable = keyof typeof schema

export type ImportCsvRequest = {
  table: CsvTable
  content: string
}

export function isImportCsvRequest(data: unknown): data is ImportCsvRequest {
  if (!isRecord(data)) return false
  return typeof data.table === 'string' && typeof data.content === 'string'
}

export type ExportCsvRequest = {
  table: CsvTable
}

export function isExportCsvRequest(data: unknown): data is ExportCsvRequest {
  if (!isRecord(data)) return false
  return typeof data.table === 'string'
}

export type ImportCsvResponse = SuccessResponse & {
  created: number
  updated: number
}

export type ExportCsvResponse = SuccessResponse & {
  csv: string
}
