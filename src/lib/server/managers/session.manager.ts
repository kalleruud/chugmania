import db from '$lib/server/db'
import { sessions } from '$lib/server/db/schema'
import { desc, eq, lt } from 'drizzle-orm'
import TimeEntryManager from './timeEntry.manager'
import TrackManager from './track.manager'
import type { PublicUser } from './user.manager'
import { toRelativeLocaleDateString } from './utils'

type SessionSelect = typeof sessions.$inferSelect
export type Session = SessionSelect & {
  typeString: string
  relativeDate: string
}
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
    const items = await db.select().from(sessions).orderBy(desc(sessions.date))
    return items.map(item => ({
      ...this.getDetails(item),
      typeString: SessionManager.typeString[item.type],
    }))
  }

  static async getAllLookup() {
    console.debug('Getting session lookup')
    return (await SessionManager.getAll()).map(session => ({
      ...this.getDetails(session),
      label: `${session.typeString} - ${session.date.toLocaleDateString()}`,
    }))
  }

  static async getMostRecent() {
    console.debug('Getting most recent session')
    const item = (
      await db
        .select()
        .from(sessions)
        .where(lt(sessions.date, new Date()))
        .orderBy(desc(sessions.date))
        .limit(1)
    ).at(0)

    return !item ? undefined : this.getDetails(item)
  }

  static async get(id: string) {
    console.debug('Getting session:', id)
    const results = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1)
    const result = results.at(0)
    if (!this.isSession(result)) throw new Error(`Session not found: ${id}`)
    return this.getDetails(result)
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

  static async getSessionData(sessionId: string) {
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

  static search(query: string, all: SessionSelect[]) {
    return all
      .filter(
        session =>
          session.type.includes(query) ||
          session.description?.includes(query) ||
          session.date.toISOString().includes(query) ||
          session.date.toLocaleDateString().includes(query)
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime())
  }

  static getDetails(session: SessionSelect): Session {
    return {
      ...session,
      typeString: SessionManager.typeString[session.type],
      relativeDate: toRelativeLocaleDateString(session.date),
    }
  }

  static isSession(item: unknown): item is Session {
    if (!item || typeof item !== 'object') return false
    return 'type' in item && (item.type === 'practice' || item.type === 'tournament')
  }
}
