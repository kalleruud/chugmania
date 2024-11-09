import { db } from '$lib/server/db'
import { tracks, type TrackLevel, type TrackType } from '$lib/server/db/schema'

type InsertTrack = typeof tracks.$inferInsert
type SelectTrack = typeof tracks.$inferSelect

export default class TrackManager {
  static async getAll() {
    console.debug('Getting tracks')
    const items = await db.select().from(tracks).orderBy(tracks.number)
    return items
  }

  static async init() {
    const result = await db.select().from(tracks)
    if (result.length > 0) return

    console.info('Initializing tracks')

    await db.insert(tracks).values(this.generateTracks())

    console.info('Tracks added successfully')
  }

  private static generateTracks(): InsertTrack[] {
    const trackCount = 200
    const items = []

    const levels: TrackLevel[] = ['white', 'green', 'blue', 'red', 'black']
    const types: TrackType[] = ['drift', 'valley', 'lagoon', 'stadium']

    for (let i = 0; i < trackCount; i++) {
      items.push({
        number: i + 1,
        level: levels[Math.floor(i / 40) % levels.length],
        type: types[Math.floor(i / 10) % types.length],
      })
    }

    return items
  }

  static getNameOf(track: SelectTrack) {
    return `#${track.number.toString().padStart(2, '0')}`
  }
}
