import type { Session } from '@common/models/session'
import { and, asc, desc, eq, gt, gte, isNull, lte, ne } from 'drizzle-orm'
import db from '../database'
import { sessions } from '../schema'

export default class SessionSource {
  static findById(id: string): Session | undefined {
    return db.select().from(sessions).where(eq(sessions.id, id)).get()
  }
  static getActiveById(id: string): Session | undefined {
    return db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, id), isNull(sessions.deletedAt)))
      .get()
  }
  static findStartedWithin(now: Date, earliest: Date, id?: string) {
    return db
      .select()
      .from(sessions)
      .where(
        and(
          isNull(sessions.deletedAt),
          ne(sessions.status, 'cancelled'),
          lte(sessions.date, now),
          gte(sessions.date, earliest),
          id ? eq(sessions.id, id) : undefined
        )
      )
      .orderBy(desc(sessions.date), asc(sessions.id))
      .get()
  }
  static findNext(now: Date) {
    return db
      .select()
      .from(sessions)
      .where(
        and(
          isNull(sessions.deletedAt),
          ne(sessions.status, 'cancelled'),
          gt(sessions.date, now)
        )
      )
      .orderBy(asc(sessions.date), asc(sessions.id))
      .get()
  }
}
