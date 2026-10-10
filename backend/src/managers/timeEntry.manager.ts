import loc from '@common/locale/locales'
import type { Session } from '@common/models/session'
import type { EventReq, EventRes } from '@common/models/socket.io'
import type {
  CreateTimeEntry,
  EditTimeEntryRequest,
  TimeEntry,
} from '@common/models/timeEntry'
import {
  isCreateTimeEntryRequest,
  isEditTimeEntryRequest,
  isPublishedTimeEntry,
} from '@common/models/timeEntry'
import type { User } from '@common/models/user'
import { and, asc, eq, getTableColumns, isNull, sql } from 'drizzle-orm'
import db, { database } from '../../database/database'
import { timeEntries } from '../../database/schema'
import TournamentSource from '../../database/tournament.source'
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
  static readonly table = timeEntries

  static async import(data: (typeof TimeEntryManager.table.$inferInsert)[]) {
    const tasks = data.map(d =>
      db
        .insert(TimeEntryManager.table)
        .values(data)
        .onConflictDoUpdate({ target: TimeEntryManager.table.id, set: d })
        .returning()
    )

    return (await Promise.all(tasks)).flat()
  }

  // Returns all latest lap times for each user after a session.
  static getAllLatestAfterSession(sessionId: Session['id']): TimeEntry[] {
    const latestDatePerUser = db
      .select({
        user: timeEntries.user,
        maxDate: sql<Date>`max(${timeEntries.createdAt})`.as('maxDate'),
      })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.session, sessionId),
          isNull(timeEntries.deletedAt),
          eq(timeEntries.publicationState, 'published'),
          eq(timeEntries.status, 'completed')
        )
      )
      .groupBy(timeEntries.user)
      .as('latest_date')

    const latestBestPerUser = db
      .select({
        user: timeEntries.user,
        createdAt: timeEntries.createdAt,
        minDuration: sql<number>`min(${timeEntries.duration})`.as(
          'minDuration'
        ),
      })
      .from(timeEntries)
      .innerJoin(
        latestDatePerUser,
        and(
          eq(timeEntries.user, latestDatePerUser.user),
          eq(timeEntries.createdAt, latestDatePerUser.maxDate)
        )
      )
      .where(
        and(
          eq(timeEntries.session, sessionId),
          isNull(timeEntries.deletedAt),
          eq(timeEntries.publicationState, 'published'),
          eq(timeEntries.status, 'completed')
        )
      )
      .groupBy(timeEntries.user, timeEntries.createdAt)
      .as('latest_best')

    return db
      .select({ ...getTableColumns(timeEntries) })
      .from(timeEntries)
      .innerJoin(
        latestBestPerUser,
        and(
          eq(timeEntries.user, latestBestPerUser.user),
          eq(timeEntries.createdAt, latestBestPerUser.createdAt),
          eq(timeEntries.duration, latestBestPerUser.minDuration)
        )
      )
      .where(
        and(
          eq(timeEntries.session, sessionId),
          isNull(timeEntries.deletedAt),
          eq(timeEntries.publicationState, 'published'),
          eq(timeEntries.status, 'completed')
        )
      )
      .all()
      .filter(isPublishedTimeEntry)
  }

  static async onPostTimeEntry(
    socket: TypedSocket,
    request: EventReq<'post_time_entry'>
  ): Promise<EventRes<'post_time_entry'>> {
    if (!isCreateTimeEntryRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('CreateTimeEntryRequest')
      )
    }
    const user = await AuthManager.checkAuth(socket)

    const isModerator = user.role !== 'user'
    const isPostingOwnTime = request.user === user.id
    if (!isModerator && !isPostingOwnTime) {
      throw new Error(loc.no.error.messages.insufficient_permissions)
    }

    const signupChanged = database.transaction(() => {
      db.insert(timeEntries)
        .values({
          id: request.id,
          user: request.user,
          track: request.track,
          session: request.session,
          duration: request.duration,
          amount: request.amount,
          comment: request.comment,
          tieBreaker: false,
          status:
            (request.duration ?? 0) > 0
              ? 'completed'
              : (request.status ?? 'completed'),
        })
        .run()
      return request.session
        ? SessionManager.ensureSessionSignup(request.session, request.user)
        : false
    })()

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
    const [user, lapTime] = await Promise.all([
      AuthManager.checkAuth(socket),
      db.query.timeEntries.findFirst({ where: eq(timeEntries.id, request.id) }),
    ])
    if (!lapTime || !isPublishedTimeEntry(lapTime))
      throw new Error(loc.no.error.messages.not_in_db(request.id))
    const updates = TimeEntryManager.normalizeTimeEntryUpdates(request, lapTime)
    TimeEntryManager.validateTimeEntryEdit(user, lapTime, updates)
    return { lapTime, updates }
  }

  private static normalizeTimeEntryUpdates(
    request: EditTimeEntryRequest,
    lapTime: TimeEntry
  ): TimeEntryUpdates {
    const updates = {
      user: request.user,
      track: request.track,
      session: request.session,
      duration: request.duration,
      status: request.status,
      amount: request.amount,
      comment: request.comment,
      deletedAt: request.deletedAt,
      updatedAt: request.updatedAt,
      createdAt: request.createdAt,
    }
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
      (duration ?? 0) > 0 ? 'completed' : (processed.status ?? lapTime.status)
    if (lapTime.tieBreaker && status === 'cancelled') processed.duration = null
    return { ...processed, status }
  }

  private static validateTimeEntryEdit(
    user: Pick<User, 'id' | 'role'>,
    lapTime: TimeEntry,
    updates: TimeEntryUpdates
  ): void {
    const isModerator = user.role !== 'user'
    if (!isModerator && lapTime.user !== user.id)
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
    return database.transaction(() => {
      const before =
        lapTime.tieBreaker && lapTime.session
          ? TournamentManager.getState(lapTime.session)
          : null
      if (before?.cancelled) throw new Error(loc.no.tournament.session)
      db.update(timeEntries)
        .set(updates)
        .where(eq(timeEntries.id, lapTime.id))
        .run()
      if (before) TournamentManager.reconcile(before.config.session, before)
      const sessionId =
        updates.session === undefined ? lapTime.session : updates.session
      const userId = updates.user ?? lapTime.user
      return sessionId && !updates.deletedAt
        ? SessionManager.ensureSessionSignup(sessionId, userId)
        : false
    })()
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

  static deleteTimeEntriesForUser(userId: User['id']): void {
    const deletedAt = new Date()
    db.update(timeEntries)
      .set({ deletedAt })
      .where(eq(timeEntries.user, userId))
      .run()
  }

  static async getAllTimeEntries(): Promise<TimeEntry[]> {
    const data = await db
      .select()
      .from(timeEntries)
      .where(
        and(
          isNull(timeEntries.deletedAt),
          eq(timeEntries.publicationState, 'published')
        )
      )
      .orderBy(
        asc(
          sql`CASE WHEN ${timeEntries.duration} IS NULL OR ${timeEntries.duration} = 0 THEN 1 ELSE 0 END`
        ),
        asc(timeEntries.duration),
        asc(timeEntries.createdAt)
      )

    return TournamentSource.visibleTimeEntries(
      data.filter(isPublishedTimeEntry)
    )
  }
}
