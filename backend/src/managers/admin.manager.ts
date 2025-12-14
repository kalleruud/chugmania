import {
  isExportCsvRequest,
  isImportCsvRequest,
  type ExportCsvRequest,
} from '@common/models/importCsv'
import type { EventReq, EventRes } from '@common/models/socket.io'
import { sql } from 'drizzle-orm'
import type { Socket } from 'socket.io'
import loc from '../../../frontend/lib/locales'
import db from '../../database/database'
import { sessions, timeEntries, tracks, users } from '../../database/schema'
import CsvParser from '../utils/csv-parser'
import AuthManager from './auth.manager'

export default class AdminManager {
  private static readonly EXCLUDED_COL_EXPORT = {
    users: new Set(['passwordHash']),
    tracks: new Set(),
    sessions: new Set(),
    timeEntries: new Set(),
    sessionSignups: new Set(),
  } satisfies Record<ExportCsvRequest['table'], Set<string>>

  private static async importUsers(data: string) {
    const parsed = await CsvParser.toObjects(data)
    if (parsed.length === 0) return { imported: 0, total: 0 }

    // Filter out rows missing required passwordHash for new inserts
    // For existing users (with ID), password is optional and can be updated
    const values = parsed.filter(
      v => 'passwordHash' in v || v.id
    ) as (typeof users.$inferInsert)[]

    if (values.length === 0) return { imported: 0, total: parsed.length }

    const updateSet: Record<string, any> = {
      email: sql`excluded.email`,
      firstName: sql`excluded.first_name`,
      lastName: sql`excluded.last_name`,
      shortName: sql`excluded.short_name`,
      role: sql`excluded.role`,
      updatedAt: new Date(),
    }

    // Only update password if it was provided in the CSV
    if (values.some(v => 'passwordHash' in v)) {
      updateSet.passwordHash = sql`excluded.password_hash`
    }

    const result = await db
      .insert(users)
      .values(values)
      .onConflictDoUpdate({
        target: users.id,
        set: updateSet,
      })
      .returning()

    return { imported: result.length, total: parsed.length }
  }

  private static async importTracks(data: string) {
    const values = await CsvParser.toObjects<typeof tracks.$inferInsert>(data)
    if (values.length === 0) return { imported: 0, total: 0 }

    const result = await db
      .insert(tracks)
      .values(values)
      .onConflictDoUpdate({
        target: tracks.id,
        set: {
          number: sql`excluded.number`,
          level: sql`excluded.level`,
          type: sql`excluded.type`,
          updatedAt: new Date(),
        },
      })
      .returning()

    return { imported: result.length, total: values.length }
  }

  private static async importSessions(data: string) {
    const values = await CsvParser.toObjects<typeof sessions.$inferInsert>(data)
    if (values.length === 0) return { imported: 0, total: 0 }

    const result = await db
      .insert(sessions)
      .values(values)
      .onConflictDoUpdate({
        target: sessions.id,
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          date: sql`excluded.date`,
          location: sql`excluded.location`,
          status: sql`excluded.status`,
          updatedAt: new Date(),
        },
      })
      .returning()

    return { imported: result.length, total: values.length }
  }

  private static async importTimeEntries(data: string) {
    const values =
      await CsvParser.toObjects<typeof timeEntries.$inferInsert>(data)
    if (values.length === 0) return { imported: 0, total: 0 }

    const result = await db
      .insert(timeEntries)
      .values(values)
      .onConflictDoUpdate({
        target: timeEntries.id,
        set: {
          user: sql`excluded.user`,
          track: sql`excluded.track`,
          session: sql`excluded.session`,
          duration: sql`excluded.duration_ms`,
          amount: sql`excluded.amount_l`,
          comment: sql`excluded.comment`,
          updatedAt: new Date(),
        },
      })
      .returning()

    return { imported: result.length, total: values.length }
  }

  static async onImportCsv(
    socket: Socket,
    request: EventReq<'import_csv'>
  ): Promise<EventRes<'import_csv'>> {
    if (!isImportCsvRequest(request))
      throw new Error('Invalid CSV import request payload')

    await AuthManager.checkAuth(socket, ['admin'])

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Received CSV file:',
      request.table
    )

    let task: Promise<{ imported: number; total: number }>
    switch (request.table) {
      case 'users':
        task = AdminManager.importUsers(request.content)
        break
      case 'tracks':
        task = AdminManager.importTracks(request.content)
        break
      case 'timeEntries':
        task = AdminManager.importTimeEntries(request.content)
        break
      case 'sessions':
        task = AdminManager.importSessions(request.content)
        break
      default:
        throw new Error(`Invalid table: '${request.table}'`)
    }

    const data = await task

    console.info(
      new Date().toISOString(),
      socket.id,
      `Imported ${data.imported}/${data.total} ${request.table}`
    )

    return {
      success: true,
      imported: data.imported,
      total: data.total,
    }
  }

  private static filterColumnsForExport(
    tableName: ExportCsvRequest['table'],
    records: object[]
  ): object[] {
    const excludeColumns = AdminManager.EXCLUDED_COL_EXPORT[tableName]
    if (excludeColumns.size === 0) return records

    return records.map(record => {
      const filtered: Record<string, any> = {}
      for (const [key, value] of Object.entries(record)) {
        if (!excludeColumns.has(key)) {
          filtered[key] = value
        }
      }
      return filtered
    })
  }

  static async onExportCsv(
    socket: Socket,
    request: EventReq<'export_csv'>
  ): Promise<EventRes<'export_csv'>> {
    if (!isExportCsvRequest(request))
      throw new Error(loc.no.error.messages.invalid_request('ExportCsvRequest'))

    await AuthManager.checkAuth(socket, ['admin'])

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Exporting CSV table:',
      request.table
    )

    // @ts-expect-error
    const records = await db.query[request.table].findMany()

    // Filter out sensitive columns
    const filtered = AdminManager.filterColumnsForExport(request.table, records)

    const csv = CsvParser.toCsv(filtered)
    if (!csv) {
      throw new Error(loc.no.error.messages.missing_data)
    }

    return {
      success: true,
      csv,
    }
  }
}
