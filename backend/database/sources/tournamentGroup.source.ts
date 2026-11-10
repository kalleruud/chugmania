import type { TournamentState } from '@common/models/tournament'
import { and, asc, eq, isNull } from 'drizzle-orm'
import db from '../database'
import { tournamentGroups } from '../schema'

export default class TournamentGroupSource {
  static getByTournament(tournament: string): TournamentState['groups'] {
    return db
      .select({
        id: tournamentGroups.id,
        name: tournamentGroups.name,
        position: tournamentGroups.position,
      })
      .from(tournamentGroups)
      .where(
        and(
          eq(tournamentGroups.tournament, tournament),
          isNull(tournamentGroups.deletedAt)
        )
      )
      .orderBy(asc(tournamentGroups.position))
      .all()
  }
  static rename(tournament: string, groupId: string, name: string): void {
    db.update(tournamentGroups)
      .set({ name, updatedAt: new Date() })
      .where(
        and(
          eq(tournamentGroups.tournament, tournament),
          eq(tournamentGroups.id, groupId),
          isNull(tournamentGroups.deletedAt)
        )
      )
      .run()
  }
}
