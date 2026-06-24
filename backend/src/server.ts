import type {
  ClientToServerEvents,
  ErrorResponse,
  EventReq,
  EventRes,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@common/models/socket.io'
import express from 'express'
import { Server, Socket } from 'socket.io'
import ViteExpress from 'vite-express'
import AdminManager from './managers/admin.manager'
import ApiManager from './managers/api.manager'
import AuthManager from './managers/auth.manager'
import MatchManager from './managers/match.manager'
import RatingManager from './managers/rating.manager'
import SessionManager from './managers/session.manager'
import SessionScheduler from './managers/session.scheduler'
import TimeEntryManager from './managers/timeEntry.manager'
import TournamentManager from './managers/tournament.manager'
import TrackManager from './managers/track.manager'
import UserManager from './managers/user.manager'

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

type ProtectedServerEvent = Exclude<
  keyof ServerToClientEvents,
  'setup_data' | 'user_data'
>

async function emitInitialData(socket: TypedSocket) {
  socket.emit('all_users', await UserManager.getAllUsers())
  socket.emit('all_tracks', await TrackManager.getAllTracks())
  socket.emit('all_sessions', await SessionManager.getAllSessions())
  socket.emit('all_time_entries', await TimeEntryManager.getAllTimeEntries())
  socket.emit('all_matches', await MatchManager.getAllMatches())
  socket.emit('all_rankings', await RatingManager.onGetRatings())
  socket.emit('all_tournaments', await TournamentManager.getAllTournaments())
}

export async function broadcastAuthenticated<Ev extends ProtectedServerEvent>(
  ev: Ev,
  ...args: Parameters<ServerToClientEvents[Ev]>
) {
  await Promise.all(
    Array.from(io.sockets.sockets.values()).map(async socket => {
      const auth = await AuthManager.refreshToken(socket)
      if (auth.success) {
        socket.emit(ev, ...args)
      }
    })
  )
}

app.get('/api/sessions/calendar.ics', (req, res) =>
  ApiManager.onGetCalendar(ORIGIN, req, res)
)

io.on('connect', s => Connect(s))

// Initialize session scheduler when server starts
await SessionScheduler.scheduleNext()

// Calculate ratings
await RatingManager.recalculate()

async function Connect(s: TypedSocket) {
  console.debug(new Date().toISOString(), s.id, 'Connected')

  s.emit('setup_data', { hasUsers: await UserManager.hasUsers() })
  const auth = await AuthManager.refreshToken(s)
  s.emit('user_data', auth)
  if (auth.success) {
    await emitInitialData(s)
  }

  s.on('disconnect', () =>
    console.debug(new Date().toISOString(), s.id, 'Disconnected')
  )

  setup(s, 'login', AuthManager.onLogin)
  setup(s, 'register', UserManager.onRegister)

  setup(s, 'get_user_data', AuthManager.refreshToken)
  setup(s, 'edit_user', UserManager.onEditUser)
  setup(s, 'delete_user', UserManager.onDeleteUser)

  setup(s, 'post_time_entry', TimeEntryManager.onPostTimeEntry)
  setup(s, 'edit_time_entry', TimeEntryManager.onEditTimeEntry)

  setup(s, 'create_session', SessionManager.onCreateSession)
  setup(s, 'edit_session', SessionManager.onEditSession)
  setup(s, 'rsvp_session', SessionManager.onRsvpSession)
  setup(s, 'delete_session', SessionManager.onDeleteSession)

  setup(s, 'create_match', MatchManager.onCreateMatch)
  setup(s, 'edit_match', MatchManager.onEditMatch)
  setup(s, 'delete_match', MatchManager.onDeleteMatch)

  setup(s, 'import_csv', AdminManager.onImportCsv)
  setup(s, 'export_csv', AdminManager.onExportCsv)

  setup(s, 'create_tournament', TournamentManager.onCreateTournament)
  setup(s, 'edit_tournament', TournamentManager.onEditTournament)
  setup(s, 'delete_tournament', TournamentManager.onDeleteTournament)
  setup(s, 'get_tournament_preview', TournamentManager.onGetTournamentPreview)
}

function setup<Ev extends keyof ClientToServerEvents>(
  s: TypedSocket,
  event: Ev,
  handler: (s: TypedSocket, r: EventReq<Ev>) => Promise<EventRes<Ev>>
) {
  s.on(event, ((r: EventReq<Ev>, callback?: any) =>
    handler(s, r)
      .then(callback)
      .catch(e => {
        console.warn(e.message)
        callback({ success: false, message: e.message } satisfies ErrorResponse)
      })) as any)
}
