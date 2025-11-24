import { eq } from 'drizzle-orm'
import type { Socket } from 'socket.io'
import { WS_BROADCAST_LEADERBOARDS } from '../../../common/models/leaderboard'
import type {
  BackendResponse,
  SuccessResponse,
} from '../../../common/models/responses'
import { isCreateTimeEntryRequest } from '../../../common/models/timeEntry'
import loc from '../../../frontend/lib/locales'
import db from '../../database/database'
import { timeEntries } from '../../database/schema'
import AuthManager from './auth.manager'
import ConnectionManager from './connection.manager'
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
  static async onPostLapTime(
    s: Socket,
    request: unknown
  ): Promise<BackendResponse> {
    if (!isCreateTimeEntryRequest(request)) {
      throw new Error(loc.no.error.description)
    }

    const { data: user } = await AuthManager.checkAuth(s)

    const isModerator = user.role !== 'user'
    const isPostingOwnTime = request.user === user.id
    if (!isModerator && !isPostingOwnTime)
      return {
        success: false,
        message: `Role '${user.role}' is not allowed to post lap times for others.`,
      }

    await db.insert(timeEntries).values(request)

    console.debug(
      new Date().toISOString(),
      s.id,
      'Created time entry',
      request.duration
    )

    ConnectionManager.emit(
      WS_BROADCAST_LEADERBOARDS,
      await LeaderboardManager.onEmitLeaderboards()
    )

    return {
      success: true,
    } satisfies SuccessResponse
  }

  static async onEditLapTime(
    s: Socket,
    request: unknown
  ): Promise<BackendResponse> {
    if (!isEditLapTimeRequest(request))
      throw new Error('Invalid edit lap time request')

    console.log(request)

    const { data: user, error } = await AuthManager.checkAuth(s)
    if (error) return error

    // Get the lap time entry to check ownership
    const entries = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, request.id))

    if (entries.length === 0)
      return {
        success: false,
        message: 'Lap time entry not found.',
      }

    const lapTime = entries[0]

    // Check permissions: admins/mods can edit any, users only their own
    const isModerator = user.role !== 'user'
    const isOwner = lapTime.user === user.id
    if (!isModerator && !isOwner)
      return {
        success: false,
        message: `Role '${user.role}' is not allowed to edit this lap time.`,
      }

    // Build update object - exclude fields that shouldn't be updated
    const updateData: Partial<typeof timeEntries.$inferInsert> = {}
    if (request.duration !== undefined) updateData.duration = request.duration
    if (request.amount !== undefined) updateData.amount = request.amount
    if (request.comment !== undefined) updateData.comment = request.comment
    if (request.createdAt !== undefined)
      updateData.createdAt = new Date(request.createdAt)
    if (request.deletedAt) updateData.deletedAt = new Date(request.deletedAt)
    if (request.track !== undefined) updateData.track = request.track
    if (request.session !== undefined) updateData.session = request.session

    // Never update deletedAt or updatedAt manually, but do update the updatedAt timestamp
    updateData.updatedAt = new Date()

    await db
      .update(timeEntries)
      .set(updateData)
      .where(eq(timeEntries.id, request.id))

    console.debug(
      new Date().toISOString(),
      s.id,
      'Updated time entry',
      updateData,
      request.id
    )

    ConnectionManager.emit(
      WS_BROADCAST_LEADERBOARDS,
      await LeaderboardManager.onEmitLeaderboards()
    )

    return {
      success: true,
    } satisfies SuccessResponse
  }
}
