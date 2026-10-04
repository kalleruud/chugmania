import type { TournamentState } from '@common/models/tournament'
import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import db, { database } from './database'
import {
  matches,
  sessions,
  sessionSignups,
  tournamentGroups,
  tournamentMatches,
  tournamentPlayers,
  tournaments,
  tournamentStages,
  tracks,
  users,
} from './schema'

export default class TournamentSource {
  static transaction<T>(work: () => T): T {
    return database.transaction(work)()
  }

  static getConfirmedPlayerIds(session: string): string[] {
    return db
      .selectDistinct({ user: sessionSignups.user })
      .from(sessionSignups)
      .innerJoin(users, eq(users.id, sessionSignups.user))
      .where(
        and(
          eq(sessionSignups.session, session),
          eq(sessionSignups.response, 'yes'),
          isNull(sessionSignups.deletedAt),
          isNull(users.deletedAt)
        )
      )
      .all()
      .map(row => row.user)
  }

  static findSession(
    session: string
  ): typeof sessions.$inferSelect | undefined {
    return db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, session), isNull(sessions.deletedAt)))
      .get()
  }

  static getAvailableTrackIds(): string[] {
    return db
      .select({ id: tracks.id })
      .from(tracks)
      .where(isNull(tracks.deletedAt))
      .all()
      .map(row => row.id)
  }

  static findMatchTournament(
    matchId: string
  ): typeof tournaments.$inferSelect | undefined {
    return db
      .select({ tournament: tournaments })
      .from(tournamentMatches)
      .innerJoin(tournaments, eq(tournaments.id, tournamentMatches.tournament))
      .where(
        and(
          eq(tournamentMatches.matchId, matchId),
          isNull(tournamentMatches.deletedAt)
        )
      )
      .get()?.tournament
  }

  static getActiveSessionIds(): string[] {
    return db
      .select({ session: tournaments.session })
      .from(tournaments)
      .where(isNull(tournaments.deletedAt))
      .all()
      .map(row => row.session)
  }

  static findActiveTournament(
    session: string
  ): typeof tournaments.$inferSelect | undefined {
    return db
      .select()
      .from(tournaments)
      .where(
        and(eq(tournaments.session, session), isNull(tournaments.deletedAt))
      )
      .get()
  }

  static loadTournament(session: string): TournamentState | null {
    const row = this.findActiveTournament(session)
    if (!row) return null
    const groupRows = db
      .select()
      .from(tournamentGroups)
      .where(
        and(
          eq(tournamentGroups.tournament, row.id),
          isNull(tournamentGroups.deletedAt)
        )
      )
      .orderBy(asc(tournamentGroups.position))
      .all()
    const playerRows = db
      .select()
      .from(tournamentPlayers)
      .where(
        and(
          eq(tournamentPlayers.tournament, row.id),
          isNull(tournamentPlayers.deletedAt)
        )
      )
      .all()
    const stageRows = db
      .select()
      .from(tournamentStages)
      .where(
        and(
          eq(tournamentStages.tournament, row.id),
          isNull(tournamentStages.deletedAt)
        )
      )
      .all()
    const fixtureRows = db
      .select({ fixture: tournamentMatches, match: matches })
      .from(tournamentMatches)
      .innerJoin(matches, eq(tournamentMatches.matchId, matches.id))
      .where(
        and(
          eq(tournamentMatches.tournament, row.id),
          isNull(tournamentMatches.deletedAt),
          isNull(matches.deletedAt)
        )
      )
      .all()
    return {
      id: row.id,
      config: {
        ...row.config,
        session: row.session,
        stageTracks: Object.fromEntries(
          stageRows.map(s => [s.stage, s.tracks])
        ),
      },
      participants: playerRows.map(p => ({
        user: p.user,
        rating: p.rating,
        admission: p.admission,
        groupId: p.groupId,
      })),
      groups: groupRows.map(g => ({
        id: g.id,
        name: g.name,
        position: g.position,
      })),
      fixtures: fixtureRows
        .map(({ fixture, match }) => ({
          id: fixture.id,
          groupId: fixture.groupId,
          bracket: fixture.bracket,
          round: fixture.round,
          order: fixture.order,
          slot1: fixture.slot1,
          slot2: fixture.slot2,
          finalResetStatus: fixture.finalResetStatus,
          match,
        }))
        .sort((a, b) => a.order - b.order),
      frozenAt: row.frozenAt ?? row.createdAt,
      notReadyReason: row.notReadyReason,
      cancelled:
        db.select().from(sessions).where(eq(sessions.id, session)).get()
          ?.status === 'cancelled',
    }
  }

  static saveTournament(state: TournamentState): void {
    const { session, stageTracks, ...config } = state.config
    const row = {
      id: state.id,
      session,
      config,
      frozenAt: state.frozenAt,
      notReadyReason: state.notReadyReason,
    }
    db.insert(tournaments)
      .values(row)
      .onConflictDoUpdate({ target: tournaments.id, set: row })
      .run()
    for (const [stage, tracks] of Object.entries(stageTracks)) {
      const row = {
        id: `${state.id}:${stage}`,
        tournament: state.id,
        stage,
        tracks,
      }
      db.insert(tournamentStages)
        .values(row)
        .onConflictDoUpdate({
          target: [tournamentStages.tournament, tournamentStages.stage],
          set: { tracks },
        })
        .run()
    }
    for (const group of state.groups) {
      const row = { ...group, tournament: state.id }
      db.insert(tournamentGroups)
        .values(row)
        .onConflictDoUpdate({ target: tournamentGroups.id, set: row })
        .run()
    }
    for (const player of state.participants) {
      const row = {
        ...player,
        id: `${state.id}:${player.user}`,
        tournament: state.id,
        deletedAt: null,
      }
      db.insert(tournamentPlayers)
        .values(row)
        .onConflictDoUpdate({ target: tournamentPlayers.id, set: row })
        .run()
    }
    for (const fixture of state.fixtures) {
      const { tournament: metadata, ...match } = fixture.match
      db.insert(matches)
        .values(match)
        .onConflictDoUpdate({ target: matches.id, set: match })
        .run()
      const { match: ignored, ...fields } = fixture
      const row = { ...fields, tournament: state.id, matchId: match.id }
      db.insert(tournamentMatches)
        .values(row)
        .onConflictDoUpdate({ target: tournamentMatches.id, set: row })
        .run()
    }
  }

  static removeTournament(
    session: string,
    { deleteMatches } = { deleteMatches: true }
  ): void {
    const state = this.loadTournament(session)
    if (!state) return
    const deletedAt = new Date()
    const relatedMatchIds = db
      .select({ id: tournamentMatches.matchId })
      .from(tournamentMatches)
      .where(eq(tournamentMatches.tournament, state.id))
    if (deleteMatches)
      db.update(matches)
        .set({ deletedAt })
        .where(inArray(matches.id, relatedMatchIds))
        .run()
    else
      db.update(matches)
        .set({ status: 'completed' })
        .where(
          and(
            inArray(matches.id, relatedMatchIds),
            eq(matches.status, 'cancelled'),
            isNotNull(matches.winner),
            isNull(matches.deletedAt)
          )
        )
        .run()
    for (const table of [
      tournamentStages,
      tournamentGroups,
      tournamentPlayers,
      tournamentMatches,
    ])
      db.update(table)
        .set({ deletedAt })
        .where(eq(table.tournament, state.id))
        .run()
    db.update(tournaments)
      .set({ deletedAt })
      .where(eq(tournaments.id, state.id))
      .run()
  }
}
