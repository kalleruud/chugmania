import { and, eq, isNull } from 'drizzle-orm'
import db from '../db'
import { matches } from '../db/schema'
import type { Group } from './group.manager'
import GroupManager from './group.manager'
import type { Session } from './session.manager'
import SessionManager from './session.manager'
import type { Track } from './track.manager'
import TrackManager from './track.manager'
import type { PublicUser } from './user.manager'
import UserManager from './user.manager'

export type NewMatch = typeof matches.$inferInsert
export type Match = Omit<
  typeof matches.$inferSelect,
  'user1' | 'user2' | 'session' | 'track' | 'winner'
> & {
  user1: PublicUser
  user2: PublicUser
  winner?: PublicUser
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
    if (values.length === 0) return []
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
    const user1 = await UserManager.getUserById(match.user1)
    const user2 = await UserManager.getUserById(match.user2)
    let winner: PublicUser | undefined = undefined
    if (match.winner === user1.id) winner = user1
    else if (match.winner === user2.id) winner = user2
    else if (match.winner) throw new Error(`Winner of ${match.id} does not match user1 or user2`)
    return {
      ...match,
      user1,
      user2,
      winner,
      session: await SessionManager.get(match.session),
      track: await TrackManager.get(match.track),
      group1: await GroupManager.getUserGroup(match.session, match.user1),
      group2: await GroupManager.getUserGroup(match.session, match.user2),
    }
  }

  static async setWinner(matchId: string, winnerId: string | null) {
    console.debug('Setting winner for match', matchId)
    await db.update(matches).set({ winner: winnerId }).where(eq(matches.id, matchId))
  }
}
