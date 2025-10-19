import { and, asc, eq, isNull } from 'drizzle-orm'
import type { Socket } from 'socket.io'
import {
  isCreateSessionRequest,
  isDeleteSessionRequest,
  isSessionSignupRequest,
  isUpdateSessionRequest,
} from '../../../common/models/requests'
import type {
  BackendResponse,
  GetSessionsResponse,
} from '../../../common/models/responses'
import type {
  SessionSignup,
  SessionWithSignups,
} from '../../../common/models/session'
import { WS_SESSIONS_UPDATED } from '../../../common/utils/constants'
import { tryCatchAsync } from '../../../common/utils/try-catch'
import db from '../../database/database'
import { sessionSignups, sessions, users } from '../../database/schema'
import AuthManager from './auth.manager'
import UserManager from './user.manager'

export default class SessionManager {
  public static async getSessions(): Promise<SessionWithSignups[]> {
    const sessionRows = await db
      .select()
      .from(sessions)
      .orderBy(asc(sessions.date), asc(sessions.createdAt))

    if (!sessionRows || sessionRows.length === 0) {
      console.debug(
        new Date().toISOString(),
        'SessionManager.getSessions - No sessions found'
      )
      return []
    }

    return Promise.all(
      sessionRows.map(async session => ({
        ...session,
        signups: await SessionManager.getSessionSignups(session.id),
      }))
    )
  }

  public static async getSession(
    sessionId: string
  ): Promise<SessionWithSignups | null> {
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    })

    if (!session) {
      console.warn(
        new Date().toISOString(),
        `SessionManager.getSession - Session not found ${sessionId}`,
        sessionId
      )
      return null
    }

    return {
      ...session,
      signups: await SessionManager.getSessionSignups(session.id),
    }
  }

  private static async getSessionSignups(
    sessionId: string
  ): Promise<SessionSignup[]> {
    const signupRows = await db
      .select({
        createdAt: sessionSignups.createdAt,
        updatedAt: sessionSignups.updatedAt,
        deletedAt: sessionSignups.deletedAt,
        response: sessionSignups.response,
        session: sessionSignups.session,
        user: users,
      })
      .from(sessionSignups)
      .innerJoin(users, eq(sessionSignups.user, users.id))
      .where(
        and(eq(sessionSignups.session, sessionId), isNull(users.deletedAt))
      )
      .orderBy(asc(sessionSignups.createdAt))

    if (!signupRows || signupRows.length === 0) {
      console.debug(
        new Date().toISOString(),
        `SessionManager.getSessionSignups - No signups found for session '${sessionId}'`
      )
      return []
    }

    return signupRows.map(row => ({
      ...row,
      user: UserManager.toUserInfo(row.user).userInfo,
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

    const { error } = await AuthManager.checkAuth(socket, [
      'admin',
      'moderator',
    ])
    if (error) return error

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

    SessionManager.broadcastSessions(socket)

    return { success: true }
  }

  static async onUpdateSession(
    socket: Socket,
    request: unknown
  ): Promise<BackendResponse> {
    if (!isUpdateSessionRequest(request))
      throw new Error('Invalid update session request')

    const { error } = await AuthManager.checkAuth(socket, [
      'admin',
      'moderator',
    ])
    if (error) return error

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, request.id),
    })
    if (!session)
      return {
        success: false,
        message: 'Session not found.',
      }

    const updates: Record<string, any> = {}
    if (request.name !== undefined) {
      const name = request.name.trim()
      if (!name)
        return {
          success: false,
          message: 'Session name cannot be empty.',
        }
      updates.name = name
    }

    if (request.date !== undefined) {
      const date = new Date(request.date)
      if (Number.isNaN(date.getTime()))
        return {
          success: false,
          message: 'Session date is invalid.',
        }
      updates.date = date
    }
    if (request.location !== undefined) {
      updates.location = request.location.trim() || null
    }
    if (request.description !== undefined) {
      updates.description = request.description.trim() || null
    }

    if (Object.keys(updates).length > 0) {
      await db.update(sessions).set(updates).where(eq(sessions.id, session.id))
    }

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Updated session',
      session.id,
      updates
    )

    SessionManager.broadcastSessions(socket)

    return { success: true }
  }

  static async onDeleteSession(
    socket: Socket,
    request: unknown
  ): Promise<BackendResponse> {
    if (!isDeleteSessionRequest(request))
      throw new Error('Invalid delete session request')

    const { error } = await AuthManager.checkAuth(socket, ['admin'])
    if (error) return error

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, request.id),
    })

    if (!session)
      return {
        success: false,
        message: 'Session not found.',
      }

    const { error: deleteError } = await tryCatchAsync(
      db
        .update(sessions)
        .set({ deletedAt: new Date() })
        .where(eq(sessions.id, session.id))
    )

    if (deleteError) {
      console.error(
        new Date().toISOString(),
        socket.id,
        'Failed to delete session',
        session.id,
        deleteError
      )
      return {
        success: false,
        message: 'Failed to delete session.',
      }
    }

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Deleted session',
      session.id
    )

    SessionManager.broadcastSessions(socket)

    return { success: true }
  }

  static async onCancelSession(
    socket: Socket,
    request: unknown
  ): Promise<BackendResponse> {
    if (!isDeleteSessionRequest(request))
      throw new Error('Invalid cancel session request')

    const { error } = await AuthManager.checkAuth(socket, [
      'admin',
      'moderator',
    ])
    if (error) return error

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, request.id),
    })

    if (!session)
      return {
        success: false,
        message: 'Session not found.',
      }

    const { error: cancelError } = await tryCatchAsync(
      db
        .update(sessions)
        .set({ status: 'cancelled' })
        .where(eq(sessions.id, session.id))
    )

    if (cancelError) {
      console.error(
        new Date().toISOString(),
        socket.id,
        'Failed to cancel session',
        session.id,
        cancelError
      )
      return {
        success: false,
        message: 'Failed to cancel session.',
      }
    }

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Cancelled session',
      session.id
    )

    SessionManager.broadcastSessions(socket)

    return { success: true }
  }

  static async onJoinSession(
    socket: Socket,
    request: unknown
  ): Promise<BackendResponse> {
    if (!isSessionSignupRequest(request))
      throw new Error('Invalid session signup request')

    const { data: user, error } = await AuthManager.checkAuth(socket)
    if (error) return error

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, request.session),
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

    const response = request.response ?? 'yes'
    await db
      .insert(sessionSignups)
      .values({ session: session.id, user: user.id, response })
      .onConflictDoUpdate({
        target: [sessionSignups.session, sessionSignups.user],
        set: { response },
      })

    console.debug(
      new Date().toISOString(),
      socket.id,
      `Signed up for session with response: ${response}`,
      session.id
    )

    SessionManager.broadcastSessions(socket)

    return { success: true }
  }

  static async onLeaveSession(
    socket: Socket,
    request: unknown
  ): Promise<BackendResponse> {
    if (!isSessionSignupRequest(request))
      throw new Error('Invalid cancel session request')

    const { data: user, error } = await AuthManager.checkAuth(socket)
    if (error) return error

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, request.session),
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
          eq(sessionSignups.session, session.id),
          eq(sessionSignups.user, user.id)
        )
      )

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Cancelled session signup',
      session.id
    )

    SessionManager.broadcastSessions(socket)

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
