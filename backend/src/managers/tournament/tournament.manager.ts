import loc from '@common/locale/locales'
import type { EditMatchRequest, Match } from '@common/models/match'
import type { EventReq, EventRes } from '@common/models/socket.io'
import {
  isDeleteTournamentRequest,
  isRenameTournamentGroupRequest,
  isStartTournamentRequest,
  isTournamentRequest,
  isUpdateTournamentRequest,
  type Participant,
  type Slot,
  type TournamentConfig,
  type TournamentConflictResponse,
  type TournamentDetails,
  type TournamentState,
} from '@common/models/tournament'
import { RATING_CONSTANTS } from '@common/utils/constants'
import {
  getTournamentStages,
  validateConfiguration,
} from '@common/utils/tournament'
import { createHash, randomUUID } from 'node:crypto'
import TournamentSource from '../../../database/tournament.source'
import type { TypedSocket } from '../../server'
import { broadcast } from '../../server'
import AuthManager from '../auth.manager'
import MatchManager from '../match.manager'
import RatingManager from '../rating.manager'
import TimeEntryManager from '../timeEntry.manager'
import {
  editTournamentMatch,
  protectResults,
  resolveTournament,
  tieBreakerNeeds,
  tournamentDetails,
} from './tournament'
import {
  generateTournament,
  generateTournamentGroups,
} from './tournament.generator'

export default class TournamentManager {
  private static published = ''

  private static participants(config: TournamentConfig): Participant[] {
    const ratings = RatingManager.onGetRatings()
    return TournamentSource.getConfirmedPlayerIds(config.session).map(user => {
      return {
        user,
        globalRank: ratings.find(r => r.user === user)?.ranking ?? null,
        rating:
          ratings.find(r => r.user === user)?.totalRating ??
          RATING_CONSTANTS.NO_DATA_RATING,
        admission: 0,
        groupId: '',
      }
    })
  }

  private static session(session: string, allowCancelled = false) {
    const row = TournamentSource.findSession(session)
    if (!row || (!allowCancelled && row.status === 'cancelled'))
      throw new Error(loc.no.tournament.session)
    return row
  }

  private static configKey(id: string, config: TournamentConfig): string {
    return this.hash({
      id,
      ...config,
      stageTracks: Object.fromEntries(
        Object.entries(config.stageTracks).toSorted(([a], [b]) =>
          a.localeCompare(b)
        )
      ),
    })
  }

  private static hash(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex')
  }

  private static draftState(session: string): TournamentState {
    const row = TournamentSource.findActiveTournament(session)
    if (!row || row.status !== 'draft')
      throw new Error(loc.no.tournament.invalid)
    const config = TournamentSource.loadConfig(row)
    const participants = this.participants(config)
    const available = new Set(TournamentSource.getAvailableTrackIds())
    const cancelled = this.session(session, true).status === 'cancelled'
    const valid = validateConfiguration(
      participants.length,
      config.groupsCount,
      config.advancementCount,
      config.eliminationType
    )
    let state: TournamentState = {
      id: row.id,
      config,
      ...generateTournamentGroups(config, participants),
      fixtures: [],
      tieBreakers: [],
      frozenAt: null,
      notReadyReason: loc.no.tournament.awaitingSignups,
      cancelled,
    }
    if (valid) {
      const effectiveConfig = {
        ...config,
        stageTracks: Object.fromEntries(
          Object.entries(config.stageTracks).map(([stage, tracks]) => [
            stage,
            tracks?.filter(id => available.has(id)),
          ])
        ),
      }
      state = resolveTournament(
        generateTournament(effectiveConfig, participants)
      )
      state.id = row.id
      state.config = config
      state.cancelled = cancelled
      const invalidTracks = getTournamentStages(
        config,
        participants.length
      ).some(stage => config.stageTracks[stage]?.some(id => !available.has(id)))
      state.notReadyReason =
        invalidTracks || state.fixtures.some(f => !f.match.track)
          ? loc.no.tournament.tracks
          : null
    }
    if (
      valid &&
      (!config.tieBreakerTrack || !available.has(config.tieBreakerTrack))
    )
      state.notReadyReason = loc.no.tournament.tieBreakerTrackRequired
    if (cancelled) state.notReadyReason = loc.no.tournament.session
    return state
  }

  static getDetails(session: string): TournamentDetails | null {
    const row = TournamentSource.findActiveTournament(session)
    if (!row) return null
    if (row.status === 'started') {
      const state = TournamentSource.loadTournament(session)
      return state ? tournamentDetails(state) : null
    }
    const state = this.draftState(session)
    const configKey = this.configKey(row.id, state.config)
    const available = new Set(TournamentSource.getAvailableTrackIds())
    const requiredTracks = getTournamentStages(
      state.config,
      state.participants.length
    ).flatMap(stage => state.config.stageTracks[stage] ?? [])
    const previewKey = this.hash({
      configKey,
      participants: state.participants
        .map(p => ({ user: p.user, rating: p.rating }))
        .toSorted((a, b) => a.user.localeCompare(b.user)),
      sessionStatus: this.session(session, true).status,
      tracks: [...requiredTracks, state.config.tieBreakerTrack].map(id => [
        id,
        !!id && available.has(id),
      ]),
    })
    return { ...tournamentDetails(state), configKey, previewKey }
  }

  private static conflict(session: string): TournamentConflictResponse {
    return {
      success: false,
      code: 'conflict',
      message: loc.no.tournament.conflict,
      details: this.getDetails(session),
    }
  }

  private static remap(
    state: TournamentState,
    tournamentId: string
  ): TournamentState {
    const result = structuredClone(state)
    result.id = tournamentId
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

  static editMatch(request: EditMatchRequest): boolean {
    const row = TournamentSource.findMatchTournament(request.id)
    if (!row) return false
    TournamentManager.session(row.session)
    TournamentSource.transaction(() => {
      const state = TournamentSource.loadTournament(row.session)
      if (!state) throw new Error(loc.no.tournament.roster)
      const updated = editTournamentMatch(state, request)
      if (
        request.track !== undefined &&
        (!request.track ||
          !TournamentSource.getAvailableTrackIds().includes(request.track))
      )
        throw new Error(loc.no.tournament.tracks)
      TournamentSource.saveTournament(updated)
      TournamentManager.reconcile(row.session, state, request.id)
    })
    return true
  }

  static getState(session: string): TournamentState | null {
    return TournamentSource.loadTournament(session)
  }

  // Resolve assignments, synchronize stage tie-breaker laps, then resolve again
  // with the refreshed lap pool. Roll back if completed downstream matches change.
  static reconcile(
    session: string,
    before?: TournamentState,
    editing?: string
  ): void {
    TournamentSource.transaction(() => {
      const state = TournamentManager.getState(session)
      if (!state || state.cancelled || !state.config.tieBreakerTrack) return
      const automatic = resolveTournament(state)
      TournamentSource.reconcileLaps(automatic, tieBreakerNeeds(automatic))
      const refreshed = TournamentManager.getState(session)
      if (!refreshed) return
      const resolved = resolveTournament(refreshed)
      protectResults(before ?? state, resolved, editing)
      TournamentSource.saveTournament(resolved)
    })
  }

  static reconcileAll(): void {
    for (const session of TournamentSource.getActiveSessionIds())
      TournamentManager.reconcile(session)
  }

  static remove(session: string, options = { deleteMatches: true }): void {
    TournamentSource.removeTournament(session, options)
  }

  static publish(actor: string | null = null): void {
    const details = TournamentManager.getAllTournaments()
    const serialized = JSON.stringify(details)
    if (TournamentManager.published === serialized) return
    TournamentManager.published = serialized
    broadcast('all_tournaments', details, actor)
  }

  static getAllTournaments(): TournamentDetails[] {
    return TournamentSource.getActiveSessionIds().flatMap(session => {
      const details = this.getDetails(session)
      return details ? [details] : []
    })
  }

  static async onCreate(
    socket: TypedSocket,
    request: EventReq<'create_tournament'>
  ): Promise<EventRes<'create_tournament'>> {
    await AuthManager.checkAuth(socket, ['admin', 'moderator'])
    if (!isTournamentRequest(request))
      throw new Error(loc.no.tournament.invalid)
    TournamentManager.session(request.session)
    const response = TournamentSource.transaction(
      (): EventRes<'create_tournament'> => {
        if (TournamentSource.findActiveTournament(request.session))
          throw new Error(loc.no.tournament.exists)
        TournamentSource.saveConfig(randomUUID(), {
          session: request.session,
          groupsCount: 1,
          advancementCount: 2,
          eliminationType: 'single',
          stageTracks: {},
          tieBreakerTrack: null,
        })
        return {
          success: true,
          details: TournamentManager.getDetails(request.session),
        }
      }
    )
    TournamentManager.publish(socket.id)
    return response
  }

  static async onUpdate(
    socket: TypedSocket,
    request: EventReq<'update_tournament'>
  ): Promise<EventRes<'update_tournament'>> {
    await AuthManager.checkAuth(socket, ['admin', 'moderator'])
    if (!isUpdateTournamentRequest(request))
      throw new Error(loc.no.tournament.invalid)
    const response = TournamentSource.transaction(
      (): EventRes<'update_tournament'> => {
        TournamentManager.session(request.config.session)
        const row = TournamentSource.findActiveTournament(
          request.config.session
        )
        const details = TournamentManager.getDetails(request.config.session)
        if (
          !row ||
          row.status !== 'draft' ||
          details?.configKey !== request.configKey
        )
          return TournamentManager.conflict(request.config.session)
        TournamentSource.saveConfig(row.id, request.config)
        return {
          success: true,
          details: TournamentManager.getDetails(request.config.session),
        }
      }
    )
    if (response.success) TournamentManager.publish(socket.id)
    return response
  }

  static async onStart(
    socket: TypedSocket,
    request: EventReq<'start_tournament'>
  ): Promise<EventRes<'start_tournament'>> {
    await AuthManager.checkAuth(socket, ['admin', 'moderator'])
    if (!isStartTournamentRequest(request))
      throw new Error(loc.no.tournament.invalid)
    const response = TournamentSource.transaction(
      (): EventRes<'start_tournament'> => {
        TournamentManager.session(request.session)
        RatingManager.recalculate()
        const row = TournamentSource.findActiveTournament(request.session)
        const details = TournamentManager.getDetails(request.session)
        if (
          !row ||
          row.status !== 'draft' ||
          details?.previewKey !== request.previewKey
        )
          return TournamentManager.conflict(request.session)
        const state = TournamentManager.draftState(request.session)
        if (state.notReadyReason) throw new Error(state.notReadyReason)
        const frozen = TournamentManager.remap(state, row.id)
        frozen.frozenAt = new Date()
        TournamentSource.saveTournament(frozen)
        return {
          success: true,
          details: TournamentManager.getDetails(request.session),
        }
      }
    )
    if (response.success) {
      broadcast('all_matches', await MatchManager.getAllMatches())
      broadcast('all_time_entries', await TimeEntryManager.getAllTimeEntries())
      TournamentManager.publish(socket.id)
    }
    return response
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
      details: TournamentManager.getDetails(request.session),
    }
  }

  static async onRenameGroup(
    socket: TypedSocket,
    request: EventReq<'rename_tournament_group'>
  ): Promise<EventRes<'rename_tournament_group'>> {
    await AuthManager.checkAuth(socket, ['admin', 'moderator'])
    if (!isRenameTournamentGroupRequest(request))
      throw new Error(loc.no.tournament.invalidGroupName)
    TournamentManager.session(request.session, true)
    const details = TournamentSource.transaction(() => {
      const state = TournamentSource.loadTournament(request.session)
      if (!state?.groups.some(group => group.id === request.groupId))
        throw new Error(loc.no.tournament.invalidGroup)
      TournamentSource.renameGroup(
        state.id,
        request.groupId,
        request.name.trim()
      )
      const details = TournamentManager.getDetails(request.session)
      if (!details) throw new Error(loc.no.tournament.invalidGroup)
      return details
    })
    TournamentManager.publish(socket.id)
    return { success: true, details }
  }

  static async onDelete(
    socket: TypedSocket,
    request: EventReq<'delete_tournament'>
  ): Promise<EventRes<'delete_tournament'>> {
    await AuthManager.checkAuth(socket, ['admin', 'moderator'])
    if (!isDeleteTournamentRequest(request))
      throw new Error(loc.no.tournament.invalid)
    TournamentManager.session(request.session, true)
    TournamentSource.transaction(() =>
      TournamentManager.remove(request.session, {
        deleteMatches: request.deleteRelatedResults,
      })
    )
    RatingManager.recalculate()
    broadcast('all_rankings', RatingManager.onGetRatings())
    broadcast('all_matches', await MatchManager.getAllMatches())
    broadcast('all_time_entries', await TimeEntryManager.getAllTimeEntries())
    TournamentManager.publish(socket.id)
    return { success: true, details: null }
  }

  static enrich(rows: Match[]): Match[] {
    const details = new Map(
      this.getAllTournaments()
        .filter(t => t.status === 'started')
        .flatMap(t => t.matches.map(m => [m.id, m]))
    )
    return rows.map(row => details.get(row.id) ?? row)
  }
}
