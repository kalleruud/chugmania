import loc from '@common/locale/locales'
import {
  isCreateMatchRequest,
  isDeleteMatchRequest,
  isEditMatchRequest,
  type CreateMatch,
  type CreateMatchRequest,
  type EditMatchRequest,
  type Match,
} from '@common/models/match'
import type { EventReq, EventRes } from '@common/models/socket.io'
import MatchSource from '../../database/sources/match.source'
import TournamentSource from '../../database/sources/tournament.source'
import { broadcast, type TypedSocket } from '../server'
import AuthManager from './auth.manager'
import RatingManager from './rating.manager'
import TimeEntryManager from './timeEntry.manager'
import TournamentManager from './tournament/tournament.manager'

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

  private static inferWebhookResult(
    request: EditMatchRequest,
    match: Match
  ): EditMatchRequest {
    if (
      request.status === 'completed' &&
      match.webhookCapture &&
      !request.winner
    ) {
      const first =
        request.user1DurationMs === undefined
          ? match.user1DurationMs
          : request.user1DurationMs
      const second =
        request.user2DurationMs === undefined
          ? match.user2DurationMs
          : request.user2DurationMs
      const user1 = request.user1 === undefined ? match.user1 : request.user1
      const user2 = request.user2 === undefined ? match.user2 : request.user2
      request = { ...request, winner: null, duration: null }
      if (first !== null && (second === null || first < second)) {
        request = { ...request, winner: user1, duration: first }
      } else if (second !== null && (first === null || second < first)) {
        request = { ...request, winner: user2, duration: second }
      }
    }
    return request
  }

  public static async getAllMatches(): Promise<Match[]> {
    return TournamentManager.enrich(
      TournamentSource.visibleMatches(await MatchSource.getAll())
    )
  }

  public static getAllBySession = MatchSource.getAllBySession

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

    const matchData: CreateMatch = {
      user1: request.user1,
      user2: request.user2,
      track: request.track,
      session: request.session,
      winner: request.winner,
      duration: request.duration,
      status: request.status,
      stage: request.stage,
      comment: request.comment,
      webhookCapture: request.webhookCapture,
      user1DurationMs: request.user1DurationMs,
      user2DurationMs: request.user2DurationMs,
      user1ChugDurationMs: request.user1ChugDurationMs,
      user2ChugDurationMs: request.user2ChugDurationMs,
    }
    MatchSource.create(matchData)

    console.debug(new Date().toISOString(), socket.id, 'Created match')

    RatingManager.recalculate()
    broadcast('all_matches', await MatchManager.getAllMatches())
    broadcast('all_rankings', RatingManager.onGetRatings())
    TournamentManager.publish(socket.id)

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

    const preImageMatch = MatchSource.findById(request.id)

    if (!preImageMatch || preImageMatch.deletedAt) {
      throw new Error(loc.no.error.messages.not_in_db(request.id))
    }

    if (TournamentManager.editMatch(request)) {
      RatingManager.recalculate()
      broadcast('all_rankings', RatingManager.onGetRatings())
      broadcast('all_matches', await MatchManager.getAllMatches())
      broadcast('all_time_entries', await TimeEntryManager.getAllTimeEntries())
      TournamentManager.publish(socket.id)
      return { success: true }
    }
    request = MatchManager.inferWebhookResult(request, preImageMatch)
    MatchManager.validateMatchState(request, preImageMatch)

    const id = request.id
    MatchSource.update(preImageMatch.id, {
      user1: request.user1,
      user2: request.user2,
      track: request.track,
      session: request.session,
      winner: request.winner,
      duration: request.duration,
      status: request.status,
      stage: request.stage,
      comment: request.comment,
      webhookCapture: request.webhookCapture,
      user1DurationMs: request.user1DurationMs,
      user2DurationMs: request.user2DurationMs,
      user1ChugDurationMs: request.user1ChugDurationMs,
      user2ChugDurationMs: request.user2ChugDurationMs,
      deletedAt: request.deletedAt
        ? new Date(request.deletedAt)
        : request.deletedAt,
    })

    console.debug(new Date().toISOString(), socket.id, 'Updated match', id)

    RatingManager.recalculate()
    broadcast('all_matches', await MatchManager.getAllMatches())
    broadcast('all_rankings', RatingManager.onGetRatings())
    TournamentManager.publish(socket.id)

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
