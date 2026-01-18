import loc from '@/lib/locales'
import db, { database } from '@backend/database/database'
import {
  groupPlayers,
  groups,
  matchDependencies,
  matches,
  stages,
  tournaments,
} from '@backend/database/schema'
import type { Match } from '@common/models/match'
import type { EventReq, EventRes } from '@common/models/socket.io'
import {
  isCreateTournamentRequest,
  isDeleteTournamentRequest,
  isEditTournamentRequest,
  isTournamentPreviewRequest,
  type TournamentWithDetails,
} from '@common/models/tournament'
import type { UserInfoWithSeed } from '@common/models/user'
import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import { broadcast, type TypedSocket } from '../../server'
import AuthManager from '../auth.manager'
import MatchManager from '../match.manager'
import SessionManager from '../session.manager'
import GroupManager from './group.manager'
import StageManager from './stage.manager'
import TournamentMatchManager from './tournament_match.manager'

export default class TournamentManager {
  public static async getAll(): Promise<TournamentWithDetails[]> {
    const tournamentRows = await db
      .select({ id: tournaments.id })
      .from(tournaments)
      .where(isNull(tournaments.deletedAt))

    return Promise.all(
      tournamentRows.map(
        async t => await TournamentManager.getTournamentWithDetails(t.id)
      )
    )
  }

  private static async getTournamentWithDetails(
    tournamentId: string
  ): Promise<TournamentWithDetails> {
    // TODO: Implement with as few queries as possible
  }

  private static async createTournament({
    session,
    name,
    description,
    groupsCount,
    advancementCount,
    eliminationType,
    groupStageTracks,
    bracketTracks,
    participants,
  }: (EventReq<'create_tournament'> | EventReq<'get_tournament_preview'>) & {
    participants: UserInfoWithSeed[]
  }): Promise<string> {
    const [tournament] = await db
      .insert(tournaments)
      .values({
        session,
        name,
        description: description === '' ? null : (description ?? null),
        groupsCount,
        advancementCount,
        eliminationType,
      })
      .returning({ id: tournaments.id })

    const groupsWithPlayers = await GroupManager.generateGroups(
      tournament.id,
      groupsCount,
      participants
    )

    const { stages: groupStages } =
      await TournamentMatchManager.createGroupMatches(
        tournament.id,
        session,
        groupsWithPlayers,
        groupStageTracks
      )

    await TournamentMatchManager.generateBracketMatches(
      tournament.id,
      session,
      groupsWithPlayers,
      advancementCount,
      eliminationType,
      groupStages.length,
      bracketTracks
    )

    return tournament.id
  }

  public static async onMatchUpdated(match: Match) {
    if (match.status !== 'completed' || !match.stage) return

    if (!match.winner) {
      throw new Error('Match has no winner')
    }

    const stage = await StageManager.getStage(match.stage)
    if (stage.level !== 'group') {
      // Bracket match: resolve dependent matches
      return await TournamentMatchManager.resolveMatchDependentMatches(match.id)
    }

    // Find the group for this match by looking at the players
    if (!match.userA || !match.userB) {
      throw new Error(
        `Match ${match.id} was completed without both users present`
      )
    }

    // Find which group these players belong to
    const group = await GroupManager.getUsersGroup(
      stage.tournament,
      match.userA
    )
    return await TournamentMatchManager.resolveGroupDependentMatches(group.id)
  }

  static async onCreateTournament(
    socket: TypedSocket,
    request: EventReq<'create_tournament'>
  ): Promise<EventRes<'create_tournament'>> {
    if (!isCreateTournamentRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('CreateTournamentRequest')
      )
    }

    await AuthManager.checkAuth(socket, ['admin', 'moderator'])

    const participants = await SessionManager.getParticipantsWithSeed(
      request.session
    )
    await TournamentManager.createTournament({
      ...request,
      participants,
    })

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Created tournament',
      request.name
    )

    broadcast('all_tournaments', await TournamentManager.getAll())
    broadcast('all_matches', await MatchManager.getAllMatches())

    return { success: true }
  }

  static async onGetTournamentPreview(
    socket: TypedSocket,
    request: EventReq<'get_tournament_preview'>
  ): Promise<EventRes<'get_tournament_preview'>> {
    if (!isTournamentPreviewRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('GetTournamentPreviewRequest')
      )
    }

    await AuthManager.checkAuth(socket, ['admin', 'moderator'])

    let tournamentId: string | undefined

    try {
      const participants = await SessionManager.getParticipantsWithSeed(
        request.session
      )

      tournamentId = await TournamentManager.createTournament({
        ...request,
        participants,
      })

      const tournament =
        await TournamentManager.getTournamentWithDetails(tournamentId)

      console.debug(
        new Date().toISOString(),
        socket.id,
        'Created tournament preview',
        request.name
      )

      return {
        success: true,
        tournament,
      }
    } finally {
      if (tournamentId) {
        await TournamentManager.hardDeleteTournament(tournamentId)
      }
    }
  }

  static async onEditTournament(
    _socket: TypedSocket,
    request: EventReq<'edit_tournament'>
  ): Promise<EventRes<'edit_tournament'>> {
    if (!isEditTournamentRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('EditTournamentRequest')
      )
    }

    return { success: false, message: 'Not implemented' }
  }

  private static async hardDeleteTournament(tournamentId: string) {
    await db.delete(tournaments).where(eq(tournaments.id, tournamentId)) // Deletes tournament, cascades to all related data
  }

  static async onDeleteTournament(
    socket: TypedSocket,
    request: EventReq<'delete_tournament'>
  ): Promise<EventRes<'delete_tournament'>> {
    if (!isDeleteTournamentRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('DeleteTournamentRequest')
      )
    }

    AuthManager.checkAuth(socket, ['admin', 'moderator'])

    const deletedAt = new Date()

    const tournamentStructure =
      await TournamentManager.getTournamentWithDetails(request.id)

    const groupIds = tournamentStructure.groups.map(g => g.id)

    const stageIds = tournamentStructure.stages.map(s => s.stage.id)
    const matchIds = tournamentStructure.stages.flatMap(s =>
      s.matches.map(m => m.id)
    )

    database.transaction(() => {
      db.update(tournaments)
        .set({ deletedAt })
        .where(
          and(eq(tournaments.id, request.id), isNull(tournaments.deletedAt))
        )
        .run()

      if (groupIds.length > 0) {
        db.update(groups)
          .set({ deletedAt })
          .where(and(inArray(groups.id, groupIds), isNull(groups.deletedAt)))
          .run()

        db.update(groupPlayers)
          .set({ deletedAt })
          .where(
            and(
              inArray(groupPlayers.group, groupIds),
              isNull(groupPlayers.deletedAt)
            )
          )
          .run()
      }

      if (stageIds.length > 0) {
        db.update(stages)
          .set({ deletedAt })
          .where(and(inArray(stages.id, stageIds), isNull(stages.deletedAt)))
          .run()
      }

      if (matchIds.length > 0) {
        db.update(matches)
          .set({ deletedAt })
          .where(and(inArray(matches.id, matchIds), isNull(matches.deletedAt)))
          .run()

        db.update(matchDependencies)
          .set({ deletedAt })
          .where(
            and(
              or(
                inArray(matchDependencies.fromGroup, groupIds),
                inArray(matchDependencies.fromMatch, matchIds),
                inArray(matchDependencies.toMatch, matchIds)
              ),
              isNull(matchDependencies.deletedAt)
            )
          )
          .run()
      }
    })()

    console.info(
      new Date().toISOString(),
      socket.id,
      `Deleted tournament '${request.id}' with ${groupIds.length} groups and ${matchIds.length} matches`
    )

    broadcast('all_tournaments', await TournamentManager.getAll())
    broadcast('all_matches', await MatchManager.getAllMatches())

    return { success: true }
  }
}
