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
import { Server } from 'socket.io'
import { listen } from 'vite-express'
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
import { trackSocket, type TypedSocket } from './socket'

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 6996
const ORIGIN = new URL(process.env.ORIGIN ?? `http://localhost:${PORT}`)

const app = express()
const server = listen(app, PORT)
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

async function emitData(socket: TypedSocket) {
  const [users, tracks, sessions, timeEntries, matches, tournaments] =
    await Promise.all([
      UserManager.getAllUsers(),
      TrackManager.getAllTracks(),
      SessionManager.getAllSessions(),
      TimeEntryManager.getAllTimeEntries(),
      MatchManager.getAllMatches(),
      TournamentManager.getAllTournaments(),
    ])
  const rankings = RatingManager.onGetRatings()
  socket.emit('all_users', users)
  socket.emit('all_tracks', tracks)
  socket.emit('all_sessions', sessions)
  socket.emit('all_time_entries', timeEntries)
  socket.emit('all_matches', matches)
  socket.emit('all_rankings', rankings)
  socket.emit('all_tournaments', tournaments)
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
  trackSocket(s)
  console.debug(new Date().toISOString(), s.id, 'Connected')

  const auth = await AuthManager.refreshToken(s)
  s.emit('user_data', auth)
  if (auth.success) {
    await emitData(s)
  }

  s.on('disconnect', () =>
    console.debug(new Date().toISOString(), s.id, 'Disconnected')
  )

  setup(s, 'login', (socket, request) => AuthManager.onLogin(socket, request))
  setup(s, 'register', (socket, request) =>
    UserManager.onRegister(socket, request)
  )

  s.on('get_user_data', callback =>
    Promise.resolve(AuthManager.refreshToken(s))
      .then(callback)
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e)
        console.warn(message)
        callback({ success: false, message })
      })
  )
  setup(s, 'edit_user', (socket, request) =>
    UserManager.onEditUser(socket, request)
  )
  setup(s, 'delete_user', (socket, request) =>
    UserManager.onDeleteUser(socket, request)
  )

  setup(s, 'post_time_entry', (socket, request) =>
    TimeEntryManager.onPostTimeEntry(socket, request)
  )
  setup(s, 'edit_time_entry', (socket, request) =>
    TimeEntryManager.onEditTimeEntry(socket, request)
  )

  setup(s, 'create_session', (socket, request) =>
    SessionManager.onCreateSession(socket, request)
  )
  setup(s, 'edit_session', (socket, request) =>
    SessionManager.onEditSession(socket, request)
  )
  setup(s, 'rsvp_session', (socket, request) =>
    SessionManager.onRsvpSession(socket, request)
  )
  setup(s, 'delete_session', (socket, request) =>
    SessionManager.onDeleteSession(socket, request)
  )

  setup(s, 'create_match', (socket, request) =>
    MatchManager.onCreateMatch(socket, request)
  )
  setup(s, 'edit_match', (socket, request) =>
    MatchManager.onEditMatch(socket, request)
  )
  setup(s, 'delete_match', (socket, request) =>
    MatchManager.onDeleteMatch(socket, request)
  )

  setup(s, 'import_csv', (socket, request) =>
    AdminManager.onImportCsv(socket, request)
  )
  setup(s, 'export_csv', (socket, request) =>
    AdminManager.onExportCsv(socket, request)
  )

  setup(s, 'create_tournament', (socket, request) =>
    TournamentManager.onCreateTournament(socket, request)
  )
  setup(s, 'edit_tournament', (socket, request) =>
    TournamentManager.onEditTournament(socket, request)
  )
  setup(s, 'delete_tournament', (socket, request) =>
    TournamentManager.onDeleteTournament(socket, request)
  )
  setup(s, 'get_tournament_preview', (socket, request) =>
    TournamentManager.onGetTournamentPreview(socket, request)
  )
}

type RequestEvent = Exclude<
  keyof ClientToServerEvents,
  'connect' | 'disconnect' | 'connect_error' | 'get_user_data'
>

type SocketCallback<Ev extends RequestEvent> = (
  response: EventRes<Ev> | ErrorResponse
) => void

function setup<Ev extends RequestEvent>(
  s: TypedSocket,
  event: Ev,
  handler: (
    s: TypedSocket,
    r: EventReq<Ev>
  ) => EventRes<Ev> | Promise<EventRes<Ev>>
) {
  ;(
    s as TypedSocket & {
      on: (
        event: Ev,
        listener: (r: EventReq<Ev>, callback: SocketCallback<Ev>) => void
      ) => void
    }
  ).on(event, (r, callback) =>
    Promise.resolve(handler(s, r))
      .then(callback)
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e)
        console.warn(message)
        callback({ success: false, message })
      })
  )
}
