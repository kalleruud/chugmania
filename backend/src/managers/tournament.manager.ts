import type { EventReq, EventRes } from '@common/models/socket.io'
import {
  isCreateTournamentRequest,
  isDeleteTournamentRequest,
  isEditTournamentRequest,
  type GroupPlayerWithUser,
  type GroupWithPlayers,
  type TournamentMatchWithDetails,
  type TournamentWithDetails,
} from '@common/models/tournament'
import { and, eq, isNull } from 'drizzle-orm'
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
  type EliminationType,
  type MatchProgression,
  type TournamentBracket,
} from '../../database/schema'
import { broadcast, type TypedSocket } from '../server'
import AuthManager from './auth.manager'
import MatchManager from './match.manager'
import RatingManager from './rating.manager'
import UserManager from './user.manager'

export default class TournamentManager {
  public static async getAllTournaments(): Promise<TournamentWithDetails[]> {
    const tournamentRows = await db
      .select()
      .from(tournaments)
      .where(isNull(tournaments.deletedAt))

    return Promise.all(
      tournamentRows.map(t => TournamentManager.getTournamentWithDetails(t.id))
    )
  }

  public static async getTournamentsBySession(
    sessionId: string
  ): Promise<TournamentWithDetails[]> {
    const tournamentRows = await db
      .select()
      .from(tournaments)
      .where(
        and(eq(tournaments.session, sessionId), isNull(tournaments.deletedAt))
      )

    return Promise.all(
      tournamentRows.map(t => TournamentManager.getTournamentWithDetails(t.id))
    )
  }

  private static async getTournamentWithDetails(
    tournamentId: string
  ): Promise<TournamentWithDetails> {
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
    })

    if (!tournament) {
      throw new Error(loc.no.error.messages.not_in_db(tournamentId))
    }

    const groupRows = await db
      .select()
      .from(groups)
      .where(and(eq(groups.tournament, tournamentId), isNull(groups.deletedAt)))

    const groupsWithPlayers: GroupWithPlayers[] = await Promise.all(
      groupRows.map(async group => {
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
              eq(groupPlayers.group, group.id),
              isNull(groupPlayers.deletedAt)
            )
          )
          .orderBy(groupPlayers.seed)

        const groupMatchRows = await db
          .select()
          .from(tournamentMatches)
          .innerJoin(matches, eq(tournamentMatches.match, matches.id))
          .where(
            and(
              eq(tournamentMatches.tournament, tournamentId),
              eq(tournamentMatches.bracket, 'group'),
              isNull(tournamentMatches.deletedAt)
            )
          )

        const players: GroupPlayerWithUser[] = playerRows.map(row => {
          const userInfo = UserManager.toUserInfo(row.user).userInfo
          let wins = 0
          let losses = 0

          for (const gm of groupMatchRows) {
            if (gm.matches.status !== 'completed') continue
            const isUser1 = gm.matches.user1 === row.user.id
            const isUser2 = gm.matches.user2 === row.user.id
            if (!isUser1 && !isUser2) continue

            if (gm.matches.winner === row.user.id) {
              wins++
            } else if (gm.matches.winner) {
              losses++
            }
          }

          return {
            id: row.id,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            deletedAt: row.deletedAt,
            group: row.group,
            seed: row.seed,
            user: userInfo,
            wins,
            losses,
          }
        })

        return {
          ...group,
          players,
        }
      })
    )

    const matchRows = await db
      .select()
      .from(tournamentMatches)
      .leftJoin(matches, eq(tournamentMatches.match, matches.id))
      .where(
        and(
          eq(tournamentMatches.tournament, tournamentId),
          isNull(tournamentMatches.deletedAt)
        )
      )
      .orderBy(tournamentMatches.bracket, tournamentMatches.round)

    const matchesWithDetails: TournamentMatchWithDetails[] = matchRows.map(
      row => ({
        ...row.tournament_matches,
        matchDetails: row.matches,
      })
    )

    return {
      ...tournament,
      groups: groupsWithPlayers,
      matches: matchesWithDetails,
    }
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

    const signupRows = await db
      .select({ user: sessionSignups.user })
      .from(sessionSignups)
      .where(
        and(
          eq(sessionSignups.session, request.session),
          eq(sessionSignups.response, 'yes'),
          isNull(sessionSignups.deletedAt)
        )
      )

    const playerIds = signupRows.map(r => r.user)

    const [tournament] = await db
      .insert(tournaments)
      .values({
        session: request.session,
        name: request.name,
        description: request.description,
        groupsCount: request.groupsCount,
        advancementCount: request.advancementCount,
        eliminationType: request.eliminationType,
      })
      .returning()

    await TournamentManager.generateTournamentStructure(
      tournament.id,
      tournament.session,
      playerIds,
      request.groupsCount,
      request.advancementCount,
      request.eliminationType,
      request.groupStageTracks,
      request.bracketTracks
    )

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Created tournament',
      tournament.name
    )

    broadcast('all_tournaments', await TournamentManager.getAllTournaments())
    broadcast('all_matches', await MatchManager.getAllMatches())

    return { success: true }
  }

  private static async generateTournamentStructure(
    tournamentId: string,
    sessionId: string,
    playerIds: string[],
    groupsCount: number,
    advancementCount: number,
    eliminationType: EliminationType,
    groupStageTracks: string[],
    bracketTracks: { stage: string; trackId: string }[]
  ) {
    // Get player ratings for seeding
    const rankings = await RatingManager.onGetRatings()
    const ratingMap = new Map(rankings.map(r => [r.user, r.totalRating]))

    // Sort players by rating (descending) - highest rated first
    const sortedPlayers = [...playerIds].sort((a, b) => {
      const ratingA = ratingMap.get(a) ?? 0
      const ratingB = ratingMap.get(b) ?? 0
      return ratingB - ratingA
    })

    const groupNames = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    const createdGroups: { id: string; name: string }[] = []

    for (let i = 0; i < groupsCount; i++) {
      const [group] = await db
        .insert(groups)
        .values({
          tournament: tournamentId,
          name: `Gruppe ${groupNames[i]}`,
        })
        .returning()
      createdGroups.push(group)
    }

    // Snake seeding: alternate direction every row
    // Row 0: A B C D (left to right)
    // Row 1: D C B A (right to left)
    // Row 2: A B C D (left to right)
    // etc.
    for (let i = 0; i < sortedPlayers.length; i++) {
      const row = Math.floor(i / groupsCount)
      const positionInRow = i % groupsCount
      const isReverseRow = row % 2 === 1

      const groupIndex = isReverseRow
        ? groupsCount - 1 - positionInRow
        : positionInRow

      const group = createdGroups[groupIndex]
      const seed = row + 1

      await db.insert(groupPlayers).values({
        group: group.id,
        user: sortedPlayers[i],
        seed,
      })
    }

    // Collect all group match pairings first
    const groupMatchPairings: {
      group: { id: string; name: string }
      user1: string
      user2: string
    }[] = []

    for (const group of createdGroups) {
      const players = await db
        .select()
        .from(groupPlayers)
        .where(eq(groupPlayers.group, group.id))

      for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
          groupMatchPairings.push({
            group,
            user1: players[i].user,
            user2: players[j].user,
          })
        }
      }
    }

    // Distribute tracks evenly across group matches
    const distributedTracks = TournamentManager.distributeTracksBalanced(
      groupMatchPairings.length,
      groupStageTracks
    )

    // Create group matches with assigned tracks
    for (let i = 0; i < groupMatchPairings.length; i++) {
      const pairing = groupMatchPairings[i]
      const trackId = distributedTracks[i]

      const [match] = await db
        .insert(matches)
        .values({
          user1: pairing.user1,
          user2: pairing.user2,
          track: trackId,
          session: sessionId,
          stage: 'group',
          status: 'planned',
        })
        .returning()

      await db.insert(tournamentMatches).values({
        tournament: tournamentId,
        name: `${pairing.group.name} Match`,
        bracket: 'group',
        round: 0,
        match: match.id,
      })
    }

    const totalAdvancing = groupsCount * advancementCount
    await TournamentManager.generateBracketSlots(
      tournamentId,
      createdGroups,
      advancementCount,
      totalAdvancing,
      eliminationType,
      bracketTracks
    )
  }

  private static distributeTracksBalanced(
    matchCount: number,
    trackIds: string[]
  ): string[] {
    if (trackIds.length === 0) return []
    if (trackIds.length === 1) return Array(matchCount).fill(trackIds[0])

    const result: string[] = []
    const trackUsage = new Map<string, number>()

    for (const trackId of trackIds) {
      trackUsage.set(trackId, 0)
    }

    for (let i = 0; i < matchCount; i++) {
      let minUsage = Infinity
      let selectedTrack = trackIds[0]

      for (const trackId of trackIds) {
        const usage = trackUsage.get(trackId) ?? 0
        if (usage < minUsage) {
          minUsage = usage
          selectedTrack = trackId
        }
      }

      result.push(selectedTrack)
      trackUsage.set(selectedTrack, (trackUsage.get(selectedTrack) ?? 0) + 1)
    }

    return result
  }

  private static async generateBracketSlots(
    tournamentId: string,
    createdGroups: { id: string; name: string }[],
    advancementCount: number,
    totalAdvancing: number,
    eliminationType: EliminationType,
    bracketTracks: { stage: string; trackId: string }[]
  ) {
    const bracketTrackMap = new Map(
      bracketTracks.map(bt => [bt.stage, bt.trackId])
    )
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(totalAdvancing)))

    const upperBracketMatches: {
      id: string
      round: number
      position: number
    }[] = []
    let roundNum = bracketSize
    let matchPosition = 0

    while (roundNum >= 2) {
      const matchesInRound = roundNum / 2

      for (let i = 0; i < matchesInRound; i++) {
        const roundName = TournamentManager.getRoundName(roundNum, false)

        const isFirstRound = roundNum === bracketSize

        let sourceGroupA: string | null = null
        let sourceGroupARank: number | null = null
        let sourceGroupB: string | null = null
        let sourceGroupBRank: number | null = null
        let sourceMatchA: string | null = null
        let sourceMatchAProgression: MatchProgression | null = null
        let sourceMatchB: string | null = null
        let sourceMatchBProgression: MatchProgression | null = null

        if (isFirstRound) {
          const seedA = i * 2
          const seedB = i * 2 + 1

          if (seedA < totalAdvancing) {
            const groupIndexA = seedA % createdGroups.length
            const rankA = Math.floor(seedA / createdGroups.length) + 1
            if (rankA <= advancementCount) {
              sourceGroupA = createdGroups[groupIndexA].id
              sourceGroupARank = rankA
            }
          }

          if (seedB < totalAdvancing) {
            const groupIndexB = seedB % createdGroups.length
            const rankB = Math.floor(seedB / createdGroups.length) + 1
            if (rankB <= advancementCount) {
              sourceGroupB = createdGroups[groupIndexB].id
              sourceGroupBRank = rankB
            }
          }
        } else {
          const prevRoundMatches = upperBracketMatches.filter(
            m => m.round === roundNum * 2
          )
          if (prevRoundMatches[i * 2]) {
            sourceMatchA = prevRoundMatches[i * 2].id
            sourceMatchAProgression = 'winner'
          }
          if (prevRoundMatches[i * 2 + 1]) {
            sourceMatchB = prevRoundMatches[i * 2 + 1].id
            sourceMatchBProgression = 'winner'
          }
        }

        const trackId = bracketTrackMap.get(roundName) ?? null

        const [tm] = await db
          .insert(tournamentMatches)
          .values({
            tournament: tournamentId,
            name: `${roundName} ${i + 1}`,
            bracket: 'upper',
            round: roundNum,
            track: trackId,
            sourceGroupA,
            sourceGroupARank,
            sourceGroupB,
            sourceGroupBRank,
            sourceMatchA,
            sourceMatchAProgression,
            sourceMatchB,
            sourceMatchBProgression,
          })
          .returning()

        upperBracketMatches.push({ id: tm.id, round: roundNum, position: i })
        matchPosition++
      }

      roundNum = roundNum / 2
    }

    if (eliminationType === 'double') {
      const lowerBracketMatches: {
        id: string
        round: number
        position: number
        isDropIn: boolean
      }[] = []

      // Double elimination lower bracket structure:
      // - First lower round: losers from first upper round play each other
      // - Subsequent rounds alternate between:
      //   1. "Survivor" rounds: lower bracket winners play each other
      //   2. "Drop-in" rounds: lower survivors vs new losers from upper bracket

      // First lower bracket round: losers from first upper bracket round
      const firstUpperRound = upperBracketMatches.filter(
        m => m.round === bracketSize
      )
      const firstLowerRoundMatches = Math.floor(firstUpperRound.length / 2)

      let lowerRoundCounter = 1

      const lowerBracketTrack = bracketTrackMap.get('Lower Bracket') ?? null

      for (let i = 0; i < firstLowerRoundMatches; i++) {
        const [tm] = await db
          .insert(tournamentMatches)
          .values({
            tournament: tournamentId,
            name: `Taper Runde ${lowerRoundCounter} - ${i + 1}`,
            bracket: 'lower',
            round: lowerRoundCounter,
            track: lowerBracketTrack,
            sourceMatchA: firstUpperRound[i * 2]?.id ?? null,
            sourceMatchAProgression: 'loser',
            sourceMatchB: firstUpperRound[i * 2 + 1]?.id ?? null,
            sourceMatchBProgression: 'loser',
          })
          .returning()

        lowerBracketMatches.push({
          id: tm.id,
          round: lowerRoundCounter,
          position: i,
          isDropIn: false,
        })
      }

      // Continue building lower bracket rounds
      let upperRoundNum = bracketSize / 2
      lowerRoundCounter++

      while (upperRoundNum >= 2) {
        const prevLowerMatches = lowerBracketMatches.filter(
          m => m.round === lowerRoundCounter - 1
        )
        const upperLosers = upperBracketMatches.filter(
          m => m.round === upperRoundNum
        )

        // Drop-in round: lower survivors vs upper bracket losers
        const dropInMatches = Math.min(
          prevLowerMatches.length,
          upperLosers.length
        )

        for (let i = 0; i < dropInMatches; i++) {
          const [tm] = await db
            .insert(tournamentMatches)
            .values({
              tournament: tournamentId,
              name: `Taper Runde ${lowerRoundCounter} - ${i + 1}`,
              bracket: 'lower',
              round: lowerRoundCounter,
              track: lowerBracketTrack,
              sourceMatchA: prevLowerMatches[i]?.id ?? null,
              sourceMatchAProgression: 'winner',
              sourceMatchB: upperLosers[i]?.id ?? null,
              sourceMatchBProgression: 'loser',
            })
            .returning()

          lowerBracketMatches.push({
            id: tm.id,
            round: lowerRoundCounter,
            position: i,
            isDropIn: true,
          })
        }

        lowerRoundCounter++

        // Survivor round: lower bracket winners play each other (if more than 1 match in prev round)
        const currentLowerMatches = lowerBracketMatches.filter(
          m => m.round === lowerRoundCounter - 1
        )

        if (currentLowerMatches.length > 1) {
          const survivorMatches = Math.floor(currentLowerMatches.length / 2)

          for (let i = 0; i < survivorMatches; i++) {
            const [tm] = await db
              .insert(tournamentMatches)
              .values({
                tournament: tournamentId,
                name: `Taper Runde ${lowerRoundCounter} - ${i + 1}`,
                bracket: 'lower',
                round: lowerRoundCounter,
                track: lowerBracketTrack,
                sourceMatchA: currentLowerMatches[i * 2]?.id ?? null,
                sourceMatchAProgression: 'winner',
                sourceMatchB: currentLowerMatches[i * 2 + 1]?.id ?? null,
                sourceMatchBProgression: 'winner',
              })
              .returning()

            lowerBracketMatches.push({
              id: tm.id,
              round: lowerRoundCounter,
              position: i,
              isDropIn: false,
            })
          }

          lowerRoundCounter++
        }

        upperRoundNum = upperRoundNum / 2
      }

      // Grand Final: upper bracket winner vs lower bracket winner
      const upperFinal = upperBracketMatches.find(m => m.round === 2)
      const lastLowerRound = Math.max(...lowerBracketMatches.map(m => m.round))
      const lowerFinal = lowerBracketMatches.find(
        m => m.round === lastLowerRound
      )

      const grandFinalTrack = bracketTrackMap.get('Grand Finale') ?? null

      if (upperFinal && lowerFinal) {
        await db.insert(tournamentMatches).values({
          tournament: tournamentId,
          name: 'Grand Finale',
          bracket: 'upper',
          round: 1,
          track: grandFinalTrack,
          sourceMatchA: upperFinal.id,
          sourceMatchAProgression: 'winner',
          sourceMatchB: lowerFinal.id,
          sourceMatchBProgression: 'winner',
        })
      }
    }
  }

  private static getRoundName(size: number, isLower: boolean): string {
    const prefix = isLower ? 'Taper ' : ''
    if (size === 2) return `${prefix}Finale`
    if (size === 4) return `${prefix}Semifinale`
    if (size === 8) return `${prefix}Kvartfinale`
    if (size === 16) return `${prefix}Åttendelsfinale`
    return `${prefix}Runde ${size}`
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
      (request.groupsCount !== undefined &&
        request.groupsCount !== tournament.groupsCount) ||
      (request.advancementCount !== undefined &&
        request.advancementCount !== tournament.advancementCount) ||
      (request.eliminationType !== undefined &&
        request.eliminationType !== tournament.eliminationType)

    if (structuralChange) {
      await TournamentManager.deleteTournamentStructure(tournament.id)

      const signupRows = await db
        .select({ user: sessionSignups.user })
        .from(sessionSignups)
        .where(
          and(
            eq(sessionSignups.session, tournament.session),
            eq(sessionSignups.response, 'yes'),
            isNull(sessionSignups.deletedAt)
          )
        )

      const playerIds = signupRows.map(r => r.user)

      await TournamentManager.generateTournamentStructure(
        tournament.id,
        tournament.session,
        playerIds,
        request.groupsCount ?? tournament.groupsCount,
        request.advancementCount ?? tournament.advancementCount,
        request.eliminationType ?? tournament.eliminationType
      )
    }

    const { type, id, ...updates } = request
    await db
      .update(tournaments)
      .set({
        name: updates.name,
        description: updates.description,
        groupsCount: updates.groupsCount,
        advancementCount: updates.advancementCount,
        eliminationType: updates.eliminationType,
      })
      .where(eq(tournaments.id, tournament.id))

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Updated tournament',
      request.id
    )

    broadcast('all_tournaments', await TournamentManager.getAllTournaments())
    broadcast('all_matches', await MatchManager.getAllMatches())

    return { success: true }
  }

  private static async deleteTournamentStructure(tournamentId: string) {
    const matchRows = await db
      .select({ matchId: tournamentMatches.match })
      .from(tournamentMatches)
      .where(eq(tournamentMatches.tournament, tournamentId))

    for (const row of matchRows) {
      if (row.matchId) {
        await db
          .update(matches)
          .set({ deletedAt: new Date() })
          .where(eq(matches.id, row.matchId))
      }
    }

    await db
      .update(tournamentMatches)
      .set({ deletedAt: new Date() })
      .where(eq(tournamentMatches.tournament, tournamentId))

    const groupRows = await db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.tournament, tournamentId))

    for (const group of groupRows) {
      await db
        .update(groupPlayers)
        .set({ deletedAt: new Date() })
        .where(eq(groupPlayers.group, group.id))
    }

    await db
      .update(groups)
      .set({ deletedAt: new Date() })
      .where(eq(groups.tournament, tournamentId))
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

    await TournamentManager.deleteTournamentStructure(request.id)

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
    broadcast('all_matches', await MatchManager.getAllMatches())

    return { success: true }
  }

  public static async onMatchCompleted(matchId: string) {
    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
    })

    if (!match || match.status !== 'completed' || !match.winner) {
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

    if (tournamentMatch.bracket === 'group') {
      await TournamentManager.checkGroupCompletion(
        tournamentMatch.tournament,
        match.session ?? ''
      )
    } else {
      await TournamentManager.progressBracket(
        tournamentMatch.tournament,
        tournamentMatch.id,
        match.winner,
        match.user1 === match.winner ? match.user2 : match.user1,
        match.session ?? ''
      )
    }

    broadcast('all_tournaments', await TournamentManager.getAllTournaments())
  }

  private static async checkGroupCompletion(
    tournamentId: string,
    sessionId: string
  ) {
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
    })

    if (!tournament) return

    const groupRows = await db
      .select()
      .from(groups)
      .where(and(eq(groups.tournament, tournamentId), isNull(groups.deletedAt)))

    for (const group of groupRows) {
      const groupMatchRows = await db
        .select()
        .from(tournamentMatches)
        .innerJoin(matches, eq(tournamentMatches.match, matches.id))
        .where(
          and(
            eq(tournamentMatches.tournament, tournamentId),
            eq(tournamentMatches.bracket, 'group'),
            isNull(tournamentMatches.deletedAt)
          )
        )

      const playerRows = await db
        .select()
        .from(groupPlayers)
        .where(
          and(eq(groupPlayers.group, group.id), isNull(groupPlayers.deletedAt))
        )

      const relevantMatches = groupMatchRows.filter(gm => {
        const playerIds = playerRows.map(p => p.user)
        return (
          playerIds.includes(gm.matches.user1 ?? '') ||
          playerIds.includes(gm.matches.user2 ?? '')
        )
      })

      const allCompleted = relevantMatches.every(
        gm => gm.matches.status === 'completed'
      )

      if (!allCompleted) continue

      const standings = TournamentManager.calculateGroupStandings(
        playerRows,
        relevantMatches.map(r => r.matches)
      )

      for (let rank = 1; rank <= tournament.advancementCount; rank++) {
        const player = standings[rank - 1]
        if (!player) continue

        const pendingMatches = await db
          .select()
          .from(tournamentMatches)
          .where(
            and(
              eq(tournamentMatches.tournament, tournamentId),
              eq(tournamentMatches.sourceGroupA, group.id),
              eq(tournamentMatches.sourceGroupARank, rank),
              isNull(tournamentMatches.match),
              isNull(tournamentMatches.deletedAt)
            )
          )

        for (const pending of pendingMatches) {
          await TournamentManager.tryCreateBracketMatch(
            pending,
            sessionId,
            player.user
          )
        }

        const pendingMatchesB = await db
          .select()
          .from(tournamentMatches)
          .where(
            and(
              eq(tournamentMatches.tournament, tournamentId),
              eq(tournamentMatches.sourceGroupB, group.id),
              eq(tournamentMatches.sourceGroupBRank, rank),
              isNull(tournamentMatches.match),
              isNull(tournamentMatches.deletedAt)
            )
          )

        for (const pending of pendingMatchesB) {
          await TournamentManager.tryCreateBracketMatch(
            pending,
            sessionId,
            undefined,
            player.user
          )
        }
      }
    }
  }

  private static calculateGroupStandings(
    players: { user: string }[],
    groupMatches: {
      user1: string | null
      user2: string | null
      winner: string | null
    }[]
  ): { user: string; wins: number; losses: number }[] {
    const stats = new Map<string, { wins: number; losses: number }>()

    for (const player of players) {
      stats.set(player.user, { wins: 0, losses: 0 })
    }

    for (const match of groupMatches) {
      if (!match.winner) continue

      const winnerStats = stats.get(match.winner)
      if (winnerStats) {
        winnerStats.wins++
      }

      const loser = match.user1 === match.winner ? match.user2 : match.user1
      if (loser) {
        const loserStats = stats.get(loser)
        if (loserStats) {
          loserStats.losses++
        }
      }
    }

    return Array.from(stats.entries())
      .map(([user, s]) => ({ user, ...s }))
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins
        return a.losses - b.losses
      })
  }

  private static async progressBracket(
    tournamentId: string,
    completedMatchId: string,
    winnerId: string,
    loserId: string | null,
    sessionId: string
  ) {
    const downstreamWinner = await db
      .select()
      .from(tournamentMatches)
      .where(
        and(
          eq(tournamentMatches.tournament, tournamentId),
          eq(tournamentMatches.sourceMatchA, completedMatchId),
          eq(tournamentMatches.sourceMatchAProgression, 'winner'),
          isNull(tournamentMatches.match),
          isNull(tournamentMatches.deletedAt)
        )
      )

    for (const pending of downstreamWinner) {
      await TournamentManager.tryCreateBracketMatch(
        pending,
        sessionId,
        winnerId
      )
    }

    const downstreamWinnerB = await db
      .select()
      .from(tournamentMatches)
      .where(
        and(
          eq(tournamentMatches.tournament, tournamentId),
          eq(tournamentMatches.sourceMatchB, completedMatchId),
          eq(tournamentMatches.sourceMatchBProgression, 'winner'),
          isNull(tournamentMatches.match),
          isNull(tournamentMatches.deletedAt)
        )
      )

    for (const pending of downstreamWinnerB) {
      await TournamentManager.tryCreateBracketMatch(
        pending,
        sessionId,
        undefined,
        winnerId
      )
    }

    if (loserId) {
      const downstreamLoser = await db
        .select()
        .from(tournamentMatches)
        .where(
          and(
            eq(tournamentMatches.tournament, tournamentId),
            eq(tournamentMatches.sourceMatchA, completedMatchId),
            eq(tournamentMatches.sourceMatchAProgression, 'loser'),
            isNull(tournamentMatches.match),
            isNull(tournamentMatches.deletedAt)
          )
        )

      for (const pending of downstreamLoser) {
        await TournamentManager.tryCreateBracketMatch(
          pending,
          sessionId,
          loserId
        )
      }

      const downstreamLoserB = await db
        .select()
        .from(tournamentMatches)
        .where(
          and(
            eq(tournamentMatches.tournament, tournamentId),
            eq(tournamentMatches.sourceMatchB, completedMatchId),
            eq(tournamentMatches.sourceMatchBProgression, 'loser'),
            isNull(tournamentMatches.match),
            isNull(tournamentMatches.deletedAt)
          )
        )

      for (const pending of downstreamLoserB) {
        await TournamentManager.tryCreateBracketMatch(
          pending,
          sessionId,
          undefined,
          loserId
        )
      }
    }
  }

  private static async tryCreateBracketMatch(
    pendingMatch: typeof tournamentMatches.$inferSelect,
    sessionId: string,
    userA?: string,
    userB?: string
  ) {
    let resolvedUserA = userA
    let resolvedUserB = userB

    if (
      !resolvedUserA &&
      pendingMatch.sourceGroupA &&
      pendingMatch.sourceGroupARank
    ) {
      resolvedUserA = await TournamentManager.getGroupRankedPlayer(
        pendingMatch.sourceGroupA,
        pendingMatch.sourceGroupARank,
        pendingMatch.tournament
      )
    }

    if (
      !resolvedUserA &&
      pendingMatch.sourceMatchA &&
      pendingMatch.sourceMatchAProgression
    ) {
      resolvedUserA = await TournamentManager.getMatchProgressedPlayer(
        pendingMatch.sourceMatchA,
        pendingMatch.sourceMatchAProgression
      )
    }

    if (
      !resolvedUserB &&
      pendingMatch.sourceGroupB &&
      pendingMatch.sourceGroupBRank
    ) {
      resolvedUserB = await TournamentManager.getGroupRankedPlayer(
        pendingMatch.sourceGroupB,
        pendingMatch.sourceGroupBRank,
        pendingMatch.tournament
      )
    }

    if (
      !resolvedUserB &&
      pendingMatch.sourceMatchB &&
      pendingMatch.sourceMatchBProgression
    ) {
      resolvedUserB = await TournamentManager.getMatchProgressedPlayer(
        pendingMatch.sourceMatchB,
        pendingMatch.sourceMatchBProgression
      )
    }

    if (!resolvedUserA || !resolvedUserB) {
      return
    }

    const stage = TournamentManager.getBracketStage(
      pendingMatch.bracket as TournamentBracket,
      pendingMatch.round
    )

    const [newMatch] = await db
      .insert(matches)
      .values({
        user1: resolvedUserA,
        user2: resolvedUserB,
        track: pendingMatch.track,
        session: sessionId,
        stage,
        status: 'planned',
      })
      .returning()

    await db
      .update(tournamentMatches)
      .set({ match: newMatch.id })
      .where(eq(tournamentMatches.id, pendingMatch.id))

    await RatingManager.recalculate()
    broadcast('all_matches', await MatchManager.getAllMatches())
    broadcast('all_rankings', await RatingManager.onGetRatings())
  }

  private static async getGroupRankedPlayer(
    groupId: string,
    rank: number,
    tournamentId: string
  ): Promise<string | undefined> {
    const playerRows = await db
      .select()
      .from(groupPlayers)
      .where(
        and(eq(groupPlayers.group, groupId), isNull(groupPlayers.deletedAt))
      )

    const groupMatchRows = await db
      .select()
      .from(tournamentMatches)
      .innerJoin(matches, eq(tournamentMatches.match, matches.id))
      .where(
        and(
          eq(tournamentMatches.tournament, tournamentId),
          eq(tournamentMatches.bracket, 'group'),
          isNull(tournamentMatches.deletedAt)
        )
      )

    const playerIds = playerRows.map(p => p.user)
    const relevantMatches = groupMatchRows.filter(
      gm =>
        playerIds.includes(gm.matches.user1 ?? '') ||
        playerIds.includes(gm.matches.user2 ?? '')
    )

    const allCompleted = relevantMatches.every(
      gm => gm.matches.status === 'completed'
    )

    if (!allCompleted) return undefined

    const standings = TournamentManager.calculateGroupStandings(
      playerRows,
      relevantMatches.map(r => r.matches)
    )

    return standings[rank - 1]?.user
  }

  private static async getMatchProgressedPlayer(
    matchId: string,
    progression: MatchProgression
  ): Promise<string | undefined> {
    const tm = await db.query.tournamentMatches.findFirst({
      where: eq(tournamentMatches.id, matchId),
    })

    if (!tm?.match || !tm.completedAt) return undefined

    const match = await db.query.matches.findFirst({
      where: eq(matches.id, tm.match),
    })

    if (!match?.winner) return undefined

    if (progression === 'winner') {
      return match.winner
    } else {
      return match.user1 === match.winner
        ? (match.user2 ?? undefined)
        : (match.user1 ?? undefined)
    }
  }

  private static getBracketStage(
    bracket: TournamentBracket,
    round: number
  ): string {
    if (bracket === 'group') return 'group'

    if (bracket === 'lower') {
      // Lower bracket uses sequential round numbers
      return 'group' // Use 'group' as generic stage for lower bracket matches
    }

    // Upper bracket uses bitwise round numbers
    if (round === 1) return 'grand_final'
    if (round === 2) return 'final'
    if (round === 4) return 'semi'
    if (round === 8) return 'quarter'
    if (round === 16) return 'eight'

    return 'group'
  }
}
