import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import ViteExpress from 'vite-express'
import { WS_DISCONNECT_NAME } from '../../common/utils/constants'
import ConnectionManager from './managers/connection.manager'
import TrackManager from './managers/track.manager'

const port = 6996
const app = express()
const io = new Server(createServer(app))

await TrackManager.seed()

io.on(WS_DISCONNECT_NAME, s =>
  ConnectionManager.connect(s).then(() => {
    s.on(WS_DISCONNECT_NAME, () => ConnectionManager.disconnect(s))
  })
)

ViteExpress.listen(app, port, () => console.log(`Server listening on ${port}`))
