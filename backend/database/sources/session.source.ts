import { and, asc, desc, eq, gt, gte, isNull, lte, ne } from 'drizzle-orm'
import db from '../database'
import {
  sessionDateVotes,
  sessions,
  sessionSignups,
  users,
  type SessionResponse,
} from '../schema'

export default class SessionSource {
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

  static getActiveById(id: string) {
    return db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, id), isNull(sessions.deletedAt)))
      .get()
  }

  static update(id: string, changes: Partial<typeof sessions.$inferInsert>) {
    const updated = db
      .update(sessions)
      .set(changes)
      .where(eq(sessions.id, id))
      .returning({ id: sessions.id })
      .all()
    return updated.length > 0
  }

  static setSignup(
    sessionId: string,
    userId: string,
    response: SessionResponse
  ) {
    const existing = db
      .select({ id: sessionSignups.id })
      .from(sessionSignups)
      .where(
        and(
          eq(sessionSignups.session, sessionId),
          eq(sessionSignups.user, userId)
        )
      )
      .get()

    db.insert(sessionSignups)
      .values({ id: existing?.id, session: sessionId, user: userId, response })
      .onConflictDoUpdate({
        target: [sessionSignups.id],
        set: { response, deletedAt: null },
      })
      .run()
  }

  static deleteSignup(id: string): { session: string } | undefined {
    return db
      .update(sessionSignups)
      .set({ deletedAt: new Date() })
      .where(and(eq(sessionSignups.id, id), isNull(sessionSignups.deletedAt)))
      .returning({ session: sessionSignups.session })
      .get()
  }

  static resetPoll(sessionId: string) {
    db.delete(sessionDateVotes)
      .where(eq(sessionDateVotes.session, sessionId))
      .run()
    db.update(sessionSignups)
      .set({ response: 'maybe' })
      .where(
        and(
          eq(sessionSignups.session, sessionId),
          isNull(sessionSignups.deletedAt)
        )
      )
      .run()
  }

  static getDateVotes(sessionId: string) {
    return db
      .select({ dates: sessionDateVotes.dates, user: users })
      .from(sessionDateVotes)
      .innerJoin(users, eq(sessionDateVotes.user, users.id))
      .where(
        and(eq(sessionDateVotes.session, sessionId), isNull(users.deletedAt))
      )
      .orderBy(asc(sessionDateVotes.createdAt))
      .all()
  }

  static setDateVote(sessionId: string, userId: string, dates: number[]) {
    db.insert(sessionDateVotes)
      .values({ session: sessionId, user: userId, dates })
      .onConflictDoUpdate({
        target: [sessionDateVotes.session, sessionDateVotes.user],
        set: { dates },
      })
      .run()
  }

  static applyDateVotes(sessionId: string, date: number) {
    const votes = db
      .select()
      .from(sessionDateVotes)
      .where(eq(sessionDateVotes.session, sessionId))
      .all()

    for (const vote of votes) {
      const response = vote.dates.includes(date) ? 'yes' : 'no'
      SessionSource.setSignup(sessionId, vote.user, response)
    }
  }
}
