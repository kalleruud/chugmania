import loc from '@common/locale/locales'
import type { Session } from '@common/models/session'
import type { EventReq, EventRes } from '@common/models/socket.io'
import type { TimeEntry } from '@common/models/timeEntry'
import {
  isCreateTimeEntryRequest,
  isEditTimeEntryRequest,
} from '@common/models/timeEntry'
import type { User } from '@common/models/user'
import { and, asc, eq, getTableColumns, isNull, sql } from 'drizzle-orm'
import db from '../../database/database'
import { timeEntries } from '../../database/schema'
import { broadcast, type TypedSocket } from '../server'
import AuthManager from './auth.manager'
import RatingManager from './rating.manager'
import SessionManager from './session.manager'

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
  static async getAllLatestAfterSession(
    sessionId: Session['id']
  ): Promise<TimeEntry[]> {
    const latestDatePerUser = db
      .select({
        user: timeEntries.user,
        maxDate: sql<Date>`max(${timeEntries.createdAt})`.as('maxDate'),
      })
      .from(timeEntries)
      .where(eq(timeEntries.session, sessionId))
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
      .groupBy(timeEntries.user, timeEntries.createdAt)
      .as('latest_best')

    return await db
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
      .where(eq(timeEntries.session, sessionId))
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

    await db.insert(timeEntries).values(request)
    const signupChanged = request.session
      ? await SessionManager.ensureSessionSignup(request.session, request.user)
      : false

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Created time entry',
      request.duration
    )

    await RatingManager.recalculate()
    broadcast('all_time_entries', await TimeEntryManager.getAllTimeEntries())
    if (signupChanged) {
      broadcast('all_sessions', await SessionManager.getAllSessions())
    }
    broadcast('all_rankings', RatingManager.onGetRatings())

    return {
      success: true,
    }
  }

  static async onEditTimeEntry(
    socket: TypedSocket,
    request: EventReq<'edit_time_entry'>
  ): Promise<EventRes<'edit_time_entry'>> {
    if (!isEditTimeEntryRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('EditTimeEntryRequest')
      )
    }

    const [user, lapTime] = await Promise.all([
      AuthManager.checkAuth(socket),
      db.query.timeEntries.findFirst({
        where: eq(timeEntries.id, request.id),
      }),
    ])
    if (!lapTime) {
      throw new Error(loc.no.error.messages.not_in_db(request.id))
    }

    // Check permissions: admins/mods can edit any, users only their own
    const isModerator = user.role !== 'user'
    const isOwner = lapTime.user === user.id
    if (!isModerator && !isOwner) {
      throw new Error(loc.no.error.messages.insufficient_permissions)
    }

    const { type, id, ...updates } = request

    // Convert string dates to Date objects
    const processedUpdates = { ...updates }
    if (typeof updates.deletedAt === 'string') {
      processedUpdates.deletedAt = new Date(updates.deletedAt)
    }
    if (typeof updates.updatedAt === 'string') {
      processedUpdates.updatedAt = new Date(updates.updatedAt)
    }
    if (typeof updates.createdAt === 'string') {
      processedUpdates.createdAt = new Date(updates.createdAt)
    }

    await db
      .update(timeEntries)
      .set(processedUpdates)
      .where(eq(timeEntries.id, request.id))
    const sessionId = processedUpdates.session ?? lapTime.session
    const userId = processedUpdates.user ?? lapTime.user
    const signupChanged = sessionId
      ? await SessionManager.ensureSessionSignup(sessionId, userId)
      : false

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Updated time entry',
      request.id
    )

    await RatingManager.recalculate()
    broadcast('all_time_entries', await TimeEntryManager.getAllTimeEntries())
    if (signupChanged) {
      broadcast('all_sessions', await SessionManager.getAllSessions())
    }
    broadcast('all_rankings', RatingManager.onGetRatings())

    return {
      success: true,
    }
  }

  static async deleteTimeEntriesForUser(userId: User['id']): Promise<void> {
    const deletedAt = new Date()
    await db
      .update(timeEntries)
      .set({ deletedAt })
      .where(eq(timeEntries.user, userId))
  }

  static async getAllTimeEntries(): Promise<TimeEntry[]> {
    const data = await db
      .select()
      .from(timeEntries)
      .where(isNull(timeEntries.deletedAt))
      .orderBy(
        asc(
          sql`CASE WHEN ${timeEntries.duration} IS NULL OR ${timeEntries.duration} = 0 THEN 1 ELSE 0 END`
        ),
        asc(timeEntries.duration),
        asc(timeEntries.createdAt)
      )

    return data
  }
}
