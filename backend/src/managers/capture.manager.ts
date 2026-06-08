import {
  isConfirmCaptureRequest,
  isDiscardCaptureRequest,
  isSetActiveSessionRequest,
  type CaptureState,
  type UnconfirmedRound,
} from '@common/models/capture'
import type { EventReq, EventRes } from '@common/models/socket.io'
import loc from '../../../frontend/lib/locales'
import db from '../../database/database'
import { broadcast, type TypedSocket } from '../server'
import AuthManager from './auth.manager'
import { isHeatPayload, isSupportedHeat } from './capture.logic'
import {
  confirmCapture,
  discardCapture,
  getUnconfirmedRounds,
  ingestHeat,
} from './capture.store'
import RatingManager from './rating.manager'

export default class CaptureManager {
  private static activeSessionId: string | null = null

  static getCaptureState(): CaptureState {
    return { activeSessionId: CaptureManager.activeSessionId }
  }

  static async getUnconfirmedRounds(): Promise<UnconfirmedRound[]> {
    return getUnconfirmedRounds(db)
  }

  // Called by the HTTP route. Returns true if the heat was stored, false if ignored.
  static async ingestHeat(body: unknown): Promise<boolean> {
    if (!isHeatPayload(body)) {
      throw new Error(loc.no.error.messages.invalid_request('CaptureHeatPayload'))
    }
    if (!isSupportedHeat(body)) {
      console.debug(new Date().toISOString(), 'Capture ignored — unsupported heat', body.heatId, body.playerCount, body.contractVersion)
      return false
    }
    if (!CaptureManager.activeSessionId) {
      console.debug(
        new Date().toISOString(),
        'Capture ignored — no active session',
        body.heatId
      )
      return false
    }
    await ingestHeat(db, body, CaptureManager.activeSessionId)
    broadcast('all_unconfirmed_rounds', await getUnconfirmedRounds(db))
    return true
  }

  static async onSetActiveSession(
    socket: TypedSocket,
    request: EventReq<'set_active_session'>
  ): Promise<EventRes<'set_active_session'>> {
    if (!isSetActiveSessionRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('SetActiveSessionRequest')
      )
    }
    await AuthManager.checkAuth(socket, ['admin', 'moderator'])
    CaptureManager.activeSessionId = request.sessionId
    broadcast('capture_state', CaptureManager.getCaptureState())
    return { success: true }
  }

  static async onConfirmCapture(
    socket: TypedSocket,
    request: EventReq<'confirm_capture'>
  ): Promise<EventRes<'confirm_capture'>> {
    if (!isConfirmCaptureRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('ConfirmCaptureRequest')
      )
    }
    await AuthManager.checkAuth(socket, ['admin', 'moderator'])
    await confirmCapture(db, request.heatId, request.assignments)

    await RatingManager.recalculate()
    broadcast('all_unconfirmed_rounds', await getUnconfirmedRounds(db))
    broadcast('all_time_entries', await TimeEntryFeed())
    broadcast('all_matches', await MatchFeed())
    broadcast('all_rankings', await RatingManager.onGetRatings())
    return { success: true }
  }

  static async onDiscardCapture(
    socket: TypedSocket,
    request: EventReq<'discard_capture'>
  ): Promise<EventRes<'discard_capture'>> {
    if (!isDiscardCaptureRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('DiscardCaptureRequest')
      )
    }
    await AuthManager.checkAuth(socket, ['admin', 'moderator'])
    await discardCapture(db, request.heatId)
    broadcast('all_unconfirmed_rounds', await getUnconfirmedRounds(db))
    return { success: true }
  }
}

async function TimeEntryFeed() {
  const { default: TimeEntryManager } = await import('./timeEntry.manager')
  return TimeEntryManager.getAllTimeEntries()
}

async function MatchFeed() {
  const { default: MatchManager } = await import('./match.manager')
  return MatchManager.getAllMatches()
}
