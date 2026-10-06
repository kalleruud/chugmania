import {
  isMatchStage,
  type Slot,
  type TournamentConfig,
  type TournamentFixture,
  type TournamentState,
} from '@common/models/tournament'
import {
  and,
  asc,
  eq,
  getTableColumns,
  inArray,
  isNotNull,
  isNull,
} from 'drizzle-orm'
import type {
  IndexColumn,
  SQLiteTable,
  SQLiteUpdateSetSource,
} from 'drizzle-orm/sqlite-core'
import db, { database } from './database'
import {
  matches,
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

function activeTournamentRows(
  table:
    | typeof tournamentStages
    | typeof tournamentGroups
    | typeof tournamentPlayers
    | typeof tournamentMatches,
  tournament: string
) {
  return and(eq(table.tournament, tournament), isNull(table.deletedAt))
}

export default class TournamentSource {
  private static upsert<T extends SQLiteTable>(
    table: T,
    row: T['$inferInsert'] & SQLiteUpdateSetSource<T>,
    target: IndexColumn | IndexColumn[] = getTableColumns(table).id
  ): void {
    const set: SQLiteUpdateSetSource<T> = { ...row }
    Reflect.deleteProperty(set, 'id')
    db.insert(table).values(row).onConflictDoUpdate({ target, set }).run()
  }

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
    if (!row || row.status !== 'started') return null
    return {
      id: row.id,
      config: this.loadConfig(row),
      participants: this.loadPlayers(row.id),
      groups: this.loadGroups(row.id),
      tieBreakers: this.loadLaps(row),
      fixtures: this.loadFixtures(row.id),
      frozenAt: row.frozenAt ?? row.createdAt,
      notReadyReason: row.notReadyReason,
      cancelled:
        db.select().from(sessions).where(eq(sessions.id, session)).get()
          ?.status === 'cancelled',
    }
  }

  private static loadGroups(tournament: string): TournamentState['groups'] {
    return db
      .select({
        id: tournamentGroups.id,
        name: tournamentGroups.name,
        position: tournamentGroups.position,
      })
      .from(tournamentGroups)
      .where(activeTournamentRows(tournamentGroups, tournament))
      .orderBy(asc(tournamentGroups.position))
      .all()
  }

  private static loadPlayers(
    tournament: string
  ): TournamentState['participants'] {
    return db
      .select({
        user: tournamentPlayers.user,
        rating: tournamentPlayers.rating,
        globalRank: tournamentPlayers.globalRank,
        admission: tournamentPlayers.admission,
        groupId: tournamentPlayers.groupId,
      })
      .from(tournamentPlayers)
      .where(activeTournamentRows(tournamentPlayers, tournament))
      .all()
  }

  private static loadLaps(
    row: typeof tournaments.$inferSelect
  ): TournamentState['tieBreakers'] {
    if (!row.tieBreakerTrack) return []
    return db
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
  }

  private static loadFixtures(tournament: string): TournamentFixture[] {
    const slotRows = db
      .select({ slot: tournamentMatchSlots })
      .from(tournamentMatchSlots)
      .innerJoin(
        tournamentMatches,
        eq(tournamentMatches.id, tournamentMatchSlots.tournamentMatch)
      )
      .where(
        and(
          activeTournamentRows(tournamentMatches, tournament),
          isNull(tournamentMatchSlots.deletedAt)
        )
      )
      .all()
    const slots = new Map(
      slotRows.map(({ slot }) => [
        `${slot.tournamentMatch}:${slot.position}`,
        slot,
      ])
    )
    return db
      .select({ fixture: tournamentMatches, match: matches })
      .from(tournamentMatches)
      .innerJoin(matches, eq(tournamentMatches.matchId, matches.id))
      .where(
        and(
          activeTournamentRows(tournamentMatches, tournament),
          isNull(matches.deletedAt)
        )
      )
      .orderBy(asc(tournamentMatches.order))
      .all()
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
  }

  // Reuse required laps, restore applicable planned laps, and soft-delete unused
  // planned laps while retaining completed and cancelled results.
  static reconcileLaps(
    state: TournamentState,
    needs: Map<string, boolean>
  ): void {
    this.transaction(() => {
      const track = state.config.tieBreakerTrack
      if (!track) return
      const laps = new Map(state.tieBreakers.map(lap => [lap.user, lap]))
      for (const user of needs.keys()) {
        if (!laps.has(user))
          db.insert(timeEntries)
            .values({
              user,
              track,
              session: state.config.session,
              tieBreaker: true,
              status: 'planned',
            })
            .run()
      }
      for (const lap of state.tieBreakers) {
        if (
          lap.status !== 'planned' ||
          !!lap.deletedAt === !needs.has(lap.user)
        )
          continue
        db.update(timeEntries)
          .set({ deletedAt: needs.has(lap.user) ? null : new Date() })
          .where(eq(timeEntries.id, lap.id))
          .run()
      }
    })
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

  static loadConfig(row: typeof tournaments.$inferSelect): TournamentConfig {
    const stages = db
      .select()
      .from(tournamentStages)
      .where(activeTournamentRows(tournamentStages, row.id))
      .all()
    return {
      session: row.session,
      owner: row.owner,
      previewVisibility: row.previewVisibility,
      groupsCount: row.groupsCount,
      advancementCount: row.advancementCount,
      eliminationType: row.eliminationType,
      tieBreakerTrack: row.tieBreakerTrack,
      stageTracks: Object.fromEntries(
        stages.map(stage => [stage.stage, stage.tracks])
      ),
    }
  }

  static saveConfig(
    id: string,
    config: TournamentConfig,
    startedState?: Pick<TournamentState, 'frozenAt' | 'notReadyReason'>
  ): void {
    this.transaction(() => {
      const { stageTracks } = config
      const row: typeof tournaments.$inferInsert = {
        id,
        session: config.session,
        owner: config.owner,
        previewVisibility: config.previewVisibility,
        groupsCount: config.groupsCount,
        advancementCount: config.advancementCount,
        eliminationType: config.eliminationType,
        tieBreakerTrack: config.tieBreakerTrack,
        status: startedState ? 'started' : 'draft',
        frozenAt: startedState?.frozenAt ?? null,
        notReadyReason: startedState?.notReadyReason ?? null,
      }
      this.upsert(tournaments, row)
      db.update(tournamentStages)
        .set({ deletedAt: new Date() })
        .where(eq(tournamentStages.tournament, id))
        .run()
      for (const [stage, tracks] of Object.entries(stageTracks)) {
        if (!tracks || !isMatchStage(stage)) continue
        this.upsert(
          tournamentStages,
          {
            id: `${id}:${stage}`,
            tournament: id,
            stage,
            tracks,
            deletedAt: null,
          },
          [tournamentStages.tournament, tournamentStages.stage]
        )
      }
    })
  }

  static saveTournament(state: TournamentState): void {
    this.transaction(() => {
      this.saveConfig(state.id, state.config, state)
      for (const group of state.groups)
        this.upsert(tournamentGroups, { ...group, tournament: state.id })
      for (const player of state.participants) {
        this.upsert(tournamentPlayers, {
          ...player,
          id: `${state.id}:${player.user}`,
          tournament: state.id,
          deletedAt: null,
        })
      }
      for (const fixture of state.fixtures) this.saveFixture(state.id, fixture)
    })
  }

  private static saveFixture(
    tournament: string,
    fixture: TournamentFixture
  ): void {
    const { tournament: metadata, ...match } = fixture.match
    this.upsert(matches, match)
    const { match: ignored, slot1, slot2, ...fields } = fixture
    this.upsert(tournamentMatches, { ...fields, tournament, matchId: match.id })
    this.saveSlot(fixture.id, 1, slot1)
    this.saveSlot(fixture.id, 2, slot2)
  }

  private static saveSlot(
    tournamentMatch: string,
    position: 1 | 2,
    slot: Slot
  ): void {
    let slotHolderId: string
    if (slot.kind === 'player') slotHolderId = slot.user
    else if (slot.kind === 'group_rank') slotHolderId = slot.groupId
    else slotHolderId = slot.matchId
    this.upsert(
      tournamentMatchSlots,
      {
        id: `${tournamentMatch}:${position}`,
        tournamentMatch,
        position,
        kind: slot.kind,
        slotHolderId,
        rank: slot.kind === 'group_rank' ? slot.rank : null,
        overrideUser: slot.override ?? null,
        deletedAt: null,
      },
      [tournamentMatchSlots.tournamentMatch, tournamentMatchSlots.position]
    )
  }

  static removeTournament(
    session: string,
    { deleteMatches } = { deleteMatches: true }
  ): void {
    this.transaction(() => {
      const state = this.findActiveTournament(session)
      if (!state) return
      const deletedAt = new Date()
      const laps = state.status === 'started' ? this.loadLaps(state) : []
      for (const lap of laps) {
        if (lap.status === 'planned')
          db.update(timeEntries)
            .set({ deletedAt })
            .where(eq(timeEntries.id, lap.id))
            .run()
      }
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
      this.removeMatches(state.id, deleteMatches, deletedAt)
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
    })
  }

  private static removeMatches(
    tournament: string,
    deleteMatches: boolean,
    deletedAt: Date
  ): void {
    const related = inArray(
      matches.id,
      db
        .select({ id: tournamentMatches.matchId })
        .from(tournamentMatches)
        .where(eq(tournamentMatches.tournament, tournament))
    )
    const awarded = and(
      eq(matches.status, 'cancelled'),
      isNotNull(matches.winner),
      isNull(matches.deletedAt)
    )
    db.update(matches)
      .set(deleteMatches ? { deletedAt } : { status: 'completed' })
      .where(and(related, deleteMatches ? undefined : awarded))
      .run()
  }
}
