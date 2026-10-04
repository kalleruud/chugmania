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
import { getTournamentStages } from '@common/utils/tournament'
import { randomUUID } from 'node:crypto'
import TournamentSource from '../../../database/tournament.source'
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
    return TournamentSource.getConfirmedPlayerIds(config.session).map(user => {
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

  private static session(session: string, allowCancelled = false) {
    const row = TournamentSource.findSession(session)
    if (!row || (!allowCancelled && row.status === 'cancelled'))
      throw new Error(loc.no.tournament.session)
    return row
  }

  private static details(session: string): TournamentDetails | null {
    const state = TournamentSource.loadTournament(session)
    return state ? tournamentDetails(state) : null
  }

  private static validate(
    config: TournamentConfig,
    creating: boolean
  ): TournamentState {
    this.session(config.session)
    const available = new Set(TournamentSource.getAvailableTrackIds())
    if (
      Object.values(config.stageTracks)
        .flatMap(tracks => tracks ?? [])
        .some(id => !available.has(id))
    )
      throw new Error(loc.no.tournament.tracks)
    const participants = this.participants(config)
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
    this.session(row.session)
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
    })
    return true
  }

  static remove(session: string, options = { deleteMatches: true }): void {
    TournamentSource.removeTournament(session, options)
  }

  static publish(actor: string | null = null): void {
    const details = this.getAllTournaments()
    const serialized = JSON.stringify(details)
    if (this.published === serialized) return
    this.published = serialized
    broadcast('all_tournaments', details, actor)
  }

  static getAllTournaments(): TournamentDetails[] {
    return TournamentSource.getActiveSessionIds().flatMap(session => {
      const details = this.details(session)
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
    TournamentSource.transaction(() =>
      TournamentManager.remove(request.session, {
        deleteMatches: request.deleteRelatedResults,
      })
    )
    RatingManager.recalculate()
    broadcast('all_rankings', RatingManager.onGetRatings())
    broadcast('all_matches', await MatchManager.getAllMatches())
    TournamentManager.publish(socket.id)
    return { success: true, details: null }
  }

  static enrich(rows: Match[]): Match[] {
    const details = new Map(
      this.getAllTournaments().flatMap(t => t.matches.map(m => [m.id, m]))
    )
    return rows.map(row => details.get(row.id) ?? row)
  }
}
