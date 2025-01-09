import db from '$lib/server/db'
import { timeEntries, tracks } from '$lib/server/db/schema'
import type { LookupEntity } from '@/components/lookup/lookup.server'
import { and, eq, isNull } from 'drizzle-orm'

type InsertTrack = typeof tracks.$inferInsert
type SelectTrack = typeof tracks.$inferSelect

export type TrackLevel = 'white' | 'green' | 'blue' | 'red' | 'black' | 'custom'
export type TrackType = 'drift' | 'valley' | 'lagoon' | 'stadium'

export type Track = SelectTrack & {
  name: string
}

export type SessionTrack = SelectTrack & {
  duration: number
  rank: number
}

export default class TrackManager {
  static readonly table = tracks

  static async init() {
    const result = await db.select().from(tracks)
    if (result.length > 0) return
    console.log('Initializing tracks')
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

  static async getAll(isChuggable: boolean = true): Promise<Track[]> {
    console.debug('Getting tracks')
    const items = await db
      .select()
      .from(tracks)
      .where(eq(tracks.isChuggable, isChuggable))
      .orderBy(tracks.number)
    return items.map(item => this.getDetails(item))
  }

  static async getAllLookup(): Promise<LookupEntity[]> {
    return (await this.getAll()).map(track => ({
      ...track,
      featured: track.isChuggable,
      label: track.name,
    }))
  }

  static async getBySession(session: string): Promise<Track[]> {
    console.debug('Getting tracks from session:', session)
    const result = await db
      .select()
      .from(tracks)
      .innerJoin(timeEntries, eq(tracks.id, timeEntries.track))
      .where(and(isNull(timeEntries.deletedAt), eq(timeEntries.session, session)))

    return result.map(item => this.getDetails(item.tracks))
  }

  static async get(id: string): Promise<Track> {
    console.debug('Getting track:', id)
    const result = await db.select().from(tracks).where(eq(tracks.id, id)).limit(1)
    const track = result.at(0)
    if (!track) throw new Error(`Track not found: ${id}`)
    return this.getDetails(track)
  }

  static getDetails(track: SelectTrack): Track {
    return {
      ...track,
      name: this.getNameOf(track),
    }
  }

  private static getNameOf(track: SelectTrack) {
    return `#${track.number.toString().padStart(2, '0')}`
  }
}
