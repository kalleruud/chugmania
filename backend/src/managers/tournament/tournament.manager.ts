import loc from '@common/locale/locales'
import type { EditMatchRequest, Match } from '@common/models/match'
import type { EventReq, EventRes } from '@common/models/socket.io'
import {
  isDeleteTournamentRequest,
  isRenameTournamentGroupRequest,
  isTournamentConfig,
  isTournamentRequest,
  type Participant,
  type Slot,
  type TournamentConfig,
  type TournamentDetails,
  type TournamentState,
} from '@common/models/tournament'
import { RATING_CONSTANTS } from '@common/utils/constants'
import { getTournamentStages } from '@common/utils/tournament'
import { randomUUID } from 'node:crypto'
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
import { generateTournament } from './tournament.generator'

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

  static details(session: string): TournamentDetails | null {
    const state = TournamentSource.loadTournament(session)
    return state ? tournamentDetails(state) : null
  }

  private static validate(
    config: TournamentConfig,
    creating: boolean
  ): TournamentState {
    TournamentManager.session(config.session)
    const available = new Set(TournamentSource.getAvailableTrackIds())
    if (
      Object.values(config.stageTracks)
        .flatMap(tracks => tracks ?? [])
        .some(id => !available.has(id))
    )
      throw new Error(loc.no.tournament.tracks)
    if (
      (config.tieBreakerTrack && !available.has(config.tieBreakerTrack)) ||
      (creating && !config.tieBreakerTrack)
    )
      throw new Error(loc.no.tournament.tieBreakerTrackRequired)
    const participants = TournamentManager.participants(config)
    const state = resolveTournament(generateTournament(config, participants))
    const stages = getTournamentStages(config, participants.length)
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
      const details = TournamentManager.details(session)
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
    TournamentSource.transaction(() => {
      if (TournamentSource.findActiveTournament(request.session))
        throw new Error(loc.no.tournament.exists)
      const state = TournamentManager.remap(
        TournamentManager.validate(request, true)
      )
      state.frozenAt = new Date()
      TournamentSource.saveTournament(state)
    })
    broadcast('all_matches', await MatchManager.getAllMatches())
    broadcast('all_time_entries', await TimeEntryManager.getAllTimeEntries())
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
      const details = TournamentManager.details(request.session)
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
      TournamentManager.getAllTournaments().flatMap(t =>
        t.matches.map(m => [m.id, m])
      )
    )
    return rows.map(row => details.get(row.id) ?? row)
  }
}
