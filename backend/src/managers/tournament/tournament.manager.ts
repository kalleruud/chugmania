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
  type StartTournamentRequest,
  type TournamentConfig,
  type TournamentDetails,
  type TournamentState,
  type UpdateTournamentRequest,
} from '@common/models/tournament'
import { RATING_CONSTANTS } from '@common/utils/constants'
import { getTournamentStages } from '@common/utils/tournament'
import { createHash, randomUUID } from 'node:crypto'
import type { SessionStatus } from '../../../database/schema'
import TournamentSource from '../../../database/tournament.source'
import type { TypedSocket } from '../../server'
import { broadcast, broadcastTournaments } from '../../server'
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
import { generateTournament } from './tournament.generator'
import TournamentSecurity from './tournament.security'

type DraftInput = {
  id: string
  config: TournamentConfig
  participants: Participant[]
  available: Set<string>
  sessionStatus: SessionStatus
  requiredTracks: string[]
}

export default class TournamentManager {
  private static previews = new Map<string, TournamentDetails>()

  private static participants(config: TournamentConfig): Participant[] {
    const ratings = new Map(
      RatingManager.onGetRatings().map(rating => [rating.user, rating])
    )
    return TournamentSource.getConfirmedPlayerIds(config.session).map(user => {
      const rating = ratings.get(user)
      return {
        user,
        globalRank: rating?.ranking ?? null,
        rating: rating?.totalRating ?? RATING_CONSTANTS.NO_DATA_RATING,
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

  private static draftInput(id: string, config: TournamentConfig): DraftInput {
    const participants = this.participants(config)
    return {
      id,
      config,
      participants,
      available: new Set(TournamentSource.getAvailableTrackIds()),
      sessionStatus: this.session(config.session, true).status,
      requiredTracks: getTournamentStages(config, participants.length).flatMap(
        stage => config.stageTracks[stage] ?? []
      ),
    }
  }

  private static draftReadiness(
    input: DraftInput,
    state: TournamentState
  ): string | null {
    if (input.sessionStatus === 'cancelled') return loc.no.tournament.session
    if (!state.fixtures.length) return loc.no.tournament.awaitingSignups
    if (
      !input.config.tieBreakerTrack ||
      !input.available.has(input.config.tieBreakerTrack)
    )
      return loc.no.tournament.tieBreakerTrackRequired
    if (
      input.requiredTracks.some(id => !input.available.has(id)) ||
      state.fixtures.some(fixture => !fixture.match.track)
    )
      return loc.no.tournament.tracks
    return null
  }

  private static draftState(input: DraftInput): TournamentState {
    const config = {
      ...input.config,
      stageTracks: Object.fromEntries(
        Object.entries(input.config.stageTracks).map(([stage, tracks]) => [
          stage,
          tracks?.filter(id => input.available.has(id)),
        ])
      ),
    }
    const state = resolveTournament(
      generateTournament(input.id, config, input.participants)
    )
    return {
      ...state,
      config: input.config,
      cancelled: input.sessionStatus === 'cancelled',
      notReadyReason: this.draftReadiness(input, state),
    }
  }

  private static previewKey(input: DraftInput, configKey: string): string {
    return this.hash({
      configKey,
      participants: input.participants.toSorted((a, b) =>
        a.user.localeCompare(b.user)
      ),
      sessionStatus: input.sessionStatus,
      tracks: [...input.requiredTracks, input.config.tieBreakerTrack].map(
        id => [id, !!id && input.available.has(id)]
      ),
    })
  }

  static getDetails(session: string): TournamentDetails | null {
    const row = TournamentSource.findActiveTournament(session)
    if (!row || row.status === 'started') {
      this.previews.delete(session)
      if (!row) return null
      const state = TournamentSource.loadTournament(session)
      return state ? tournamentDetails(state) : null
    }
    const input = this.draftInput(row.id, TournamentSource.loadConfig(row))
    const configKey = this.configKey(row.id, input.config)
    const previewKey = this.previewKey(input, configKey)
    const cached = this.previews.get(session)
    if (cached?.previewKey === previewKey) return structuredClone(cached)
    const state = this.draftState(input)
    const details = { ...tournamentDetails(state), configKey, previewKey }
    this.previews.set(session, details)
    return structuredClone(details)
  }

  private static response(
    session: string,
    userId: string,
    message?: string
  ): EventRes<'update_tournament'> {
    const details = TournamentSecurity.view(this.getDetails(session), userId)
    if (message) return { success: false, message, details }
    return { success: true, details }
  }

  private static changeDraft(
    userId: string,
    request: UpdateTournamentRequest | StartTournamentRequest,
    change: (details: TournamentDetails) => void
  ): EventRes<'update_tournament'> {
    const updating = 'config' in request
    const session = updating ? request.config.session : request.session
    const key = updating ? 'configKey' : 'previewKey'
    const expectedKey = updating ? request.configKey : request.previewKey
    return TournamentSource.transaction(() => {
      this.session(session)
      if (!updating) RatingManager.recalculate()
      const details = this.getDetails(session)
      if (details)
        TournamentSecurity.authorize(
          userId,
          details.config,
          details.status,
          updating ? request.config : undefined
        )
      if (
        !details ||
        details.status !== 'draft' ||
        details[key] !== expectedKey
      )
        return this.response(session, userId, loc.no.tournament.conflict)
      change(details)
      return this.response(session, userId)
    })
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
    this.previews.delete(session)
  }

  static publish(actor: string | null = null): void {
    const details = TournamentManager.getAllTournaments()
    broadcastTournaments(details, actor)
  }

  static getAllTournaments(): TournamentDetails[] {
    return TournamentSource.getActiveSessionIds()
      .map(session => this.getDetails(session))
      .filter(details => details !== null)
  }

  static async onCreate(
    socket: TypedSocket,
    request: EventReq<'create_tournament'>
  ): Promise<EventRes<'create_tournament'>> {
    const user = await AuthManager.checkAuth(socket, ['admin', 'moderator'])
    if (!isTournamentRequest(request))
      throw new Error(loc.no.tournament.invalid)
    TournamentManager.session(request.session)
    const response = TournamentSource.transaction(() => {
      if (TournamentSource.findActiveTournament(request.session))
        throw new Error(loc.no.tournament.exists)
      TournamentSource.saveConfig(randomUUID(), {
        session: request.session,
        owner: user.id,
        previewVisibility: 'visible',
        groupsCount: 1,
        advancementCount: 2,
        eliminationType: 'single',
        stageTracks: {},
        tieBreakerTrack: null,
      })
      return TournamentManager.response(request.session, user.id)
    })
    TournamentManager.publish(socket.id)
    return response
  }

  static async onUpdate(
    socket: TypedSocket,
    request: EventReq<'update_tournament'>
  ): Promise<EventRes<'update_tournament'>> {
    const user = await AuthManager.checkAuth(socket)
    if (!isUpdateTournamentRequest(request))
      throw new Error(loc.no.tournament.invalid)
    const response = TournamentManager.changeDraft(
      user.id,
      request,
      details => {
        TournamentSource.saveConfig(details.id, request.config)
      }
    )
    if (response.success) TournamentManager.publish(socket.id)
    return response
  }

  static async onStart(
    socket: TypedSocket,
    request: EventReq<'start_tournament'>
  ): Promise<EventRes<'start_tournament'>> {
    const user = await AuthManager.checkAuth(socket)
    if (!isStartTournamentRequest(request))
      throw new Error(loc.no.tournament.invalid)
    const response = TournamentManager.changeDraft(
      user.id,
      { session: request.session, previewKey: request.previewKey },
      details => {
        const state = TournamentManager.draftState(
          TournamentManager.draftInput(details.id, details.config)
        )
        if (state.notReadyReason) throw new Error(state.notReadyReason)
        const now = new Date()
        state.frozenAt = now
        state.config.previewVisibility = 'visible'
        for (const fixture of state.fixtures) fixture.match.createdAt = now
        TournamentSource.saveTournament(state)
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
    const user = await AuthManager.checkAuth(socket)
    if (!isTournamentRequest(request))
      throw new Error(loc.no.tournament.invalid)
    TournamentManager.session(request.session, true)
    return TournamentManager.response(request.session, user.id)
  }

  static async onRenameGroup(
    socket: TypedSocket,
    request: EventReq<'rename_tournament_group'>
  ): Promise<EventRes<'rename_tournament_group'>> {
    const user = await AuthManager.checkAuth(socket)
    if (!isRenameTournamentGroupRequest(request))
      throw new Error(loc.no.tournament.invalidGroupName)
    TournamentManager.session(request.session, true)
    const details = TournamentSource.transaction(() => {
      const state = TournamentSource.loadTournament(request.session)
      if (state) TournamentSecurity.authorize(user.id, state.config, 'started')
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
    const view = TournamentSecurity.view(details, user.id)
    if (!view) throw new Error(loc.no.error.messages.insufficient_permissions)
    return { success: true, details: view }
  }

  static async onDelete(
    socket: TypedSocket,
    request: EventReq<'delete_tournament'>
  ): Promise<EventRes<'delete_tournament'>> {
    const user = await AuthManager.checkAuth(socket)
    if (!isDeleteTournamentRequest(request))
      throw new Error(loc.no.tournament.invalid)
    TournamentManager.session(request.session, true)
    const row = TournamentSource.findActiveTournament(request.session)
    if (row)
      TournamentSecurity.authorize(
        user.id,
        TournamentSource.loadConfig(row),
        row.status
      )
    else if (user.role === 'user')
      throw new Error(loc.no.error.messages.insufficient_permissions)
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
