import type { Match } from '@common/models/match'
import type { EventReq, EventRes } from '@common/models/socket.io'
import type {
  CreateTournamentRequest,
  TournamentDetails,
  TournamentGroupDetails,
  TournamentMatchDetails,
  TournamentParticipantRanking,
} from '@common/models/tournament'
import {
  isCreateTournamentRequest,
  isGetTournamentDetailsRequest,
} from '@common/models/tournament'
import type { UserInfo } from '@common/models/user'
import { and, asc, eq, gt, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import loc from '../../../frontend/lib/locales'
import db, { database } from '../../database/database'
import {
  groupPlayers,
  groups,
  matches,
  sessionSignups,
  sessions,
  timeEntries,
  tournamentMatches,
  tournaments,
  tracks,
  users,
} from '../../database/schema'
import { broadcast, type TypedSocket } from '../server'
import AuthManager from './auth.manager'
import RatingManager from './rating.manager'
import UserManager from './user.manager'
import {
  assignParticipantsToGroupsSnake,
  buildGroupStandings,
  createRoundRobinGroupMatches,
  createSingleEliminationBracket,
  getSlotDependency,
  getSlotLabel,
  isPowerOfTwo,
  rankParticipantsByQualification,
  resolveMatchParticipants,
  type DraftGroup,
} from './tournament/tournament.helpers'

export default class TournamentManager {
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

    const tournament = await TournamentManager.createTournament(request)
    broadcast('tournament_details', tournament)

    return {
      success: true,
      tournament,
    }
  }

  static async onGetTournamentDetails(
    socket: TypedSocket,
    request: EventReq<'get_tournament_details'>
  ): Promise<EventRes<'get_tournament_details'>> {
    if (!isGetTournamentDetailsRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('GetTournamentDetailsRequest')
      )
    }

    await AuthManager.checkAuth(socket, undefined, true)

    return {
      success: true,
      tournament: await TournamentManager.getTournamentDetails(request.sessionId),
    }
  }

  static async onMatchUpdated(matchId: Match['id']): Promise<void> {
    const tournamentMatch = await db.query.tournamentMatches.findFirst({
      where: eq(tournamentMatches.match, matchId),
    })

    if (!tournamentMatch) {
      return
    }

    await TournamentManager.resolveTournamentSlots(tournamentMatch.tournament)

    const details = await TournamentManager.getTournamentDetailsById(
      tournamentMatch.tournament
    )
    broadcast('tournament_details', details)
  }

  static async getTournamentDetails(
    sessionId: string
  ): Promise<TournamentDetails | null> {
    const tournament = await db.query.tournaments.findFirst({
      where: and(
        eq(tournaments.session, sessionId),
        isNull(tournaments.deletedAt)
      ),
    })

    if (!tournament) {
      return null
    }

    return TournamentManager.getTournamentDetailsById(tournament.id)
  }

  private static async createTournament(
    request: CreateTournamentRequest
  ): Promise<TournamentDetails> {
    if ((request.eliminationType ?? 'single') !== 'single') {
      throw new Error(loc.no.tournament.error.invalid_elimination_type)
    }

    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.id, request.sessionId), isNull(sessions.deletedAt)),
    })

    if (!session) {
      throw new Error(loc.no.error.messages.not_in_db(request.sessionId))
    }

    if (session.status === 'cancelled') {
      throw new Error(loc.no.tournament.error.session_cancelled)
    }

    const existingTournament = await db.query.tournaments.findFirst({
      where: and(
        eq(tournaments.session, request.sessionId),
        isNull(tournaments.deletedAt)
      ),
    })

    if (existingTournament) {
      throw new Error(loc.no.tournament.error.duplicate_active)
    }

    if (request.groupsCount < 2) {
      throw new Error(loc.no.tournament.error.invalid_group_count)
    }

    if (request.advancementCount < 1) {
      throw new Error(loc.no.tournament.error.invalid_advancement_count)
    }

    const totalAdvancers = request.groupsCount * request.advancementCount
    if (!isPowerOfTwo(totalAdvancers) || totalAdvancers < 2) {
      throw new Error(loc.no.tournament.error.invalid_advancer_total)
    }

    const [qualificationTrack, tournamentTrack] = await Promise.all([
      db.query.tracks.findFirst({ where: eq(tracks.id, request.qualificationTrack) }),
      db.query.tracks.findFirst({ where: eq(tracks.id, request.tournamentTrack) }),
    ])

    if (!qualificationTrack || !tournamentTrack) {
      throw new Error(loc.no.tournament.error.missing_track)
    }

    const participants = await TournamentManager.getRankedParticipants(
      request.sessionId,
      request.qualificationTrack
    )

    if (participants.length < 4) {
      throw new Error(loc.no.tournament.error.min_participants)
    }

    if (participants.length < totalAdvancers) {
      throw new Error(loc.no.tournament.error.invalid_advancer_total)
    }

    const groupsDraft = assignParticipantsToGroupsSnake(
      participants,
      request.groupsCount,
      randomUUID
    )
    const groupMatchesDraft = createRoundRobinGroupMatches(
      groupsDraft,
      tournamentTrack.id,
      randomUUID
    )
    const bracketMatchesDraft = createSingleEliminationBracket(
      groupsDraft,
      request.advancementCount,
      tournamentTrack.id,
      randomUUID
    )
    const tournamentId = randomUUID()

    database.transaction(() => {
      db.insert(tournaments)
        .values({
          id: tournamentId,
          session: request.sessionId,
          qualificationTrack: request.qualificationTrack,
          name: request.name,
          description: request.description ?? null,
          groupsCount: request.groupsCount,
          advancementCount: request.advancementCount,
          eliminationType: 'single',
        })
        .run()

      db.insert(groups)
        .values(
          groupsDraft.map(group => ({
            id: group.id,
            tournament: tournamentId,
            name: group.name,
          }))
        )
        .run()

      db.insert(groupPlayers)
        .values(
          groupsDraft.flatMap(group =>
            group.players.map(player => ({
              id: randomUUID(),
              group: group.id,
              user: player.user.id,
              seed: player.qualificationRank,
            }))
          )
        )
        .run()

      const allDraftMatches = [...groupMatchesDraft, ...bracketMatchesDraft]

      db.insert(matches)
        .values(
          allDraftMatches.map(match => ({
            id: match.matchId,
            user1: match.user1,
            user2: match.user2,
            track: match.trackId,
            session: request.sessionId,
            winner: null,
            duration: null,
            stage: match.stage ?? undefined,
            comment: null,
            status: 'planned',
          }))
        )
        .run()

      db.insert(tournamentMatches)
        .values(
          allDraftMatches.map(match => ({
            id: match.id,
            tournament: tournamentId,
            group: match.groupId,
            name: match.name,
            bracket: match.bracket,
            stage: match.stage ?? undefined,
            round: match.round,
            sortOrder: match.sortOrder,
            match: match.matchId,
            track: match.trackId,
            completedAt: null,
            sourceGroupA:
              match.slotA?.type === 'group_rank' ? match.slotA.groupId : null,
            sourceGroupARank:
              match.slotA?.type === 'group_rank' ? match.slotA.rank : null,
            sourceGroupB:
              match.slotB?.type === 'group_rank' ? match.slotB.groupId : null,
            sourceGroupBRank:
              match.slotB?.type === 'group_rank' ? match.slotB.rank : null,
            sourceMatchA:
              match.slotA?.type === 'match_winner'
                ? match.slotA.tournamentMatchId
                : null,
            sourceMatchAProgression:
              match.slotA?.type === 'match_winner' ? 'winner' : null,
            sourceMatchB:
              match.slotB?.type === 'match_winner'
                ? match.slotB.tournamentMatchId
                : null,
            sourceMatchBProgression:
              match.slotB?.type === 'match_winner' ? 'winner' : null,
          }))
        )
        .run()
    })()

    await TournamentManager.resolveTournamentSlots(tournamentId)

    const details = await TournamentManager.getTournamentDetailsById(tournamentId)
    if (!details) {
      throw new Error(loc.no.error.messages.db_failed)
    }

    return details
  }

  private static async getRankedParticipants(
    sessionId: string,
    qualificationTrackId: string
  ): Promise<TournamentParticipantRanking[]> {
    const signupRows = await db
      .select({
        signupCreatedAt: sessionSignups.createdAt,
        user: users,
      })
      .from(sessionSignups)
      .innerJoin(users, eq(sessionSignups.user, users.id))
      .where(
        and(
          eq(sessionSignups.session, sessionId),
          eq(sessionSignups.response, 'yes'),
          isNull(sessionSignups.deletedAt),
          isNull(users.deletedAt)
        )
      )
      .orderBy(asc(sessionSignups.createdAt), asc(users.createdAt))

    const userIds = signupRows.map(row => row.user.id)
    if (userIds.length === 0) {
      return []
    }

    const rankingRows = await RatingManager.onGetRatings()
    const rankingByUserId = new Map(
      rankingRows.map(ranking => [ranking.user, ranking.ranking])
    )

    const qualificationRows = await db
      .select({
        user: timeEntries.user,
        qualificationDuration:
          sql<number>`min(${timeEntries.duration})`.as('qualification_duration'),
      })
      .from(timeEntries)
      .where(
        and(
          inArray(timeEntries.user, userIds),
          eq(timeEntries.track, qualificationTrackId),
          isNull(timeEntries.deletedAt),
          isNotNull(timeEntries.duration),
          gt(timeEntries.duration, 0)
        )
      )
      .groupBy(timeEntries.user)

    const qualificationByUserId = new Map(
      qualificationRows.map(row => [row.user, row.qualificationDuration])
    )

    return rankParticipantsByQualification(
      signupRows.map(row => ({
        user: UserManager.toUserInfo(row.user).userInfo,
        qualificationRank: 0,
        qualificationDuration: qualificationByUserId.get(row.user.id) ?? null,
        globalRanking: rankingByUserId.get(row.user.id) ?? null,
      }))
    )
  }

  private static async getTournamentDetailsById(
    tournamentId: string
  ): Promise<TournamentDetails | null> {
    const tournament = await db.query.tournaments.findFirst({
      where: and(eq(tournaments.id, tournamentId), isNull(tournaments.deletedAt)),
    })

    if (!tournament) {
      return null
    }

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, tournament.session),
    })
    const qualificationTrack = await db.query.tracks.findFirst({
      where: eq(tracks.id, tournament.qualificationTrack),
    })

    if (!session || !qualificationTrack) {
      throw new Error(loc.no.error.messages.db_failed)
    }

    const [groupRows, groupPlayerRows, tournamentMatchRows] = await Promise.all([
      db
        .select()
        .from(groups)
        .where(eq(groups.tournament, tournament.id))
        .orderBy(asc(groups.name)),
      db
        .select({
          id: groupPlayers.id,
          group: groupPlayers.group,
          user: users,
          seed: groupPlayers.seed,
          createdAt: groupPlayers.createdAt,
          updatedAt: groupPlayers.updatedAt,
          deletedAt: groupPlayers.deletedAt,
        })
        .from(groupPlayers)
        .innerJoin(users, eq(groupPlayers.user, users.id))
        .where(isNull(groupPlayers.deletedAt))
        .orderBy(asc(groupPlayers.seed), asc(groupPlayers.createdAt)),
      db
        .select({
          tournamentMatch: tournamentMatches,
          match: matches,
        })
        .from(tournamentMatches)
        .leftJoin(matches, eq(tournamentMatches.match, matches.id))
        .where(eq(tournamentMatches.tournament, tournament.id))
        .orderBy(asc(tournamentMatches.sortOrder), asc(tournamentMatches.createdAt)),
    ])

    const groupIds = new Set(groupRows.map(group => group.id))
    const filteredGroupPlayerRows = groupPlayerRows.filter(player =>
      groupIds.has(player.group)
    )

    const participants = await TournamentManager.getPersistedParticipantRankings(
      filteredGroupPlayerRows.map(player => ({
        user: UserManager.toUserInfo(player.user).userInfo,
        qualificationRank: player.seed,
      })),
      tournament.qualificationTrack
    )

    const participantsById = new Map(
      participants.map(participant => [participant.user.id, participant])
    )
    const groupsById = new Map(groupRows.map(group => [group.id, group]))
    const tournamentMatchesById = new Map(
      tournamentMatchRows.map(row => [row.tournamentMatch.id, row.tournamentMatch])
    )

    const groupMatchRows = tournamentMatchRows.filter(
      row => row.tournamentMatch.bracket === 'group' && row.match
    ) as Array<{ tournamentMatch: typeof tournamentMatches.$inferSelect; match: Match }>

    const groupDetails: TournamentGroupDetails[] = groupRows.map(group => {
      const players = filteredGroupPlayerRows
        .filter(player => player.group === group.id)
        .sort((left, right) => left.seed - right.seed)
        .map(player => participantsById.get(player.user.id))
        .filter(
          (player): player is TournamentParticipantRanking => player !== undefined
        )

      const standings = buildGroupStandings(
        {
          id: group.id,
          name: group.name,
          players,
        },
        groupMatchRows
          .filter(row => row.tournamentMatch.group === group.id)
          .map(row => row.match)
      ).map((standing, index) => ({
        ...standing,
        advanced: index < tournament.advancementCount,
      }))

      return {
        group,
        players,
        standings,
      }
    })

    const standingsByGroupId = new Map(
      groupDetails.map(group => [group.group.id, group.standings])
    )

    const buildMatchDetails = (
      row: { tournamentMatch: typeof tournamentMatches.$inferSelect; match: Match | null }
    ): TournamentMatchDetails | null => {
      if (!row.match) {
        return null
      }

      const slotA = getSlotDependency(
        row.tournamentMatch,
        'A',
        groupsById,
        tournamentMatchesById
      )
      const slotB = getSlotDependency(
        row.tournamentMatch,
        'B',
        groupsById,
        tournamentMatchesById
      )

      return {
        tournamentMatch: row.tournamentMatch,
        match: row.match,
        slotA,
        slotB,
        slotLabelA: getSlotLabel(slotA, participantsById, row.match.user1 ?? null),
        slotLabelB: getSlotLabel(slotB, participantsById, row.match.user2 ?? null),
      }
    }

    const groupMatches = tournamentMatchRows
      .filter(row => row.tournamentMatch.bracket === 'group')
      .map(buildMatchDetails)
      .filter((row): row is TournamentMatchDetails => row !== null)

    const bracketMatches = tournamentMatchRows
      .filter(row => row.tournamentMatch.bracket !== 'group')
      .map(buildMatchDetails)
      .filter((row): row is TournamentMatchDetails => row !== null)

    const tournamentTrackId =
      groupMatches[0]?.match.track ?? bracketMatches[0]?.match.track ?? null
    const tournamentTrack = tournamentTrackId
      ? await db.query.tracks.findFirst({ where: eq(tracks.id, tournamentTrackId) })
      : null

    const groupMatchesCompleted = groupMatches.filter(
      row => row.match.status === 'completed'
    ).length
    const bracketMatchesCompleted = bracketMatches.filter(
      row => row.match.status === 'completed'
    ).length
    const resolvedBracketSlots = bracketMatches.reduce((count, match) => {
      return count + Number(match.match.user1 !== null) + Number(match.match.user2 !== null)
    }, 0)

    const details: TournamentDetails = {
      tournament,
      session,
      qualificationTrack,
      tournamentTrack: tournamentTrack ?? null,
      participants,
      groups: groupDetails,
      groupMatches,
      bracketMatches,
      progress: {
        groupMatchesCompleted,
        groupMatchesTotal: groupMatches.length,
        bracketMatchesCompleted,
        bracketMatchesTotal: bracketMatches.length,
        resolvedBracketSlots,
        totalBracketSlots: bracketMatches.length * 2,
      },
      workload: {
        participantCount: participants.length,
        totalScheduledMatches: groupMatches.length + bracketMatches.length,
        groupStageMatches: groupMatches.length,
        bracketStageMatches: bracketMatches.length,
      },
    }

    return details
  }

  private static async resolveTournamentSlots(
    tournamentId: string
  ): Promise<void> {
    const [groupRows, groupPlayerRows, tournamentMatchRows] = await Promise.all([
      db
        .select()
        .from(groups)
        .where(eq(groups.tournament, tournamentId))
        .orderBy(asc(groups.name)),
      db
        .select({
          group: groupPlayers.group,
          seed: groupPlayers.seed,
          user: users,
        })
        .from(groupPlayers)
        .innerJoin(users, eq(groupPlayers.user, users.id))
        .where(isNull(groupPlayers.deletedAt))
        .orderBy(asc(groupPlayers.seed), asc(groupPlayers.createdAt)),
      db
        .select({
          id: tournamentMatches.id,
          name: tournamentMatches.name,
          bracket: tournamentMatches.bracket,
          sortOrder: tournamentMatches.sortOrder,
          sourceGroupA: tournamentMatches.sourceGroupA,
          sourceGroupARank: tournamentMatches.sourceGroupARank,
          sourceGroupB: tournamentMatches.sourceGroupB,
          sourceGroupBRank: tournamentMatches.sourceGroupBRank,
          sourceMatchA: tournamentMatches.sourceMatchA,
          sourceMatchAProgression: tournamentMatches.sourceMatchAProgression,
          sourceMatchB: tournamentMatches.sourceMatchB,
          sourceMatchBProgression: tournamentMatches.sourceMatchBProgression,
          match: matches,
          group: tournamentMatches.group,
        })
        .from(tournamentMatches)
        .innerJoin(matches, eq(tournamentMatches.match, matches.id))
        .where(eq(tournamentMatches.tournament, tournamentId))
        .orderBy(asc(tournamentMatches.sortOrder), asc(tournamentMatches.createdAt)),
    ])

    const groupsDraft: DraftGroup[] = groupRows.map(group => ({
      id: group.id,
      name: group.name,
      players: groupPlayerRows
        .filter(player => player.group === group.id)
        .map(player => ({
          user: UserManager.toUserInfo(player.user).userInfo,
          qualificationRank: player.seed,
          qualificationDuration: null,
          globalRanking: null,
        })),
    }))

    const standingsByGroupId = new Map(
      groupsDraft.map(group => [
        group.id,
        buildGroupStandings(
          group,
          tournamentMatchRows
            .filter(row => row.group === group.id)
            .map(row => row.match)
        ),
      ])
    )

    const resolvedMatches = resolveMatchParticipants(
      tournamentMatchRows.map(row => ({
        id: row.id,
        name: row.name,
        bracket: row.bracket,
        sourceGroupA: row.sourceGroupA,
        sourceGroupARank: row.sourceGroupARank,
        sourceGroupB: row.sourceGroupB,
        sourceGroupBRank: row.sourceGroupBRank,
        sourceMatchA: row.sourceMatchA,
        sourceMatchAProgression: row.sourceMatchAProgression,
        sourceMatchB: row.sourceMatchB,
        sourceMatchBProgression: row.sourceMatchBProgression,
        sortOrder: row.sortOrder,
        match: row.match,
      })),
      standingsByGroupId
    )

    database.transaction(() => {
      for (const resolvedMatch of resolvedMatches) {
        const source = tournamentMatchRows.find(row => row.id === resolvedMatch.tournamentMatchId)
        if (!source) {
          continue
        }

        const nextWinner =
          source.match.winner === resolvedMatch.user1 ||
          source.match.winner === resolvedMatch.user2
            ? source.match.winner
            : null
        const nextStatus =
          source.match.status === 'cancelled'
            ? 'cancelled'
            : source.match.status === 'completed' && nextWinner
              ? 'completed'
              : 'planned'

        db.update(matches)
          .set({
            user1: resolvedMatch.user1,
            user2: resolvedMatch.user2,
            winner: nextWinner,
            status: nextStatus,
          })
          .where(eq(matches.id, resolvedMatch.matchId))
          .run()

        db.update(tournamentMatches)
          .set({
            completedAt: nextStatus === 'completed' ? source.match.updatedAt : null,
          })
          .where(eq(tournamentMatches.id, resolvedMatch.tournamentMatchId))
          .run()
      }
    })()
  }

  private static async getPersistedParticipantRankings(
    seededParticipants: Array<{
      user: UserInfo
      qualificationRank: number
    }>,
    qualificationTrackId: string
  ): Promise<TournamentParticipantRanking[]> {
    const userIds = seededParticipants.map(participant => participant.user.id)
    if (userIds.length === 0) {
      return []
    }

    const rankingRows = await RatingManager.onGetRatings()
    const rankingByUserId = new Map(
      rankingRows.map(ranking => [ranking.user, ranking.ranking])
    )
    const qualificationRows = await db
      .select({
        user: timeEntries.user,
        qualificationDuration:
          sql<number>`min(${timeEntries.duration})`.as('qualification_duration'),
      })
      .from(timeEntries)
      .where(
        and(
          inArray(timeEntries.user, userIds),
          eq(timeEntries.track, qualificationTrackId),
          isNull(timeEntries.deletedAt),
          isNotNull(timeEntries.duration),
          gt(timeEntries.duration, 0)
        )
      )
      .groupBy(timeEntries.user)

    const qualificationByUserId = new Map(
      qualificationRows.map(row => [row.user, row.qualificationDuration])
    )

    return seededParticipants
      .map(participant => ({
        user: participant.user,
        qualificationRank: participant.qualificationRank,
        qualificationDuration:
          qualificationByUserId.get(participant.user.id) ?? null,
        globalRanking: rankingByUserId.get(participant.user.id) ?? null,
      }))
      .sort((left, right) => left.qualificationRank - right.qualificationRank)
  }
}
