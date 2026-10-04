import loc from '@common/locale/locales'
import type { EditMatchRequest, Match } from '@common/models/match'
import type { EventReq, EventRes } from '@common/models/socket.io'
import {
  isDeleteTournamentRequest,
  isTournamentConfig,
  isTournamentRequest,
  type Participant,
  type Slot,
  type TournamentConfig,
  type TournamentDetails,
  type TournamentState,
} from '@common/models/tournament'
import { RATING_CONSTANTS } from '@common/utils/constants'
import { usedStages } from '@common/utils/tournament'
import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import db, { database } from '../../../database/database'
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
} from '../../../database/schema'
import type { TypedSocket } from '../../server'
import { broadcast } from '../../server'
import AuthManager from '../auth.manager'
import MatchManager from '../match.manager'
import RatingManager from '../rating.manager'
import {
  editTournamentMatch,
  resolveTournament,
  tournamentDetails,
} from './tournament'
import { generateTournament } from './tournament.generator'

export default class TournamentManager {
  private static published = ''

  private static participants(config: TournamentConfig): Participant[] {
    const ratings = RatingManager.onGetRatings()
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
      return {
        user,
        rating:
          ratings.find(r => r.user === user)?.totalRating ??
          RATING_CONSTANTS.NO_DATA_RATING,
        admission: 0,
        groupId: '',
      }
    })
  }

  private static active(session: string) {
    return db
      .select()
      .from(tournaments)
      .where(
        and(eq(tournaments.session, session), isNull(tournaments.deletedAt))
      )
      .get()
  }

  private static session(session: string, allowCancelled = false) {
    const row = db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, session), isNull(sessions.deletedAt)))
      .get()
    if (!row || (!allowCancelled && row.status === 'cancelled'))
      throw new Error(loc.no.tournament.session)
    return row
  }

  private static load(session: string): TournamentState | null {
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
          reset: fixture.reset,
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

  private static details(session: string): TournamentDetails | null {
    const state = this.load(session)
    return state ? tournamentDetails(state) : null
  }

  private static validate(
    config: TournamentConfig,
    creating: boolean
  ): TournamentState {
    this.session(config.session)
    const available = new Set(
      db
        .select({ id: tracks.id })
        .from(tracks)
        .where(isNull(tracks.deletedAt))
        .all()
        .map(t => t.id)
    )
    if (
      Object.values(config.stageTracks)
        .flat()
        .some(id => !available.has(id))
    )
      throw new Error(loc.no.tournament.tracks)
    const participants = this.participants(config)
    const state = resolveTournament(generateTournament(config, participants))
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

  private static remap(state: TournamentState): TournamentState {
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

  private static save(state: TournamentState): void {
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
    database.transaction(() => {
      const state = this.load(row.session)
      if (!state) throw new Error(loc.no.tournament.roster)
      const updated = editTournamentMatch(state, request)
      if (
        request.track !== undefined &&
        (!request.track ||
          !db
            .select()
            .from(tracks)
            .where(and(eq(tracks.id, request.track), isNull(tracks.deletedAt)))
            .get())
      )
        throw new Error(loc.no.tournament.tracks)
      this.save(updated)
    })()
    return true
  }

  static remove(
    session: string,
    { deleteMatches } = { deleteMatches: true }
  ): void {
    const state = this.load(session)
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
  static publish(actor: string | null = null): void {
    const details = this.getAllTournaments()
    const serialized = JSON.stringify(details)
    if (this.published === serialized) return
    this.published = serialized
    broadcast('all_tournaments', details, actor)
  }

  static getAllTournaments(): TournamentDetails[] {
    return db
      .select({ session: tournaments.session })
      .from(tournaments)
      .where(isNull(tournaments.deletedAt))
      .all()
      .flatMap(row => {
        const details = this.details(row.session)
        return details ? [details] : []
      })
  }

  static async onPreview(
    socket: TypedSocket,
    request: TournamentConfig
  ): Promise<EventRes<'preview_tournament'>> {
    await AuthManager.checkAuth(socket, ['admin', 'moderator'])
    if (!isTournamentConfig(request)) throw new Error(loc.no.tournament.invalid)
    const state = TournamentManager.validate(request, false)
    return {
      success: true,
      details: tournamentDetails(state),
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
      state.frozenAt = new Date()
      TournamentManager.save(state)
    })()
    broadcast('all_matches', await MatchManager.getAllMatches())
    TournamentManager.publish(socket.id)
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
    return {
      success: true,
      details: TournamentManager.details(request.session),
    }
  }

  static async onDelete(
    socket: TypedSocket,
    request: EventReq<'delete_tournament'>
  ): Promise<EventRes<'delete_tournament'>> {
    await AuthManager.checkAuth(socket, ['admin', 'moderator'])
    if (!isDeleteTournamentRequest(request))
      throw new Error(loc.no.tournament.invalid)
    TournamentManager.session(request.session, true)
    database.transaction(() =>
      TournamentManager.remove(request.session, {
        deleteMatches: request.deleteRelatedResults,
      })
    )()
    RatingManager.recalculate()
    broadcast('all_rankings', RatingManager.onGetRatings())
    broadcast('all_matches', await MatchManager.getAllMatches())
    TournamentManager.publish(socket.id)
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
