import db from '$lib/server/db'
import { sessions } from '$lib/server/db/schema'
import type { LookupEntity } from '@/components/lookup/lookup.server'
import { toRelativeLocaleDateString } from '@/utils'
import { getLocalTimeZone, today } from '@internationalized/date'
import { and, desc, eq, isNull } from 'drizzle-orm'
import GroupManager from './group.manager'
import TimeEntryManager from './timeEntry.manager'
import TrackManager from './track.manager'
import type { PublicUser } from './user.manager'

type SessionSelect = typeof sessions.$inferSelect
export type Session = Omit<SessionSelect, 'date'> & {
  date: Date
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
    const items = await db
      .select()
      .from(sessions)
      .where(isNull(sessions.deletedAt))
      .orderBy(desc(sessions.date))
    return items.map(item => ({
      ...this.getDetails(item),
      typeString: SessionManager.typeString[item.type],
    }))
  }

  static async getAllLookup(): Promise<LookupEntity[]> {
    console.debug('Getting session lookup')
    const initialCount = 10
    return (await SessionManager.getAll()).map((session, i) => ({
      ...session,
      featured: i <= initialCount,
      label: `${session.typeString} - ${session.relativeDate}`,
    }))
  }

  static async getMostRecent() {
    console.debug('Getting most recent session')
    const todayString = today(getLocalTimeZone()).toString()
    const item = await db.query.sessions.findFirst({
      where: eq(sessions.date, todayString),
      orderBy: desc(sessions.date),
    })

    return !item ? undefined : this.getDetails(item)
  }

  static async get(id: string) {
    console.debug('Getting session:', id)
    const results = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1)
    const result = results.at(0)
    if (!this.isSession(result)) throw new Error(`Session not found: ${id}`)
    return this.getDetails(result)
  }

  static async getFromDate(date: string) {
    console.debug('Getting session from:', date)
    const result = await db.query.sessions.findFirst({
      where: and(eq(sessions.date, date), isNull(sessions.deletedAt)),
    })
    if (!result) return undefined
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

  static async update(id: string, description: string | null, date: string) {
    console.debug('Updating session:', id)
    await db.update(sessions).set({ description, date }).where(eq(sessions.id, id))
  }

  static async addGroup(id: string, groupSize?: number) {
    console.debug('Adding group to session:', id)
    await GroupManager.create(id, groupSize)
  }

  static async delete(id: string) {
    console.debug('Deleting session:', id)
    await db.update(sessions).set({ deletedAt: new Date() }).where(eq(sessions.id, id))
    await GroupManager.deleteBySession(id)
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

  static search(query: string, all: Session[]) {
    return all
      .filter(
        session =>
          session.type.includes(query) ||
          session.description?.includes(query) ||
          session.date.toString().includes(query) ||
          toRelativeLocaleDateString(session.date).includes(query)
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime())
  }

  static getDetails(session: SessionSelect): Session {
    const date = new Date(session.date)
    return {
      ...session,
      date,
      typeString: SessionManager.typeString[session.type],
      relativeDate: toRelativeLocaleDateString(date),
    }
  }

  static isSession(item: unknown): item is Session {
    if (!item || typeof item !== 'object') return false
    return 'type' in item && (item.type === 'practice' || item.type === 'tournament')
  }
}
