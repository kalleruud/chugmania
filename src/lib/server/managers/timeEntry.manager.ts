import { db } from '$lib/server/db'
import { eq } from 'drizzle-orm'
import { timeEntries } from '../db/schema'

export default class TimeEntryManager {
  static async getAll(sessionId: string) {
    console.debug('Getting time entries for session:', sessionId)
    const items = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.session, sessionId))
      .orderBy(timeEntries.duration)
    return items
  }

  static async create(timeEntry: typeof timeEntries.$inferInsert) {
    console.debug('Creating time entry')
    return await db.insert(timeEntries).values(timeEntry).returning()
  }
}
