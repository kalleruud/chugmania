import {
  isCreateMatchRequest,
  isDeleteMatchRequest,
  isEditMatchRequest,
  type CreateMatchRequest,
  type EditMatchRequest,
  type Match,
  type MatchSide,
} from '@common/models/match'
import type { EventReq, EventRes } from '@common/models/socket.io'
import { and, desc, eq, getTableColumns, isNull, sql } from 'drizzle-orm'
import loc from '../../../frontend/lib/locales'
import db from '../../database/database'
import { matches, sessions } from '../../database/schema'
import { broadcast, type TypedSocket } from '../server'
import AuthManager from './auth.manager'
import RatingManager from './rating.manager'
import TournamentManager from './tournament.managers/tournament.manager'

export default class MatchManager {
  private static validateMatchState(
    request: CreateMatchRequest | EditMatchRequest,
    match?: Match
  ) {
    const userA = request.userA === undefined ? match?.userA : request.userA
    const userB = request.userB === undefined ? match?.userB : request.userB
    const winner = request.winner === undefined ? match?.winner : request.winner
    const status = request.status ?? match?.status

    if (status !== 'completed' && winner) {
      throw new Error(loc.no.match.error.planned_winner)
    }

    if (userA && userB && userA === userB) {
      throw new Error(loc.no.match.error.same_user)
    }

    // Winner must be 'A' or 'B' slot, not a user ID
    if (winner && winner !== 'A' && winner !== 'B') {
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

  static async createMatch(sessionId: string | null, trackId: string) {
    const [match] = await db
      .insert(matches)
      .values({
        session: sessionId,
        track: trackId,
      })
      .returning()
    return match.id
  }

  static async setPlayer(matchId: string, side: MatchSide, userId: string) {
    await db
      .update(matches)
      .set({ [side === 'A' ? matches.userA.name : matches.userB.name]: userId })
      .where(eq(matches.id, matchId))
  }

  /**
   * Get the user who progressed from a match based on position.
   * Position 1 = winner, Position 2 = loser
   */
  static async getProgressedUser(matchId: string, position: number) {
    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
    })
    if (!match) throw new Error(loc.no.error.messages.not_in_db(matchId))
    if (!match.winner) {
      throw new Error(
        `Tried to get position ${position} for match ${matchId} but it has no winner`
      )
    }

    const winnerUserId = match.winner === 'A' ? match.userA : match.userB
    const loserUserId = match.winner === 'A' ? match.userB : match.userA

    if (!winnerUserId || !loserUserId) {
      throw new Error(loc.no.error.messages.loser_not_found)
    }

    return position === 1 ? winnerUserId : loserUserId
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

    let shouldBroadcastTournaments = false
    if (
      (preImageMatch.winner || res.winner) &&
      preImageMatch.winner !== res.winner
    ) {
      shouldBroadcastTournaments = true
      // Note: onMatchUpdated may also broadcast tournaments, but we'll do it here to be sure
      await TournamentManager.onMatchUpdated(res, res.updatedAt!)
    }

    await RatingManager.recalculate()
    broadcast('all_matches', await MatchManager.getAllMatches())
    broadcast('all_rankings', await RatingManager.onGetRatings())

    // Always broadcast tournaments if any match was part of a tournament
    if (shouldBroadcastTournaments) {
      broadcast('all_tournaments', await TournamentManager.getAll())
    }

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
