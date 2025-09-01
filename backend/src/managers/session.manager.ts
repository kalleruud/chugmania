import { tryCatchAsync } from '@chugmania/common/utils/try-catch.js'
import db from '@database/database'
import { sessions } from '@database/schema'
import { and, between, eq } from 'drizzle-orm'

export default class SessionManager {
  static readonly table = sessions

  static async getOrCreatePracticeSessionForDay(userId: string, date: Date) {
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const { data: existing } = await tryCatchAsync(
      db.query.sessions.findFirst({
        where: and(
          eq(sessions.type, 'practice'),
          eq(sessions.createdBy, userId),
          between(sessions.date, dayStart, dayEnd)
        ),
      })
    )
    if (existing) return existing

    const { data, error } = await tryCatchAsync(
      db
        .insert(sessions)
        .values({
          createdBy: userId,
          type: 'practice',
          description: 'Daily practice',
        })
        .returning()
    )
    if (error) throw error
    return data[0]!
  }
}
