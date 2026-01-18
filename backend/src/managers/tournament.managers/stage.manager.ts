import loc from '@/lib/locales'
import db from '@backend/database/database'
import { stages, type StageLevel } from '@backend/database/schema'
import type {
  CreateStage,
  MatchWithTournamentDetails,
  Stage,
  TournamentStage,
} from '@common/models/tournament'
import { eq } from 'drizzle-orm'

export default class StageManager {
  private static async getMatches(
    stageId: string
  ): Promise<MatchWithTournamentDetails[]> {
    // TODO: Fetch matches
  }

  static async getStages(
    tournamentId: string,
    level?: StageLevel
  ): Promise<TournamentStage[]> {
    // TODO: Fetch all stages with corresponding matches
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
