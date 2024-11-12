import db from '$lib/server/db'
import { sessions } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import type { PublicUser } from './user.manager'
import TrackManager from './track.manager'
import TimeEntryManager from './timeEntry.manager'

export type Session = typeof sessions.$inferSelect
export type SessionType = 'practice' | 'tournament'

export default class SessionManager {
  private static readonly typeString: Record<SessionType, string> = {
    practice: 'Practice',
    tournament: 'Turnering',
  }

  static init() {
    console.debug('Initializing session manager')
  }

  static async getAll() {
    console.debug('Getting sessions')
    const items = await db.select().from(sessions).orderBy(sessions.date).limit(10)
    return items.map(item => ({
      ...item,
      typeString: SessionManager.typeString[item.type],
    }))
  }

  static async get(id: string) {
    console.debug('Getting session:', id)
    const results = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1)
    if (results.length === 0) throw new Error(`Session not found: ${id}`)
    return results.at(0)!
  }

  static async create(type: SessionType, user: PublicUser) {
    console.debug('Creating session')
    const items = await db
      .insert(sessions)
      .values({
        type,
        createdBy: user.id,
      })
      .returning()
    const item = items.at(0)
    if (!item) throw new Error('Failed to create session')
    return item
  }

  static async getTracksWithEntries(sessionId: string) {
    console.debug('Getting tracks with entries for session:', sessionId)
    const tracks = await TrackManager.getBySession(sessionId)
    const entries = await TimeEntryManager.getBySession(sessionId)
    return tracks.map(track => {
      return {
        ...track,
        entries: entries.filter(entry => entry.track.id === track.id),
      }
    })
  }
}
