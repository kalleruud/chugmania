import { tryCatchAsync } from '@chugmania/common/utils/try-catch.js'
import db from '@database/database'
import { tracks, type TrackLevel, type TrackType } from '@database/schema'
import { asc, inArray } from 'drizzle-orm'

export default class TrackManager {
  static readonly table = tracks

  private static generateTracks(): (typeof tracks.$inferInsert)[] {
    const trackCount = 200
    const items: (typeof tracks.$inferInsert)[] = []

    const levels: TrackLevel[] = ['white', 'green', 'blue', 'red', 'black']
    // Use schema-supported types; 'drift' not in current union
    const types: TrackType[] = ['canyon', 'valley', 'lagoon', 'stadium']

    for (let i = 0; i < trackCount; i++) {
      items.push({
        number: i + 1,
        level: levels[Math.floor(i / 40) % levels.length]!,
        type: types[Math.floor(i / 10) % types.length]!,
      })
    }

    return items
  }

  static async list() {
    const { data, error } = await tryCatchAsync(
      db.query.tracks.findMany({
        orderBy: [asc(tracks.number)],
      })
    )
    if (error) throw error
    return data
  }

  static async ensureSeed() {
    // Seed a full set of tracks if DB is empty
    const existing = await db.query.tracks.findFirst()
    if (existing) return
    const values = this.generateTracks()
    db.insert(tracks).values(values).onConflictDoNothing().run()
  }

  static async getByIds(ids: string[]) {
    if (ids.length === 0) return [] as (typeof tracks.$inferSelect)[]
    const { data, error } = await tryCatchAsync(
      db
        .select()
        .from(tracks)
        .where(inArray(tracks.id, Array.from(new Set(ids))))
    )
    if (error) throw error
    return data
  }
}
