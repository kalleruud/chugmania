import loc from '@/lib/locales'
import db from '@backend/database/database'
import {
  groups,
  matchDependencies,
  matches,
  stages,
  type StageLevel,
} from '@backend/database/schema'
import type {
  CreateStage,
  MatchWithTournamentDetails,
  Stage,
  TournamentStage,
} from '@common/models/tournament'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { getStageName } from '../../utils/stage'

export default class StageManager {
  private static async getMatches(
    stageId: string,
    tournamentId: string,
    allStages: Stage[]
  ): Promise<MatchWithTournamentDetails[]> {
    const matchData = await db
      .select()
      .from(matches)
      .where(eq(matches.stage, stageId))
      .orderBy(asc(matches.index))

    const currentStage = allStages.find(s => s.id === stageId)
    if (!currentStage) {
      throw new Error(`Stage ${stageId} not found`)
    }

    // Fetch all dependencies targeting matches in this stage
    const matchIds = matchData.map(m => m.id)
    const deps = await db.query.matchDependencies.findMany({
      where: and(
        inArray(matchDependencies.toMatch, matchIds),
        isNull(matchDependencies.deletedAt)
      ),
    })

    // Build a map of match IDs to stage data for quick lookup
    const stageMap = new Map(allStages.map(s => [s.id, s]))

    // Build a map of all matches in this tournament for dependency resolution
    const allMatches = await db.query.matches.findMany({
      where: and(
        inArray(
          matches.stage,
          allStages.map(s => s.id)
        ),
        isNull(matches.deletedAt)
      ),
    })

    const matchMap = new Map(allMatches.map(m => [m.id, m]))

    // Fetch all groups in this tournament for group dependency resolution
    const allGroups = await db.query.groups.findMany({
      where: eq(groups.tournament, tournamentId),
    })

    const groupMap = new Map(allGroups.map(g => [g.id, g]))

    // Build dependency map: matchId -> dependencies targeting it
    const dependenciesByToMatch = new Map<string, typeof deps>()
    for (const dep of deps) {
      const existing = dependenciesByToMatch.get(dep.toMatch) || []
      existing.push(dep)
      dependenciesByToMatch.set(dep.toMatch, existing)
    }

    return matchData.map(match => {
      const { stage, index, ...cleanMatch } = match
      if (index === null)
        throw new Error(
          `Found a match (${cleanMatch.id}) with a stage and  without an index`
        )

      const matchDeps = dependenciesByToMatch.get(match.id) || []
      const depsBySlot = new Map<string, string>()

      for (const dep of matchDeps) {
        let source: string

        if (dep.fromGroup) {
          // Format: "{rank}. plass fra {groupName}"
          const group = groupMap.get(dep.fromGroup)
          if (group) {
            // fromPosition is 1-based (1 = 1st place, 2 = 2nd place, etc.)
            // group.index is 0-based, we pass it directly to groupName
            source = loc.no.tournament.sourceGroupPlaceholder(
              group.index,
              dep.fromPosition
            )
          } else {
            source = 'Ukjent'
          }
        } else if (dep.fromMatch) {
          // Format: "Vinner av {matchName}" or "Taper av {matchName}"
          const sourceMatch = matchMap.get(dep.fromMatch)
          const sourceStage =
            sourceMatch && stageMap.get(sourceMatch.stage || '')

          if (sourceMatch && sourceStage && sourceMatch.index !== null) {
            const stageName = getStageName(
              sourceStage.level,
              sourceStage.bracket,
              sourceStage.index
            )
            const matchName = loc.no.tournament.bracketMatchName(
              stageName,
              sourceMatch.index + 1
            )
            // Position 1 = winner, 2+ = loser
            const position = dep.fromPosition === 1 ? 1 : 2
            source = loc.no.tournament.sourceMatchPlaceholder(
              matchName,
              position
            )
          } else {
            source = 'Ukjent'
          }
        } else {
          source = 'Ukjent'
        }

        depsBySlot.set(dep.toSlot, source)
      }

      return {
        ...match,
        stage: stageId,
        index,
        dependencyNames:
          depsBySlot.size === 2
            ? {
                A: depsBySlot.get('A') || 'Ukjent',
                B: depsBySlot.get('B') || 'Ukjent',
              }
            : null,
      }
    })
  }

  static async getStages(
    tournamentId: string,
    level?: StageLevel
  ): Promise<TournamentStage[]> {
    const stagesList = await db
      .select()
      .from(stages)
      .where(
        and(
          eq(stages.tournament, tournamentId),
          level ? eq(stages.level, level) : undefined
        )
      )
      .orderBy(asc(stages.index))

    return Promise.all(
      stagesList.map(stage =>
        StageManager.getStageWithDetails(stage.id, tournamentId, stagesList)
      )
    )
  }

  static async createStage(draft: CreateStage): Promise<Stage> {
    const [stage] = await db.insert(stages).values(draft).returning()
    return stage
  }

  static async updateStageIndex(
    stageId: string,
    newIndex: number
  ): Promise<void> {
    await db
      .update(stages)
      .set({ index: newIndex })
      .where(eq(stages.id, stageId))
  }

  static async getStage(stageId: string) {
    const stage = await db.query.stages.findFirst({
      where: eq(stages.id, stageId),
    })

    if (!stage) throw new Error(loc.no.error.messages.not_in_db(stageId))
    return stage
  }

  private static async getStageWithDetails(
    stageId: string,
    tournamentId: string,
    allStages: Stage[]
  ): Promise<TournamentStage> {
    return {
      stage: await StageManager.getStage(stageId),
      matches: await StageManager.getMatches(stageId, tournamentId, allStages),
    }
  }

  static getStageLevel(matchesInRound: number): StageLevel {
    switch (matchesInRound) {
      case 1:
        return 'final'
      case 2:
        return 'semi'
      case 4:
        return 'quarter'
      case 8:
        return 'eight'
      case 16:
        return 'sixteen'
      default:
        throw new Error(`Invalid matches in round: ${matchesInRound}`)
    }
  }
}
