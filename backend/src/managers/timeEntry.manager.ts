import loc from '@common/locale/locales'
import type { EventReq, EventRes } from '@common/models/socket.io'
import type {
  CreateTimeEntry,
  EditTimeEntryRequest,
  TimeEntry,
} from '@common/models/timeEntry'
import {
  isCreateTimeEntryRequest,
  isEditTimeEntryRequest,
} from '@common/models/timeEntry'
import type { User } from '@common/models/user'
import TimeEntrySource from '../../database/timeEntry.source'
import TournamentSource from '../../database/tournament.source'
import TransactionSource from '../../database/transaction.source'
import { broadcast, type TypedSocket } from '../server'
import AuthManager from './auth.manager'
import MatchManager from './match.manager'
import RatingManager from './rating.manager'
import SessionManager from './session.manager'
import TournamentManager from './tournament/tournament.manager'

type TimeEntryUpdates = Partial<CreateTimeEntry> & {
  status: TimeEntry['status']
}

export default class TimeEntryManager {
  static readonly table = TimeEntrySource.table

  static import = TimeEntrySource.import
  static getAllLatestAfterSession = TimeEntrySource.getAllLatestAfterSession

  static async onPostTimeEntry(
    socket: TypedSocket,
    request: EventReq<'post_time_entry'>
  ): Promise<EventRes<'post_time_entry'>> {
    if (!isCreateTimeEntryRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('CreateTimeEntryRequest')
      )
    }
    if (request.tieBreaker) throw new Error(loc.no.tournament.owned)
    const user = await AuthManager.checkAuth(socket)

    const isModerator = user.role !== 'user'
    const isPostingOwnTime = request.user === user.id
    if (!isModerator && !isPostingOwnTime) {
      throw new Error(loc.no.error.messages.insufficient_permissions)
    }

    const { type, tieBreaker, webhookCapture, ...entry } = request
    const signupChanged = TransactionSource.run(() => {
      TimeEntrySource.create({
        ...entry,
        webhookCapture: isModerator ? webhookCapture : undefined,
        tieBreaker: false,
        status:
          (request.duration ?? 0) > 0
            ? 'completed'
            : (request.status ?? 'completed'),
      })
      return request.session && request.user
        ? SessionManager.ensureSessionSignup(request.session, request.user)
        : false
    })

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Created time entry',
      request.duration
    )

    RatingManager.recalculate()
    if (signupChanged) {
      broadcast('all_sessions', await SessionManager.getAllSessions())
    }
    broadcast('all_rankings', RatingManager.onGetRatings())
    TournamentManager.publish(socket.id)
    broadcast('all_time_entries', await TimeEntryManager.getAllTimeEntries())

    return {
      success: true,
    }
  }

  static async onEditTimeEntry(
    socket: TypedSocket,
    request: EventReq<'edit_time_entry'>
  ): Promise<EventRes<'edit_time_entry'>> {
    const { lapTime, updates } = await TimeEntryManager.prepareTimeEntryEdit(
      socket,
      request
    )
    const signupChanged = TimeEntryManager.saveTimeEntryEdit(lapTime, updates)
    console.debug(
      new Date().toISOString(),
      socket.id,
      'Updated time entry',
      request.id
    )
    await TimeEntryManager.publishTimeEntryEdit(
      signupChanged,
      lapTime.tieBreaker,
      socket.id
    )
    return { success: true }
  }

  private static async prepareTimeEntryEdit(
    socket: TypedSocket,
    request: EventReq<'edit_time_entry'>
  ): Promise<{ lapTime: TimeEntry; updates: TimeEntryUpdates }> {
    if (!isEditTimeEntryRequest(request))
      throw new Error(
        loc.no.error.messages.invalid_request('EditTimeEntryRequest')
      )
    if (request.tieBreaker !== undefined)
      throw new Error(loc.no.tournament.owned)
    const user = await AuthManager.checkAuth(socket)
    const lapTime = TimeEntrySource.findById(request.id)
    if (!lapTime || lapTime.deletedAt)
      throw new Error(loc.no.error.messages.not_in_db(request.id))
    const updates = TimeEntryManager.normalizeTimeEntryUpdates(request, lapTime)
    TimeEntryManager.validateTimeEntryEdit(user, lapTime, updates)
    return { lapTime, updates }
  }

  private static normalizeTimeEntryUpdates(
    request: EditTimeEntryRequest,
    lapTime: TimeEntry
  ): TimeEntryUpdates {
    const { type, id, webhookCapture, tieBreaker, ...updates } = request
    const processed = { ...updates }
    if (typeof updates.deletedAt === 'string')
      processed.deletedAt = new Date(updates.deletedAt)
    if (typeof updates.updatedAt === 'string')
      processed.updatedAt = new Date(updates.updatedAt)
    if (typeof updates.createdAt === 'string')
      processed.createdAt = new Date(updates.createdAt)
    const duration =
      processed.duration === undefined ? lapTime.duration : processed.duration
    const status =
      !lapTime.webhookCapture && (duration ?? 0) > 0
        ? 'completed'
        : (processed.status ?? lapTime.status)
    if (lapTime.tieBreaker && status === 'cancelled') processed.duration = null
    return { ...processed, status }
  }

  private static validateTimeEntryEdit(
    user: Pick<User, 'id' | 'role'>,
    lapTime: TimeEntry,
    updates: TimeEntryUpdates
  ): void {
    const isModerator = user.role !== 'user'
    const isUnclaimedEntry = lapTime.user === null
    if (!isModerator && lapTime.user !== user.id && !isUnclaimedEntry)
      throw new Error(loc.no.error.messages.insufficient_permissions)
    if (!isModerator && updates.user && updates.user !== user.id)
      throw new Error(loc.no.error.messages.insufficient_permissions)
    if (!lapTime.tieBreaker) return
    const duration =
      updates.duration === undefined ? lapTime.duration : updates.duration
    if (
      lapTime.deletedAt ||
      (lapTime.status === 'cancelled' && !isModerator) ||
      updates.deletedAt !== undefined ||
      (updates.user !== undefined && updates.user !== lapTime.user) ||
      (updates.track !== undefined && updates.track !== lapTime.track) ||
      (updates.session !== undefined && updates.session !== lapTime.session) ||
      (updates.status !== lapTime.status &&
        updates.status !== 'completed' &&
        !isModerator) ||
      (updates.status === 'completed' && (duration ?? 0) <= 0)
    )
      throw new Error(loc.no.tournament.owned)
  }

  private static saveTimeEntryEdit(
    lapTime: TimeEntry,
    updates: TimeEntryUpdates
  ): boolean {
    return TransactionSource.run(() => {
      const before =
        lapTime.tieBreaker && lapTime.session
          ? TournamentManager.getState(lapTime.session)
          : null
      if (before?.cancelled) throw new Error(loc.no.tournament.session)
      TimeEntrySource.update(lapTime.id, updates)
      if (before) TournamentManager.reconcile(before.config.session, before)
      const sessionId =
        updates.session === undefined ? lapTime.session : updates.session
      const userId = updates.user === undefined ? lapTime.user : updates.user
      return sessionId && userId && !updates.deletedAt
        ? SessionManager.ensureSessionSignup(sessionId, userId)
        : false
    })
  }

  private static async publishTimeEntryEdit(
    signupChanged: boolean,
    tieBreaker: boolean,
    actor: string
  ): Promise<void> {
    RatingManager.recalculate()
    if (signupChanged)
      broadcast('all_sessions', await SessionManager.getAllSessions())
    broadcast('all_rankings', RatingManager.onGetRatings())
    broadcast('all_time_entries', await TimeEntryManager.getAllTimeEntries())
    if (tieBreaker) broadcast('all_matches', await MatchManager.getAllMatches())
    TournamentManager.publish(actor)
  }

  static deleteTimeEntriesForUser = TimeEntrySource.deleteTimeEntriesForUser

  static async getAllTimeEntries(): Promise<TimeEntry[]> {
    return TournamentSource.visibleTimeEntries(await TimeEntrySource.getAll())
  }
}
