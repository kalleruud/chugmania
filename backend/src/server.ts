import {
  WS_CONNECT_NAME,
  WS_DISCONNECT_NAME,
  WS_LOGIN_NAME,
  WS_REGISTER_NAME,
  WS_LIST_TRACKS,
  WS_GET_LEADERBOARD,
  WS_SUBMIT_TIME,
  WS_TIME_ADDED,
  WS_TIME_UPDATED,
  WS_TIME_DELETED,
  WS_LIST_TIMES,
  WS_UPDATE_TIME,
  WS_DELETE_TIME,
  WS_LIST_USERS,
  WS_UPDATE_USER,
  WS_DELETE_USER,
  WS_WHOAMI,
  WS_USER_TOP_TIMES,
} from '@chugmania/common/models/constants.js'
import type { ErrorResponse } from '@chugmania/common/models/responses.js'
import { Server } from 'socket.io'
import AuthManager from './managers/auth.manager'
import ConnectionManager from './managers/connection.manager'
import TrackManager from './managers/track.manager'
import TimeManager from './managers/time.manager'
import SessionManager from './managers/session.manager'
import type {
  SubmitTimeRequest,
  ListTimesRequest,
  UpdateTimeRequest,
  DeleteTimeRequest,
  ListUsersRequest,
  UpdateUserRequest,
  DeleteUserRequest,
  WhoAmIRequest,
  UserTopTimesRequest,
} from '@chugmania/common/models/requests.js'
import {
  isGetLeaderboardRequest,
  isSubmitTimeRequest,
  isListTimesRequest,
  isUpdateTimeRequest,
  isDeleteTimeRequest,
  isUpdateUserRequest,
  isDeleteUserRequest,
  isUserTopTimesRequest,
} from '@chugmania/common/models/requests.js'
import { parseLapTime } from '@chugmania/common/utils/time.js'
import UserManager from './managers/user.manager'

const port = 6996
const io = new Server(port, { cors: { origin: '*' } })

// Seed demo data on startup
TrackManager.ensureSeed().catch(err =>
  console.error('Track seeding failed', err)
)

io.on(WS_CONNECT_NAME, s =>
  ConnectionManager.connect(s).then(() => {
    s.on(WS_LOGIN_NAME, (arg, c) =>
      AuthManager.onLogin(s, arg)
        .catch(err =>
          c({ success: false, message: err.message } satisfies ErrorResponse)
        )
        .then(c)
    )
    s.on(WS_REGISTER_NAME, (arg, c) =>
      AuthManager.onRegister(s, arg)
        .catch(err =>
          c({ success: false, message: err.message } satisfies ErrorResponse)
        )
        .then(c)
    )
    // Who am I
    s.on(WS_WHOAMI, async (_: WhoAmIRequest, c) => {
      try {
        const auth = await AuthManager.checkAuth(s)
        const isUser = (
          u: any
        ): u is import('@chugmania/common/models/user.js').UserInfo =>
          !!u && typeof u === 'object' && 'id' in u && 'role' in u
        c({ success: true, user: isUser(auth) ? auth : null })
      } catch (err: any) {
        c({ success: false, message: err.message } satisfies ErrorResponse)
      }
    })
    // Users: top times per track (public)
    s.on(WS_USER_TOP_TIMES, async (arg: UserTopTimesRequest, c) => {
      try {
        if (!isUserTopTimesRequest(arg)) throw new Error('Invalid request')
        const entries = await TimeManager.timesForUser(arg.userId)
        const bestByTrack = new Map<string, (typeof entries)[number]>()
        for (const e of entries) {
          const cur = bestByTrack.get(e.track)
          if (!cur || e.duration < cur.duration) bestByTrack.set(e.track, e)
        }
        const best = Array.from(bestByTrack.values())
        const trackIds = best.map(b => b.track)
        const tracksList = await TrackManager.getByIds(trackIds)
        const trackMap = new Map(tracksList.map(t => [t.id, t]))
        const results = best
          .map(b => ({ track: trackMap.get(b.track)!, bestTimeMs: b.duration }))
          .filter(r => !!r.track)
        c({ success: true, userId: arg.userId, results })
      } catch (err: any) {
        c({ success: false, message: err.message } satisfies ErrorResponse)
      }
    })
    // Public: list tracks
    s.on(WS_LIST_TRACKS, async (_arg, c) => {
      try {
        const tracks = await TrackManager.list()
        c({ success: true, tracks })
      } catch (err: any) {
        c({ success: false, message: err.message } satisfies ErrorResponse)
      }
    })
    // Public: leaderboard by track
    s.on(WS_GET_LEADERBOARD, async (arg, c) => {
      try {
        if (!isGetLeaderboardRequest(arg)) throw new Error('Invalid request')
        const entries = await TimeManager.timesForTrack(arg.trackId)
        // Group best per user
        const bestByUser = new Map<string, (typeof entries)[number]>()
        for (const e of entries) {
          const current = bestByUser.get(e.user)
          if (!current || e.duration < current.duration)
            bestByUser.set(e.user, e)
        }
        const best = Array.from(bestByUser.values()).sort(
          (a, b) => a.duration - b.duration
        )
        // Load users
        const enriched = await Promise.all(
          best.map(async e => {
            const u = await UserManager.getUserById?.(e.user)
            // Fallback: minimal payload if helper missing
            return {
              user: u
                ? {
                    id: u.id,
                    name: u.name,
                    shortName: u.shortName,
                    role: u.role,
                  }
                : {
                    id: e.user,
                    name: 'Unknown',
                    shortName: null,
                    role: 'user',
                  },
              bestTimeMs: e.duration,
            }
          })
        )
        c({ success: true, trackId: arg.trackId, leaderboard: enriched })
      } catch (err: any) {
        c({ success: false, message: err.message } satisfies ErrorResponse)
      }
    })
    // Protected: submit time
    s.on(WS_SUBMIT_TIME, async (arg: SubmitTimeRequest, c) => {
      try {
        if (!isSubmitTimeRequest(arg)) throw new Error('Invalid request')
        const auth = await AuthManager.checkAuth(s)
        const isUser = (
          u: any
        ): u is import('@chugmania/common/models/user.js').UserInfo =>
          !!u && typeof u === 'object' && 'id' in u && 'role' in u
        if (!isUser(auth)) throw new Error('Not authenticated')
        const actor = auth

        const duration = parseLapTime(arg.time)
        const forUserId =
          arg.userId && (actor.role === 'admin' || actor.role === 'moderator')
            ? arg.userId
            : actor.id

        const session = arg.sessionId
          ? { id: arg.sessionId }
          : await SessionManager.getOrCreatePracticeSessionForDay(
              actor.id,
              new Date()
            )

        await TimeManager.addTime({
          user: forUserId,
          track: arg.trackId,
          session: session.id,
          duration,
          amount: 0,
          comment: arg.comment ?? null,
        })
        // Notify all clients that a time was added for this track
        io.emit(WS_TIME_ADDED, { trackId: arg.trackId })
        c({ success: true })
      } catch (err: any) {
        c({ success: false, message: err.message } satisfies ErrorResponse)
      }
    })
    // Times: list
    s.on(WS_LIST_TIMES, async (arg: ListTimesRequest, c) => {
      try {
        if (!isListTimesRequest(arg)) throw new Error('Invalid request')
        const auth = await AuthManager.checkAuth(s)
        const isUser = (
          u: any
        ): u is import('@chugmania/common/models/user.js').UserInfo =>
          !!u && typeof u === 'object' && 'id' in u && 'role' in u
        const actor = isUser(auth) ? auth : null
        const admin =
          actor && (actor.role === 'admin' || actor.role === 'moderator')
        const filterUserId = admin ? (arg.userId ?? undefined) : actor?.id
        const entries = await TimeManager.timesForTrack(arg.trackId)
        const filtered = filterUserId
          ? entries.filter(e => e.user === filterUserId)
          : entries
        const enriched = await Promise.all(
          filtered.map(async e => {
            const u = await UserManager.getUserById?.(e.user)
            return {
              id: e.id,
              user: u
                ? {
                    id: u.id,
                    name: u.name,
                    shortName: u.shortName,
                    role: u.role,
                  }
                : {
                    id: e.user,
                    name: 'Unknown',
                    shortName: null,
                    role: 'user',
                  },
              track: e.track,
              session: e.session,
              duration: e.duration,
              comment: e.comment ?? null,
              createdAt: e.createdAt,
            }
          })
        )
        c({ success: true, trackId: arg.trackId, times: enriched })
      } catch (err: any) {
        c({ success: false, message: err.message } satisfies ErrorResponse)
      }
    })
    // Times: update
    s.on(WS_UPDATE_TIME, async (arg: UpdateTimeRequest, c) => {
      try {
        if (!isUpdateTimeRequest(arg)) throw new Error('Invalid request')
        const auth = await AuthManager.checkAuth(s)
        const isUser = (
          u: any
        ): u is import('@chugmania/common/models/user.js').UserInfo =>
          !!u && typeof u === 'object' && 'id' in u && 'role' in u
        if (!isUser(auth)) throw new Error('Not authenticated')
        const actor = auth
        const target = await TimeManager.getById(arg.timeEntryId)
        const canEdit =
          actor.role === 'admin' ||
          actor.role === 'moderator' ||
          target.user === actor.id
        if (!canEdit) throw new Error('Forbidden')
        const patch: any = {}
        if (typeof arg.comment !== 'undefined') patch.comment = arg.comment
        if (typeof arg.time === 'string')
          patch.duration = parseLapTime(arg.time)
        await TimeManager.updateById(arg.timeEntryId, patch)
        io.emit(WS_TIME_UPDATED, { trackId: target.track })
        c({ success: true })
      } catch (err: any) {
        c({ success: false, message: err.message } satisfies ErrorResponse)
      }
    })
    // Times: delete
    s.on(WS_DELETE_TIME, async (arg: DeleteTimeRequest, c) => {
      try {
        if (!isDeleteTimeRequest(arg)) throw new Error('Invalid request')
        const auth = await AuthManager.checkAuth(s)
        const isUser = (
          u: any
        ): u is import('@chugmania/common/models/user.js').UserInfo =>
          !!u && typeof u === 'object' && 'id' in u && 'role' in u
        if (!isUser(auth)) throw new Error('Not authenticated')
        const actor = auth
        const target = await TimeManager.getById(arg.timeEntryId)
        const canDelete =
          actor.role === 'admin' ||
          actor.role === 'moderator' ||
          target.user === actor.id
        if (!canDelete) throw new Error('Forbidden')
        await TimeManager.deleteById(arg.timeEntryId)
        io.emit(WS_TIME_DELETED, { trackId: target.track })
        c({ success: true })
      } catch (err: any) {
        c({ success: false, message: err.message } satisfies ErrorResponse)
      }
    })
    // Users: list (public)
    s.on(WS_LIST_USERS, async (_: ListUsersRequest, c) => {
      try {
        const rows = await UserManager.listUsers()
        c({ success: true, users: rows })
      } catch (err: any) {
        c({ success: false, message: err.message } satisfies ErrorResponse)
      }
    })
    // Users: update (admin only)
    s.on(WS_UPDATE_USER, async (arg: UpdateUserRequest, c) => {
      try {
        if (!isUpdateUserRequest(arg)) throw new Error('Invalid request')
        const auth = await AuthManager.checkAuth(s)
        const isUser = (
          u: any
        ): u is import('@chugmania/common/models/user.js').UserInfo =>
          !!u && typeof u === 'object' && 'id' in u && 'role' in u
        if (!isUser(auth) || auth.role !== 'admin') throw new Error('Forbidden')
        const patch: any = {}
        if (typeof arg.name === 'string') {
          if (arg.name.trim().length < 2)
            throw new Error('Name must be at least 2 characters')
          patch.name = arg.name.trim()
        }
        if (typeof arg.shortName !== 'undefined') {
          const s = arg.shortName
          if (s === null || s === '') patch.shortName = null
          else if (/^[A-Za-z]{3}$/.test(s)) patch.shortName = s.toUpperCase()
          else throw new Error('Short name must be exactly 3 letters')
        }
        if (typeof arg.role === 'string') patch.role = arg.role
        await UserManager.updateUser(arg.userId, patch)
        c({ success: true })
      } catch (err: any) {
        c({ success: false, message: err.message } satisfies ErrorResponse)
      }
    })
    // Users: delete (admin only)
    s.on(WS_DELETE_USER, async (arg: DeleteUserRequest, c) => {
      try {
        if (!isDeleteUserRequest(arg)) throw new Error('Invalid request')
        const auth = await AuthManager.checkAuth(s)
        const isUser = (
          u: any
        ): u is import('@chugmania/common/models/user.js').UserInfo =>
          !!u && typeof u === 'object' && 'id' in u && 'role' in u
        if (!isUser(auth) || auth.role !== 'admin') throw new Error('Forbidden')
        await UserManager.deleteUser(arg.userId)
        c({ success: true })
      } catch (err: any) {
        c({ success: false, message: err.message } satisfies ErrorResponse)
      }
    })
    s.on(WS_DISCONNECT_NAME, () => ConnectionManager.disconnect(s))
  })
)

io.use((socket, next) => {
  AuthManager.checkAuth(socket)
    .catch(next)
    .then(() => next())
})
