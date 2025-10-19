import type { Socket } from 'socket.io'
import type {
  BackendResponse,
  ErrorResponse,
} from '../../../common/models/responses'
import {
  WS_CREATE_SESSION,
  WS_DELETE_SESSION,
  WS_EXPORT_CSV,
  WS_GET_LEADERBOARD,
  WS_GET_LEADERBOARD_SUMMARIES,
  WS_GET_PLAYER_DETAILS,
  WS_GET_PLAYER_SUMMARIES,
  WS_GET_SESSIONS,
  WS_GET_TRACKS,
  WS_GET_USER_DATA,
  WS_GET_USERS,
  WS_IMPORT_CSV,
  WS_JOIN_SESSION,
  WS_LEAVE_SESSION,
  WS_LOGIN_NAME,
  WS_POST_LAPTIME,
  WS_REGISTER_NAME,
  WS_UPDATE_SESSION,
} from '../../../common/utils/constants'
import AdminManager from './admin.manager'
import AuthManager from './auth.manager'
import LeaderboardManager from './leaderboard.manager'
import PlayerManager from './player.manager'
import SessionManager from './session.manager'
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

    // Setup session handling
    ConnectionManager.setup(s, WS_GET_SESSIONS, SessionManager.onGetSessions)
    ConnectionManager.setup(
      s,
      WS_CREATE_SESSION,
      SessionManager.onCreateSession
    )
    ConnectionManager.setup(
      s,
      WS_UPDATE_SESSION,
      SessionManager.onUpdateSession
    )
    ConnectionManager.setup(
      s,
      WS_DELETE_SESSION,
      SessionManager.onDeleteSession
    )
    ConnectionManager.setup(s, WS_JOIN_SESSION, SessionManager.onJoinSession)
    ConnectionManager.setup(s, WS_LEAVE_SESSION, SessionManager.onLeaveSession)

    // Setup admin utilities
    ConnectionManager.setup(s, WS_IMPORT_CSV, AdminManager.onImportCsv)
    ConnectionManager.setup(s, WS_EXPORT_CSV, AdminManager.onExportCsv)
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
