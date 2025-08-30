import {
  WS_CONNECT_NAME,
  WS_DISCONNECT_NAME,
  WS_LOGIN_NAME,
} from '@chugmania/common/models/constants.js'
import type { ErrorResponse } from '@chugmania/common/models/responses.js'
import { Server } from 'socket.io'
import AuthManager from './managers/auth.manager'
import ConnectionManager from './managers/connection.manager'

const port = 6996
const io = new Server(port, { cors: { origin: '*' } })

io.on(WS_CONNECT_NAME, s =>
  ConnectionManager.connect(s).then(() => {
    s.on(WS_LOGIN_NAME, (arg, c) =>
      AuthManager.onLogin(s, arg)
        .catch(err =>
          c({ success: false, message: err.message } satisfies ErrorResponse)
        )
        .then(c)
    )
    s.on(WS_DISCONNECT_NAME, () => ConnectionManager.disconnect(s))
  })
)

io.use((socket, next) => {
  AuthManager.checkAuth(socket)
    .catch(next)
    .then(() => next())
})
