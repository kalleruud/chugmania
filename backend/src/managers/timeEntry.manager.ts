import { isPostLapTimeRequest } from '@chugmania/common/models/requests.js'
import type {
  BackendResponse,
  SuccessResponse,
} from '@chugmania/common/models/responses.js'
import db from '@database/database'
import { timeEntries } from '@database/schema'
import type { Socket } from 'socket.io'

export default class TimeEntryManager {
  static async onPostLapTime(
    s: Socket,
    request: unknown
  ): Promise<BackendResponse> {
    if (!isPostLapTimeRequest(request))
      throw Error('Invalid post lap time request')

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
