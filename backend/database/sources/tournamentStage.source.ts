import { and, eq, isNull } from 'drizzle-orm'
import db from '../database'
import { tournamentStages } from '../schema'

export default class TournamentStageSource {
  static getByTournament(tournament: string) {
    return db
      .select()
      .from(tournamentStages)
      .where(
        and(
          eq(tournamentStages.tournament, tournament),
          isNull(tournamentStages.deletedAt)
        )
      )
      .all()
  }
}
