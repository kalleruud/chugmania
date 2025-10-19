import express from 'express'
import { Server } from 'socket.io'
import ViteExpress from 'vite-express'
import {
  WS_CONNECT_NAME,
  WS_DISCONNECT_NAME,
} from '../../common/utils/constants'
import ApiManager from './managers/api.manager'
import ConnectionManager from './managers/connection.manager'

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 6996
const app = express()
const server = ViteExpress.listen(app, PORT)
const io = new Server(server, {
  cors: {
    origin: [process.env.ORIGIN ?? `http://localhost:${PORT}`],
    credentials: true,
  },
})

io.on(WS_CONNECT_NAME, s =>
  ConnectionManager.connect(s).then(() => {
    s.on(WS_DISCONNECT_NAME, () => ConnectionManager.disconnect(s))
  })
)

app.get('/api/sessions/calendar.ics', ApiManager.handleGetAllSessionsCalendar)
app.get('/api/sessions/:id/calendar.ics', ApiManager.handleGetSessionCalendar)
