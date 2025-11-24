import express from 'express'
import { Server, Socket } from 'socket.io'
import ViteExpress from 'vite-express'
import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../../common/models/socket.io'
import AdminManager from './managers/admin.manager'
import ApiManager from './managers/api.manager'
import AuthManager from './managers/auth.manager'
import LeaderboardManager from './managers/leaderboard.manager'
import SessionManager from './managers/session.manager'
import TimeEntryManager from './managers/timeEntry.manager'
import TrackManager from './managers/track.manager'
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

export const broadcast: typeof io.emit = (ev, ...args) => {
  return io.emit(ev, ...args)
}

app.get('/api/sessions/calendar.ics', (req, res) =>
  ApiManager.handleGetAllSessionsCalendar(ORIGIN, req, res)
)
app.get('/api/sessions/:id/calendar.ics', (req, res) =>
  ApiManager.handleGetSessionCalendar(ORIGIN, req, res)
)

io.on('connect', s => Connect(s))

async function Connect(s: TypedSocket) {
  console.debug(new Date().toISOString(), s.id, 'Connected')

  s.emit('user_data', await AuthManager.onGetUserData(s))
  s.emit('all_users', await UserManager.getAllUsers())
  s.emit('all_tracks', await TrackManager.getAllTracks())
  s.emit('all_leaderboards', await LeaderboardManager.getAllLeaderboards())
  s.emit('all_sessions', await SessionManager.getAllSessions())

  bind(s, {
    disconnect: async () =>
      console.debug(new Date().toISOString(), s.id, 'Disconnected'),
    login: AuthManager.onLogin,
    register: UserManager.onRegister,

    get_user_data: AuthManager.onGetUserData,
    edit_user: UserManager.onUpdateUser,

    post_time_entry: TimeEntryManager.onPostTimeEntry,
    edit_time_entry: TimeEntryManager.onEditTimeEntry,

    create_session: SessionManager.onCreateSession,
    edit_session: SessionManager.onEditSession,
    rsvp_session: SessionManager.onRsvpSession,

    import_csv: AdminManager.onImportCsv,
    export_csv: AdminManager.onExportCsv,
  })
}
