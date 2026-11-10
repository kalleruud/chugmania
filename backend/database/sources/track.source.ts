import type { Track } from '@common/models/track'
import { tryCatchAsync } from '@common/utils/try-catch'
import { and, asc, eq, isNull } from 'drizzle-orm'
import db from '../database'
import { timeEntries, tracks } from '../schema'

export default class TrackSource {
  static readonly table = tracks

  static async import(data: (typeof TrackSource.table.$inferInsert)[]) {
    const tasks = data.map(d =>
      db
        .insert(TrackSource.table)
        .values(data)
        .onConflictDoUpdate({ target: TrackSource.table.id, set: d })
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
        .innerJoin(
          timeEntries,
          and(
            eq(tracks.id, timeEntries.track),
            eq(timeEntries.status, 'completed')
          )
        )
        .groupBy(tracks.id)
        .orderBy(asc(tracks.name))
        .offset(offset)
        .limit(limit)
    )

    if (error) throw error
    return data.map(d => d.id)
  }

  static async getAll(): Promise<Track[]> {
    return await db.select().from(tracks).orderBy(asc(tracks.name))
  }
  static findByUid(uid: string) {
    return db
      .select()
      .from(tracks)
      .where(and(eq(tracks.uid, uid), isNull(tracks.deletedAt)))
      .get()
  }
  static create(track: typeof tracks.$inferInsert) {
    return db.insert(tracks).values(track).returning().get()
  }
}
