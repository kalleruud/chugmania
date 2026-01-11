import db from '@backend/database/database'
import {
  matches,
  tournamentMatches,
  type EliminationType,
} from '@backend/database/schema'
import type { Match, MatchSide } from '@common/models/match'
import type {
  CreateGroupPlayer,
  CreateTournamentMatch,
  Group,
  GroupWithPlayers,
  TournamentMatch,
} from '@common/models/tournament'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import MatchManager from '../match.manager'
import GroupManager from './group.manager'

type UpperMatchMeta = {
  id: string
  round: number
  position: number
}

type LowerMatchMeta = UpperMatchMeta & {
  isDropIn: boolean
}

export default class TournamentMatchManager {
  static async getAll(tournamentId: string): Promise<{
    tournamentMatches: TournamentMatch[]
    matches: Match[]
  }> {
    const tournamentMatchRows = await db.query.tournamentMatches.findMany({
      where: and(
        eq(tournamentMatches.tournament, tournamentId),
        isNull(tournamentMatches.deletedAt)
      ),
      orderBy: asc(tournamentMatches.position),
    })

    const matchIds = tournamentMatchRows
      .filter(tm => tm.match)
      .map(tm => tm.match!)

    if (matchIds.length === 0) {
      return { tournamentMatches: tournamentMatchRows, matches: [] }
    }

    const matchRows: Match[] = await db.query.matches.findMany({
      where: and(inArray(matches.id, matchIds), isNull(matches.deletedAt)),
      orderBy: asc(matches.createdAt),
    })

    return { tournamentMatches: tournamentMatchRows, matches: matchRows }
  }

  private static newTournamentMatch(
    draft: CreateTournamentMatch
  ): TournamentMatch {
    return {
      id: randomUUID(),
      updatedAt: null,
      createdAt: new Date(),
      deletedAt: null,
      match: null,
      completedAt: null,
      sourceGroupA: null,
      sourceGroupARank: null,
      sourceGroupB: null,
      sourceGroupBRank: null,
      sourceMatchA: null,
      sourceMatchAProgression: null,
      sourceMatchB: null,
      sourceMatchBProgression: null,
      group: null,
      round: null,
      position: 0,
      ...draft,
    }
  }

  static async createGroupMatches(
    tournamentId: string,
    sessionId: string,
    groups: { id: string }[],
    groupPlayers: CreateGroupPlayer[],
    tracks?: string[] // tracks to cycle through rounds
  ) {
    const groupWithPlayers = groups.map(group => ({
      ...group,
      players: groupPlayers
        .filter(gp => gp.group === group.id)
        .map(p => p.user),
    }))

    // Generate round-robin rounds for each group using circle method
    // This ensures each player plays at most once per round
    const groupRounds: {
      group: { id: Group['id'] }
      user1: string
      user2: string
      round: number
    }[][] = []

    for (const group of groupWithPlayers) {
      const rounds = TournamentMatchManager.generateRoundRobinRounds(
        group.players,
        group
      )
      groupRounds.push(rounds.flat())
    }

    // Interleave matches from all groups to maximize rest time
    // Spread each group's matches proportionally so all groups finish together
    const pairings: {
      group: { id: Group['id'] }
      user1: string
      user2: string
      round: number
    }[] = []

    const maxMatchesPerGroup = Math.max(...groupRounds.map(r => r.length))

    // Assign each match a target position to spread evenly across the timeline
    const matchesWithPosition: {
      match: (typeof groupRounds)[0][0]
      targetPosition: number
    }[] = []

    for (let g = 0; g < groupRounds.length; g++) {
      const groupMatches = groupRounds[g]
      const groupMatchCount = groupMatches.length

      for (let m = 0; m < groupMatchCount; m++) {
        // Normalize match index to [0, 1] range, then scale to max timeline
        // Add small group offset to interleave groups at similar positions
        const progress = groupMatchCount > 1 ? m / (groupMatchCount - 1) : 0
        const targetPosition =
          progress * maxMatchesPerGroup + g / groupRounds.length

        matchesWithPosition.push({
          match: groupMatches[m],
          targetPosition,
        })
      }
    }

    // Sort by target position to get final ordering
    matchesWithPosition.sort((a, b) => a.targetPosition - b.targetPosition)

    for (const { match } of matchesWithPosition) {
      pairings.push(match)
    }

    // Create group matches with assigned tracks
    const matches: Match[] = []
    const tournamentMatches: TournamentMatch[] = []

    for (let i = 0; i < pairings.length; i++) {
      const pairing = pairings[i]
      const matchId = randomUUID()
      // Cycle tracks for equal distribution across rounds
      // E.g., with 4 rounds and 2 tracks: A,B,A,B (2 matches per track)
      let trackId: string | null = null
      if (tracks && tracks.length > 0) {
        const trackIndex = (pairing.round - 1) % tracks.length
        trackId = tracks[trackIndex]
      }

      matches.push({
        id: matchId,
        duration: null,
        status: 'planned',
        updatedAt: null,
        createdAt: new Date(),
        deletedAt: null,
        user1: pairing.user1,
        user2: pairing.user2,
        winner: null,
        comment: null,
        session: sessionId,
        stage: 'group',
        track: trackId,
      })

      tournamentMatches.push({
        id: randomUUID(),
        updatedAt: null,
        createdAt: new Date(),
        deletedAt: null,
        tournament: tournamentId,
        bracket: 'group',
        round: pairing.round,
        position: i,
        group: pairing.group.id,
        match: matchId,
        completedAt: null,
        sourceGroupA: null,
        sourceGroupARank: null,
        sourceGroupB: null,
        sourceGroupBRank: null,
        sourceMatchA: null,
        sourceMatchAProgression: null,
        sourceMatchB: null,
        sourceMatchBProgression: null,
      })
    }

    return { tournamentMatches, matches }
  }

  static generateBracketMatches(
    tournamentId: string,
    sessionId: string,
    groups: Group[],
    advancementCount: number,
    eliminationType: EliminationType,
    startPosition: number = 0,
    bracketTracks: string[] = []
  ): { tournamentMatches: TournamentMatch[]; matches: Match[] } {
    const totalAdvancing = groups.length * advancementCount
    const bracketSize = 2 ** Math.ceil(Math.log2(totalAdvancing))

    const { matches: upperTournamentMatches, meta: upperMeta } =
      TournamentMatchManager.buildUpperBracket(
        tournamentId,
        groups,
        advancementCount,
        totalAdvancing,
        bracketSize
      )

    if (eliminationType === 'single') {
      // Single elimination: assign positions, create matches with tracks by round
      upperTournamentMatches.forEach((m, i) => {
        m.position = startPosition + i
      })
      const matches = TournamentMatchManager.createMatchesForTournamentMatches(
        upperTournamentMatches,
        sessionId,
        bracketTracks
      )
      return { tournamentMatches: upperTournamentMatches, matches }
    }

    // Double elimination: interleave upper and lower brackets
    const { matches: lowerTournamentMatches, meta: lowerMeta } =
      TournamentMatchManager.buildLowerBracket(
        tournamentId,
        upperMeta,
        bracketSize
      )

    const grandFinal = TournamentMatchManager.buildGrandFinal(
      tournamentId,
      upperMeta,
      lowerMeta
    )

    // Group upper matches by round
    const upperByRound = new Map<number, TournamentMatch[]>()
    for (const m of upperTournamentMatches) {
      const round = m.round ?? 0
      if (!upperByRound.has(round)) upperByRound.set(round, [])
      upperByRound.get(round)!.push(m)
    }

    // Group lower matches by round
    const lowerByRound = new Map<number, TournamentMatch[]>()
    for (const m of lowerTournamentMatches) {
      const round = m.round ?? 0
      if (!lowerByRound.has(round)) lowerByRound.set(round, [])
      lowerByRound.get(round)!.push(m)
    }

    // Interleave: upper round -> corresponding lower rounds -> repeat
    // Upper rounds go: log2(bracketSize), log2(bracketSize)-1, ..., 1
    // Lower rounds go: 1, 2, 3, ... (sequential)
    const orderedTournamentMatches: TournamentMatch[] = []
    const maxUpperRound = Math.log2(bracketSize)

    let lowerRound = 1

    for (
      let upperDisplayRound = maxUpperRound;
      upperDisplayRound >= 1;
      upperDisplayRound--
    ) {
      // Add upper round matches
      const upperRoundMatches = upperByRound.get(upperDisplayRound) ?? []
      orderedTournamentMatches.push(...upperRoundMatches)

      // Add corresponding lower round(s)
      if (upperDisplayRound === maxUpperRound) {
        // First upper round -> single lower round (losers play each other)
        const lowerRoundMatches = lowerByRound.get(lowerRound) ?? []
        orderedTournamentMatches.push(...lowerRoundMatches)
        lowerRound++
      } else {
        // Subsequent upper rounds -> drop-in round + survivor round
        const dropInMatches = lowerByRound.get(lowerRound) ?? []
        orderedTournamentMatches.push(...dropInMatches)
        lowerRound++

        const survivorMatches = lowerByRound.get(lowerRound) ?? []
        orderedTournamentMatches.push(...survivorMatches)
        lowerRound++
      }
    }

    // Add grand final last
    if (grandFinal) {
      orderedTournamentMatches.push(grandFinal)
    }

    // Assign positions
    orderedTournamentMatches.forEach((m, i) => {
      m.position = startPosition + i
    })

    // Create matches with tracks assigned by round
    const matches = TournamentMatchManager.createMatchesForTournamentMatches(
      orderedTournamentMatches,
      sessionId,
      bracketTracks
    )

    return { tournamentMatches: orderedTournamentMatches, matches }
  }

  private static createMatchesForTournamentMatches(
    tournamentMatches: TournamentMatch[],
    sessionId: string,
    bracketTracks: string[]
  ): Match[] {
    const matches: Match[] = []

    // Group by bracket+round to assign same track to all matches in a round
    const roundGroups = new Map<string, TournamentMatch[]>()
    for (const tm of tournamentMatches) {
      const key = `${tm.bracket}-${tm.round ?? 0}`
      if (!roundGroups.has(key)) roundGroups.set(key, [])
      roundGroups.get(key)!.push(tm)
    }

    // Assign tracks by round order
    const roundKeys = Array.from(roundGroups.keys())
    for (let roundIndex = 0; roundIndex < roundKeys.length; roundIndex++) {
      const key = roundKeys[roundIndex]
      const tms = roundGroups.get(key)!
      const trackId =
        bracketTracks.length > 0
          ? bracketTracks[roundIndex % bracketTracks.length]
          : null

      for (const tm of tms) {
        const matchId = randomUUID()
        tm.match = matchId

        matches.push({
          id: matchId,
          duration: null,
          status: 'planned',
          updatedAt: null,
          createdAt: new Date(),
          deletedAt: null,
          user1: null,
          user2: null,
          winner: null,
          comment: null,
          session: sessionId,
          stage: tm.bracket === 'grand_final' ? 'grand_final' : null,
          track: trackId,
        })
      }
    }

    return matches
  }

  static buildUpperBracket(
    tournamentId: string,
    groups: { id: string }[],
    advancementCount: number,
    totalAdvancing: number,
    bracketSize: number
  ): { matches: TournamentMatch[]; meta: UpperMatchMeta[] } {
    const matches: TournamentMatch[] = []
    const meta: UpperMatchMeta[] = []

    let roundNum = bracketSize

    while (roundNum >= 2) {
      const matchesInRound = roundNum / 2
      // Convert bracket size to display round: log2(roundNum)
      // Final (roundNum=2) -> round 1, Semifinal (roundNum=4) -> round 2, etc.
      const displayRound = Math.log2(roundNum)

      for (let i = 0; i < matchesInRound; i++) {
        const id = randomUUID()
        const isFirstRound = roundNum === bracketSize

        const draft = TournamentMatchManager.newTournamentMatch({
          id,
          tournament: tournamentId,
          bracket: 'upper',
          round: displayRound,
        })

        if (isFirstRound) {
          TournamentMatchManager.assignGroupSources(
            draft,
            i,
            groups,
            advancementCount,
            totalAdvancing
          )
        } else {
          TournamentMatchManager.assignWinnerSources(draft, meta, roundNum, i)
        }

        matches.push(draft)
        meta.push({ id, round: roundNum, position: i })
      }

      roundNum /= 2
    }

    return { matches, meta }
  }

  private static assignGroupSources(
    draft: TournamentMatch,
    index: number,
    groups: { id: string }[],
    advancementCount: number,
    totalAdvancing: number
  ) {
    const assign = (
      seed: number,
      set: (groupId: string, rank: number) => void
    ) => {
      if (seed >= totalAdvancing) return

      const groupIndex = seed % groups.length
      const rank = Math.floor(seed / groups.length) + 1

      if (rank <= advancementCount) {
        set(groups[groupIndex].id, rank)
      }
    }

    assign(index * 2, (g, r) => {
      draft.sourceGroupA = g
      draft.sourceGroupARank = r
    })

    assign(index * 2 + 1, (g, r) => {
      draft.sourceGroupB = g
      draft.sourceGroupBRank = r
    })
  }

  private static assignWinnerSources(
    draft: TournamentMatch,
    meta: UpperMatchMeta[],
    roundNum: number,
    index: number
  ) {
    const prev = meta.filter(m => m.round === roundNum * 2)

    if (prev[index * 2]) {
      draft.sourceMatchA = prev[index * 2].id
      draft.sourceMatchAProgression = 'winner'
    }

    if (prev[index * 2 + 1]) {
      draft.sourceMatchB = prev[index * 2 + 1].id
      draft.sourceMatchBProgression = 'winner'
    }
  }

  static buildLowerBracket(
    tournamentId: string,
    upperMeta: UpperMatchMeta[],
    bracketSize: number
  ): { matches: TournamentMatch[]; meta: LowerMatchMeta[] } {
    const matches: TournamentMatch[] = []
    const meta: LowerMatchMeta[] = []

    let lowerRound = 1

    const firstUpper = upperMeta.filter(m => m.round === bracketSize)

    for (let i = 0; i < Math.floor(firstUpper.length / 2); i++) {
      const id = randomUUID()

      matches.push(
        TournamentMatchManager.newTournamentMatch({
          id,
          tournament: tournamentId,
          bracket: 'lower',
          round: lowerRound,
          sourceMatchA: firstUpper[i * 2].id,
          sourceMatchAProgression: 'loser',
          sourceMatchB: firstUpper[i * 2 + 1].id,
          sourceMatchBProgression: 'loser',
        })
      )

      meta.push({ id, round: lowerRound, position: i, isDropIn: false })
    }

    let upperRound = bracketSize / 2
    lowerRound++

    while (upperRound >= 2) {
      TournamentMatchManager.buildLowerDropInRound(
        tournamentId,
        matches,
        meta,
        upperMeta,
        upperRound,
        lowerRound
      )

      lowerRound++
      TournamentMatchManager.buildLowerSurvivorRound(
        tournamentId,
        matches,
        meta,
        lowerRound
      )

      lowerRound++
      upperRound /= 2
    }

    return { matches, meta }
  }

  private static buildLowerDropInRound(
    tournamentId: string,
    matches: TournamentMatch[],
    meta: LowerMatchMeta[],
    upperMeta: UpperMatchMeta[],
    upperRound: number,
    lowerRound: number
  ) {
    const prevLower = meta.filter(m => m.round === lowerRound - 1)
    const upperLosers = upperMeta.filter(m => m.round === upperRound)
    const count = Math.min(prevLower.length, upperLosers.length)

    for (let i = 0; i < count; i++) {
      const id = randomUUID()

      matches.push(
        TournamentMatchManager.newTournamentMatch({
          id,
          tournament: tournamentId,
          bracket: 'lower',
          round: lowerRound,
          sourceMatchA: prevLower[i].id,
          sourceMatchAProgression: 'winner',
          sourceMatchB: upperLosers[i].id,
          sourceMatchBProgression: 'loser',
        })
      )

      meta.push({ id, round: lowerRound, position: i, isDropIn: true })
    }
  }

  private static buildLowerSurvivorRound(
    tournamentId: string,
    matches: TournamentMatch[],
    meta: LowerMatchMeta[],
    lowerRound: number
  ) {
    const prev = meta.filter(m => m.round === lowerRound - 1)
    if (prev.length <= 1) return

    for (let i = 0; i < Math.floor(prev.length / 2); i++) {
      const id = randomUUID()

      matches.push(
        TournamentMatchManager.newTournamentMatch({
          id,
          tournament: tournamentId,
          bracket: 'lower',
          round: lowerRound,
          sourceMatchA: prev[i * 2].id,
          sourceMatchAProgression: 'winner',
          sourceMatchB: prev[i * 2 + 1].id,
          sourceMatchBProgression: 'winner',
        })
      )

      meta.push({ id, round: lowerRound, position: i, isDropIn: false })
    }
  }

  static buildGrandFinal(
    tournamentId: string,
    upperMeta: UpperMatchMeta[],
    lowerMeta: LowerMatchMeta[]
  ): TournamentMatch | null {
    const upperFinal = upperMeta.find(m => m.round === 2)
    if (!upperFinal) return null

    const lastLowerRound = Math.max(...lowerMeta.map(m => m.round))
    const lowerFinal = lowerMeta.find(m => m.round === lastLowerRound)
    if (!lowerFinal) return null

    return TournamentMatchManager.newTournamentMatch({
      tournament: tournamentId,
      bracket: 'grand_final',
      sourceMatchA: upperFinal.id,
      sourceMatchAProgression: 'winner',
      sourceMatchB: lowerFinal.id,
      sourceMatchBProgression: 'winner',
    })
  }

  /**
   * Generates round-robin pairings using the circle method.
   * Each round has floor(n/2) matches where each player plays at most once.
   * This maximizes rest time between a player's consecutive matches.
   */
  private static generateRoundRobinRounds<T extends { id: string }>(
    players: string[],
    group: T
  ): { group: T; user1: string; user2: string; round: number }[][] {
    if (players.length < 2) return []

    // Add a "bye" placeholder if odd number of players
    const participants = [...players]
    const hasBye = participants.length % 2 === 1
    if (hasBye) {
      participants.push('BYE')
    }

    const n = participants.length
    const rounds: {
      group: T
      user1: string
      user2: string
      round: number
    }[][] = []

    // Circle method: fix first player, rotate the rest
    for (let round = 0; round < n - 1; round++) {
      const roundMatches: {
        group: T
        user1: string
        user2: string
        round: number
      }[] = []

      for (let i = 0; i < n / 2; i++) {
        const home = i === 0 ? 0 : ((round + i - 1) % (n - 1)) + 1
        const away = ((round + (n - 1) - i - 1) % (n - 1)) + 1

        const player1 = participants[home]
        const player2 = participants[away]

        // Skip matches involving the "bye" placeholder
        if (player1 !== 'BYE' && player2 !== 'BYE') {
          roundMatches.push({
            group,
            user1: player1,
            user2: player2,
            round: round + 1, // 1-indexed round number
          })
        }
      }

      rounds.push(roundMatches)
    }

    return rounds
  }

  static async resolveGroupDependentMatches(
    groupId: string,
    sessionId: string | null
  ) {
    await Promise.all([
      TournamentMatchManager.handleGroupDependencyResolution(
        groupId,
        sessionId,
        'A'
      ),
      TournamentMatchManager.handleGroupDependencyResolution(
        groupId,
        sessionId,
        'B'
      ),
    ])
  }

  private static async handleGroupDependencyResolution(
    groupId: string,
    _sessionId: string | null,
    side: MatchSide
  ) {
    // Find all tournament matches that are dependent on this group
    const tournamentMatchRows = await db.query.tournamentMatches.findMany({
      where: and(
        side === 'A'
          ? eq(tournamentMatches.sourceGroupA, groupId)
          : eq(tournamentMatches.sourceGroupB, groupId),
        isNull(tournamentMatches.deletedAt)
      ),
    })

    for (const tournamentMatch of tournamentMatchRows) {
      const rank =
        side === 'A'
          ? tournamentMatch.sourceGroupARank
          : tournamentMatch.sourceGroupBRank
      if (!rank) throw new Error(`Source group ${side} rank not found`)

      const userId = await GroupManager.getUserAt(groupId, rank)

      const matchId = tournamentMatch.match
      if (!matchId) {
        throw new Error(
          `Match not found for tournament match ${tournamentMatch.id}`
        )
      }

      await MatchManager.setPlayer(matchId, side, userId)
    }
  }

  static async resolveMatchDependentMatches(
    matchId: string,
    sessionId: string | null
  ) {
    await Promise.all([
      TournamentMatchManager.handleMatchDependencyResolution(
        matchId,
        sessionId,
        'A'
      ),
      TournamentMatchManager.handleMatchDependencyResolution(
        matchId,
        sessionId,
        'B'
      ),
    ])
  }

  private static async handleMatchDependencyResolution(
    matchId: string,
    _sessionId: string | null,
    side: MatchSide
  ) {
    // Find all tournament matches that are dependent on this match
    const tournamentMatchRows = await db.query.tournamentMatches.findMany({
      where: and(
        side === 'A'
          ? eq(tournamentMatches.sourceMatchA, matchId)
          : eq(tournamentMatches.sourceMatchB, matchId),
        isNull(tournamentMatches.deletedAt)
      ),
    })

    for (const tournamentMatch of tournamentMatchRows) {
      const progression =
        side === 'A'
          ? tournamentMatch.sourceMatchAProgression
          : tournamentMatch.sourceMatchBProgression
      if (!progression)
        throw new Error(`Progression not found for match dependency`)

      const userId = await MatchManager.getProgressedUser(matchId, progression)

      const dependentMatchId = tournamentMatch.match
      if (!dependentMatchId) {
        throw new Error(
          `Match not found for tournament match ${tournamentMatch.id}`
        )
      }

      await MatchManager.setPlayer(dependentMatchId, side, userId)
    }
  }

  static calculateMinMaxMatchesPerPlayer(tournament: {
    groups: GroupWithPlayers[]
    advancementCount: number
    eliminationType: EliminationType
  }): { min: number; max: number } {
    const largestGroup = tournament.groups.reduce(
      (max, group) => Math.max(max, group.players.length),
      0
    )

    if (largestGroup < 2) return { min: 0, max: 0 }

    // Group stage (round-robin)
    const groupStageMatches = largestGroup - 1

    // Normalize advancing players to next power of two
    const totalAdvancingPlayers =
      tournament.advancementCount * tournament.groups.length
    const bracketSize = Math.pow(
      2,
      Math.ceil(Math.log2(Math.max(1, totalAdvancingPlayers)))
    )

    const rounds = Math.log2(bracketSize)

    let knockoutMatches: number

    if (tournament.eliminationType === 'single') {
      knockoutMatches = rounds
    } else {
      // Matches your actual double-elimination structure
      knockoutMatches = rounds + 2
    }

    // TOOD: Include tiebreaker matches
    return { min: groupStageMatches, max: groupStageMatches + knockoutMatches }
  }
}
