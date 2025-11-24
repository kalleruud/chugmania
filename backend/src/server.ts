import express from 'express'
import { Server, Socket } from 'socket.io'
import ViteExpress from 'vite-express'
import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../../common/models/socket.io'
import ApiManager from './managers/api.manager'
import AuthManager from './managers/auth.manager'
import UserManager from './managers/user.manager'
import { bind } from './utils/bind'

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 6996
const ORIGIN = new URL(process.env.ORIGIN ?? `http://localhost:${PORT}`)

const app = express()
const server = ViteExpress.listen(app, PORT)
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(server, {
  cors: {
    origin: [ORIGIN.toString()],
    credentials: true,
  },
})

export type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>

app.get('/api/sessions/calendar.ics', (req, res) =>
  ApiManager.handleGetAllSessionsCalendar(ORIGIN, req, res)
)
app.get('/api/sessions/:id/calendar.ics', (req, res) =>
  ApiManager.handleGetSessionCalendar(ORIGIN, req, res)
)

io.on('connect', s => {
  console.debug(new Date().toISOString(), s.id, 'Connected')
  bind(s, {
    disconnect: async () =>
      console.debug(new Date().toISOString(), s.id, 'Disconnected'),
    login: AuthManager.onLogin,
    // register: UserManager.onRegister,
  })
})
