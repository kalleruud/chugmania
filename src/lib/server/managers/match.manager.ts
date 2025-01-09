import { and, eq, isNull } from 'drizzle-orm'
import db from '../db'
import { matches } from '../db/schema'

export type NewMatch = typeof matches.$inferInsert
export type Match = typeof matches.$inferSelect

export default class MatchManager {
  static async create(match: typeof matches.$inferInsert) {
    console.debug('Creating match between', match.user1, 'and', match.user2)
    return (await this.createMany([match])).at(0)
  }

  static async createMany(values: (typeof matches.$inferInsert)[]) {
    console.debug('Creating', values.length, 'matches')
    return await db.insert(matches).values(values).returning()
  }

  static async delete(matchId: string) {
    console.debug('Deleting match', matchId)
    await db.update(matches).set({ deletedAt: new Date() }).where(eq(matches.id, matchId))
  }

  static async deleteAllFromSession(sessionId: string) {
    console.debug('Deleting all matches from session', sessionId)
    await db.update(matches).set({ deletedAt: new Date() }).where(eq(matches.session, sessionId))
  }

  static async getAllFromSession(sessionId: string) {
    console.debug('Getting all matches from session', sessionId)
    return await db
      .select()
      .from(matches)
      .where(and(isNull(matches.deletedAt), eq(matches.session, sessionId)))
  }
}
