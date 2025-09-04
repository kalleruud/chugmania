import {
  WS_CONNECT_NAME,
  WS_DISCONNECT_NAME,
  WS_GET_LEADERBOARD_NAME,
  WS_GET_TRACKS_NAME,
  WS_GET_TRACK_NAME,
  WS_LOGIN_NAME,
  WS_REGISTER_NAME,
} from '@chugmania/common/models/constants.js'
import type {
  GetTrackDetailsRequest,
  GetTrackLeaderboardRequest,
} from '@chugmania/common/models/requests.js'
import type { ErrorResponse } from '@chugmania/common/models/responses.js'
import { Server } from 'socket.io'
import AuthManager from './managers/auth.manager'
import ConnectionManager from './managers/connection.manager'
import TrackManager from './managers/track.manager'

const port = 6996
const io = new Server(port, { cors: { origin: '*' } })

await TrackManager.seed()

io.on(WS_CONNECT_NAME, s =>
  ConnectionManager.connect(s).then(() => {
    s.on(WS_LOGIN_NAME, (arg, c) =>
      AuthManager.onLogin(s, arg)
        .catch(err =>
          c({ success: false, message: err.message } satisfies ErrorResponse)
        )
        .then(c)
    )
    s.on(WS_REGISTER_NAME, (arg, c) =>
      AuthManager.onRegister(s, arg)
        .catch(err =>
          c({ success: false, message: err.message } satisfies ErrorResponse)
        )
        .then(c)
    )
    s.on(WS_GET_TRACKS_NAME, (_, c) =>
      TrackManager.getTracks()
        .then(tracks => c({ tracks }))
        .catch(err =>
          c({ success: false, message: err.message } satisfies ErrorResponse)
        )
    )
    s.on(WS_GET_TRACK_NAME, (arg: GetTrackDetailsRequest, c) =>
      TrackManager.getTrack(arg.id)
        .then(track => c(track))
        .catch(err =>
          c({ success: false, message: err.message } satisfies ErrorResponse)
        )
    )
    s.on(WS_GET_LEADERBOARD_NAME, (arg: GetTrackLeaderboardRequest, c) =>
      TrackManager.getLeaderboard(arg.id, arg.offset, arg.limit)
        .then(times => c({ times }))
        .catch(err =>
          c({ success: false, message: err.message } satisfies ErrorResponse)
        )
    )
    s.on(WS_DISCONNECT_NAME, () => ConnectionManager.disconnect(s))
  })
)

io.use((socket, next) => {
  AuthManager.checkAuth(socket)
    .catch(next)
    .then(() => next())
})
