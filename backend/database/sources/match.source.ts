import type { CreateMatch, Match } from '@common/models/match'
import { and, desc, eq, getTableColumns, isNull, sql } from 'drizzle-orm'
import db from '../database'
import { matches, sessions } from '../schema'

export default class MatchSource {
  static async getAll(): Promise<Match[]> {
    return await db
      .select({ ...getTableColumns(matches) })
      .from(matches)
      .leftJoin(sessions, eq(matches.session, sessions.id))
      .where(isNull(matches.deletedAt))
      .orderBy(desc(sql`COALESCE(${sessions.date}, ${matches.createdAt})`))
  }
  static getAllBySession(sessionId: string): Match[] {
    return db
      .select()
      .from(matches)
      .where(and(eq(matches.session, sessionId), isNull(matches.deletedAt)))
      .orderBy(desc(matches.createdAt))
      .all()
  }
  static findById(id: string): Match | undefined {
    return db.select().from(matches).where(eq(matches.id, id)).get()
  }
  static create(entry: CreateMatch): void {
    db.insert(matches).values(entry).run()
  }
  static update(id: string, updates: Partial<CreateMatch>): void {
    db.update(matches).set(updates).where(eq(matches.id, id)).run()
  }
  static findByCapture(capture: string) {
    return db
      .select()
      .from(matches)
      .where(eq(matches.webhookCapture, capture))
      .get()
  }
}
