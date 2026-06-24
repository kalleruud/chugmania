import type { Track } from '@common/models/track'
import { tryCatchAsync } from '@common/utils/try-catch'
import { asc, eq } from 'drizzle-orm'
import loc from '../../../frontend/lib/locales'
import db from '../../database/database'
import { timeEntries, tracks } from '../../database/schema'

class TrackManagerClass {
  readonly table = tracks

  async import(data: (typeof TrackManager.table.$inferInsert)[]) {
    const tasks = data.map(d =>
      db
        .insert(TrackManager.table)
        .values(data)
        .onConflictDoUpdate({ target: TrackManager.table.id, set: d })
        .returning()
    )

    return (await Promise.all(tasks)).flat()
  }

  async getTrackIdsWithLapTimes(offset = 0, limit = 100): Promise<string[]> {
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

  async getAllTracks(): Promise<Track[]> {
    const data = await db.select().from(tracks).orderBy(asc(tracks.number))

    if (data.length === 0) {
      console.debug(
        new Date().toISOString(),
        loc.no.error.messages.not_in_db(loc.no.tracks.title)
      )
      return []
    }

    return data
  }
}
const TrackManager = new TrackManagerClass()

export default TrackManager
