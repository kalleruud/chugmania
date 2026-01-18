import db from '@backend/database/database'
import {
  matchDependencies,
  matches,
  type EliminationType,
} from '@backend/database/schema'
import type { CreateMatch, Match } from '@common/models/match'
import type {
  CreateMatchDependency,
  Group,
  GroupWithPlayers,
  MatchDependency,
  Stage,
} from '@common/models/tournament'
import { and, eq, isNull } from 'drizzle-orm'
import MatchManager from '../match.manager'
import GroupManager from './group.manager'
import StageManager from './stage.manager'

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
  matches: Match[]
  matchDependencies: MatchDependency[]
}

export default class TournamentMatchManager {
  private static async createMatch(draft: CreateMatch): Promise<Match> {
    const [match] = await db.insert(matches).values(draft).returning()
    return match
  }

  private static async createMatchDependency(
    draft: CreateMatchDependency
  ): Promise<MatchDependency> {
    const [dependency] = await db
      .insert(matchDependencies)
      .values(draft)
      .returning()
    return dependency
  }

  static async createGroupMatches(
    tournamentId: string,
    sessionId: string,
    groupsWithPlayers: GroupWithPlayers[],
    tracks?: string[]
  ): Promise<Omit<GeneratedStructure, 'matchDependencies'>> {
    // Generate round-robin rounds for each group using circle method
    const groupRounds: {
      group: { id: Group['id'] }
      userA: string
      userB: string
      round: number
    }[][] = []

    for (const group of groupsWithPlayers) {
      const rounds = TournamentMatchManager.generateRoundRobinRounds(
        group.players.map(p => p.user),
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

    matchesWithPosition.toSorted((a, b) => a.targetPosition - b.targetPosition)

    for (const { match } of matchesWithPosition) {
      pairings.push(match)
    }

    // Create stages (one per round)
    const roundNumbers = [...new Set(pairings.map(p => p.round))].toSorted(
      (a, b) => a - b
    )
    const stagesMap = new Map<number, Stage>()

    for (let i = 0; i < roundNumbers.length; i++) {
      const roundNum = roundNumbers[i]
      stagesMap.set(
        roundNum,
        await StageManager.createStage({
          tournament: tournamentId,
          level: 'group',
          index: i,
        })
      )
    }

    // Create matches and tournament matches
    const generatedMatches: Match[] = []

    for (let i = 0; i < pairings.length; i++) {
      const pairing = pairings[i]
      const stage = stagesMap.get(pairing.round)!

      // Get track for this round (cycling through tracks)
      let trackId: string | null = null
      if (tracks && tracks.length > 0) {
        const trackIndex = (pairing.round - 1) % tracks.length
        trackId = tracks[trackIndex]
      }

      const match = await TournamentMatchManager.createMatch({
        session: sessionId,
        track: trackId,
        userA: pairing.userA,
        userB: pairing.userB,
        stage: stage.id,
        index: i,
      })

      generatedMatches.push(match)
    }

    return {
      stages: Array.from(stagesMap.values()),
      matches: generatedMatches,
    }
  }

  static async generateBracketMatches(
    tournamentId: string,
    sessionId: string,
    groups: GroupWithPlayers[],
    advancementCount: number,
    eliminationType: EliminationType,
    groupStageCount: number,
    bracketTracks: string[] = []
  ): Promise<GeneratedStructure> {
    const totalAdvancing = groups.length * advancementCount
    const bracketSize = 2 ** Math.ceil(Math.log2(totalAdvancing))

    const upperBracket = await TournamentMatchManager.buildUpperBracket(
      tournamentId,
      sessionId,
      groups,
      advancementCount,
      bracketSize,
      groupStageCount
    )

    if (eliminationType === 'single') {
      return {
        stages: upperBracket.stages,
        matches: upperBracket.matches,
        matchDependencies: upperBracket.deps,
      }
    }

    // Double elimination: add lower bracket and grand final
    const lowerBracket = await TournamentMatchManager.buildLowerBracket(
      tournamentId,
      sessionId,
      upperBracket.metas,
      bracketSize,
      groupStageCount + upperBracket.stages.length
    )

    const {
      stage: grandFinalStage,
      match: grandFinalMatch,
      deps: grandFinalDeps,
    } = await TournamentMatchManager.buildGrandFinal(
      tournamentId,
      sessionId,
      upperBracket.metas,
      lowerBracket.metas,
      groupStageCount + upperBracket.stages.length + lowerBracket.stages.length
    )

    // Interleave upper and lower stages for proper ordering
    // Structure: Group → Upper R1 → Lower R1 → Upper R2 → Lower R2a → Lower R2b → ...
    // After each upper bracket round, include all dependent lower bracket stages
    const interleavedStages: Stage[] = []
    const interleavedMatches: Match[] = []
    const interleavedDeps: MatchDependency[] = []

    // Build lookup maps for easy filtering
    const upperMatchesByStage = new Map<string, Match[]>()
    const lowerMatchesByStage = new Map<string, Match[]>()
    const matchesById = new Map<string, Match>()

    upperBracket.matches.forEach(tm => {
      if (!tm.stage) throw new Error('Stage has not been set')
      if (!upperMatchesByStage.has(tm.stage))
        upperMatchesByStage.set(tm.stage, [])
      upperMatchesByStage.get(tm.stage)!.push(tm)
    })

    lowerBracket.matches.forEach(tm => {
      if (!tm.stage) throw new Error('Stage has not been set')
      if (!lowerMatchesByStage.has(tm.stage))
        lowerMatchesByStage.set(tm.stage, [])
      lowerMatchesByStage.get(tm.stage)!.push(tm)
    })

    upperBracket.matches.forEach(m => matchesById.set(m.id, m))
    lowerBracket.matches.forEach(m => matchesById.set(m.id, m))

    // Add all upper bracket stages, and after each one add its dependent lower bracket stages
    // Lower bracket has multiple stages per upper bracket round (drop-in + survivor)
    const addStageToInterleaved = (
      stage: Stage,
      stageMap: Map<string, Match[]>,
      deps: MatchDependency[]
    ) => {
      interleavedStages.push(stage)
      const tmsForStage = stageMap.get(stage.id) || []
      interleavedMatches.push(...tmsForStage)
      tmsForStage.forEach(tm => {
        const match = matchesById.get(tm.id)
        if (match) interleavedMatches.push(match)
      })
      interleavedDeps.push(
        ...deps.filter(d => tmsForStage.some(tm => tm.id === d.toMatch))
      )
    }

    // Process stages in order created (which creates proper dependencies)
    let lowerStageIndex = 0
    for (let i = 0; i < upperBracket.stages.length; i++) {
      // Add upper bracket stage
      addStageToInterleaved(
        upperBracket.stages[i],
        upperMatchesByStage,
        upperBracket.deps
      )

      // For the first upper bracket round, just add the first lower round
      // For subsequent rounds, add all lower stages that follow this upper stage
      if (i === 0) {
        // First upper round: only Lower R1 follows
        if (lowerStageIndex < lowerBracket.stages.length) {
          addStageToInterleaved(
            lowerBracket.stages[lowerStageIndex],
            lowerMatchesByStage,
            lowerBracket.deps
          )
          lowerStageIndex++
        }
      } else {
        // Subsequent upper rounds: add drop-in and survivor stages (2 per round)
        for (
          let j = 0;
          j < 2 && lowerStageIndex < lowerBracket.stages.length;
          j++
        ) {
          addStageToInterleaved(
            lowerBracket.stages[lowerStageIndex],
            lowerMatchesByStage,
            lowerBracket.deps
          )
          lowerStageIndex++
        }
      }
    }

    // Add any remaining lower bracket stages (shouldn't happen but just in case)
    while (lowerStageIndex < lowerBracket.stages.length) {
      addStageToInterleaved(
        lowerBracket.stages[lowerStageIndex],
        lowerMatchesByStage,
        lowerBracket.deps
      )
      lowerStageIndex++
    }

    // Add grand final
    interleavedStages.push(grandFinalStage)
    interleavedMatches.push(grandFinalMatch)
    interleavedDeps.push(...grandFinalDeps)

    // Reassign stage indices and tracks based on the final interleaved stage order
    const stageToTrackId = new Map<string, string>()
    interleavedStages.forEach((stage, idx) => {
      // Update stage index to match position in interleaved order
      stage.index = groupStageCount + idx

      // Assign track if provided
      if (bracketTracks.length > 0) {
        const trackId = bracketTracks[idx % bracketTracks.length]
        stageToTrackId.set(stage.id, trackId)
      }
    })

    // Update all matches to use the correct track for their stage
    interleavedMatches.forEach(match => {
      const stageId = interleavedMatches.find(tm => tm.id === match.id)?.stage
      if (stageId) {
        const trackId = stageToTrackId.get(stageId)
        if (trackId) {
          match.track = trackId
        }
      }
    })

    return {
      stages: interleavedStages,
      matches: interleavedMatches,
      matchDependencies: interleavedDeps,
    }
  }

  private static async buildUpperBracket(
    tournamentId: string,
    sessionId: string,
    groups: { id: string }[],
    advancementCount: number,
    bracketSize: number,
    stageOffset: number
  ): Promise<{
    stages: Stage[]
    metas: UpperMatchMeta[]
    deps: MatchDependency[]
    matches: Match[]
  }> {
    const stagesList: Stage[] = []
    const metaList: UpperMatchMeta[] = []
    const depsList: MatchDependency[] = []
    const matchList: Match[] = []

    let roundNum = bracketSize
    let stageIndex = 0

    while (roundNum >= 2) {
      const matchesInRound = roundNum / 2
      const isFirstRound = roundNum === bracketSize

      // Create stage for this round
      const stage = await StageManager.createStage({
        tournament: tournamentId,
        bracket: 'upper',
        index: stageOffset + stageIndex,
        level: StageManager.getStageLevel(matchesInRound),
      })
      stagesList.push(stage)

      // Get track for this round (continue from trackIndexStart)
      // Track will be assigned after interleaving in generateBracketMatches
      // For now, create matches without a track
      for (let i = 0; i < matchesInRound; i++) {
        const tm = await TournamentMatchManager.createMatch({
          session: sessionId,
          stage: stage.id,
          index: i,
        })

        matchList.push(tm)
        metaList.push({
          tournamentMatchId: tm.id,
          round: roundNum,
          position: i,
        })

        if (isFirstRound) {
          // First round: source from groups
          const depsForMatch =
            await TournamentMatchManager.createGroupSourceDependencies(
              tm.id,
              i,
              groups,
              advancementCount
            )
          depsList.push(...depsForMatch)
        } else {
          // Later rounds: source from previous round winners
          const depsForMatch =
            await TournamentMatchManager.createWinnerSourceDependencies(
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
      metas: metaList,
      deps: depsList,
      matches: matchList,
    }
  }

  private static async createGroupSourceDependencies(
    toMatchId: string,
    index: number,
    groups: { id: string }[],
    advancementCount: number
  ): Promise<MatchDependency[]> {
    const deps: MatchDependency[] = []
    const groupCount = groups.length

    // Snake-style seeding: best players face worst advancing players
    // This ensures balanced matchups in the first bracket round

    // Determine which two groups are pairing in this match
    const groupAIndex = Math.floor(index / advancementCount) % groupCount
    const groupBIndex = (groupAIndex + 1) % groupCount

    // Determine which rank within each group
    const rankWithinPairing = index % advancementCount
    const slotAPosition = rankWithinPairing // 0 = 1st, 1 = 2nd, 2 = 3rd,  3 = 4th, etc.
    const slotBPosition = advancementCount - rankWithinPairing // Reverse order from other group

    // Slot A: from group A, in order
    if (slotAPosition <= advancementCount) {
      deps.push(
        await TournamentMatchManager.createMatchDependency({
          fromMatch: null,
          fromGroup: groups[groupAIndex].id,
          toMatch: toMatchId,
          fromPosition: slotAPosition,
          toSlot: 'A',
        })
      )
    }

    // Slot B: from group B, in reverse order (worst to best as A goes from best to worst)
    if (slotBPosition >= 1 && slotBPosition <= advancementCount) {
      deps.push(
        await TournamentMatchManager.createMatchDependency({
          fromMatch: null,
          fromGroup: groups[groupBIndex].id,
          toMatch: toMatchId,
          fromPosition: slotBPosition,
          toSlot: 'B',
        })
      )
    }

    return deps
  }

  private static async createWinnerSourceDependencies(
    toMatchId: string,
    meta: UpperMatchMeta[],
    roundNum: number,
    index: number
  ): Promise<MatchDependency[]> {
    const deps: MatchDependency[] = []
    const prev = meta.filter(m => m.round === roundNum * 2)

    if (prev[index * 2]) {
      deps.push(
        await TournamentMatchManager.createMatchDependency({
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
        await TournamentMatchManager.createMatchDependency({
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

  private static async buildLowerBracket(
    tournamentId: string,
    sessionId: string,
    upperMeta: UpperMatchMeta[],
    bracketSize: number,
    stageOffset: number
  ): Promise<{
    stages: Stage[]
    metas: LowerMatchMeta[]
    deps: MatchDependency[]
    matches: Match[]
  }> {
    const stagesList: Stage[] = []
    const tmsList: Match[] = []
    const metaList: LowerMatchMeta[] = []
    const depsList: MatchDependency[] = []

    let lowerRound = 1
    let stageIndex = 0

    // First lower round: losers from first upper round play each other
    const firstUpper = upperMeta.filter(m => m.round === bracketSize)
    const stage1 = await StageManager.createStage({
      tournament: tournamentId,
      bracket: 'lower',
      index: stageOffset + stageIndex,
      level: null,
    })
    stagesList.push(stage1)

    // Track will be assigned after interleaving
    for (let i = 0; i < Math.floor(firstUpper.length / 2); i++) {
      const tm = await TournamentMatchManager.createMatch({
        session: sessionId,
        stage: stage1.id,
        index: i,
      })

      tmsList.push(tm)
      metaList.push({
        tournamentMatchId: tm.id,
        round: lowerRound,
        position: i,
        isDropIn: false,
      })

      // Source: losers from first upper round
      depsList.push(
        await TournamentMatchManager.createMatchDependency({
          fromMatch: firstUpper[i * 2].tournamentMatchId,
          fromGroup: null,
          toMatch: tm.id,
          fromPosition: 2, // loser
          toSlot: 'A',
        }),
        await TournamentMatchManager.createMatchDependency({
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

      const dropInStage = await StageManager.createStage({
        tournament: tournamentId,
        bracket: 'lower',
        index: stageOffset + stageIndex,
      })
      stagesList.push(dropInStage)

      // Track will be assigned after interleaving
      for (let i = 0; i < count; i++) {
        const tm = await TournamentMatchManager.createMatch({
          session: sessionId,
          stage: dropInStage.id,
          index: i,
        })

        tmsList.push(tm)
        metaList.push({
          tournamentMatchId: tm.id,
          round: lowerRound,
          position: i,
          isDropIn: true,
        })

        depsList.push(
          await TournamentMatchManager.createMatchDependency({
            fromMatch: prevLower[i].tournamentMatchId,
            fromGroup: null,
            toMatch: tm.id,
            fromPosition: 1, // winner
            toSlot: 'A',
          }),
          await TournamentMatchManager.createMatchDependency({
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
        const survivorStage = await StageManager.createStage({
          tournament: tournamentId,
          bracket: 'lower',
          index: stageOffset + stageIndex,
        })
        stagesList.push(survivorStage)

        // Track will be assigned after interleaving
        for (let i = 0; i < Math.floor(prevDropIn.length / 2); i++) {
          const tm = await TournamentMatchManager.createMatch({
            session: sessionId,
            stage: survivorStage.id,
            index: i,
          })

          tmsList.push(tm)
          metaList.push({
            tournamentMatchId: tm.id,
            round: lowerRound,
            position: i,
            isDropIn: false,
          })

          depsList.push(
            await TournamentMatchManager.createMatchDependency({
              fromMatch: prevDropIn[i * 2].tournamentMatchId,
              fromGroup: null,
              toMatch: tm.id,
              fromPosition: 1, // winner
              toSlot: 'A',
            }),
            await TournamentMatchManager.createMatchDependency({
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
      matches: tmsList,
      metas: metaList,
      deps: depsList,
    }
  }

  private static async buildGrandFinal(
    tournamentId: string,
    sessionId: string,
    upperMeta: UpperMatchMeta[],
    lowerMeta: LowerMatchMeta[],
    stageOffset: number
  ): Promise<{
    stage: Stage
    match: Match
    deps: MatchDependency[]
  }> {
    const upperFinal = upperMeta.find(m => m.round === 2)

    let lowerFinal: LowerMatchMeta | undefined
    if (lowerMeta.length > 0) {
      const lastLowerRound = Math.max(...lowerMeta.map(m => m.round))
      lowerFinal = lowerMeta.find(m => m.round === lastLowerRound)
    }

    const stage = await StageManager.createStage({
      tournament: tournamentId,
      index: stageOffset,
      level: 'grand_final',
    })

    // Track will be assigned after interleaving
    const match = await TournamentMatchManager.createMatch({
      session: sessionId,
      stage: stage.id,
      index: 0,
    })

    const deps: MatchDependency[] = []
    if (upperFinal) {
      deps.push(
        await TournamentMatchManager.createMatchDependency({
          fromMatch: upperFinal.tournamentMatchId,
          fromGroup: null,
          toMatch: match.id,
          fromPosition: 1, // winner
          toSlot: 'A',
        })
      )
    }
    if (lowerFinal) {
      deps.push(
        await TournamentMatchManager.createMatchDependency({
          fromMatch: lowerFinal.tournamentMatchId,
          fromGroup: null,
          toMatch: match.id,
          fromPosition: 1, // winner
          toSlot: 'B',
        })
      )
    }

    return { stage, match, deps }
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
  static async resolveGroupDependentMatches(groupId: string) {
    const isGroupComplete = await GroupManager.isGroupComplete(groupId)
    if (!isGroupComplete) return

    // Find all dependencies from this group
    const deps = await db.query.matchDependencies.findMany({
      where: and(
        eq(matchDependencies.fromGroup, groupId),
        isNull(matchDependencies.deletedAt)
      ),
    })

    for (const dep of deps) {
      const user = await GroupManager.getUserAt(groupId, dep.fromPosition)

      // Find the match linked to the target tournament match
      const tm = await db.query.matches.findFirst({
        where: eq(matches.id, dep.toMatch),
      })
      if (!tm) continue

      await MatchManager.setPlayer(tm.id, dep.toSlot, user.id)
    }
  }

  /**
   * Resolve dependencies when a match is completed.
   * Finds all dependencies from this match and assigns users to next matches.
   */
  static async resolveMatchDependentMatches(matchId: string) {
    // Find all dependencies from this tournament match
    const deps = await db.query.matchDependencies.findMany({
      where: and(
        eq(matchDependencies.fromMatch, matchId),
        isNull(matchDependencies.deletedAt)
      ),
    })

    // Get the source tournament match to find its match
    const sourceTM = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
    })
    if (!sourceTM) return

    for (const dep of deps) {
      // Get user from the source match (position 1 = winner, 2 = loser)
      const userId = await MatchManager.getProgressedUser(
        sourceTM.id,
        dep.fromPosition
      )

      // Find the target match
      const targetTM = await db.query.matches.findFirst({
        where: eq(matches.id, dep.toMatch),
      })
      if (!targetTM) continue

      await MatchManager.setPlayer(targetTM.id, dep.toSlot, userId)
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
