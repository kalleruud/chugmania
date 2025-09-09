import type {
  BackendResponse,
  ErrorResponse,
} from '@chugmania/common/models/responses.js'
import {
  WS_GET_LEADERBOARD,
  WS_GET_LEADERBOARD_SUMMARIES,
  WS_LOGIN_NAME,
  WS_REGISTER_NAME,
} from '@chugmania/common/utils/constants.js'
import { Socket } from 'socket.io'
import AuthManager from './auth.manager'
import LeaderboardManager from './leaderboard.manager'

export default class ConnectionManager {
  static async connect(socket: Socket) {
    console.debug(new Date().toISOString(), socket.id, '✅ Connected')

    this.setupUserHandling(socket)
    this.setupLeaderboardHandling(socket)
  }

  static async disconnect(socket: Socket) {
    console.debug(new Date().toISOString(), socket.id, '🚫 Disconnected')
  }

  private static setupUserHandling(s: Socket) {
    this.setOn(s, WS_LOGIN_NAME, AuthManager.onLogin)
    this.setOn(s, WS_REGISTER_NAME, AuthManager.onRegister)
  }

  private static setupLeaderboardHandling(s: Socket) {
    this.setOn(s, WS_GET_LEADERBOARD, LeaderboardManager.onGetLeaderboard)
    this.setOn(
      s,
      WS_GET_LEADERBOARD_SUMMARIES,
      LeaderboardManager.onGetLeaderboardSummaries
    )
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
