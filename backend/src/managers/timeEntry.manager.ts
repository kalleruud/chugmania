import type { EventReq, EventRes } from '@common/models/socket.io'
import type { TimeEntry } from '@common/models/timeEntry'
import {
  isCreateTimeEntryRequest,
  isEditTimeEntryRequest,
} from '@common/models/timeEntry'
import type { User } from '@common/models/user'
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import loc from '../../../frontend/lib/locales'
import db from '../../database/database'
import { timeEntries } from '../../database/schema'
import type { TypedSocket } from '../server'
import { broadcast } from '../server'
import AuthManager from './auth.manager'
import RatingManager from './rating.manager'
import UserManager from './user.manager'

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

  static async getAllBySession(sessionId: string): Promise<TimeEntry[]> {
    return await db
      .select()
      .from(timeEntries)
      .where(
        and(eq(timeEntries.session, sessionId), isNull(timeEntries.deletedAt))
      )
      .orderBy(desc(timeEntries.duration))
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

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Created time entry',
      request.duration
    )

    RatingManager.recalculate()
    broadcast('all_time_entries', await TimeEntryManager.getAllTimeEntries())
    broadcast('all_users', await UserManager.getAllUsers())
    broadcast('all_rankings', await RatingManager.onGetRatings())

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

    const user = await AuthManager.checkAuth(socket)

    // Get the lap time entry to check ownership
    const entries = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, request.id))

    const lapTime = entries[0]
    if (!lapTime) {
      throw new Error(loc.no.error.messages.not_in_db(request.id))
    }

    // Check permissions: admins/mods can edit any, users only their own
    const isModerator = user.role !== 'user'
    const isOwner = lapTime.user === user.id
    if (!isModerator && !isOwner) {
      throw new Error(loc.no.error.messages.insufficient_permissions)
    }

    let { type, id, ...updates } = request

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

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Updated time entry',
      request.id
    )

    await RatingManager.recalculate()

    broadcast('all_time_entries', await TimeEntryManager.getAllTimeEntries())
    broadcast('all_rankings', await RatingManager.onGetRatings())

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
