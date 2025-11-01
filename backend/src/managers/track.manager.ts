import { asc, eq } from 'drizzle-orm'
import { t } from '../../../common/locales'
import type {
  BackendResponse,
  GetTracksResponse,
} from '../../../common/models/responses'
import { tryCatchAsync } from '../../../common/utils/try-catch'
import db from '../../database/database'
import { timeEntries, tracks } from '../../database/schema'

export default class TrackManager {
  static readonly table = tracks

  static async import(data: (typeof TrackManager.table.$inferInsert)[]) {
    const tasks = data.map(d =>
      db
        .insert(TrackManager.table)
        .values(data)
        .onConflictDoUpdate({ target: TrackManager.table.id, set: d })
        .returning()
    )

    return (await Promise.all(tasks)).flat()
  }

  static async getTrackIdsWithLapTimes(
    offset = 0,
    limit = 100
  ): Promise<string[]> {
    const { data, error } = await tryCatchAsync(
      db
        .select({ id: tracks.id })
        .from(tracks)
        .innerJoin(timeEntries, eq(tracks.id, timeEntries.track))
        .groupBy(tracks.id)
        .orderBy(asc(tracks.number))
        .offset(offset)
        .limit(limit)
    )

    if (error) throw error
    return data.map(d => d.id)
  }

  static async onGetTracks(): Promise<BackendResponse> {
    const { data, error } = await tryCatchAsync(
      db.select().from(tracks).orderBy(asc(tracks.number))
    )

    if (error) throw error
    if (data.length === 0) throw new Error(t('messages.track.noLeaderboards'))
    return { success: true, tracks: data } satisfies GetTracksResponse
  }
}
