import type { Socket } from 'socket.io'
import { isImportCsvRequest } from '../../../common/models/requests'
import type {
  BackendResponse,
  ErrorResponse,
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
      throw Error('Invalid CSV import request payload')

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
      default:
        throw Error(`Invalid table: '${request.table}'`)
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
}
