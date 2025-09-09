import { TRACK_LEVELS, TRACK_TYPES } from '@chugmania/common/models/track.ts'
import { tryCatchAsync } from '@chugmania/common/utils/try-catch.js'
import db from '@database/database'
import { tracks } from '@database/schema'

export default class TrackManager {
  static async seed(): Promise<void> {
    const { data, error } = await tryCatchAsync(db.query.tracks.findFirst())
    if (error) throw error
    if (data) return

    const trackCount = 200

    const items: (typeof tracks.$inferInsert)[] = []
    for (let i = 0; i < trackCount; i++) {
      items.push({
        number: i + 1,
        level: TRACK_LEVELS.filter(t => t != 'custom')[
          Math.floor(i / 40) % (TRACK_LEVELS.length - 1)
        ]!,
        type: TRACK_TYPES[Math.floor(i / 10) % TRACK_TYPES.length]!,
      })
    }
    await db.insert(tracks).values(items)
    console.log(`Inserted ${trackCount} tracks`)
  }
}
