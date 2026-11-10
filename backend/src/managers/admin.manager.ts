import loc from '@common/locale/locales'
import {
  isExportCsvRequest,
  isImportCsvRequest,
  type ExportCsvRequest,
} from '@common/models/importCsv'
import type { EventReq, EventRes } from '@common/models/socket.io'
import AdminSource from '../../database/sources/admin.source'
import { broadcast, type TypedSocket } from '../server'
import CsvParser from '../utils/csv-parser'
import AuthManager from './auth.manager'
import MatchManager from './match.manager'
import RatingManager from './rating.manager'
import SessionManager from './session.manager'
import TimeEntryManager from './timeEntry.manager'
import TournamentManager from './tournament/tournament.manager'
import TrackManager from './track.manager'
import UserManager from './user.manager'

export default class AdminManager {
  private static importRows(
    tableName: ExportCsvRequest['table'],
    data: Record<string, unknown>[]
  ) {
    const before = TournamentManager.getAllTournaments().flatMap(tournament => {
      const state = TournamentManager.getState(tournament.config.session)
      return state ? [state] : []
    })
    return AdminSource.importRows(tableName, data, () => {
      for (const state of before)
        TournamentManager.reconcile(state.config.session, state)
      TournamentManager.reconcileAll()
    })
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
    const results = AdminManager.importRows(request.table, data)

    console.info(
      new Date().toISOString(),
      socket.id,
      `Imported ${data.length} ${request.table}`
    )

    RatingManager.recalculate()

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
    TournamentManager.publish(socket.id)

    return {
      success: true,
      ...results,
    }
  }

  private static filterColumnsForExport(
    tableName: ExportCsvRequest['table'],
    records: object[]
  ): Record<string, unknown>[] {
    const excludeColumns =
      tableName === 'users' ? new Set(['passwordHash']) : new Set<string>()

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

    const records = AdminSource.getRows(request.table)

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
