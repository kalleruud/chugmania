import {
  isCreateMatchRequest,
  isDeleteMatchRequest,
  isEditMatchRequest,
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

    if (
      (request.status === 'planned' || request.status === 'cancelled') &&
      request.winner
    ) {
      throw new Error(loc.no.match.error.planned_winner)
    }

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

    if (
      (request.status === 'planned' || request.status === 'cancelled') &&
      request.winner
    ) {
      throw new Error(loc.no.match.error.planned_winner)
    }

    const match = await db.query.matches.findFirst({
      where: eq(matches.id, request.id),
    })

    if (!match) {
      throw new Error(loc.no.error.messages.not_in_db(request.id))
    }

    const { type, id, createdAt, updatedAt, ...updates } = request
    const res = await db
      .update(matches)
      .set({
        ...updates,
        deletedAt: updates.deletedAt ? new Date(updates.deletedAt) : undefined,
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
