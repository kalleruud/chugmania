import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { EventReq, EventRes } from '../../../common/models/socket.io'
import type {
  LeaderboardEntry,
  LeaderboardEntryGap,
  TimeEntry,
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

    broadcast('all_time_entries', await TimeEntryManager.getAllTimeEntries())

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

    broadcast('all_time_entries', await TimeEntryManager.getAllTimeEntries())

    return {
      success: true,
    }
  }

  static async onGetAbsoluteTimeEntries(
    socket: TypedSocket,
    request: EventReq<'get_absolute_time_entries'>
  ): Promise<EventRes<'get_absolute_time_entries'>> {
    const trackIds = await TimeEntryManager.getRequestedTrackIds(request)
    if (trackIds.length === 0) {
      return { success: true, entries: [] }
    }

    const rows = await TimeEntryManager.fetchTimeEntriesForTracks(trackIds)

    // Group by track
    const byTrack: Record<string, typeof rows> = {}
    for (const row of rows) {
      if (!byTrack[row.track]) byTrack[row.track] = []
      byTrack[row.track].push(row)
    }

    const entries: LeaderboardEntry[] = []
    for (const trackEntries of Object.values(byTrack)) {
      entries.push(...TimeEntryManager.computeGaps(trackEntries))
    }

    const finalEntries =
      'user' in request ? entries.filter(e => e.user === request.user) : entries

    return {
      success: true,
      entries: finalEntries,
    }
  }

  private static async getRequestedTrackIds(
    request: EventReq<'get_absolute_time_entries'>
  ): Promise<string[]> {
    if ('track' in request) {
      return [request.track]
    }
    // For a user, find all tracks they have played
    const userTracks = await db
      .selectDistinct({ id: timeEntries.track })
      .from(timeEntries)
      .where(
        and(eq(timeEntries.user, request.user), isNull(timeEntries.deletedAt))
      )
    return userTracks.map(t => t.id)
  }

  private static async fetchTimeEntriesForTracks(trackIds: string[]) {
    return db
      .select()
      .from(timeEntries)
      .where(
        and(inArray(timeEntries.track, trackIds), isNull(timeEntries.deletedAt))
      )
      .orderBy(
        asc(timeEntries.track),
        asc(
          sql`CASE WHEN ${timeEntries.duration} IS NULL OR ${timeEntries.duration} = 0 THEN 1 ELSE 0 END`
        ),
        asc(timeEntries.duration),
        asc(timeEntries.createdAt)
      )
  }

  private static computeGaps<T extends { duration: number | null }>(
    entries: T[]
  ): (T & { gap?: LeaderboardEntryGap })[] {
    const leader = entries[0]?.duration
    const hasValidLeader = leader && leader > 0
    const roundToHundredth = (ms: number) => Math.round(ms / 10) * 10

    return entries.map((row, i) => {
      const isDnf = !row.duration
      if (isDnf) {
        return { ...row, gap: undefined }
      }

      const prev = i > 0 ? entries[i - 1].duration : null
      const next = i < entries.length - 1 ? entries[i + 1].duration : null
      const gap: LeaderboardEntryGap = { position: i + 1 }

      if (row.duration && prev && prev > 0) {
        gap.previous = roundToHundredth(row.duration - prev)
      }
      if (
        row.duration &&
        hasValidLeader &&
        leader !== undefined &&
        leader !== null &&
        i > 0
      ) {
        gap.leader = roundToHundredth(row.duration - leader)
      }
      if (row.duration && next && next > 0) {
        gap.next = roundToHundredth(next - row.duration)
      }

      return {
        ...row,
        gap,
      }
    })
  }

  static async getAllTimeEntries(): Promise<TimeEntry[]> {
    const data = await db
      .select()
      .from(timeEntries)
      .orderBy(asc(timeEntries.duration))

    return data
  }
}
