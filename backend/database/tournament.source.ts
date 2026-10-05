import type { Slot, TournamentState } from '@common/models/tournament'
import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import db, { database } from './database'
import {
  matches,
  type MatchStage,
  sessions,
  sessionSignups,
  timeEntries,
  tournamentGroups,
  tournamentMatches,
  tournamentMatchSlots,
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
    const row = TournamentSource.findActiveTournament(session)
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
    const slotRows = db
      .select({ slot: tournamentMatchSlots })
      .from(tournamentMatchSlots)
      .innerJoin(
        tournamentMatches,
        eq(tournamentMatches.id, tournamentMatchSlots.tournamentMatch)
      )
      .where(
        and(
          eq(tournamentMatches.tournament, row.id),
          isNull(tournamentMatchSlots.deletedAt),
          isNull(tournamentMatches.deletedAt)
        )
      )
      .all()
    const slots = new Map(
      slotRows.map(({ slot }) => [
        `${slot.tournamentMatch}:${slot.position}`,
        slot,
      ])
    )
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
        groupsCount: row.groupsCount,
        advancementCount: row.advancementCount,
        eliminationType: row.eliminationType,
        session: row.session,
        tieBreakerTrack: row.tieBreakerTrack,
        stageTracks: Object.fromEntries(
          stageRows.map(s => [s.stage, s.tracks])
        ),
      },
      participants: playerRows.map(p => ({
        user: p.user,
        rating: p.rating,
        globalRank: p.globalRank,
        admission: p.admission,
        groupId: p.groupId,
      })),
      groups: groupRows.map(g => ({
        id: g.id,
        name: g.name,
        position: g.position,
      })),
      tieBreakers: row.tieBreakerTrack
        ? db
            .select()
            .from(timeEntries)
            .where(
              and(
                eq(timeEntries.session, row.session),
                eq(timeEntries.track, row.tieBreakerTrack),
                eq(timeEntries.tieBreaker, true)
              )
            )
            .all()
        : [],
      fixtures: fixtureRows
        .map(({ fixture, match }) => ({
          id: fixture.id,
          groupId: fixture.groupId,
          bracket: fixture.bracket,
          round: fixture.round,
          order: fixture.order,
          slot1: TournamentSource.readSlot(slots.get(`${fixture.id}:1`)),
          slot2: TournamentSource.readSlot(slots.get(`${fixture.id}:2`)),
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

  // Reuse required laps, restore applicable planned laps, and soft-delete unused
  // planned laps while retaining completed and cancelled results.
  static reconcileLaps(
    state: TournamentState,
    needs: Map<string, boolean>
  ): void {
    const track = state.config.tieBreakerTrack
    if (!track) return
    const laps = new Map(state.tieBreakers.map(lap => [lap.user, lap]))
    for (const user of needs.keys()) {
      const lap = laps.get(user)
      if (!lap)
        db.insert(timeEntries)
          .values({
            user,
            track,
            session: state.config.session,
            tieBreaker: true,
            status: 'planned',
          })
          .run()
      else if (lap.status === 'planned' && lap.deletedAt)
        db.update(timeEntries)
          .set({ deletedAt: null })
          .where(eq(timeEntries.id, lap.id))
          .run()
    }
    for (const lap of state.tieBreakers) {
      if (lap.status === 'planned' && !lap.deletedAt && !needs.has(lap.user))
        db.update(timeEntries)
          .set({ deletedAt: new Date() })
          .where(eq(timeEntries.id, lap.id))
          .run()
    }
  }

  private static readSlot(
    row: typeof tournamentMatchSlots.$inferSelect | undefined
  ): Slot {
    if (!row) throw new Error('Tournament match slot is missing')
    const override = row.overrideUser ? { override: row.overrideUser } : {}
    if (row.kind === 'player')
      return { kind: row.kind, user: row.slotHolderId, ...override }
    if (row.kind === 'group_rank') {
      if (row.rank === null) throw new Error('Tournament group rank is missing')
      return {
        kind: row.kind,
        groupId: row.slotHolderId,
        rank: row.rank,
        ...override,
      }
    }
    return { kind: row.kind, matchId: row.slotHolderId, ...override }
  }

  static renameGroup(tournament: string, groupId: string, name: string): void {
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

  static saveTournament(state: TournamentState): void {
    const { session, stageTracks, ...config } = state.config
    const row = {
      id: state.id,
      session,
      ...config,
      frozenAt: state.frozenAt,
      notReadyReason: state.notReadyReason,
    }
    db.insert(tournaments)
      .values(row)
      .onConflictDoUpdate({ target: tournaments.id, set: row })
      .run()
    for (const [stage, tracks] of Object.entries(stageTracks)) {
      if (!tracks) continue
      const row = {
        id: `${state.id}:${stage}`,
        tournament: state.id,
        stage: stage as MatchStage,
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
      const { match: ignored, slot1, slot2, ...fields } = fixture
      const row = { ...fields, tournament: state.id, matchId: match.id }
      db.insert(tournamentMatches)
        .values(row)
        .onConflictDoUpdate({ target: tournamentMatches.id, set: row })
        .run()
      const slots: [1 | 2, Slot][] = [
        [1, slot1],
        [2, slot2],
      ]
      for (const [position, slot] of slots) {
        let slotHolderId: string
        if (slot.kind === 'player') slotHolderId = slot.user
        else if (slot.kind === 'group_rank') slotHolderId = slot.groupId
        else slotHolderId = slot.matchId
        const fields = {
          tournamentMatch: fixture.id,
          position,
          kind: slot.kind,
          slotHolderId,
          rank: slot.kind === 'group_rank' ? slot.rank : null,
          overrideUser: slot.override ?? null,
          deletedAt: null,
        }
        db.insert(tournamentMatchSlots)
          .values({ id: `${fixture.id}:${position}`, ...fields })
          .onConflictDoUpdate({
            target: [
              tournamentMatchSlots.tournamentMatch,
              tournamentMatchSlots.position,
            ],
            set: fields,
          })
          .run()
      }
    }
  }

  static removeTournament(
    session: string,
    { deleteMatches } = { deleteMatches: true }
  ): void {
    const state = TournamentSource.loadTournament(session)
    if (!state) return
    const deletedAt = new Date()
    for (const lap of state.tieBreakers) {
      if (lap.status === 'planned')
        db.update(timeEntries)
          .set({ deletedAt })
          .where(eq(timeEntries.id, lap.id))
          .run()
    }
    const relatedMatchIds = db
      .select({ id: tournamentMatches.matchId })
      .from(tournamentMatches)
      .where(eq(tournamentMatches.tournament, state.id))
    db.update(tournamentMatchSlots)
      .set({ deletedAt })
      .where(
        inArray(
          tournamentMatchSlots.tournamentMatch,
          db
            .select({ id: tournamentMatches.id })
            .from(tournamentMatches)
            .where(eq(tournamentMatches.tournament, state.id))
        )
      )
      .run()
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
