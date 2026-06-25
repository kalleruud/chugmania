import loc from '@common/locale/locales'
import {
  isExportCsvRequest,
  isImportCsvRequest,
  type ExportCsvRequest,
} from '@common/models/importCsv'
import type { EventReq, EventRes } from '@common/models/socket.io'
import { eq } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
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
import { broadcast, type TypedSocket } from '../server'
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

  private static async importRows(
    tableName: ExportCsvRequest['table'],
    data: Record<string, unknown>[]
  ): Promise<{ created: number; updated: number }> {
    const table = AdminManager.TABLE_MAP[tableName]

    // Fetch all existing IDs in a single query instead of per-row
    const existingRecords = await db.select({ id: table.id }).from(table)
    const existingIds = new Set(existingRecords.map(r => r.id))

    const toCreate: Record<string, unknown>[] = []
    const toUpdate: Record<string, unknown>[] = []
    for (const item of data) {
      const id = item.id
      if (typeof id === 'string' && existingIds.has(id)) {
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
        const id = update.id
        if (typeof id !== 'string') continue

        const res = db.update(table).set(update).where(eq(table.id, id)).run()
        updated += res.changes
      }
    })()

    return { created, updated }
  }

  static async onImportCsv(
    socket: TypedSocket,
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

    const [users, tracks, sessions, timeEntries, matches] = await Promise.all([
      UserManager.getAllUsers(),
      TrackManager.getAllTracks(),
      SessionManager.getAllSessions(),
      TimeEntryManager.getAllTimeEntries(),
      MatchManager.getAllMatches(),
    ])

    broadcast('all_users', users)
    broadcast('all_tracks', tracks)
    broadcast('all_sessions', sessions)
    broadcast('all_time_entries', timeEntries)
    broadcast('all_matches', matches)
    broadcast('all_rankings', RatingManager.onGetRatings())

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
      const filtered: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(record)) {
        if (!excludeColumns.has(key)) {
          filtered[key] = value
        }
      }
      return filtered
    })
  }

  static async onExportCsv(
    socket: TypedSocket,
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
