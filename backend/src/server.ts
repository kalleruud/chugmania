import {
  WS_CONNECT_NAME,
  WS_DISCONNECT_NAME,
} from '@chugmania/common/utils/constants.js'
import { Server } from 'socket.io'
import ConnectionManager from './managers/connection.manager'
import TrackManager from './managers/track.manager'

const port = 6996
const io = new Server(port, { cors: { origin: '*' } })

await TrackManager.seed()

io.on(WS_CONNECT_NAME, s =>
  ConnectionManager.connect(s).then(() => {
    s.on(WS_DISCONNECT_NAME, () => ConnectionManager.disconnect(s))
  })
)
