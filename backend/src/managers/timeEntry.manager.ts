import { and, asc, eq, isNull } from 'drizzle-orm'
import { EventReq, EventRes } from '../../../common/models/socket.io'
import type {
  LeaderboardEntry,
  LeaderboardEntryGap,
} from '../../../common/models/timeEntry'
import {
  isCreateTimeEntryRequest,
  isEditTimeEntryRequest,
} from '../../../common/models/timeEntry'
import loc from '../../../frontend/lib/locales'
import db from '../../database/database'
import { timeEntries } from '../../database/schema'
import { broadcast, TypedSocket } from '../server'
import AuthManager from './auth.manager'
import LeaderboardManager from './leaderboard.manager'

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

    broadcast('all_leaderboards', await LeaderboardManager.getAllLeaderboards())

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

    broadcast('all_leaderboards', await LeaderboardManager.getAllLeaderboards())

    return {
      success: true,
    }
  }

  static async onGetAbsoluteTimeEntries(
    socket: TypedSocket,
    request: EventReq<'get_absolute_time_entries'>
  ): Promise<EventRes<'get_absolute_time_entries'>> {
    // Get all time entries for the user, grouped by track
    const rows = await db
      .select()
      .from(timeEntries)
      .where(
        and(
          'user' in request
            ? eq(timeEntries.user, request.user)
            : eq(timeEntries.track, request.track),
          isNull(timeEntries.deletedAt)
        )
      )
      .orderBy(asc(timeEntries.track), asc(timeEntries.duration))

    const entries: LeaderboardEntry[] = []
    const roundToHundredth = (ms: number) => Math.round(ms / 10) * 10

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const prev = i > 0 ? rows[i - 1].duration : null
      const next = i < rows.length - 1 ? rows[i + 1].duration : null
      const leader = rows[0]?.duration

      const gap: LeaderboardEntryGap = { position: i + 1 }

      if (row.duration && prev !== null) {
        gap.previous = roundToHundredth(row.duration - prev)
      }
      if (row.duration && leader !== null && i > 0 && leader !== undefined) {
        gap.leader = roundToHundredth(row.duration - leader)
      }
      if (row.duration && next !== null) {
        gap.next = roundToHundredth(next - row.duration)
      }

      entries.push({
        ...row,
        gap: gap,
      })
    }

    return {
      success: true,
      entries,
    }
  }
}
