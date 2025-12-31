import type { EventReq, EventRes } from '@common/models/socket.io'
import {
  isCreateTournamentRequest,
  isDeleteTournamentRequest,
  isEditTournamentRequest,
  type CreateTournamentRequest,
  type GroupPlayerWithUser,
  type GroupWithPlayers,
  type TournamentMatchWithMatch,
  type TournamentWithDetails,
} from '@common/models/tournament'
import { and, asc, desc, eq, getTableColumns, isNull } from 'drizzle-orm'
import loc from '../../../frontend/lib/locales'
import db from '../../database/database'
import {
  groupPlayers,
  groups,
  matches,
  sessionSignups,
  tournamentMatches,
  tournaments,
  users,
} from '../../database/schema'
import { broadcast, type TypedSocket } from '../server'
import AuthManager from './auth.manager'
import UserManager from './user.manager'

export default class TournamentManager {
  public static async getAllTournaments(): Promise<TournamentWithDetails[]> {
    const tournamentRows = await db
      .select()
      .from(tournaments)
      .where(isNull(tournaments.deletedAt))
      .orderBy(desc(tournaments.createdAt))

    if (!tournamentRows || tournamentRows.length === 0) {
      return []
    }

    return Promise.all(
      tournamentRows.map(async tournament => ({
        ...tournament,
        groups: await TournamentManager.getTournamentGroups(tournament.id),
        tournamentMatches: await TournamentManager.getTournamentMatches(
          tournament.id
        ),
      }))
    )
  }

  private static async getTournamentGroups(
    tournamentId: string
  ): Promise<GroupWithPlayers[]> {
    const groupRows = await db
      .select()
      .from(groups)
      .where(and(eq(groups.tournament, tournamentId), isNull(groups.deletedAt)))
      .orderBy(asc(groups.name))

    if (!groupRows || groupRows.length === 0) {
      return []
    }

    return Promise.all(
      groupRows.map(async group => ({
        ...group,
        players: await TournamentManager.getGroupPlayers(group.id),
      }))
    )
  }

  private static async getGroupPlayers(
    groupId: string
  ): Promise<GroupPlayerWithUser[]> {
    const playerRows = await db
      .select({
        id: groupPlayers.id,
        createdAt: groupPlayers.createdAt,
        updatedAt: groupPlayers.updatedAt,
        deletedAt: groupPlayers.deletedAt,
        group: groupPlayers.group,
        seed: groupPlayers.seed,
        user: users,
      })
      .from(groupPlayers)
      .innerJoin(users, eq(groupPlayers.user, users.id))
      .where(
        and(
          eq(groupPlayers.group, groupId),
          isNull(users.deletedAt),
          isNull(groupPlayers.deletedAt)
        )
      )
      .orderBy(asc(groupPlayers.seed))

    if (!playerRows || playerRows.length === 0) {
      return []
    }

    return playerRows.map(row => ({
      ...row,
      user: UserManager.toUserInfo(row.user).userInfo,
    }))
  }

  private static async getTournamentMatches(
    tournamentId: string
  ): Promise<TournamentMatchWithMatch[]> {
    const matchRows = await db
      .select({
        ...getTableColumns(tournamentMatches),
        match: matches,
      })
      .from(tournamentMatches)
      .leftJoin(matches, eq(tournamentMatches.match, matches.id))
      .where(
        and(
          eq(tournamentMatches.tournament, tournamentId),
          isNull(tournamentMatches.deletedAt)
        )
      )
      .orderBy(asc(tournamentMatches.round), asc(tournamentMatches.createdAt))

    return matchRows.map(row => ({
      ...row,
      match: row.match || null,
    }))
  }

  private static async generateTournamentStructure(
    request: CreateTournamentRequest
  ): Promise<string> {
    const sessionId = request.session
    const groupsCount = request.groupsCount
    const advancementCount = request.advancementCount
    const eliminationType = request.eliminationType

    const signups = await db
      .select({
        user: sessionSignups.user,
      })
      .from(sessionSignups)
      .where(
        and(
          eq(sessionSignups.session, sessionId),
          eq(sessionSignups.response, 'yes'),
          isNull(sessionSignups.deletedAt)
        )
      )

    if (signups.length === 0) {
      throw new Error('No players found for tournament')
    }

    const [tournament] = await db
      .insert(tournaments)
      .values({
        session: sessionId,
        name: request.name,
        description: request.description,
        groupsCount,
        advancementCount,
        eliminationType,
      })
      .returning()

    const tournamentId = tournament.id

    const playerIds = signups.map(s => s.user)
    const shuffledPlayers = playerIds.sort(() => Math.random() - 0.5)

    const createdGroups: { id: string; name: string }[] = []
    for (let i = 0; i < groupsCount; i++) {
      const groupName = String.fromCharCode(65 + i)
      const [group] = await db
        .insert(groups)
        .values({
          tournament: tournamentId,
          name: `Group ${groupName}`,
        })
        .returning()

      createdGroups.push(group)
    }

    shuffledPlayers.forEach((playerId, index) => {
      const groupIndex = index % groupsCount
      const seed = Math.floor(index / groupsCount) + 1

      db.insert(groupPlayers)
        .values({
          group: createdGroups[groupIndex].id,
          user: playerId,
          seed,
        })
        .run()
    })

    await TournamentManager.generateGroupStageMatches(
      tournamentId,
      createdGroups
    )

    await TournamentManager.generateBracketStructure(
      tournamentId,
      createdGroups,
      advancementCount,
      eliminationType
    )

    return tournamentId
  }

  private static async generateGroupStageMatches(
    tournamentId: string,
    tournamentGroups: { id: string; name: string }[]
  ): Promise<void> {
    for (const group of tournamentGroups) {
      const players = await db
        .select()
        .from(groupPlayers)
        .where(
          and(eq(groupPlayers.group, group.id), isNull(groupPlayers.deletedAt))
        )

      for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
          const [match] = await db
            .insert(matches)
            .values({
              user1: players[i].user,
              user2: players[j].user,
              status: 'planned',
            })
            .returning()

          await db.insert(tournamentMatches).values({
            tournament: tournamentId,
            name: `${group.name}: ${i + 1} vs ${j + 1}`,
            bracket: 'group',
            round: 0,
            match: match.id,
          })
        }
      }
    }
  }

  private static async generateBracketStructure(
    tournamentId: string,
    tournamentGroups: { id: string; name: string }[],
    advancementCount: number,
    eliminationType: 'single' | 'double'
  ): Promise<void> {
    const totalAdvancing = tournamentGroups.length * advancementCount
    const rounds = Math.ceil(Math.log2(totalAdvancing))

    const bracketSize = Math.pow(2, rounds)

    const slots: Array<{
      sourceGroupA: string | null
      sourceGroupARank: number | null
      sourceGroupB: string | null
      sourceGroupBRank: number | null
      sourceMatchA: string | null
      sourceMatchAProgression: 'winner' | 'loser' | null
      sourceMatchB: string | null
      sourceMatchBProgression: 'winner' | 'loser' | null
    }> = []

    let seedIndex = 0
    for (let i = 0; i < bracketSize / 2; i++) {
      const slot1Index = seedIndex++
      const slot2Index = seedIndex++

      const groupA = tournamentGroups[slot1Index % tournamentGroups.length]
      const rankA = Math.floor(slot1Index / tournamentGroups.length) + 1

      const groupB = tournamentGroups[slot2Index % tournamentGroups.length]
      const rankB = Math.floor(slot2Index / tournamentGroups.length) + 1

      if (rankA <= advancementCount && rankB <= advancementCount) {
        slots.push({
          sourceGroupA: groupA.id,
          sourceGroupARank: rankA,
          sourceGroupB: groupB.id,
          sourceGroupBRank: rankB,
          sourceMatchA: null,
          sourceMatchAProgression: null,
          sourceMatchB: null,
          sourceMatchBProgression: null,
        })
      }
    }

    const createdMatchIds: string[] = []
    for (let i = 0; i < slots.length; i++) {
      const [tournamentMatch] = await db
        .insert(tournamentMatches)
        .values({
          tournament: tournamentId,
          name: `Upper Bracket - Round 1 - Match ${i + 1}`,
          bracket: 'upper',
          round: 1,
          match: null,
          ...slots[i],
        })
        .returning()

      createdMatchIds.push(tournamentMatch.id)
    }

    let currentRound = 1
    let currentMatches = createdMatchIds
    while (currentMatches.length > 1) {
      currentRound++
      const nextMatches: string[] = []

      for (let i = 0; i < currentMatches.length; i += 2) {
        const [tournamentMatch] = await db
          .insert(tournamentMatches)
          .values({
            tournament: tournamentId,
            name: `Upper Bracket - Round ${currentRound} - Match ${Math.floor(i / 2) + 1}`,
            bracket: 'upper',
            round: currentRound,
            match: null,
            sourceMatchA: currentMatches[i],
            sourceMatchAProgression: 'winner',
            sourceMatchB: currentMatches[i + 1] || null,
            sourceMatchBProgression: currentMatches[i + 1] ? 'winner' : null,
            sourceGroupA: null,
            sourceGroupARank: null,
            sourceGroupB: null,
            sourceGroupBRank: null,
          })
          .returning()

        nextMatches.push(tournamentMatch.id)
      }

      currentMatches = nextMatches
    }

    if (eliminationType === 'double') {
      await TournamentManager.generateLowerBracket(
        tournamentId,
        createdMatchIds.length
      )
    }
  }

  private static async generateLowerBracket(
    tournamentId: string,
    upperBracketFirstRoundSize: number
  ): Promise<void> {
    const upperBracketMatches = await db
      .select()
      .from(tournamentMatches)
      .where(
        and(
          eq(tournamentMatches.tournament, tournamentId),
          eq(tournamentMatches.bracket, 'upper'),
          isNull(tournamentMatches.deletedAt)
        )
      )
      .orderBy(asc(tournamentMatches.round))

    const lowerRounds: string[][] = []
    let previousLowerRoundMatches: string[] = []

    for (
      let upperRound = 1;
      upperRound <= Math.log2(upperBracketFirstRoundSize);
      upperRound++
    ) {
      const upperRoundMatches = upperBracketMatches.filter(
        m => m.round === upperRound
      )

      const lowerRoundMatchIds: string[] = []

      for (let i = 0; i < upperRoundMatches.length; i++) {
        const hasPartner = i < previousLowerRoundMatches.length

        const [lowerMatch] = await db
          .insert(tournamentMatches)
          .values({
            tournament: tournamentId,
            name: `Lower Bracket - Round ${lowerRounds.length + 1} - Match ${i + 1}`,
            bracket: 'lower',
            round: lowerRounds.length + 1,
            match: null,
            sourceMatchA: upperRoundMatches[i].id,
            sourceMatchAProgression: 'loser',
            sourceMatchB: hasPartner ? previousLowerRoundMatches[i] : null,
            sourceMatchBProgression: hasPartner ? 'winner' : null,
            sourceGroupA: null,
            sourceGroupARank: null,
            sourceGroupB: null,
            sourceGroupBRank: null,
          })
          .returning()

        lowerRoundMatchIds.push(lowerMatch.id)
      }

      lowerRounds.push(lowerRoundMatchIds)
      previousLowerRoundMatches = lowerRoundMatchIds
    }
  }

  public static async checkAndProgressMatches(matchId: string): Promise<void> {
    const completedMatch = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
    })

    if (
      !completedMatch ||
      completedMatch.status !== 'completed' ||
      !completedMatch.winner
    ) {
      return
    }

    const tournamentMatch = await db.query.tournamentMatches.findFirst({
      where: and(
        eq(tournamentMatches.match, matchId),
        isNull(tournamentMatches.deletedAt)
      ),
    })

    if (!tournamentMatch) {
      return
    }

    await db
      .update(tournamentMatches)
      .set({ completedAt: new Date() })
      .where(eq(tournamentMatches.id, tournamentMatch.id))

    const downstreamMatchesA = await db
      .select()
      .from(tournamentMatches)
      .where(
        and(
          eq(tournamentMatches.sourceMatchA, tournamentMatch.id),
          isNull(tournamentMatches.deletedAt)
        )
      )

    const downstreamMatchesB = await db
      .select()
      .from(tournamentMatches)
      .where(
        and(
          eq(tournamentMatches.sourceMatchB, tournamentMatch.id),
          isNull(tournamentMatches.deletedAt)
        )
      )

    const downstreamMatches = [...downstreamMatchesA, ...downstreamMatchesB]

    for (const downstream of downstreamMatches) {
      await TournamentManager.tryCreateDownstreamMatch(downstream)
    }

    broadcast('all_tournaments', await TournamentManager.getAllTournaments())
  }

  private static async tryCreateDownstreamMatch(
    tournamentMatch: typeof tournamentMatches.$inferSelect
  ): Promise<void> {
    if (tournamentMatch.match) {
      return
    }

    const user1 = await TournamentManager.resolveSlotUser(
      tournamentMatch.sourceGroupA,
      tournamentMatch.sourceGroupARank,
      tournamentMatch.sourceMatchA,
      tournamentMatch.sourceMatchAProgression
    )

    const user2 = await TournamentManager.resolveSlotUser(
      tournamentMatch.sourceGroupB,
      tournamentMatch.sourceGroupBRank,
      tournamentMatch.sourceMatchB,
      tournamentMatch.sourceMatchBProgression
    )

    if (!user1 || !user2) {
      return
    }

    const [newMatch] = await db
      .insert(matches)
      .values({
        user1,
        user2,
        status: 'planned',
      })
      .returning()

    await db
      .update(tournamentMatches)
      .set({ match: newMatch.id })
      .where(eq(tournamentMatches.id, tournamentMatch.id))
  }

  private static async resolveSlotUser(
    sourceGroup: string | null,
    sourceGroupRank: number | null,
    sourceMatch: string | null,
    sourceMatchProgression: 'winner' | 'loser' | null
  ): Promise<string | null> {
    if (sourceGroup && sourceGroupRank) {
      const players = await db
        .select()
        .from(groupPlayers)
        .where(
          and(
            eq(groupPlayers.group, sourceGroup),
            eq(groupPlayers.seed, sourceGroupRank),
            isNull(groupPlayers.deletedAt)
          )
        )

      if (players.length > 0) {
        return players[0].user
      }
    }

    if (sourceMatch && sourceMatchProgression) {
      const sourceTournamentMatch = await db.query.tournamentMatches.findFirst({
        where: eq(tournamentMatches.id, sourceMatch),
      })

      if (!sourceTournamentMatch?.match || !sourceTournamentMatch.completedAt) {
        return null
      }

      const match = await db.query.matches.findFirst({
        where: eq(matches.id, sourceTournamentMatch.match),
      })

      if (!match || match.status !== 'completed' || !match.winner) {
        return null
      }

      if (sourceMatchProgression === 'winner') {
        return match.winner
      } else {
        return match.user1 === match.winner ? match.user2 : match.user1
      }
    }

    return null
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

    await TournamentManager.generateTournamentStructure(request)

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Created tournament',
      request.name
    )

    broadcast('all_tournaments', await TournamentManager.getAllTournaments())

    return { success: true }
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

    await AuthManager.checkAuth(socket, ['admin', 'moderator'])

    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, request.id),
    })

    if (!tournament) {
      throw new Error(loc.no.error.messages.not_in_db(request.id))
    }

    const structuralChange =
      request.groupsCount !== undefined ||
      request.advancementCount !== undefined ||
      request.eliminationType !== undefined

    if (structuralChange) {
      await db
        .update(groups)
        .set({ deletedAt: new Date() })
        .where(eq(groups.tournament, request.id))

      await db
        .update(groupPlayers)
        .set({ deletedAt: new Date() })
        .where(eq(groupPlayers.group, request.id))

      await db
        .update(tournamentMatches)
        .set({ deletedAt: new Date() })
        .where(eq(tournamentMatches.tournament, request.id))

      await TournamentManager.generateTournamentStructure({
        type: 'CreateTournamentRequest',
        session: tournament.session,
        name: request.name ?? tournament.name,
        description: request.description ?? tournament.description,
        groupsCount: request.groupsCount ?? tournament.groupsCount,
        advancementCount:
          request.advancementCount ?? tournament.advancementCount,
        eliminationType: request.eliminationType ?? tournament.eliminationType,
      })
    } else {
      const { type, id, ...updates } = request
      await db
        .update(tournaments)
        .set(updates)
        .where(eq(tournaments.id, request.id))
    }

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Updated tournament',
      request.id
    )

    broadcast('all_tournaments', await TournamentManager.getAllTournaments())

    return { success: true }
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

    await TournamentManager.onEditTournament(socket, {
      type: 'EditTournamentRequest',
      id: request.id,
    })

    await db
      .update(tournaments)
      .set({ deletedAt: new Date() })
      .where(eq(tournaments.id, request.id))

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Deleted tournament',
      request.id
    )

    broadcast('all_tournaments', await TournamentManager.getAllTournaments())

    return { success: true }
  }
}
