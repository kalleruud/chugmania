import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
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
    // 1. Determine relevant track IDs
    let trackIds: string[] = []

    if ('track' in request) {
      trackIds = [request.track]
    } else {
      // For a user, find all tracks they have played
      const userTracks = await db
        .selectDistinct({ id: timeEntries.track })
        .from(timeEntries)
        .where(
          and(eq(timeEntries.user, request.user), isNull(timeEntries.deletedAt))
        )
      trackIds = userTracks.map(t => t.id)
    }

    if (trackIds.length === 0) {
      return { success: true, entries: [] }
    }

    // 2. Fetch ALL time entries for these tracks to establish global context/ranking
    // Sort: Valid times first (asc), then DNFs (duration 0 or null) sorted by date (oldest first)
    const rows = await db
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

    const processedEntries: LeaderboardEntry[] = []
    const roundToHundredth = (ms: number) => Math.round(ms / 10) * 10

    // 3. Group by track to calculate gaps correctly per track
    const byTrack: Record<string, typeof rows> = {}
    for (const row of rows) {
      if (!byTrack[row.track]) byTrack[row.track] = []
      byTrack[row.track].push(row)
    }

    for (const trackEntries of Object.values(byTrack)) {
      const leader = trackEntries[0]?.duration
      // Only consider it a valid leader if it's not a DNF
      const hasValidLeader = leader && leader > 0

      for (let i = 0; i < trackEntries.length; i++) {
        const row = trackEntries[i]
        const isDnf = !row.duration || row.duration === 0

        if (isDnf) {
          // DNFs have no position or gaps
          processedEntries.push(row)
          continue
        }

        const prev = i > 0 ? trackEntries[i - 1].duration : null
        const next =
          i < trackEntries.length - 1 ? trackEntries[i + 1].duration : null

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

        processedEntries.push({
          ...row,
          gap,
        })
      }
    }

    // 4. Filter results to return only what was requested
    const finalEntries =
      'user' in request
        ? processedEntries.filter(e => e.user === request.user)
        : processedEntries

    return {
      success: true,
      entries: finalEntries,
    }
  }
}
