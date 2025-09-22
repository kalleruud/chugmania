import express from 'express'
import { Server } from 'socket.io'
import ViteExpress from 'vite-express'
import {
  WS_CONNECT_NAME,
  WS_DISCONNECT_NAME,
} from '../../common/utils/constants'
import ConnectionManager from './managers/connection.manager'
import TrackManager from './managers/track.manager'

const PORT = 6996
const app = express()

await TrackManager.seed()

const server = ViteExpress.listen(app, PORT)
const io = new Server(server, { cors: { origin: '*' } })

io.on(WS_CONNECT_NAME, s =>
  ConnectionManager.connect(s).then(() => {
    s.on(WS_DISCONNECT_NAME, () => ConnectionManager.disconnect(s))
  })
)
