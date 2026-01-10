import {
  isCreateMatchRequest,
  isDeleteMatchRequest,
  isEditMatchRequest,
  type CreateMatch,
  type CreateMatchRequest,
  type EditMatchRequest,
  type Match,
  type MatchSide,
} from '@common/models/match'
import type { EventReq, EventRes } from '@common/models/socket.io'
import { and, desc, eq, getTableColumns, isNull, sql } from 'drizzle-orm'
import loc from '../../../frontend/lib/locales'
import db from '../../database/database'
import { matches, sessions, type MatchProgression } from '../../database/schema'
import { broadcast, type TypedSocket } from '../server'
import AuthManager from './auth.manager'
import RatingManager from './rating.manager'
import TournamentManager from './tournament.managers/tournament.manager'

export default class MatchManager {
  private static validateMatchState(
    request: CreateMatchRequest | EditMatchRequest,
    match?: Match
  ) {
    const user1 = request.user1 === undefined ? match?.user1 : request.user1
    const user2 = request.user2 === undefined ? match?.user2 : request.user2
    const winner = request.winner === undefined ? match?.winner : request.winner
    const status = request.status ?? match?.status

    if (status !== 'completed' && winner) {
      throw new Error(loc.no.match.error.planned_winner)
    }

    if (user1 && user2 && user1 === user2) {
      throw new Error(loc.no.match.error.same_user)
    }

    if (winner && winner !== user1 && winner !== user2) {
      throw new Error(loc.no.match.error.invalid_winner)
    }
  }

  public static async getAllMatches(): Promise<Match[]> {
    const matchRows = await db
      .select({ ...getTableColumns(matches) })
      .from(matches)
      .leftJoin(sessions, eq(matches.session, sessions.id))
      .where(isNull(matches.deletedAt))
      .orderBy(desc(sql`COALESCE(${sessions.date}, ${matches.createdAt})`))

    return matchRows
  }

  // Returns matches sorted by creation date, most recent first.
  public static async getAllBySession(sessionId: string): Promise<Match[]> {
    return await db
      .select({ ...getTableColumns(matches) })
      .from(matches)
      .where(and(eq(matches.session, sessionId), isNull(matches.deletedAt)))
      .orderBy(desc(matches.createdAt))
  }

  static async createMatch(sessionId: string | null, trackId: string | null) {
    const [match] = await db
      .insert(matches)
      .values({
        session: sessionId,
        track: trackId,
      } satisfies CreateMatch)
      .returning()
    return match.id
  }

  static async setPlayer(matchId: string, side: MatchSide, userId: string) {
    await db
      .update(matches)
      .set({ [side === 'A' ? matches.user1.name : matches.user2.name]: userId })
      .where(eq(matches.id, matchId))
  }

  static async getProgressedUser(
    matchId: string,
    progression: MatchProgression
  ) {
    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
    })
    if (!match) throw new Error(loc.no.error.messages.not_in_db(matchId))
    if (!match.winner) {
      throw new Error(
        `Tried to get ${progression} for match ${matchId} but it has no winner`
      )
    }

    const loser = match.user1 === match.winner ? match.user2 : match.user1
    if (!loser) {
      throw new Error(loc.no.error.messages.loser_not_found)
    }

    return progression === 'winner' ? match.winner : loser
  }

  static async onCreateMatch(
    socket: TypedSocket,
    request: EventReq<'create_match'>
  ): Promise<EventRes<'create_match'>> {
    if (!isCreateMatchRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('CreateMatchRequest')
      )
    }

    await AuthManager.checkAuth(socket, ['admin', 'moderator'])

    MatchManager.validateMatchState(request)

    const { type, createdAt, updatedAt, deletedAt, ...matchData } = request
    const [match] = await db.insert(matches).values(matchData).returning()

    console.debug(new Date().toISOString(), socket.id, 'Created match')

    RatingManager.recalculate()
    broadcast('all_matches', await MatchManager.getAllMatches())
    broadcast('all_rankings', await RatingManager.onGetRatings())

    if (match.winner) {
      await TournamentManager.onMatchUpdated(match, match.createdAt)
    }

    return { success: true }
  }

  static async onEditMatch(
    socket: TypedSocket,
    request: EventReq<'edit_match'>
  ): Promise<EventRes<'edit_match'>> {
    if (!isEditMatchRequest(request)) {
      throw new Error(loc.no.error.messages.invalid_request('EditMatchRequest'))
    }

    await AuthManager.checkAuth(socket, ['admin', 'moderator'])

    const preImageMatch = await db.query.matches.findFirst({
      where: eq(matches.id, request.id),
    })

    if (!preImageMatch) {
      throw new Error(loc.no.error.messages.not_in_db(request.id))
    }

    MatchManager.validateMatchState(request, preImageMatch)

    const { type, id, createdAt, updatedAt, ...updates } = request
    const [res] = await db
      .update(matches)
      .set({
        ...updates,
        deletedAt: updates.deletedAt
          ? new Date(updates.deletedAt)
          : updates.deletedAt,
      })
      .where(eq(matches.id, id))
      .returning()

    console.debug(new Date().toISOString(), socket.id, 'Updated match', id)

    if (
      (preImageMatch.winner || res.winner) &&
      preImageMatch.winner !== res.winner
    ) {
      await TournamentManager.onMatchUpdated(res, res.updatedAt!)
    }

    await RatingManager.recalculate()
    broadcast('all_matches', await MatchManager.getAllMatches())
    broadcast('all_rankings', await RatingManager.onGetRatings())

    return { success: true }
  }

  static async onDeleteMatch(
    socket: TypedSocket,
    request: EventReq<'delete_match'>
  ): Promise<EventRes<'delete_match'>> {
    if (!isDeleteMatchRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('DeleteMatchRequest')
      )
    }

    await MatchManager.onEditMatch(socket, {
      ...request,
      type: 'EditMatchRequest',
      deletedAt: new Date(),
    })

    return {
      success: true,
    }
  }
}
