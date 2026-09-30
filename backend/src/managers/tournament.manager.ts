import loc from '@common/locale/locales'
import type { EditMatchRequest, Match } from '@common/models/match'
import type { EventRes } from '@common/models/socket.io'
import {
  isTournamentConfig,
  isTournamentRequest,
  type Participant,
  type Slot,
  type TournamentConfig,
  type TournamentDetails,
  type TournamentState,
} from '@common/models/tournament'
import { RATING_CONSTANTS } from '@common/utils/constants'
import { usedStages, validConfiguration } from '@common/utils/tournament'
import { and, eq, isNull } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import db, { database } from '../../database/database'
import {
  matches,
  sessions,
  sessionSignups,
  timeEntries,
  tournamentGroups,
  tournamentMatches,
  tournamentPlayers,
  tournaments,
  tournamentStages,
  tracks,
  users,
} from '../../database/schema'
import type { TypedSocket } from '../server'
import { broadcast, broadcastTournament } from '../server'
import AuthManager from './auth.manager'
import MatchManager from './match.manager'
import RatingManager from './rating.manager'
import { tournamentDetails } from './tournament.details'
import { generateTournament, snakeGroup } from './tournament.draft'
import {
  decided,
  groupComplete,
  protectResults,
  resolveSlots,
} from './tournament.rules'

export default class TournamentManager {
  private static published = new Map<string, string>()
  static participants(config: TournamentConfig): Participant[] {
    const ratings = RatingManager.onGetRatings()
    const laps = db
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.session, config.session),
          eq(timeEntries.track, config.qualificationTrack),
          isNull(timeEntries.deletedAt)
        )
      )
      .all()
    const signups = db
      .select({ user: sessionSignups.user })
      .from(sessionSignups)
      .innerJoin(users, eq(users.id, sessionSignups.user))
      .where(
        and(
          eq(sessionSignups.session, config.session),
          eq(sessionSignups.response, 'yes'),
          isNull(sessionSignups.deletedAt),
          isNull(users.deletedAt)
        )
      )
      .all()
    return [...new Set(signups.map(s => s.user))].map(user => {
      const best = laps
        .filter(l => l.user === user && l.duration !== null && l.duration > 0)
        .sort(
          (a, b) =>
            (a.duration ?? 0) - (b.duration ?? 0) || a.id.localeCompare(b.id)
        )
        .at(0)
      return {
        user,
        duration: best?.duration ?? null,
        sourceEntry: best?.id ?? null,
        rating:
          ratings.find(r => r.user === user)?.totalRating ??
          RATING_CONSTANTS.NO_DATA_RATING,
        admission: 0,
        groupId: '',
      }
    })
  }
  static active(session: string) {
    return db
      .select()
      .from(tournaments)
      .where(
        and(eq(tournaments.session, session), isNull(tournaments.deletedAt))
      )
      .get()
  }
  static session(session: string, allowCancelled = false) {
    const row = db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, session), isNull(sessions.deletedAt)))
      .get()
    if (!row || (!allowCancelled && row.status === 'cancelled'))
      throw new Error(loc.no.tournament.session)
    return row
  }
  static load(session: string): TournamentState | null {
    const row = this.active(session)
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
        stageTracks: Object.fromEntries(
          stageRows.map(s => [s.stage, s.tracks])
        ),
      },
      participants: playerRows.map(p => ({
        user: p.user,
        duration: p.duration,
        sourceEntry: p.sourceEntry,
        rating: p.rating,
        admission: p.admission,
        groupId: p.groupId,
      })),
      groups: groupRows
        .map(g => ({ id: g.id, name: g.name }))
        .sort(
          (a, b) =>
            a.name.length - b.name.length || a.name.localeCompare(b.name)
        ),
      fixtures: fixtureRows
        .map(({ fixture, match }) => ({
          id: fixture.id,
          groupId: fixture.groupId,
          bracket: fixture.bracket,
          round: fixture.round,
          order: fixture.order,
          slot1: fixture.slot1,
          slot2: fixture.slot2,
          reset: fixture.reset,
          match,
        }))
        .sort((a, b) => a.order - b.order),
      frozenAt: row.frozenAt,
      admissionClosedAt: row.admissionClosedAt,
      notReadyReason: row.notReadyReason,
      cancelled:
        db.select().from(sessions).where(eq(sessions.id, session)).get()
          ?.status === 'cancelled',
    }
  }
  static details(session: string): TournamentDetails | null {
    const state = this.load(session)
    return state ? tournamentDetails(state) : null
  }
  static validate(
    config: TournamentConfig,
    creating: boolean
  ): TournamentState {
    this.session(config.session)
    if (creating && !config.name.trim())
      throw new Error(loc.no.tournament.invalid)
    const available = new Set(
      db
        .select({ id: tracks.id })
        .from(tracks)
        .where(isNull(tracks.deletedAt))
        .all()
        .map(t => t.id)
    )
    if (
      !available.has(config.qualificationTrack) ||
      Object.values(config.stageTracks)
        .flat()
        .some(id => !available.has(id))
    )
      throw new Error(loc.no.tournament.tracks)
    const participants = this.participants(config)
    const state = resolveSlots(generateTournament(config, participants))
    const stages = usedStages(config, participants.length)
    if (
      Object.keys(config.stageTracks).some(
        stage => !stages.some(s => s === stage)
      )
    )
      throw new Error(loc.no.tournament.invalid)
    if (creating && state.fixtures.some(f => !f.match.track))
      throw new Error(loc.no.tournament.tracks)
    return state
  }
  static remap(state: TournamentState): TournamentState {
    const result = structuredClone(state)
    result.id = randomUUID()
    const ids = new Map(
      [...result.groups, ...result.fixtures].map(row => [row.id, randomUUID()])
    )
    const id = (key: string) => {
      const value = ids.get(key)
      if (!value) throw new Error(loc.no.tournament.invalid)
      return value
    }
    const slot = (value: Slot): Slot => {
      if (value.kind === 'player') return value
      if (value.kind === 'group_rank')
        return { ...value, groupId: id(value.groupId) }
      return { ...value, matchId: id(value.matchId) }
    }
    result.groups.forEach(g => {
      g.id = id(g.id)
    })
    result.participants.forEach(p => {
      p.groupId = id(p.groupId)
    })
    result.fixtures.forEach(f => {
      f.id = id(f.id)
      f.groupId = f.groupId ? id(f.groupId) : null
      f.slot1 = slot(f.slot1)
      f.slot2 = slot(f.slot2)
      f.match.id = f.id
      f.match.createdAt = new Date()
    })
    return result
  }

  static reconcile(
    before: TournamentState,
    next: TournamentState
  ): TournamentState {
    const result = structuredClone(next)
    const ids = new Map<string, string>()
    for (const group of result.groups)
      ids.set(
        group.id,
        before.groups.find(g => g.name === group.name)?.id ?? randomUUID()
      )
    const key = (
      state: TournamentState,
      fixture: TournamentState['fixtures'][number]
    ): string => {
      if (fixture.groupId)
        return `${state.groups.find(g => g.id === fixture.groupId)?.name}:${[fixture.match.user1, fixture.match.user2].sort().join(':')}`
      const peers = state.fixtures.filter(
        f => f.bracket === fixture.bracket && f.round === fixture.round
      )
      return `${fixture.bracket}:${fixture.round}:${peers.indexOf(fixture)}`
    }
    const existing = new Map(before.fixtures.map(f => [key(before, f), f]))
    for (const fixture of result.fixtures)
      ids.set(
        fixture.id,
        existing.get(key(result, fixture))?.id ?? randomUUID()
      )
    const mapped = (id: string): string => {
      const value = ids.get(id)
      if (!value) throw new Error(loc.no.tournament.invalid)
      return value
    }
    const slot = (value: Slot): Slot => {
      if (value.kind === 'player') return value
      if (value.kind === 'group_rank')
        return { ...value, groupId: mapped(value.groupId) }
      return { ...value, matchId: mapped(value.matchId) }
    }
    result.fixtures = result.fixtures.map(fixture => {
      const previous = existing.get(key(result, fixture))
      const id = mapped(fixture.id)
      return {
        ...fixture,
        id,
        groupId: fixture.groupId ? mapped(fixture.groupId) : null,
        slot1: slot(fixture.slot1),
        slot2: slot(fixture.slot2),
        match: previous
          ? { ...previous.match }
          : { ...fixture.match, id, createdAt: new Date() },
      }
    })
    result.groups.forEach(g => {
      g.id = mapped(g.id)
    })
    result.participants.forEach(p => {
      p.groupId = mapped(p.groupId)
    })
    result.id = before.id
    result.frozenAt = before.frozenAt
    result.admissionClosedAt = before.admissionClosedAt
    result.cancelled = before.cancelled
    return resolveSlots(result)
  }
  static refreshAll(): void {
    for (const row of db
      .select()
      .from(tournaments)
      .where(isNull(tournaments.deletedAt))
      .all()) {
      const session = db
        .select()
        .from(sessions)
        .where(eq(sessions.id, row.session))
        .get()
      if (!session || session.deletedAt) {
        this.remove(row.session)
        continue
      }
      const before = this.load(row.session)
      if (!before || before.cancelled) continue
      const inputs = this.participants(before.config)
      if (!before.frozenAt) {
        if (
          !validConfiguration(
            inputs.length,
            before.config.groupsCount,
            before.config.advancementCount,
            before.config.eliminationType
          )
        ) {
          db.update(tournaments)
            .set({ notReadyReason: loc.no.tournament.roster })
            .where(eq(tournaments.id, before.id))
            .run()
          continue
        }
        const state = this.reconcile(
          before,
          generateTournament(before.config, inputs)
        )
        if (groupComplete(state)) {
          state.frozenAt = new Date()
          state.admissionClosedAt = new Date()
        }
        this.save(state)
      } else if (!before.admissionClosedAt) {
        const entrants = inputs
          .filter(
            p => !before.participants.some(existing => existing.user === p.user)
          )
          .sort((a, b) => a.user.localeCompare(b.user))
        if (!entrants.length) continue
        const players = [...before.participants]
        for (const entrant of entrants) {
          const admission = Math.max(-1, ...players.map(p => p.admission)) + 1
          players.push({
            ...entrant,
            admission,
            groupId:
              before.groups[snakeGroup(admission, before.groups.length)].id,
          })
        }
        this.save(
          this.reconcile(
            before,
            generateTournament(before.config, players, before.groups)
          )
        )
      }
    }
  }
  static commit<T>(write: () => T): T {
    try {
      return database.transaction(() => {
        const result = write()
        RatingManager.recalculate()
        this.refreshAll()
        return result
      })()
    } catch (error) {
      RatingManager.recalculate()
      throw error
    }
  }
  static save(state: TournamentState): void {
    const previous = this.load(state.config.session)
    if (previous) {
      const deletedAt = new Date()
      for (const fixture of previous.fixtures.filter(
        f => !state.fixtures.some(next => next.id === f.id)
      )) {
        db.update(matches)
          .set({ deletedAt })
          .where(eq(matches.id, fixture.match.id))
          .run()
        db.update(tournamentMatches)
          .set({ deletedAt })
          .where(eq(tournamentMatches.id, fixture.id))
          .run()
      }
      for (const player of previous.participants.filter(
        p => !state.participants.some(next => next.user === p.user)
      ))
        db.update(tournamentPlayers)
          .set({ deletedAt })
          .where(
            and(
              eq(tournamentPlayers.tournament, state.id),
              eq(tournamentPlayers.user, player.user)
            )
          )
          .run()
    }

    const { stageTracks, ...config } = state.config
    const row = {
      id: state.id,
      session: config.session,
      config,
      frozenAt: state.frozenAt,
      admissionClosedAt: state.admissionClosedAt,
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
        .onConflictDoUpdate({ target: tournamentStages.id, set: row })
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
  static editMatch(request: EditMatchRequest): boolean {
    const link = db
      .select()
      .from(tournamentMatches)
      .where(
        and(
          eq(tournamentMatches.matchId, request.id),
          isNull(tournamentMatches.deletedAt)
        )
      )
      .get()
    if (!link) return false
    const row = db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, link.tournament))
      .get()
    if (!row) throw new Error(loc.no.tournament.invalid)
    this.session(row.session)
    this.commit(() => {
      const state = this.load(row.session)
      if (!state || state.notReadyReason)
        throw new Error(loc.no.tournament.roster)
      const before = structuredClone(state)
      const fixture = state.fixtures.find(f => f.match.id === request.id)
      if (!fixture) throw new Error(loc.no.tournament.invalid)
      const match = fixture.match
      if (
        request.deletedAt ||
        (request.user1 !== undefined && request.user1 !== match.user1) ||
        (request.user2 !== undefined && request.user2 !== match.user2) ||
        (request.session !== undefined && request.session !== match.session) ||
        (request.stage !== undefined && request.stage !== match.stage)
      )
        throw new Error(loc.no.tournament.owned)
      if (
        !match.user1 ||
        !match.user2 ||
        fixture.reset === 'conditional' ||
        fixture.reset === 'unneeded'
      )
        throw new Error(loc.no.tournament.result)
      const status = request.status ?? match.status
      const winner =
        request.winner === undefined ? match.winner : request.winner
      if (
        !['planned', 'completed', 'cancelled'].includes(status) ||
        (winner !== null && winner !== match.user1 && winner !== match.user2) ||
        (status === 'planned' && winner) ||
        (status === 'completed' && !winner)
      )
        throw new Error(loc.no.tournament.result)
      Object.assign(match, { status, winner, updatedAt: new Date() })
      if (request.track !== undefined) {
        if (
          !request.track ||
          !db
            .select()
            .from(tracks)
            .where(and(eq(tracks.id, request.track), isNull(tracks.deletedAt)))
            .get()
        )
          throw new Error(loc.no.tournament.tracks)
        match.track = request.track
      }
      if (request.comment !== undefined) match.comment = request.comment
      if (request.duration !== undefined) match.duration = request.duration
      if (!state.frozenAt && fixture.bracket === 'group' && decided(match))
        state.frozenAt = new Date()
      const resolved = resolveSlots(state)
      protectResults(before, resolved, fixture.id)
      if (groupComplete(resolved) && !resolved.admissionClosedAt)
        resolved.admissionClosedAt = new Date()
      this.save(resolved)
    })
    return true
  }
  static remove(session: string): void {
    const state = this.load(session)
    if (!state) return
    const deletedAt = new Date()
    for (const fixture of state.fixtures)
      db.update(matches)
        .set({ deletedAt })
        .where(eq(matches.id, fixture.match.id))
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
  static async publish(actor: string | null = null): Promise<void> {
    for (const row of db.select().from(sessions).all()) {
      const details = this.details(row.id)
      const serialized = JSON.stringify(details)
      if (this.published.get(row.id) === serialized) continue
      this.published.set(row.id, serialized)
      broadcastTournament({ session: row.id, details, actor })
    }
    broadcast('all_matches', await MatchManager.getAllMatches())
  }
  static async onPreview(
    socket: TypedSocket,
    request: TournamentConfig
  ): Promise<EventRes<'preview_tournament'>> {
    await AuthManager.checkAuth(socket, ['admin', 'moderator'])
    if (!isTournamentConfig(request)) throw new Error(loc.no.tournament.invalid)
    return {
      success: true,
      details: tournamentDetails(TournamentManager.validate(request, false)),
    }
  }
  static async onCreate(
    socket: TypedSocket,
    request: TournamentConfig
  ): Promise<EventRes<'create_tournament'>> {
    await AuthManager.checkAuth(socket, ['admin', 'moderator'])
    if (!isTournamentConfig(request)) throw new Error(loc.no.tournament.invalid)
    database.transaction(() => {
      if (TournamentManager.active(request.session))
        throw new Error(loc.no.tournament.exists)
      const state = TournamentManager.remap(
        TournamentManager.validate(request, true)
      )
      if (groupComplete(state)) {
        state.frozenAt = new Date()
        state.admissionClosedAt = new Date()
      }
      TournamentManager.save(state)
    })()
    await TournamentManager.publish(socket.id)
    return {
      success: true,
      details: TournamentManager.details(request.session),
    }
  }
  static async onGet(
    socket: TypedSocket,
    request: { session: string }
  ): Promise<EventRes<'get_tournament'>> {
    await AuthManager.checkAuth(socket)
    if (!isTournamentRequest(request))
      throw new Error(loc.no.tournament.invalid)
    TournamentManager.session(request.session, true)
    await socket.join(`tournament:${request.session}`)
    return {
      success: true,
      details: TournamentManager.details(request.session),
    }
  }
  static async onDelete(
    socket: TypedSocket,
    request: { session: string }
  ): Promise<EventRes<'delete_tournament'>> {
    await AuthManager.checkAuth(socket, ['admin', 'moderator'])
    if (!isTournamentRequest(request))
      throw new Error(loc.no.tournament.invalid)
    TournamentManager.session(request.session, true)
    TournamentManager.commit(() => TournamentManager.remove(request.session))
    RatingManager.recalculate()
    broadcast('all_rankings', RatingManager.onGetRatings())
    await TournamentManager.publish(socket.id)
    return { success: true, details: null }
  }
  static enrich(rows: Match[]): Match[] {
    const details = new Map(
      db
        .select()
        .from(tournaments)
        .where(isNull(tournaments.deletedAt))
        .all()
        .flatMap(
          t => this.details(t.session)?.matches.map(m => [m.id, m]) ?? []
        )
    )
    return rows.map(row => details.get(row.id) ?? row)
  }
}
