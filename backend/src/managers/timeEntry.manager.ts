import { eq } from 'drizzle-orm'
import { EventReq, EventRes } from '../../../common/models/socket.io'
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

    const lapTime = entries.at(0)
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
    console.log('Editing...', JSON.stringify(updates))

    await db
      .update(timeEntries)
      .set(updates)
      .where(eq(timeEntries.id, request.id))

    console.log('Editing...', JSON.stringify(updates))
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
}
