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
import { sessions, timeEntries, tracks, users } from '../../database/schema'
import CsvParser from '../utils/csv-parser'
import AuthManager from './auth.manager'

export default class AdminManager {
  private static async import(
    into: (typeof schema)[keyof typeof schema],
    data: string,
    creatorId: string
  ) {
    const values = await CsvParser.parse<typeof into.$inferInsert>(data)
    const normalizedValues = values.map(value => ({
      ...value,
      createdBy: value.createdBy ?? creatorId,
    }))
    const inserts = await db
      .insert(into)
      .values(normalizedValues)
      .onConflictDoNothing()
      .returning()

    return { imported: inserts.length, total: normalizedValues.length }
  }

  static async onImportCsv(
    socket: Socket,
    request: unknown
  ): Promise<BackendResponse> {
    if (!isImportCsvRequest(request))
      throw new Error('Invalid CSV import request payload')

    const { data: actor, error } = await AuthManager.checkAuth(socket, [
      'admin',
    ])
    if (error) return error

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Received CSV file:',
      request.table
    )

    let task: ReturnType<typeof AdminManager.import> | undefined = undefined
    switch (request.table) {
      case 'users':
        task = AdminManager.import(users, request.content, actor.id)
        break
      case 'tracks':
        task = AdminManager.import(tracks, request.content, actor.id)
        break
      case 'timeEntries':
        task = AdminManager.import(timeEntries, request.content, actor.id)
        break
      case 'sessions':
        task = AdminManager.import(sessions, request.content, actor.id)
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

    const { error } = await AuthManager.checkAuth(socket, ['admin'])
    if (error) return error

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Exporting CSV table:',
      request.table
    )

    let records: object[] = []
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
      default:
        throw new Error(`Invalid table: '${request.table}'`)
    }

    const csv = AdminManager.objectsToCsv(records)
    if (csv === null)
      return {
        success: false,
        message: 'No data to export',
      } satisfies ErrorResponse

    return {
      success: true,
      csv,
    } satisfies ExportCsvResponse
  }

  private static objectsToCsv<T extends Record<string, any>>(
    objects: T[]
  ): string | null {
    if (objects.length === 0) {
      console.warn('No objects to convert to CSV')
      return null
    }

    const headers = Object.keys(objects[0]!)
    const rows = objects.map(obj =>
      headers
        .map(header => {
          const value = obj[header]
          if (value === null || value === undefined) return ''
          if (value instanceof Date) return String(value.getTime())
          if (typeof value === 'string' && value.includes(','))
            return `"${value.replaceAll(/"/, '""')}"`
          return String(value)
        })
        .join(',')
    )

    return [headers.join(','), ...rows].join('\n')
  }
}
