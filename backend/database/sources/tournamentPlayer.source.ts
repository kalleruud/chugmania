import type { TournamentState } from '@common/models/tournament'
import { and, eq, isNull } from 'drizzle-orm'
import db from '../database'
import { tournamentPlayers } from '../schema'

export default class TournamentPlayerSource {
  static getByTournament(tournament: string): TournamentState['participants'] {
    return db
      .select({
        user: tournamentPlayers.user,
        rating: tournamentPlayers.rating,
        globalRank: tournamentPlayers.globalRank,
        admission: tournamentPlayers.admission,
        groupId: tournamentPlayers.groupId,
      })
      .from(tournamentPlayers)
      .where(
        and(
          eq(tournamentPlayers.tournament, tournament),
          isNull(tournamentPlayers.deletedAt)
        )
      )
      .all()
  }
}
