import { and, asc, eq } from 'drizzle-orm'
import type { Socket } from 'socket.io'
import {
  isCreateSessionRequest,
  isSessionSignupRequest,
} from '../../../common/models/requests'
import type {
  BackendResponse,
  GetSessionsResponse,
} from '../../../common/models/responses'
import type { SessionWithSignups } from '../../../common/models/session'
import { WS_SESSIONS_UPDATED } from '../../../common/utils/constants'
import db from '../../database/database'
import { sessionSignups, sessions, users } from '../../database/schema'
import AuthManager from './auth.manager'
import UserManager from './user.manager'

export default class SessionManager {
  private static async getSessions(): Promise<SessionWithSignups[]> {
    const sessionRows = await db
      .select()
      .from(sessions)
      .orderBy(asc(sessions.date), asc(sessions.createdAt))

    const signupRows = await db
      .select({
        sessionId: sessionSignups.sessionId,
        joinedAt: sessionSignups.createdAt,
        user: users,
      })
      .from(sessionSignups)
      .innerJoin(users, eq(sessionSignups.userId, users.id))
      .orderBy(asc(sessionSignups.createdAt))

    const grouped = new Map<string, SessionWithSignups['signups']>()
    for (const row of signupRows) {
      const entry = grouped.get(row.sessionId) ?? []
      entry.push({
        user: UserManager.toUserInfo(row.user).userInfo,
        joinedAt: row.joinedAt,
      })
      grouped.set(row.sessionId, entry)
    }

    return sessionRows.map(session => ({
      ...session,
      signups: grouped.get(session.id) ?? [],
    }))
  }

  static async onGetSessions(): Promise<GetSessionsResponse> {
    return {
      success: true,
      sessions: await SessionManager.getSessions(),
    }
  }

  static async onCreateSession(
    socket: Socket,
    request: unknown
  ): Promise<BackendResponse> {
    if (!isCreateSessionRequest(request))
      throw new Error('Invalid create session request')

    const { data: user, error } = await AuthManager.checkAuth(socket)
    if (error)
      return {
        success: false,
        message: error.message,
      }

    if (user.role === 'user')
      return {
        success: false,
        message: `Role '${user.role}' is not allowed to create sessions.`,
      }

    const name = request.name.trim()
    if (!name)
      return {
        success: false,
        message: 'Session name is required.',
      }

    const date = new Date(request.date)
    if (Number.isNaN(date.getTime()))
      return {
        success: false,
        message: 'Session date is invalid.',
      }

    const location = request.location?.trim()
    const description = request.description?.trim()

    await db.insert(sessions).values({
      name,
      date,
      location,
      description,
    })

    console.debug(new Date().toISOString(), socket.id, 'Created session', name)

    void SessionManager.broadcastSessions(socket)

    return { success: true }
  }

  static async onJoinSession(
    socket: Socket,
    request: unknown
  ): Promise<BackendResponse> {
    if (!isSessionSignupRequest(request))
      throw new Error('Invalid session signup request')

    const { data: user, error } = await AuthManager.checkAuth(socket)
    if (error)
      return {
        success: false,
        message: error.message,
      }

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, request.sessionId),
    })
    if (!session)
      return {
        success: false,
        message: 'Session not found.',
      }

    if (session.date.getTime() < Date.now())
      return {
        success: false,
        message: 'Cannot sign up for a session that has already happened.',
      }

    await db
      .insert(sessionSignups)
      .values({ sessionId: session.id, userId: user.id })
      .onConflictDoNothing()

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Signed up for session',
      session.id
    )

    void SessionManager.broadcastSessions(socket)

    return { success: true }
  }

  static async onLeaveSession(
    socket: Socket,
    request: unknown
  ): Promise<BackendResponse> {
    if (!isSessionSignupRequest(request))
      throw new Error('Invalid cancel session request')

    const { data: user, error } = await AuthManager.checkAuth(socket)
    if (error)
      return {
        success: false,
        message: error.message,
      }

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, request.sessionId),
    })
    if (!session)
      return {
        success: false,
        message: 'Session not found.',
      }

    if (session.date.getTime() <= Date.now())
      return {
        success: false,
        message: 'Cannot cancel after the session has happened.',
      }

    await db
      .delete(sessionSignups)
      .where(
        and(
          eq(sessionSignups.sessionId, session.id),
          eq(sessionSignups.userId, user.id)
        )
      )

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Cancelled session signup',
      session.id
    )

    void SessionManager.broadcastSessions(socket)

    return { success: true }
  }

  private static async broadcastSessions(socket: Socket) {
    try {
      const payload: GetSessionsResponse = {
        success: true,
        sessions: await SessionManager.getSessions(),
      }

      const namespace = socket.nsp
      const clients = Array.from(namespace.sockets.values())

      await Promise.all(
        clients.map(async client => {
          if (!client.handshake.auth?.token) return
          const { data } = await AuthManager.checkAuth(client)
          if (!data) return
          client.emit(WS_SESSIONS_UPDATED, payload)
        })
      )
    } catch (error) {
      console.error(
        new Date().toISOString(),
        socket.id,
        'Failed to broadcast sessions',
        error
      )
    }
  }
}
