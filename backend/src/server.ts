import express from 'express'
import { Server } from 'socket.io'
import ViteExpress from 'vite-express'
import {
  WS_CONNECT_NAME,
  WS_DISCONNECT_NAME,
} from '../../common/utils/constants'
import ConnectionManager from './managers/connection.manager'
import TrackManager from './managers/track.manager'

const port = 6997
const app = express()
const io = new Server(port, { cors: { origin: '*' } })

await TrackManager.seed()

io.on(WS_CONNECT_NAME, s =>
  ConnectionManager.connect(s).then(() => {
    s.on(WS_DISCONNECT_NAME, () => ConnectionManager.disconnect(s))
  })
)

ViteExpress.listen(app, 6996)
