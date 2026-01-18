import loc from '@/lib/locales'
import db from '@backend/database/database'
import { matches, stages, type StageLevel } from '@backend/database/schema'
import type {
  CreateStage,
  MatchWithTournamentDetails,
  Stage,
  TournamentStage,
} from '@common/models/tournament'
import { and, asc, eq } from 'drizzle-orm'

export default class StageManager {
  private static async getMatches(
    stageId: string
  ): Promise<MatchWithTournamentDetails[]> {
    const matchData = await db
      .select()
      .from(matches)
      .where(eq(matches.stage, stageId))
      .orderBy(asc(matches.index))

    return matchData.map(match => {
      const { stage, index, ...cleanMatch } = match
      if (index === null)
        throw new Error(
          `Found a match (${cleanMatch.id}) with a stage and  without an index`
        )

      return {
        ...match,
        stage: stageId,
        index,
        dependencyNames: null,
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
      stagesList.map(stage => StageManager.getStageWithDetails(stage.id))
    )
  }

  static async createStage(draft: CreateStage): Promise<Stage> {
    const [stage] = await db.insert(stages).values(draft).returning()
    return stage
  }

  static async getStage(stageId: string) {
    const stage = await db.query.stages.findFirst({
      where: eq(stages.id, stageId),
    })

    if (!stage) throw new Error(loc.no.error.messages.not_in_db(stageId))
    return stage
  }

  static async getStageWithDetails(stageId: string): Promise<TournamentStage> {
    return {
      stage: await StageManager.getStage(stageId),
      matches: await StageManager.getMatches(stageId),
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
