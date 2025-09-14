import type {
  BackendResponse,
  ErrorResponse,
} from '@chugmania/common/models/responses.js'
import {
  WS_GET_LEADERBOARD,
  WS_GET_LEADERBOARD_SUMMARIES,
  WS_GET_TRACK,
  WS_GET_TRACKS,
  WS_GET_USERS,
  WS_LOGIN_NAME,
  WS_POST_LAPTIME,
  WS_REGISTER_NAME,
} from '@chugmania/common/utils/constants.js'
import { Socket } from 'socket.io'
import AuthManager from './auth.manager'
import LeaderboardManager from './leaderboard.manager'
import TimeEntryManager from './timeEntry.manager'
import TrackManager from './track.manager'
import UserManager from './user.manager'

export default class ConnectionManager {
  static async connect(socket: Socket) {
    console.debug(new Date().toISOString(), socket.id, 'Connected')

    ConnectionManager.setupUserHandling(socket)
    ConnectionManager.setupLeaderboardHandling(socket)
    ConnectionManager.setupTrackHandling(socket)
    ConnectionManager.setupTimeEntryHandling(socket)
  }

  static async disconnect(socket: Socket) {
    console.debug(new Date().toISOString(), socket.id, 'Disconnected')
  }

  private static setupUserHandling(s: Socket) {
    ConnectionManager.setOn(s, WS_LOGIN_NAME, AuthManager.onLogin)
    ConnectionManager.setOn(s, WS_REGISTER_NAME, AuthManager.onRegister)
    ConnectionManager.setOn(s, WS_GET_USERS, UserManager.onGetUsers)
  }

  private static setupLeaderboardHandling(s: Socket) {
    ConnectionManager.setOn(
      s,
      WS_GET_LEADERBOARD,
      LeaderboardManager.onGetLeaderboard
    )
    ConnectionManager.setOn(
      s,
      WS_GET_LEADERBOARD_SUMMARIES,
      LeaderboardManager.onGetLeaderboardSummaries
    )
  }

  private static setupTimeEntryHandling(s: Socket) {
    ConnectionManager.setOn(s, WS_POST_LAPTIME, TimeEntryManager.onPostLapTime)
  }

  private static setupTrackHandling(s: Socket) {
    ConnectionManager.setOn(s, WS_GET_TRACKS, TrackManager.onGetTracks)
    ConnectionManager.setOn(s, WS_GET_TRACK, TrackManager.onGetTrack)
  }

  private static async setOn(
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
