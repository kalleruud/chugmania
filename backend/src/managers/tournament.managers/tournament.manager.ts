import loc from '@/lib/locales'
import db, { database } from '@backend/database/database'
import {
  groupPlayers,
  groups,
  matchDependencies,
  matches,
  stages,
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
  type CreateMatchDependency,
  type CreateStage,
  type CreateTournament,
  type Group,
  type GroupPlayer,
  type GroupWithPlayers,
  type MatchDependency,
  type Stage,
  type Tournament,
  type TournamentMatch,
  type TournamentMatchWithDetails,
  type TournamentStage,
  type TournamentWithDetails,
} from '@common/models/tournament'
import { and, eq, inArray, isNull } from 'drizzle-orm'
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
  stages: Stage[]
  tournamentMatches: TournamentMatch[]
  matches: Match[]
  matchDependencies: MatchDependency[]
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
    const {
      stages: stageRows,
      tournamentMatches: tmRows,
      matches: matchRows,
    } = await TournamentMatchManager.getAll(tournamentId)

    // Get match dependencies
    const tmIds = tmRows.map(tm => tm.id)
    const deps =
      tmIds.length > 0
        ? await db.query.matchDependencies.findMany({
            where: and(
              inArray(matchDependencies.toMatch, tmIds),
              isNull(matchDependencies.deletedAt)
            ),
          })
        : []

    return {
      tournament,
      groups,
      groupPlayers,
      stages: stageRows,
      tournamentMatches: tmRows,
      matches: matchRows,
      matchDependencies: deps,
    }
  }

  private static async toTournamentWithDetails({
    tournament,
    groups,
    groupPlayers,
    stages: stageRows,
    tournamentMatches,
    matches,
    matchDependencies: deps,
  }: TournamentStructure): Promise<TournamentWithDetails> {
    // Find group stages and compute wins/losses for group players
    const groupStages = stageRows.filter(s => s.level === 'group')
    const groupStageIds = new Set(groupStages.map(s => s.id))

    const groupMatches = tournamentMatches
      .filter(tm => groupStageIds.has(tm.stage))
      .map(tm => matches.find(m => m.id === tm.match))
      .filter((m): m is Match => m !== undefined && m.winner !== null)

    const groupsWithPlayers: GroupWithPlayers[] = groups.map(group => {
      const playersInGroup = groupPlayers.filter(gp => gp.group === group.id)
      const groupUserIds = new Set(playersInGroup.map(gp => gp.user))

      // Filter matches to only those within this group
      const groupOnlyMatches = groupMatches.filter(
        m =>
          m.userA &&
          m.userB &&
          groupUserIds.has(m.userA) &&
          groupUserIds.has(m.userB)
      )

      return {
        ...group,
        players: playersInGroup.map(gp => {
          const wins = groupOnlyMatches.filter(m => {
            const winnerId = m.winner === 'A' ? m.userA : m.userB
            return winnerId === gp.user
          }).length

          const losses = groupOnlyMatches.filter(m => {
            const loserId = m.winner === 'A' ? m.userB : m.userA
            return loserId === gp.user
          }).length

          return {
            ...gp,
            wins,
            losses,
          }
        }),
      }
    })

    // Group tournament matches by stage
    const stagesWithMatches = TournamentManager.generateStages(
      stageRows,
      tournamentMatches,
      matches,
      deps,
      groups
    )

    // Calculate min and max matches per player
    const { min, max } = TournamentMatchManager.calculateMinMaxMatchesPerPlayer(
      {
        groups: groupsWithPlayers,
        advancementCount: tournament.advancementCount,
        eliminationType: tournament.eliminationType,
      }
    )

    // Calculate recommended number of tracks for group stage
    const groupStageTrackCount = Math.ceil(groupStages.length / 2)

    return {
      ...tournament,
      maxMatchesPerPlayer: max,
      minMatchesPerPlayer: min,
      groupStageTrackCount,
      groups: groupsWithPlayers,
      stages: stagesWithMatches,
    }
  }

  private static generateStages(
    stageRows: Stage[],
    tournamentMatches: TournamentMatch[],
    matches: Match[],
    dependencies: MatchDependency[],
    groups: Group[]
  ): TournamentStage[] {
    return stageRows.map(stageRow => {
      const tmsInStage = tournamentMatches.filter(
        tm => tm.stage === stageRow.id
      )

      const matchesWithDetails: TournamentMatchWithDetails[] = tmsInStage.map(
        tm => {
          const matchDetails = matches.find(m => m.id === tm.match)!

          const depsForMatch = dependencies.filter(d => d.toMatch === tm.id)
          const depA = depsForMatch.find(d => d.toSlot === 'A')
          const depB = depsForMatch.find(d => d.toSlot === 'B')

          const dependencyNames =
            depA && depB
              ? {
                  A: TournamentManager.getDependencyName(
                    depA,
                    tournamentMatches,
                    stageRows,
                    groups
                  )!,
                  B: TournamentManager.getDependencyName(
                    depB,
                    tournamentMatches,
                    stageRows,
                    groups
                  )!,
                }
              : null

          return {
            id: tm.id,
            updatedAt: tm.updatedAt,
            createdAt: tm.createdAt,
            deletedAt: tm.deletedAt,
            match: tm.match,
            stage: stageRow,
            index: tm.index,
            matchDetails,
            dependencyNames,
          } satisfies TournamentMatchWithDetails
        }
      )

      return {
        stage: stageRow,
        matches: matchesWithDetails,
      }
    })
  }

  private static getDependencyName(
    dep: MatchDependency | undefined,
    tournamentMatches: TournamentMatch[],
    stageRows: Stage[],
    groups: Group[]
  ): string | null {
    if (!dep) return null

    // Source from group
    if (dep.fromGroup) {
      const group = groups.find(g => g.id === dep.fromGroup)
      const groupIndex = group?.index ?? 0
      return loc.no.tournament.sourceGroupPlaceholder(
        groupIndex,
        dep.fromPosition
      )
    }

    // Source from match
    if (dep.fromMatch) {
      const sourceTm = tournamentMatches.find(t => t.id === dep.fromMatch)
      if (sourceTm) {
        const sourceStage = stageRows.find(s => s.id === sourceTm.stage)
        if (sourceStage) {
          const stageName = TournamentManager.getStageName(sourceStage)
          const matchName = loc.no.tournament.bracketMatchName(
            stageName,
            sourceTm.index + 1
          )
          return loc.no.tournament.sourceMatchPlaceholder(
            matchName,
            dep.fromPosition
          )
        }
      }
    }

    return null
  }

  private static getStageName(stage: Stage): string {
    if (stage.level) {
      return loc.no.match.stageNames[stage.level]
    }
    return `${loc.no.match.round} ${stage.index + 1}`
  }

  private static async generateTournamentStructure({
    session,
    name,
    description,
    groupsCount,
    advancementCount,
    eliminationType,
    groupStageTracks,
    bracketTracks,
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

    const {
      stages: groupStages,
      tournamentMatches: groupTMs,
      matches: groupMatches,
      matchDependencies: groupDeps,
    } = TournamentMatchManager.createGroupMatches(
      tournament.id,
      session,
      groups,
      groupPlayers,
      groupStageTracks
    )

    const {
      stages: bracketStages,
      tournamentMatches: bracketTMs,
      matches: bracketMatches,
      matchDependencies: bracketDeps,
    } = TournamentMatchManager.generateBracketMatches(
      tournament.id,
      session,
      groups,
      advancementCount,
      eliminationType,
      groupStages.length,
      bracketTracks
    )

    return {
      tournament,
      groups,
      groupPlayers,
      stages: [...groupStages, ...bracketStages],
      tournamentMatches: [...groupTMs, ...bracketTMs],
      matches: [...groupMatches, ...bracketMatches],
      matchDependencies: [...groupDeps, ...bracketDeps],
    }
  }

  private static insertInDatabase(
    tournamentDraft: CreateTournament,
    groupDrafts: CreateGroup[],
    groupPlayerDrafts: CreateGroupPlayer[],
    stageDrafts: CreateStage[],
    matchDrafts: CreateMatch[],
    tournamentMatchDrafts: TournamentMatch[],
    matchDependencyDrafts: CreateMatchDependency[]
  ) {
    database.transaction(() => {
      db.insert(tournaments).values(tournamentDraft).run()
      if (groupDrafts.length > 0) {
        db.insert(groups).values(groupDrafts).run()
      }
      if (groupPlayerDrafts.length > 0) {
        db.insert(groupPlayers).values(groupPlayerDrafts).run()
      }
      if (stageDrafts.length > 0) {
        db.insert(stages).values(stageDrafts).run()
      }
      if (matchDrafts.length > 0) {
        db.insert(matches).values(matchDrafts).run()
      }
      if (tournamentMatchDrafts.length > 0) {
        db.insert(tournamentMatches).values(tournamentMatchDrafts).run()
      }
      if (matchDependencyDrafts.length > 0) {
        db.insert(matchDependencies).values(matchDependencyDrafts).run()
      }
    })()
  }

  public static async onMatchUpdated(match: Match, _date: Date) {
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

    // Find the stage to determine if this is a group stage match
    const stage = await db.query.stages.findFirst({
      where: eq(stages.id, tournamentMatch.stage),
    })

    if (!stage) return

    if (stage.level === 'group') {
      // Find the group for this match by looking at the players
      const userA = match.userA
      const userB = match.userB

      if (!userA || !userB) return

      // Find which group these players belong to
      const gpA = await db.query.groupPlayers.findFirst({
        where: and(
          eq(groupPlayers.user, userA),
          isNull(groupPlayers.deletedAt)
        ),
      })

      if (!gpA) return

      const isGroupComplete = await GroupManager.isGroupComplete(gpA.group)

      if (isGroupComplete) {
        return await TournamentMatchManager.resolveGroupDependentMatches(
          gpA.group,
          match.session
        )
      }
      return
    }

    // Bracket match: resolve dependent matches
    return await TournamentMatchManager.resolveMatchDependentMatches(
      tournamentMatch.id,
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
      tournamentStructure.stages,
      tournamentStructure.matches,
      tournamentStructure.tournamentMatches,
      tournamentStructure.matchDependencies
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

    const tournamentStructure = await TournamentManager.getTournamentStructure(
      request.id
    )

    const groupIds = tournamentStructure.groups.map(g => g.id)
    const stageIds = tournamentStructure.stages.map(s => s.id)
    const matchIds = tournamentStructure.matches.map(m => m.id)
    const tmIds = tournamentStructure.tournamentMatches.map(tm => tm.id)

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
      }

      if (tmIds.length > 0) {
        db.update(tournamentMatches)
          .set({ deletedAt })
          .where(
            and(
              inArray(tournamentMatches.id, tmIds),
              isNull(tournamentMatches.deletedAt)
            )
          )
          .run()

        db.update(matchDependencies)
          .set({ deletedAt })
          .where(
            and(
              inArray(matchDependencies.toMatch, tmIds),
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
