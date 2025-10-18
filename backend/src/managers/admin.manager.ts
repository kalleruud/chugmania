import type { Socket } from 'socket.io'
import {
  isExportCsvRequest,
  isImportCsvRequest,
} from '../../../common/models/requests'
import type {
  BackendResponse,
  ErrorResponse,
  ExportCsvResponse,
  SuccessResponse,
} from '../../../common/models/responses'
import { tryCatchAsync } from '../../../common/utils/try-catch'
import db from '../../database/database'
import * as schema from '../../database/schema'
import { timeEntries, tracks, users } from '../../database/schema'
import CsvParser from '../utils/csv-parser'
import AuthManager from './auth.manager'

export default class AdminManager {
  private static async import(
    into: (typeof schema)[keyof typeof schema],
    data: string
  ) {
    const values = await CsvParser.parse<typeof into.$inferInsert>(data)
    const inserts = await db
      .insert(into)
      .values(values)
      .onConflictDoNothing()
      .returning()

    return { imported: inserts.length, total: values.length }
  }

  static async onImportCsv(
    socket: Socket,
    request: unknown
  ): Promise<BackendResponse> {
    if (!isImportCsvRequest(request))
      throw new Error('Invalid CSV import request payload')

    const { data: user, error } = await AuthManager.checkAuth(socket)
    if (error)
      return {
        success: false,
        message: error.message,
      } satisfies BackendResponse

    if (user.role !== 'admin')
      return {
        success: false,
        message: 'Only admins can import CSV data.',
      }

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Received CSV file:',
      request.table
    )

    let task: ReturnType<typeof AdminManager.import> | undefined = undefined
    switch (request.table) {
      case 'users':
        task = AdminManager.import(users, request.content)
        break
      case 'tracks':
        task = AdminManager.import(tracks, request.content)
        break
      case 'timeEntries':
        task = AdminManager.import(timeEntries, request.content)
        break
      case 'sessions':
        task = AdminManager.import(schema.sessions, request.content)
        break
      default:
        throw new Error(`Invalid table: '${request.table}'`)
    }

    const { data, error: importError } = await tryCatchAsync(task)
    if (importError)
      return {
        success: false,
        message: importError.message,
      } satisfies ErrorResponse

    return {
      success: true,
      message: `Imported ${data.imported}/${data.total} ${request.table}`,
    } satisfies SuccessResponse
  }

  static async onExportCsv(
    socket: Socket,
    request: unknown
  ): Promise<BackendResponse> {
    if (!isExportCsvRequest(request))
      throw new Error('Invalid CSV export request payload')

    const { data: user, error } = await AuthManager.checkAuth(socket)
    if (error)
      return {
        success: false,
        message: error.message,
      } satisfies BackendResponse

    if (user.role !== 'admin')
      return {
        success: false,
        message: 'Only admins can export CSV data.',
      }

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Exporting CSV table:',
      request.table
    )

    const validTables = ['users', 'tracks', 'timeEntries', 'sessions'] as const
    if (!validTables.includes(request.table as any))
      throw new Error(`Invalid export table: '${request.table}'`)

    let records: any[] = []
    switch (request.table) {
      case 'users':
        records = await db.query.users.findMany()
        break
      case 'tracks':
        records = await db.query.tracks.findMany()
        break
      case 'timeEntries':
        records = await db.query.timeEntries.findMany()
        break
      case 'sessions':
        records = await db.query.sessions.findMany()
        break
    }

    const csv = AdminManager.objectsToCsv(records)

    return {
      success: true,
      csv,
    } satisfies ExportCsvResponse
  }

  private static objectsToCsv<T extends Record<string, any>>(
    objects: T[]
  ): string {
    if (objects.length === 0) return ''

    const headers = Object.keys(objects[0]!)
    const rows = objects.map(obj =>
      headers
        .map(header => {
          const value = obj[header]
          if (value === null || value === undefined) return ''
          if (value instanceof Date) return String(value.getTime())
          if (typeof value === 'string' && value.includes(','))
            return `"${value.replace(/"/g, '""')}"`
          return String(value)
        })
        .join(',')
    )

    return [headers.join(','), ...rows].join('\n')
  }
}
