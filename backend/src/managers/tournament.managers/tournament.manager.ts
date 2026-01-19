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
    // Fetch tournament
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
    })

    if (!tournament) {
      throw new Error(`Tournament ${tournamentId} not found`)
    }

    // Fetch all groups with players
    const groupsWithPlayers = await GroupManager.getAll(tournamentId)

    // Fetch all stages for this tournament
    const stagesData = await db.query.stages.findMany({
      where: and(eq(stages.tournament, tournamentId), isNull(stages.deletedAt)),
    })

    const stageIds = stagesData.map(s => s.id)

    // Fetch all matches for this tournament (only those in stages)
    const allMatches = await db.query.matches.findMany({
      where: and(inArray(matches.stage, stageIds), isNull(matches.deletedAt)),
    })

    // Filter to ensure all matches have a stage (non-null)
    const matchesWithStage = allMatches.filter(
      (m): m is typeof m & { stage: string } => m.stage !== null
    )

    // Fetch all match dependencies for bracket structure
    const allDependencies = await db.query.matchDependencies.findMany({
      where: and(
        or(
          inArray(
            matchDependencies.toMatch,
            matchesWithStage.map(m => m.id)
          ),
          inArray(
            matchDependencies.fromMatch,
            matchesWithStage.map(m => m.id)
          ),
          inArray(
            matchDependencies.fromGroup,
            groupsWithPlayers.map(g => g.id)
          )
        ),
        isNull(matchDependencies.deletedAt)
      ),
    })

    // Build dependency map: matchId -> dependencies targeting it
    const dependenciesByToMatch = new Map<string, typeof allDependencies>()
    for (const dep of allDependencies) {
      const existing = dependenciesByToMatch.get(dep.toMatch) || []
      existing.push(dep)
      dependenciesByToMatch.set(dep.toMatch, existing)
    }

    // Enrich matches with dependency names (ensure index is non-null)
    const enrichedMatches = matchesWithStage
      .filter((m): m is typeof m & { index: number } => m.index !== null)
      .map(match => {
        const deps = dependenciesByToMatch.get(match.id) || []
        const depsBySlot = new Map<string, string>()

        for (const dep of deps) {
          let source: string
          if (dep.fromGroup) {
            source = `Group ${dep.fromPosition}`
          } else if (dep.fromMatch) {
            source = 'Match Winner'
          } else {
            source = 'Unknown'
          }
          depsBySlot.set(dep.toSlot, source)
        }

        return {
          ...match,
          dependencyNames:
            depsBySlot.size === 2
              ? {
                  A: depsBySlot.get('A') || 'Unknown',
                  B: depsBySlot.get('B') || 'Unknown',
                }
              : null,
        }
      })

    // Group enriched matches by stage
    const matchesByStage = new Map<string, typeof enrichedMatches>()
    for (const stage of stagesData) {
      matchesByStage.set(
        stage.id,
        enrichedMatches.filter(m => m.stage === stage.id)
      )
    }

    // Build TournamentStage array, sorted by stage index
    const sortedStages = stagesData.toSorted((a, b) => a.index - b.index)
    const tournamentStages = sortedStages.map(stage => ({
      stage,
      matches: matchesByStage.get(stage.id) || [],
    }))

    // Calculate min/max matches per player
    const { min: minMatchesPerPlayer, max: maxMatchesPerPlayer } =
      TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
        groups: groupsWithPlayers,
        advancementCount: tournament.advancementCount,
        eliminationType: tournament.eliminationType,
      })

    // Count unique group stage tracks
    const groupStageIds = stagesData
      .filter(s => s.level === 'group')
      .map(s => s.id)
    const groupStageTracks = new Set<string>()

    if (groupStageIds.length > 0) {
      const groupStageMatches = enrichedMatches.filter(m =>
        groupStageIds.includes(m.stage || '')
      )
      for (const match of groupStageMatches) {
        if (match.track) {
          groupStageTracks.add(match.track)
        }
      }
    }

    return {
      ...tournament,
      minMatchesPerPlayer,
      maxMatchesPerPlayer,
      groupStageTrackCount: groupStageTracks.size,
      groups: groupsWithPlayers,
      stages: tournamentStages,
    }
  }

  private static async createTournament({
    id,
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
        id,
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

    await AuthManager.checkAuth(socket, ['admin', 'moderator'])

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
