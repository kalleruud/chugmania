import db from '@backend/database/database'
import {
  matchDependencies,
  matches,
  stages,
  tournamentMatches,
  type DependencySlot,
  type EliminationType,
} from '@backend/database/schema'
import type { Match, MatchSide } from '@common/models/match'
import type {
  CreateGroupPlayer,
  CreateMatchDependency,
  CreateStage,
  CreateTournamentMatch,
  Group,
  GroupWithPlayers,
  MatchDependency,
  Stage,
  TournamentMatch,
} from '@common/models/tournament'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import MatchManager from '../match.manager'
import GroupManager from './group.manager'

type UpperMatchMeta = {
  tournamentMatchId: string
  round: number
  position: number
}

type LowerMatchMeta = UpperMatchMeta & {
  isDropIn: boolean
}

type GeneratedStructure = {
  stages: Stage[]
  tournamentMatches: TournamentMatch[]
  matches: Match[]
  matchDependencies: MatchDependency[]
}

export default class TournamentMatchManager {
  static async getAll(tournamentId: string): Promise<{
    stages: Stage[]
    tournamentMatches: TournamentMatch[]
    matches: Match[]
  }> {
    // Get all stages for this tournament
    const stageRows = await db.query.stages.findMany({
      where: and(eq(stages.tournament, tournamentId), isNull(stages.deletedAt)),
      orderBy: [asc(stages.bracket), asc(stages.index)],
    })

    if (stageRows.length === 0) {
      return { stages: [], tournamentMatches: [], matches: [] }
    }

    const stageIds = stageRows.map(s => s.id)

    const tournamentMatchRows = await db.query.tournamentMatches.findMany({
      where: and(
        inArray(tournamentMatches.stage, stageIds),
        isNull(tournamentMatches.deletedAt)
      ),
      orderBy: asc(tournamentMatches.index),
    })

    const matchIds = tournamentMatchRows.map(tm => tm.match)

    if (matchIds.length === 0) {
      return {
        stages: stageRows,
        tournamentMatches: tournamentMatchRows,
        matches: [],
      }
    }

    const matchRows: Match[] = await db.query.matches.findMany({
      where: and(inArray(matches.id, matchIds), isNull(matches.deletedAt)),
      orderBy: asc(matches.createdAt),
    })

    return {
      stages: stageRows,
      tournamentMatches: tournamentMatchRows,
      matches: matchRows,
    }
  }

  private static newStage(draft: CreateStage): Stage {
    return {
      id: randomUUID(),
      updatedAt: null,
      createdAt: new Date(),
      deletedAt: null,
      ...draft,
    }
  }

  private static newTournamentMatch(
    draft: CreateTournamentMatch
  ): TournamentMatch {
    return {
      id: randomUUID(),
      updatedAt: null,
      createdAt: new Date(),
      deletedAt: null,
      ...draft,
    }
  }

  private static newMatchDependency(
    draft: CreateMatchDependency
  ): MatchDependency {
    return {
      id: randomUUID(),
      updatedAt: null,
      createdAt: new Date(),
      deletedAt: null,
      fromMatch: draft.fromMatch ?? null,
      fromGroup: draft.fromGroup ?? null,
      toMatch: draft.toMatch,
      fromPosition: draft.fromPosition,
      toSlot: draft.toSlot,
    }
  }

  private static newMatch(
    sessionId: string,
    trackId: string | null,
    userA: string | null = null,
    userB: string | null = null
  ): Match {
    return {
      id: randomUUID(),
      duration: null,
      status: 'planned',
      updatedAt: null,
      createdAt: new Date(),
      deletedAt: null,
      userA,
      userB,
      winner: null,
      comment: null,
      session: sessionId,
      track: trackId,
    }
  }

  static createGroupMatches(
    tournamentId: string,
    sessionId: string,
    groups: { id: string }[],
    groupPlayers: CreateGroupPlayer[],
    tracks?: string[]
  ): GeneratedStructure {
    const groupWithPlayers = groups.map(group => ({
      ...group,
      players: groupPlayers
        .filter(gp => gp.group === group.id)
        .map(p => p.user),
    }))

    // Generate round-robin rounds for each group using circle method
    const groupRounds: {
      group: { id: Group['id'] }
      userA: string
      userB: string
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
    const pairings: {
      group: { id: Group['id'] }
      userA: string
      userB: string
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
        const progress = groupMatchCount > 1 ? m / (groupMatchCount - 1) : 0
        const targetPosition =
          progress * maxMatchesPerGroup + g / groupRounds.length

        matchesWithPosition.push({
          match: groupMatches[m],
          targetPosition,
        })
      }
    }

    matchesWithPosition.sort((a, b) => a.targetPosition - b.targetPosition)

    for (const { match } of matchesWithPosition) {
      pairings.push(match)
    }

    // Create stages (one per round)
    const roundNumbers = [...new Set(pairings.map(p => p.round))].sort(
      (a, b) => a - b
    )
    const stagesMap = new Map<number, Stage>()

    for (let i = 0; i < roundNumbers.length; i++) {
      const roundNum = roundNumbers[i]
      stagesMap.set(
        roundNum,
        TournamentMatchManager.newStage({
          tournament: tournamentId,
          bracket: 'group',
          index: i,
        })
      )
    }

    // Create matches and tournament matches
    const generatedMatches: Match[] = []
    const generatedTournamentMatches: TournamentMatch[] = []

    for (let i = 0; i < pairings.length; i++) {
      const pairing = pairings[i]
      const stage = stagesMap.get(pairing.round)!

      // Get track for this round (cycling through tracks)
      let trackId: string | null = null
      if (tracks && tracks.length > 0) {
        const trackIndex = (pairing.round - 1) % tracks.length
        trackId = tracks[trackIndex]
      }

      const match = TournamentMatchManager.newMatch(
        sessionId,
        trackId,
        pairing.userA,
        pairing.userB
      )

      const tournamentMatch = TournamentMatchManager.newTournamentMatch({
        match: match.id,
        stage: stage.id,
        index: i,
      })

      generatedMatches.push(match)
      generatedTournamentMatches.push(tournamentMatch)
    }

    return {
      stages: Array.from(stagesMap.values()),
      tournamentMatches: generatedTournamentMatches,
      matches: generatedMatches,
      matchDependencies: [], // Group matches have no dependencies
    }
  }

  static generateBracketMatches(
    tournamentId: string,
    sessionId: string,
    groups: Group[],
    advancementCount: number,
    eliminationType: EliminationType,
    groupStageCount: number,
    bracketTracks: string[] = []
  ): GeneratedStructure {
    const totalAdvancing = groups.length * advancementCount
    const bracketSize = 2 ** Math.ceil(Math.log2(totalAdvancing))

    const {
      stages: upperStages,
      tms: upperTMs,
      metas: upperMeta,
      deps: upperDeps,
      matchList: upperMatches,
    } = TournamentMatchManager.buildUpperBracket(
      tournamentId,
      sessionId,
      groups,
      advancementCount,
      totalAdvancing,
      bracketSize,
      groupStageCount,
      bracketTracks
    )

    if (eliminationType === 'single') {
      return {
        stages: upperStages,
        tournamentMatches: upperTMs,
        matches: upperMatches,
        matchDependencies: upperDeps,
      }
    }

    // Double elimination: add lower bracket and grand final
    const {
      stages: lowerStages,
      tms: lowerTMs,
      metas: lowerMeta,
      deps: lowerDeps,
      matchList: lowerMatches,
    } = TournamentMatchManager.buildLowerBracket(
      tournamentId,
      sessionId,
      upperMeta,
      bracketSize,
      groupStageCount + upperStages.length,
      bracketTracks
    )

    const {
      stage: grandFinalStage,
      tm: grandFinalTM,
      match: grandFinalMatch,
      deps: grandFinalDeps,
    } = TournamentMatchManager.buildGrandFinal(
      tournamentId,
      sessionId,
      upperMeta,
      lowerMeta,
      groupStageCount + upperStages.length + lowerStages.length,
      bracketTracks
    )

    return {
      stages: [...upperStages, ...lowerStages, grandFinalStage],
      tournamentMatches: [...upperTMs, ...lowerTMs, grandFinalTM],
      matches: [...upperMatches, ...lowerMatches, grandFinalMatch],
      matchDependencies: [...upperDeps, ...lowerDeps, ...grandFinalDeps],
    }
  }

  private static buildUpperBracket(
    tournamentId: string,
    sessionId: string,
    groups: { id: string }[],
    advancementCount: number,
    totalAdvancing: number,
    bracketSize: number,
    stageOffset: number,
    tracks: string[]
  ): {
    stages: Stage[]
    tms: TournamentMatch[]
    metas: UpperMatchMeta[]
    deps: MatchDependency[]
    matchList: Match[]
  } {
    const stagesList: Stage[] = []
    const tmsList: TournamentMatch[] = []
    const metaList: UpperMatchMeta[] = []
    const depsList: MatchDependency[] = []
    const matchList: Match[] = []

    let roundNum = bracketSize
    let stageIndex = 0

    while (roundNum >= 2) {
      const matchesInRound = roundNum / 2
      const isFirstRound = roundNum === bracketSize

      // Create stage for this round
      const stage = TournamentMatchManager.newStage({
        tournament: tournamentId,
        bracket: 'upper',
        index: stageOffset + stageIndex,
      })
      stagesList.push(stage)

      // Get track for this round
      const trackId =
        tracks.length > 0 ? tracks[stageIndex % tracks.length] : null

      for (let i = 0; i < matchesInRound; i++) {
        const match = TournamentMatchManager.newMatch(sessionId, trackId)
        const tm = TournamentMatchManager.newTournamentMatch({
          match: match.id,
          stage: stage.id,
          index: i,
        })

        matchList.push(match)
        tmsList.push(tm)
        metaList.push({
          tournamentMatchId: tm.id,
          round: roundNum,
          position: i,
        })

        if (isFirstRound) {
          // First round: source from groups
          const depsForMatch =
            TournamentMatchManager.createGroupSourceDependencies(
              tm.id,
              i,
              groups,
              advancementCount,
              totalAdvancing
            )
          depsList.push(...depsForMatch)
        } else {
          // Later rounds: source from previous round winners
          const depsForMatch =
            TournamentMatchManager.createWinnerSourceDependencies(
              tm.id,
              metaList,
              roundNum,
              i
            )
          depsList.push(...depsForMatch)
        }
      }

      roundNum /= 2
      stageIndex++
    }

    return {
      stages: stagesList,
      tms: tmsList,
      metas: metaList,
      deps: depsList,
      matchList,
    }
  }

  private static createGroupSourceDependencies(
    toMatchId: string,
    index: number,
    groups: { id: string }[],
    advancementCount: number,
    totalAdvancing: number
  ): MatchDependency[] {
    const deps: MatchDependency[] = []

    const assignSlot = (seed: number, slot: DependencySlot) => {
      if (seed >= totalAdvancing) return

      const groupIndex = seed % groups.length
      const rank = Math.floor(seed / groups.length) + 1

      if (rank <= advancementCount) {
        deps.push(
          TournamentMatchManager.newMatchDependency({
            fromMatch: null,
            fromGroup: groups[groupIndex].id,
            toMatch: toMatchId,
            fromPosition: rank,
            toSlot: slot,
          })
        )
      }
    }

    assignSlot(index * 2, 'A')
    assignSlot(index * 2 + 1, 'B')

    return deps
  }

  private static createWinnerSourceDependencies(
    toMatchId: string,
    meta: UpperMatchMeta[],
    roundNum: number,
    index: number
  ): MatchDependency[] {
    const deps: MatchDependency[] = []
    const prev = meta.filter(m => m.round === roundNum * 2)

    if (prev[index * 2]) {
      deps.push(
        TournamentMatchManager.newMatchDependency({
          fromMatch: prev[index * 2].tournamentMatchId,
          fromGroup: null,
          toMatch: toMatchId,
          fromPosition: 1, // winner
          toSlot: 'A',
        })
      )
    }

    if (prev[index * 2 + 1]) {
      deps.push(
        TournamentMatchManager.newMatchDependency({
          fromMatch: prev[index * 2 + 1].tournamentMatchId,
          fromGroup: null,
          toMatch: toMatchId,
          fromPosition: 1, // winner
          toSlot: 'B',
        })
      )
    }

    return deps
  }

  private static buildLowerBracket(
    tournamentId: string,
    sessionId: string,
    upperMeta: UpperMatchMeta[],
    bracketSize: number,
    stageOffset: number,
    tracks: string[]
  ): {
    stages: Stage[]
    tms: TournamentMatch[]
    metas: LowerMatchMeta[]
    deps: MatchDependency[]
    matchList: Match[]
  } {
    const stagesList: Stage[] = []
    const tmsList: TournamentMatch[] = []
    const metaList: LowerMatchMeta[] = []
    const depsList: MatchDependency[] = []
    const matchList: Match[] = []

    let lowerRound = 1
    let stageIndex = 0

    // First lower round: losers from first upper round play each other
    const firstUpper = upperMeta.filter(m => m.round === bracketSize)
    const stage1 = TournamentMatchManager.newStage({
      tournament: tournamentId,
      bracket: 'lower',
      index: stageOffset + stageIndex,
    })
    stagesList.push(stage1)

    const trackId1 =
      tracks.length > 0 ? tracks[stageIndex % tracks.length] : null

    for (let i = 0; i < Math.floor(firstUpper.length / 2); i++) {
      const match = TournamentMatchManager.newMatch(sessionId, trackId1)
      const tm = TournamentMatchManager.newTournamentMatch({
        match: match.id,
        stage: stage1.id,
        index: i,
      })

      matchList.push(match)
      tmsList.push(tm)
      metaList.push({
        tournamentMatchId: tm.id,
        round: lowerRound,
        position: i,
        isDropIn: false,
      })

      // Source: losers from first upper round
      depsList.push(
        TournamentMatchManager.newMatchDependency({
          fromMatch: firstUpper[i * 2].tournamentMatchId,
          fromGroup: null,
          toMatch: tm.id,
          fromPosition: 2, // loser
          toSlot: 'A',
        }),
        TournamentMatchManager.newMatchDependency({
          fromMatch: firstUpper[i * 2 + 1].tournamentMatchId,
          fromGroup: null,
          toMatch: tm.id,
          fromPosition: 2, // loser
          toSlot: 'B',
        })
      )
    }

    let upperRound = bracketSize / 2
    lowerRound++
    stageIndex++

    while (upperRound >= 2) {
      // Drop-in round: lower bracket survivors vs upper bracket losers
      const prevLower = metaList.filter(m => m.round === lowerRound - 1)
      const upperLosers = upperMeta.filter(m => m.round === upperRound)
      const count = Math.min(prevLower.length, upperLosers.length)

      const dropInStage = TournamentMatchManager.newStage({
        tournament: tournamentId,
        bracket: 'lower',
        index: stageOffset + stageIndex,
      })
      stagesList.push(dropInStage)

      const dropInTrack =
        tracks.length > 0 ? tracks[stageIndex % tracks.length] : null

      for (let i = 0; i < count; i++) {
        const match = TournamentMatchManager.newMatch(sessionId, dropInTrack)
        const tm = TournamentMatchManager.newTournamentMatch({
          match: match.id,
          stage: dropInStage.id,
          index: i,
        })

        matchList.push(match)
        tmsList.push(tm)
        metaList.push({
          tournamentMatchId: tm.id,
          round: lowerRound,
          position: i,
          isDropIn: true,
        })

        depsList.push(
          TournamentMatchManager.newMatchDependency({
            fromMatch: prevLower[i].tournamentMatchId,
            fromGroup: null,
            toMatch: tm.id,
            fromPosition: 1, // winner
            toSlot: 'A',
          }),
          TournamentMatchManager.newMatchDependency({
            fromMatch: upperLosers[i].tournamentMatchId,
            fromGroup: null,
            toMatch: tm.id,
            fromPosition: 2, // loser
            toSlot: 'B',
          })
        )
      }

      lowerRound++
      stageIndex++

      // Survivor round: lower bracket winners play each other
      const prevDropIn = metaList.filter(m => m.round === lowerRound - 1)
      if (prevDropIn.length > 1) {
        const survivorStage = TournamentMatchManager.newStage({
          tournament: tournamentId,
          bracket: 'lower',
          index: stageOffset + stageIndex,
        })
        stagesList.push(survivorStage)

        const survivorTrack =
          tracks.length > 0 ? tracks[stageIndex % tracks.length] : null

        for (let i = 0; i < Math.floor(prevDropIn.length / 2); i++) {
          const match = TournamentMatchManager.newMatch(
            sessionId,
            survivorTrack
          )
          const tm = TournamentMatchManager.newTournamentMatch({
            match: match.id,
            stage: survivorStage.id,
            index: i,
          })

          matchList.push(match)
          tmsList.push(tm)
          metaList.push({
            tournamentMatchId: tm.id,
            round: lowerRound,
            position: i,
            isDropIn: false,
          })

          depsList.push(
            TournamentMatchManager.newMatchDependency({
              fromMatch: prevDropIn[i * 2].tournamentMatchId,
              fromGroup: null,
              toMatch: tm.id,
              fromPosition: 1, // winner
              toSlot: 'A',
            }),
            TournamentMatchManager.newMatchDependency({
              fromMatch: prevDropIn[i * 2 + 1].tournamentMatchId,
              fromGroup: null,
              toMatch: tm.id,
              fromPosition: 1, // winner
              toSlot: 'B',
            })
          )
        }

        lowerRound++
        stageIndex++
      }

      upperRound /= 2
    }

    return {
      stages: stagesList,
      tms: tmsList,
      metas: metaList,
      deps: depsList,
      matchList,
    }
  }

  private static buildGrandFinal(
    tournamentId: string,
    sessionId: string,
    upperMeta: UpperMatchMeta[],
    lowerMeta: LowerMatchMeta[],
    stageOffset: number,
    tracks: string[]
  ): {
    stage: Stage
    tm: TournamentMatch
    match: Match
    deps: MatchDependency[]
  } {
    const upperFinal = upperMeta.find(m => m.round === 2)
    const lastLowerRound = Math.max(...lowerMeta.map(m => m.round))
    const lowerFinal = lowerMeta.find(m => m.round === lastLowerRound)

    const stage = TournamentMatchManager.newStage({
      tournament: tournamentId,
      bracket: 'grand_final',
      index: stageOffset,
    })

    const trackId =
      tracks.length > 0 ? tracks[stageOffset % tracks.length] : null
    const match = TournamentMatchManager.newMatch(sessionId, trackId)

    const tm = TournamentMatchManager.newTournamentMatch({
      match: match.id,
      stage: stage.id,
      index: 0,
    })

    const deps: MatchDependency[] = []
    if (upperFinal) {
      deps.push(
        TournamentMatchManager.newMatchDependency({
          fromMatch: upperFinal.tournamentMatchId,
          fromGroup: null,
          toMatch: tm.id,
          fromPosition: 1, // winner
          toSlot: 'A',
        })
      )
    }
    if (lowerFinal) {
      deps.push(
        TournamentMatchManager.newMatchDependency({
          fromMatch: lowerFinal.tournamentMatchId,
          fromGroup: null,
          toMatch: tm.id,
          fromPosition: 1, // winner
          toSlot: 'B',
        })
      )
    }

    return { stage, tm, match, deps }
  }

  /**
   * Generates round-robin pairings using the circle method.
   */
  private static generateRoundRobinRounds<T extends { id: string }>(
    players: string[],
    group: T
  ): { group: T; userA: string; userB: string; round: number }[][] {
    if (players.length < 2) return []

    const participants = [...players]
    const hasBye = participants.length % 2 === 1
    if (hasBye) {
      participants.push('BYE')
    }

    const n = participants.length
    const rounds: {
      group: T
      userA: string
      userB: string
      round: number
    }[][] = []

    for (let round = 0; round < n - 1; round++) {
      const roundMatches: {
        group: T
        userA: string
        userB: string
        round: number
      }[] = []

      for (let i = 0; i < n / 2; i++) {
        const home = i === 0 ? 0 : ((round + i - 1) % (n - 1)) + 1
        const away = ((round + (n - 1) - i - 1) % (n - 1)) + 1

        const player1 = participants[home]
        const player2 = participants[away]

        if (player1 !== 'BYE' && player2 !== 'BYE') {
          roundMatches.push({
            group,
            userA: player1,
            userB: player2,
            round: round + 1,
          })
        }
      }

      rounds.push(roundMatches)
    }

    return rounds
  }

  /**
   * Resolve dependencies when a group is complete.
   * Finds all dependencies from this group and assigns users to bracket matches.
   */
  static async resolveGroupDependentMatches(
    groupId: string,
    _sessionId: string | null
  ) {
    // Find all dependencies from this group
    const deps = await db.query.matchDependencies.findMany({
      where: and(
        eq(matchDependencies.fromGroup, groupId),
        isNull(matchDependencies.deletedAt)
      ),
    })

    for (const dep of deps) {
      const userId = await GroupManager.getUserAt(groupId, dep.fromPosition)

      // Find the match linked to the target tournament match
      const tm = await db.query.tournamentMatches.findFirst({
        where: eq(tournamentMatches.id, dep.toMatch),
      })
      if (!tm) continue

      await MatchManager.setPlayer(tm.match, dep.toSlot as MatchSide, userId)
    }
  }

  /**
   * Resolve dependencies when a match is completed.
   * Finds all dependencies from this match and assigns users to next matches.
   */
  static async resolveMatchDependentMatches(
    tournamentMatchId: string,
    _sessionId: string | null
  ) {
    // Find all dependencies from this tournament match
    const deps = await db.query.matchDependencies.findMany({
      where: and(
        eq(matchDependencies.fromMatch, tournamentMatchId),
        isNull(matchDependencies.deletedAt)
      ),
    })

    // Get the source tournament match to find its match
    const sourceTM = await db.query.tournamentMatches.findFirst({
      where: eq(tournamentMatches.id, tournamentMatchId),
    })
    if (!sourceTM) return

    for (const dep of deps) {
      // Get user from the source match (position 1 = winner, 2 = loser)
      const userId = await MatchManager.getProgressedUser(
        sourceTM.match,
        dep.fromPosition
      )

      // Find the target match
      const targetTM = await db.query.tournamentMatches.findFirst({
        where: eq(tournamentMatches.id, dep.toMatch),
      })
      if (!targetTM) continue

      await MatchManager.setPlayer(
        targetTM.match,
        dep.toSlot as MatchSide,
        userId
      )
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

    const groupStageMatches = largestGroup - 1

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
      knockoutMatches = rounds + 2
    }

    return { min: groupStageMatches, max: groupStageMatches + knockoutMatches }
  }
}
