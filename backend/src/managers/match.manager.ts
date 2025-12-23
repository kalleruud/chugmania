import {
  isCreateMatchRequest,
  isDeleteMatchRequest,
  isEditMatchRequest,
  type CreateMatchRequest,
  type EditMatchRequest,
  type Match,
} from '@common/models/match'
import type { EventReq, EventRes } from '@common/models/socket.io'
import { desc, eq, isNull } from 'drizzle-orm'
import loc from '../../../frontend/lib/locales'
import db from '../../database/database'
import { matches } from '../../database/schema'
import { broadcast, type TypedSocket } from '../server'
import AuthManager from './auth.manager'

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
      .select()
      .from(matches)
      .where(isNull(matches.deletedAt))
      .orderBy(desc(matches.createdAt))

    return matchRows
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
    await db.insert(matches).values(matchData)

    console.debug(new Date().toISOString(), socket.id, 'Created match')

    broadcast('all_matches', await MatchManager.getAllMatches())

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

    const match = await db.query.matches.findFirst({
      where: eq(matches.id, request.id),
    })

    if (!match) {
      throw new Error(loc.no.error.messages.not_in_db(request.id))
    }

    MatchManager.validateMatchState(request, match)

    const { type, id, createdAt, updatedAt, ...updates } = request
    const res = await db
      .update(matches)
      .set({
        ...updates,
        deletedAt: updates.deletedAt
          ? new Date(updates.deletedAt)
          : updates.deletedAt,
      })
      .where(eq(matches.id, match.id))

    if (res.changes === 0) throw new Error(loc.no.error.messages.update_failed)

    console.debug(new Date().toISOString(), socket.id, 'Updated match', id)

    broadcast('all_matches', await MatchManager.getAllMatches())

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
