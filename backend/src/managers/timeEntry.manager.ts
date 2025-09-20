import { isPostLapTimeRequest } from '@chugmania/common/models/requests.js'
import type {
  BackendResponse,
  SuccessResponse,
} from '@chugmania/common/models/responses.js'
import db from '@database/database'
import { timeEntries } from '@database/schema'
import type { Socket } from 'socket.io'
import AuthManager from './auth.manager'

export default class TimeEntryManager {
  static async onPostLapTime(
    s: Socket,
    request: unknown
  ): Promise<BackendResponse> {
    if (!isPostLapTimeRequest(request))
      throw Error('Invalid post lap time request')

    const { data: user, error } = await AuthManager.checkAuth(s)
    if (error)
      return {
        success: false,
        message: error.message,
      }

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

    return {
      success: true,
    } satisfies SuccessResponse
  }
}
