import { and, eq, isNull } from 'drizzle-orm'
import db from '../db'
import { matches } from '../db/schema'
import type { PublicUser } from './user.manager'
import type { Session } from './session.manager'
import type { Track } from './track.manager'
import UserManager from './user.manager'
import SessionManager from './session.manager'
import TrackManager from './track.manager'
import type { Group } from './group.manager'
import GroupManager from './group.manager'

export type NewMatch = typeof matches.$inferInsert
export type Match = Omit<typeof matches.$inferSelect, 'user1' | 'user2' | 'session' | 'track'> & {
  user1: PublicUser
  user2: PublicUser
  session: Session
  track: Track
  group1?: Group
  group2?: Group
}

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
    return Promise.all(
      (
        await db
          .select()
          .from(matches)
          .where(and(isNull(matches.deletedAt), eq(matches.session, sessionId)))
      ).map(match => this.getDetails(match))
    )
  }

  static async getDetails(match: typeof matches.$inferSelect): Promise<Match> {
    console.debug('Getting details for match', match.id)
    return {
      ...match,
      user1: await UserManager.getUserById(match.user1),
      user2: await UserManager.getUserById(match.user2),
      session: await SessionManager.get(match.session),
      track: await TrackManager.get(match.track),
      group1: await GroupManager.getUserGroup(match.session, match.user1),
      group2: await GroupManager.getUserGroup(match.session, match.user2),
    }
  }
}
