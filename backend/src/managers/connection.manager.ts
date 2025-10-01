import type { Socket } from 'socket.io'
import type {
  BackendResponse,
  ErrorResponse,
} from '../../../common/models/responses'
import {
  WS_GET_LEADERBOARD,
  WS_GET_LEADERBOARD_SUMMARIES,
  WS_GET_PLAYER_DETAILS,
  WS_GET_PLAYER_SUMMARIES,
  WS_GET_TRACKS,
  WS_GET_USER_DATA,
  WS_GET_USERS,
  WS_IMPORT_CSV,
  WS_LOGIN_NAME,
  WS_POST_LAPTIME,
  WS_REGISTER_NAME,
} from '../../../common/utils/constants'
import AdminManager from './admin.manager'
import AuthManager from './auth.manager'
import LeaderboardManager from './leaderboard.manager'
import PlayerManager from './player.manager'
import TimeEntryManager from './timeEntry.manager'
import TrackManager from './track.manager'
import UserManager from './user.manager'

export default class ConnectionManager {
  static async connect(s: Socket) {
    console.debug(new Date().toISOString(), s.id, 'Connected')

    // Setup user handling
    ConnectionManager.setup(s, WS_LOGIN_NAME, AuthManager.onLogin)
    ConnectionManager.setup(s, WS_REGISTER_NAME, AuthManager.onRegister)
    ConnectionManager.setup(s, WS_GET_USER_DATA, AuthManager.onGetUserData)
    ConnectionManager.setup(s, WS_GET_USERS, UserManager.onGetUsers)

    // Setup leaderboard handling
    ConnectionManager.setup(
      s,
      WS_GET_LEADERBOARD,
      LeaderboardManager.onGetLeaderboard
    )
    ConnectionManager.setup(
      s,
      WS_GET_LEADERBOARD_SUMMARIES,
      LeaderboardManager.onGetLeaderboardSummaries
    )

    ConnectionManager.setup(
      s,
      WS_GET_PLAYER_SUMMARIES,
      PlayerManager.onGetPlayerSummaries
    )

    ConnectionManager.setup(
      s,
      WS_GET_PLAYER_DETAILS,
      PlayerManager.onGetPlayerDetails
    )

    // Setup track handling
    ConnectionManager.setup(s, WS_GET_TRACKS, TrackManager.onGetTracks)

    // Setup time entry handling
    ConnectionManager.setup(s, WS_POST_LAPTIME, TimeEntryManager.onPostLapTime)

    // Setup admin utilities
    ConnectionManager.setup(s, WS_IMPORT_CSV, AdminManager.onImportCsv)
  }

  static async disconnect(socket: Socket) {
    console.debug(new Date().toISOString(), socket.id, 'Disconnected')
  }

  private static async setup(
    s: Socket,
    event: string,
    handler: (s: Socket, request?: unknown) => Promise<BackendResponse>
  ) {
    s.on(event, async (arg, callback) =>
      handler(s, arg)
        .catch(err =>
          callback({
            success: false,
            message: err.message,
          } satisfies ErrorResponse)
        )
        .then(callback)
    )
  }
}
