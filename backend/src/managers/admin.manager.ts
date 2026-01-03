import {
  isExportCsvRequest,
  isImportCsvRequest,
  type ExportCsvRequest,
} from '@common/models/importCsv'
import type { EventReq, EventRes } from '@common/models/socket.io'
import { eq } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import type { Socket } from 'socket.io'
import loc from '../../../frontend/lib/locales'
import db, { database } from '../../database/database'
import {
  groupPlayers,
  groups,
  matches,
  sessions,
  sessionSignups,
  timeEntries,
  tournamentMatches,
  tournaments,
  tracks,
  users,
} from '../../database/schema'
import { broadcast } from '../server'
import CsvParser from '../utils/csv-parser'
import AuthManager from './auth.manager'
import MatchManager from './match.manager'
import RatingManager from './rating.manager'
import SessionManager from './session.manager'
import TimeEntryManager from './timeEntry.manager'
import TrackManager from './track.manager'
import UserManager from './user.manager'

export default class AdminManager {
  private static readonly EXCLUDED_COL_EXPORT = {
    users: new Set(['passwordHash']),
    tracks: new Set(),
    sessions: new Set(),
    timeEntries: new Set(),
    sessionSignups: new Set(),
    matches: new Set(),
    tournaments: new Set(),
    groups: new Set(),
    groupPlayers: new Set(),
    tournamentMatches: new Set(),
  } satisfies Record<ExportCsvRequest['table'], Set<string>>

  private static readonly TABLE_MAP = {
    users: users,
    tracks: tracks,
    sessions: sessions,
    timeEntries: timeEntries,
    sessionSignups: sessionSignups,
    matches: matches,
    tournaments: tournaments,
    groups: groups,
    groupPlayers: groupPlayers,
    tournamentMatches: tournamentMatches,
  } satisfies Record<ExportCsvRequest['table'], SQLiteTable>

  private static async importRows<T extends Record<string, any>>(
    tableName: ExportCsvRequest['table'],
    data: T[]
  ): Promise<{ created: number; updated: number }> {
    const table = AdminManager.TABLE_MAP[tableName]

    // Fetch all existing IDs in a single query instead of per-row
    const existingRecords = await db.select({ id: table.id }).from(table)
    const existingIds = new Set(existingRecords.map(r => r.id))

    const toCreate: T[] = []
    const toUpdate: T[] = []
    for (const item of data) {
      if (existingIds.has(item.id)) {
        toUpdate.push(item)
      } else {
        toCreate.push({
          ...item,
          // Avoid setting createdAt to NULL when creating, this will crash db.
          createdAt: item.createdAt === null ? undefined : item.createdAt,
        })
      }
    }

    let created = 0
    let updated = 0
    // Manual transaction management for better-sqlite3
    database.transaction(() => {
      if (toCreate.length > 0) {
        const res = db.insert(table).values(toCreate).run()
        created = res.changes
      }

      for (const update of toUpdate) {
        const res = db
          .update(table)
          .set(update)
          .where(eq(table.id, update.id))
          .run()
        updated += res.changes
      }
    })()

    return { created, updated }
  }

  static async onImportCsv(
    socket: Socket,
    request: EventReq<'import_csv'>
  ): Promise<EventRes<'import_csv'>> {
    if (!isImportCsvRequest(request))
      throw new Error(loc.no.error.messages.invalid_request('ImportCsvRequest'))

    await AuthManager.checkAuth(socket, ['admin'])

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Received CSV file:',
      request.table
    )
    const data = await CsvParser.toObjects(request.content)
    const results = await AdminManager.importRows(request.table, data)

    console.info(
      new Date().toISOString(),
      socket.id,
      `Imported ${data.length} ${request.table}`
    )

    await RatingManager.recalculate()

    broadcast('all_users', await UserManager.getAllUsers())
    broadcast('all_tracks', await TrackManager.getAllTracks())
    broadcast('all_sessions', await SessionManager.getAllSessions())
    broadcast('all_time_entries', await TimeEntryManager.getAllTimeEntries())
    broadcast('all_matches', await MatchManager.getAllMatches())
    broadcast('all_rankings', await RatingManager.onGetRatings())

    return {
      success: true,
      ...results,
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

    // Use type-safe table lookup
    const table = AdminManager.TABLE_MAP[request.table]
    const records = await db.select().from(table)

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
