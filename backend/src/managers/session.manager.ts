import {
  isCreateSessionRequest,
  isDeleteSessionRequest,
  isEditSessionRequest,
  isRsvpSessionRequest,
  type SessionSignup,
  type SessionWithSignups,
} from '@common/models/session'
import type { EventReq, EventRes } from '@common/models/socket.io'
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import loc from '../../../frontend/lib/locales'
import db from '../../database/database'
import { sessions, sessionSignups, users } from '../../database/schema'
import { broadcast, type TypedSocket } from '../server'
import AuthManager from './auth.manager'
import SessionScheduler from './session.scheduler'
import UserManager from './user.manager'

export default class SessionManager {
  public static async getAllSessions(): Promise<SessionWithSignups[]> {
    const sessionRows = await db
      .select()
      .from(sessions)
      .where(isNull(sessions.deletedAt))
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
      }))
    )
  }

  public static async getSession(
    id: string
  ): Promise<SessionWithSignups | null> {
    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.id, id), isNull(sessions.deletedAt)),
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
    }
  }

  private static async getSessionSignups(
    sessionId: string
  ): Promise<SessionSignup[]> {
    const signupRows = await db
      .select({
        id: sessionSignups.id,
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

    const { type, createdAt, updatedAt, deletedAt, ...sessionData } = request
    await db.insert(sessions).values({
      ...sessionData,
      date: new Date(sessionData.date),
    })

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Created session',
      request.name
    )

    broadcast('all_sessions', await SessionManager.getAllSessions())
    await SessionScheduler.reschedule()

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

    const { type, id, createdAt, updatedAt, ...updates } = request
    const res = await db
      .update(sessions)
      .set({
        ...updates,
        date: updates.date ? new Date(updates.date) : undefined,
        deletedAt: updates.deletedAt ? new Date(updates.deletedAt) : undefined,
      })
      .where(eq(sessions.id, session.id))

    if (res.changes === 0) throw new Error('Update failed')

    console.debug(new Date().toISOString(), socket.id, 'Updated session', id)

    broadcast('all_sessions', await SessionManager.getAllSessions())
    await SessionScheduler.reschedule()

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

    const existingSignup = await db.query.sessionSignups.findFirst({
      where: and(
        eq(sessionSignups.session, request.session),
        eq(sessionSignups.user, request.user)
      ),
    })

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

    if (existingSignup) {
      await db
        .update(sessionSignups)
        .set({ response: request.response })
        .where(eq(sessionSignups.id, existingSignup.id))
    } else {
      await db.insert(sessionSignups).values(request)
    }

    console.debug(
      new Date().toISOString(),
      socket.id,
      `Signed up for session with response: ${request.response}`,
      session.id
    )

    broadcast('all_sessions', await SessionManager.getAllSessions())
    await SessionScheduler.reschedule()

    return { success: true }
  }

  static async onDeleteSession(
    socket: TypedSocket,
    request: EventReq<'delete_session'>
  ): Promise<EventRes<'delete_session'>> {
    if (!isDeleteSessionRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('DeleteSessionRequest')
      )
    }

    await SessionManager.onEditSession(socket, {
      ...request,
      type: 'EditSessionRequest',
      deletedAt: new Date(),
    })

    // Soft-delete all signups for this session
    await db
      .update(sessionSignups)
      .set({ deletedAt: new Date() })
      .where(eq(sessionSignups.session, request.id))

    console.info(
      new Date().toISOString(),
      socket.id,
      `Deleted all related signups '${request.id}'`
    )

    return {
      success: true,
    }
  }
}
