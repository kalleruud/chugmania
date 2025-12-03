import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import {
  isCreateSessionRequest,
  isEditSessionRequest,
  isRsvpSessionRequest,
  type SessionLapTime,
  type SessionSignup,
  type SessionWithSignups,
} from '../../../common/models/session'
import { EventReq, EventRes } from '../../../common/models/socket.io'
import loc from '../../../frontend/lib/locales'
import db from '../../database/database'
import {
  sessions,
  sessionSignups,
  timeEntries,
  tracks,
  users,
} from '../../database/schema'
import { broadcast, TypedSocket } from '../server'
import AuthManager from './auth.manager'
import UserManager from './user.manager'

export default class SessionManager {
  public static async getAllSessions(): Promise<SessionWithSignups[]> {
    const sessionRows = await db
      .select()
      .from(sessions)
      .orderBy(desc(sessions.date), asc(sessions.createdAt))

    if (!sessionRows || sessionRows.length === 0) {
      console.debug(
        new Date().toISOString(),
        loc.no.error.messages.not_in_db('sessions')
      )
      return []
    }

    return Promise.all(
      sessionRows.map(async session => ({
        ...session,
        signups: await SessionManager.getSessionSignups(session.id),
        lapTimes: await SessionManager.getSessionLapTimes(session.id),
      }))
    )
  }

  public static async getSession(
    id: string
  ): Promise<SessionWithSignups | null> {
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, id),
    })

    if (!session) {
      console.warn(
        new Date().toISOString(),
        loc.no.error.messages.not_in_db(id)
      )
      return null
    }

    return {
      ...session,
      signups: await SessionManager.getSessionSignups(session.id),
      lapTimes: await SessionManager.getSessionLapTimes(session.id),
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
        and(
          eq(sessionSignups.session, sessionId),
          isNull(users.deletedAt),
          isNull(sessionSignups.deletedAt)
        )
      )
      .orderBy(asc(sessionSignups.createdAt))

    if (!signupRows || signupRows.length === 0) {
      return []
    }

    return signupRows.map(row => ({
      ...row,
      user: UserManager.toUserInfo(row.user).userInfo,
    }))
  }

  private static async getSessionLapTimes(
    sessionId: string
  ): Promise<SessionLapTime[]> {
    const lapRows = await db
      .select()
      .from(timeEntries)
      .innerJoin(users, eq(timeEntries.user, users.id))
      .innerJoin(tracks, eq(timeEntries.track, tracks.id))
      .where(
        and(
          eq(timeEntries.session, sessionId),
          isNull(timeEntries.deletedAt),
          isNull(users.deletedAt)
        )
      )
      .orderBy(asc(timeEntries.createdAt))

    if (!lapRows || lapRows.length === 0) {
      return []
    }

    return lapRows.map(row => ({
      entry: row.time_entries,
      track: row.tracks,
      user: UserManager.toUserInfo(row.users).userInfo,
    }))
  }

  static async onCreateSession(
    socket: TypedSocket,
    request: EventReq<'create_session'>
  ): Promise<EventRes<'create_session'>> {
    if (!isCreateSessionRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('CreateSessionRequest')
      )
    }

    await AuthManager.checkAuth(socket, ['admin', 'moderator'])
    await db.insert(sessions).values(request)

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Created session',
      request.name
    )

    broadcast('all_sessions', await SessionManager.getAllSessions())

    return { success: true }
  }

  static async onEditSession(
    socket: TypedSocket,
    request: EventReq<'edit_session'>
  ): Promise<EventRes<'edit_session'>> {
    if (!isEditSessionRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('EditSessionRequest')
      )
    }

    await AuthManager.checkAuth(socket, ['admin', 'moderator'])

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, request.id),
    })

    if (!session) {
      throw new Error(loc.no.error.messages.not_in_db(request.id))
    }

    const { type, id, ...updates } = request
    await db.update(sessions).set(updates).where(eq(sessions.id, session.id))

    console.debug(new Date().toISOString(), socket.id, 'Updated session', id)

    broadcast('all_sessions', await SessionManager.getAllSessions())

    return { success: true }
  }

  static async onRsvpSession(
    socket: TypedSocket,
    request: EventReq<'rsvp_session'>
  ): Promise<EventRes<'rsvp_session'>> {
    if (!isRsvpSessionRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('RsvpSessionRequest')
      )
    }

    const actor = await AuthManager.checkAuth(socket)
    const isModerator = actor.role !== 'user'
    const isSelf = actor.id === request.user

    if (!isModerator && !isSelf) {
      throw new Error(loc.no.error.messages.insufficient_permissions)
    }

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, request.session),
    })

    if (!session) {
      throw new Error(loc.no.error.messages.not_in_db(request.session))
    }

    if (session.date.getTime() < Date.now() && !isModerator) {
      throw new Error(loc.no.session.errorMessages.no_edit_historical)
    }

    await db
      .insert(sessionSignups)
      .values({
        session: session.id,
        user: actor.id,
        response: request.response,
      })
      .onConflictDoUpdate({
        target: [sessionSignups.session, sessionSignups.user],
        set: { response: request.response },
      })

    console.debug(
      new Date().toISOString(),
      socket.id,
      `Signed up for session with response: ${request.response}`,
      session.id
    )

    broadcast('all_sessions', await SessionManager.getAllSessions())

    return { success: true }
  }
}
