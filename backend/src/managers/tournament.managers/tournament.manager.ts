import loc from '@/lib/locales'
import db, { database } from '@backend/database/database'
import {
  groupPlayers,
  groups,
  matches,
  tournamentMatches,
  tournaments,
} from '@backend/database/schema'
import type { CreateMatch, Match } from '@common/models/match'
import type { EventReq, EventRes } from '@common/models/socket.io'
import {
  isCreateTournamentRequest,
  isDeleteTournamentRequest,
  isEditTournamentRequest,
  isTournamentPreviewRequest,
  type CreateGroup,
  type CreateGroupPlayer,
  type CreateTournament,
  type Group,
  type GroupPlayer,
  type GroupWithPlayers,
  type Tournament,
  type TournamentMatch,
  type TournamentRound,
  type TournamentWithDetails,
} from '@common/models/tournament'
import { and, eq, isNull } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { broadcast, type TypedSocket } from '../../server'
import AuthManager from '../auth.manager'
import MatchManager from '../match.manager'
import SessionManager from '../session.manager'
import GroupManager from './group.manager'
import TournamentMatchManager from './tournament_match.manager'

type TournamentStructure = {
  tournament: Tournament
  groups: Group[]
  groupPlayers: GroupPlayer[]
  tournamentMatches: TournamentMatch[]
  matches: Match[]
}

export default class TournamentManager {
  public static async getAll(): Promise<TournamentWithDetails[]> {
    const tournamentRows = await db
      .select({ id: tournaments.id })
      .from(tournaments)
      .where(isNull(tournaments.deletedAt))

    return Promise.all(
      tournamentRows.map(
        async t =>
          await TournamentManager.toTournamentWithDetails(
            await TournamentManager.getTournamentStructure(t.id)
          )
      )
    )
  }

  private static async getTournamentStructure(
    tournamentId: string
  ): Promise<TournamentStructure> {
    const tournament = await db.query.tournaments.findFirst({
      where: and(
        eq(tournaments.id, tournamentId),
        isNull(tournaments.deletedAt)
      ),
    })

    if (!tournament) {
      throw new Error(loc.no.error.messages.not_in_db(tournamentId))
    }

    const { groups, groupPlayers } = await GroupManager.getAll(tournamentId)
    const { tournamentMatches, matches } =
      await TournamentMatchManager.getAll(tournamentId)

    return {
      tournament,
      groups,
      groupPlayers,
      tournamentMatches,
      matches,
    }
  }

  private static async toTournamentWithDetails({
    tournament,
    groups,
    groupPlayers,
    tournamentMatches,
    matches,
  }: TournamentStructure): Promise<TournamentWithDetails> {
    const groupMatches = tournamentMatches
      .filter(tm => tm.bracket === 'group')
      .map(tm => matches.find(m => m.id === tm.match))
      .filter(m => m?.winner)

    const groupsWithPlayers: GroupWithPlayers[] = groups.map(group => {
      return {
        ...group,
        players: groupPlayers
          .filter(gp => gp.group === group.id)
          .map(gp => ({
            ...gp,
            wins: groupMatches.filter(m => m?.winner === gp.user).length,
            losses: groupMatches.filter(
              m =>
                (m?.user1 === gp.user || m?.user2 === gp.user) &&
                m?.winner !== gp.user
            ).length,
          })),
      }
    })

    // Sort matches in correct display order, then group by bracket+round
    const matchesByRound = TournamentManager.generateRounds(
      tournamentMatches,
      matches
    )

    // Calculate min and max matches per player
    const { min, max } = TournamentMatchManager.calculateMinMaxMatchesPerPlayer(
      {
        groups: groupsWithPlayers,
        advancementCount: tournament.advancementCount,
        eliminationType: tournament.eliminationType,
      }
    )

    // Calculate recommended number of tracks so each is used ~2 times
    const groupStageTrackCount = Math.ceil(
      matchesByRound.filter(r => r.bracket === 'group').length / 2
    )

    return {
      ...tournament,
      maxMatchesPerPlayer: max,
      minMatchesPerPlayer: min,
      groupStageTrackCount,
      groups: groupsWithPlayers,
      rounds: matchesByRound,
    }
  }

  private static generateRounds(
    tournamentMatches: TournamentMatch[],
    matches: Match[]
  ): TournamentRound[] {
    const groups = new Map<string, TournamentRound>()

    for (const match of tournamentMatches) {
      const key = `${match.bracket}-${match.round ?? 0}`

      if (!groups.has(key)) {
        groups.set(key, {
          bracket: match.bracket,
          matches: [],
          round: match.round ?? 0,
        })
      }

      const group = groups.get(key)!
      group.matches.push({
        ...match,
        matchDetails: matches.find(m => m.id === match.match) ?? null,
      })
    }

    return Array.from(groups.values())
  }

  private static async generateTournamentStructure({
    session,
    name,
    description,
    groupsCount,
    advancementCount,
    eliminationType,
    groupStageTracks,
  }:
    | EventReq<'create_tournament'>
    | EventReq<'get_tournament_preview'>): Promise<TournamentStructure> {
    const tournament = {
      id: randomUUID(),
      session,
      name,
      description: description === '' ? null : (description ?? null),
      groupsCount,
      advancementCount,
      eliminationType,
      updatedAt: null,
      createdAt: new Date(),
      deletedAt: null,
    }

    const playerIds = (await SessionManager.getSessionSignups(session))
      .filter(s => s.response === 'yes')
      .map(s => s.user.id)

    const { groups, groupPlayers } = await GroupManager.generateGroups(
      tournament.id,
      groupsCount,
      playerIds
    )

    const { tournamentMatches, matches, groupStageRounds } =
      await TournamentMatchManager.createGroupMatches(
        tournament.id,
        session,
        groups,
        groupPlayers,
        groupStageTracks
      )

    const bracketTournamentMatches =
      TournamentMatchManager.generateBracketSlots(
        tournament.id,
        groups,
        advancementCount,
        eliminationType,
        tournamentMatches.length
      )

    return {
      tournament,
      groups,
      groupPlayers,
      tournamentMatches,
      matches,
    }
  }

  private static insertInDatabase(
    tournamentDraft: CreateTournament,
    groupDrafts: CreateGroup[],
    groupPlayerDrafts: CreateGroupPlayer[],
    matchDrafts: CreateMatch[],
    tournamentMatchDrafts: TournamentMatch[]
  ) {
    database.transaction(() => {
      db.insert(tournaments).values(tournamentDraft).run()
      db.insert(groups).values(groupDrafts).run()
      db.insert(groupPlayers).values(groupPlayerDrafts).run()
      db.insert(matches).values(matchDrafts).run()
      db.insert(tournamentMatches).values(tournamentMatchDrafts).run()
    })()
  }

  public static async onMatchUpdated(match: Match, date: Date) {
    if (match.status !== 'completed') return

    const tournamentMatch = await db.query.tournamentMatches.findFirst({
      where: and(
        eq(tournamentMatches.match, match.id),
        isNull(tournamentMatches.deletedAt)
      ),
    })

    if (!tournamentMatch) return

    if (!match.winner) {
      // TODO: Handle removal of winner, if any
      throw new Error('Match has no winner')
    }

    const loser = match.user1 === match.winner ? match.user2 : match.user1
    if (!loser) throw new Error(loc.no.error.messages.loser_not_found)

    await db
      .update(tournamentMatches)
      .set({ completedAt: date })
      .where(eq(tournamentMatches.id, tournamentMatch.id))

    if (tournamentMatch.group) {
      const isGroupComplete = await GroupManager.incrementGroupWinLoseStats(
        tournamentMatch.group,
        {
          ...match,
          winner: match.winner,
        }
      )

      if (isGroupComplete) {
        return await TournamentMatchManager.resolveGroupDependentMatches(
          tournamentMatch.group,
          match.session
        )
      }
      return
    }

    return await TournamentMatchManager.resolveMatchDependentMatches(
      match.id,
      match.session
    )
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

    const tournamentStructure =
      await TournamentManager.generateTournamentStructure(request)

    TournamentManager.insertInDatabase(
      tournamentStructure.tournament,
      tournamentStructure.groups,
      tournamentStructure.groupPlayers,
      tournamentStructure.matches,
      tournamentStructure.tournamentMatches
    )

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

    const tournamentStructure =
      await TournamentManager.generateTournamentStructure(request)

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Created tournament preview',
      request.name
    )

    return {
      success: true,
      tournament:
        await TournamentManager.toTournamentWithDetails(tournamentStructure),
    }
  }

  static async onEditTournament(
    socket: TypedSocket,
    request: EventReq<'edit_tournament'>
  ): Promise<EventRes<'edit_tournament'>> {
    if (!isEditTournamentRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('EditTournamentRequest')
      )
    }

    return { success: false, message: 'Not implemented' }
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

    return { success: false, message: 'Not implemented' }
  }
}
