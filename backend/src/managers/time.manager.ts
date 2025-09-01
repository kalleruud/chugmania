import { tryCatchAsync } from '@chugmania/common/utils/try-catch.js'
import db from '@database/database'
import { timeEntries } from '@database/schema'
import { asc, desc, eq } from 'drizzle-orm'

export default class TimeManager {
  static readonly table = timeEntries

  static async addTime(entry: typeof timeEntries.$inferInsert) {
    const { data, error } = await tryCatchAsync(
      db.insert(timeEntries).values(entry).returning()
    )
    if (error) throw error
    return data[0]!
  }

  static async timesForTrack(trackId: string) {
    const { data, error } = await tryCatchAsync(
      db
        .select()
        .from(timeEntries)
        .where(eq(timeEntries.track, trackId))
        .orderBy(asc(timeEntries.duration), desc(timeEntries.createdAt))
    )
    if (error) throw error
    return data
  }

  static async timesForUser(userId: string) {
    const { data, error } = await tryCatchAsync(
      db
        .select()
        .from(timeEntries)
        .where(eq(timeEntries.user, userId))
        .orderBy(asc(timeEntries.track), asc(timeEntries.duration))
    )
    if (error) throw error
    return data
  }

  static async getById(id: string) {
    const { data, error } = await tryCatchAsync(
      db.query.timeEntries.findFirst({ where: eq(timeEntries.id, id) })
    )
    if (error) throw error
    if (!data) throw new Error('Time entry not found')
    return data
  }

  static async updateById(
    id: string,
    patch: Partial<typeof timeEntries.$inferInsert>
  ) {
    const { data, error } = await tryCatchAsync(
      db
        .update(timeEntries)
        .set(patch)
        .where(eq(timeEntries.id, id))
        .returning()
    )
    if (error) throw error
    return data[0]!
  }

  static async deleteById(id: string) {
    const { data, error } = await tryCatchAsync(
      db.delete(timeEntries).where(eq(timeEntries.id, id)).returning()
    )
    if (error) throw error
    return data[0]!
  }
}
