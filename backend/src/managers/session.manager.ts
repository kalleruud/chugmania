import {
  isCreateSessionRequest,
  isDeleteSessionRequest,
  isEditSessionRequest,
  isRsvpSessionRequest,
  type CreateSessionRequest,
  type DeleteSessionRequest,
  type EditSessionRequest,
  type RsvpSessionRequest,
  type SessionSignup,
  type SessionWithSignups,
} from '@common/models/session'
import type { EventRes } from '@common/models/socket.io'
import { and, eq } from 'drizzle-orm'
import loc from '../../../frontend/lib/locales'
import db from '../../database/database'
import { sessions, sessionSignups } from '../../database/schema'
import { broadcast, type TypedSocket } from '../socket'
import AuthManager from './auth.manager'
import {
  ensureSessionSignup,
  getAllSessions,
  getSession,
  getSessionSignups,
} from './session.queries'

class SessionManagerClass {
  public async ensureSessionSignup(
    sessionId: string,
    userId: string
  ): Promise<boolean> {
    return ensureSessionSignup(sessionId, userId)
  }

  public async getAllSessions(): Promise<SessionWithSignups[]> {
    return getAllSessions()
  }

  public async getSession(id: string): Promise<SessionWithSignups | null> {
    return getSession(id)
  }

  public async getSessionSignups(sessionId: string): Promise<SessionSignup[]> {
    return getSessionSignups(sessionId)
  }

  async onCreateSession(
    socket: TypedSocket,
    request: CreateSessionRequest
  ): Promise<EventRes<'create_session'>> {
    if (!isCreateSessionRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('CreateSessionRequest')
      )
    }

    await AuthManager.checkAuth(socket, ['admin', 'moderator'])

    await db.insert(sessions).values({
      name: request.name,
      date: new Date(request.date),
    })

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Created session',
      request.name
    )

    broadcast('all_sessions', await SessionManager.getAllSessions())
    const { default: SessionScheduler } = await import('./session.scheduler')
    await SessionScheduler.reschedule()

    return { success: true }
  }

  async onEditSession(
    socket: TypedSocket,
    request: EditSessionRequest
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

    const updates = {
      name: request.name,
      date: request.date,
      deletedAt: request.deletedAt,
    }
    const res = await db
      .update(sessions)
      .set({
        ...updates,
        date: updates.date ? new Date(updates.date) : undefined,
        deletedAt: updates.deletedAt ? new Date(updates.deletedAt) : undefined,
      })
      .where(eq(sessions.id, session.id))

    if (res.changes === 0) throw new Error('Update failed')

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Updated session',
      request.id
    )

    broadcast('all_sessions', await SessionManager.getAllSessions())
    const { default: SessionScheduler } = await import('./session.scheduler')
    await SessionScheduler.reschedule()

    return { success: true }
  }

  async onRsvpSession(
    socket: TypedSocket,
    request: RsvpSessionRequest
  ): Promise<EventRes<'rsvp_session'>> {
    if (!isRsvpSessionRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('RsvpSessionRequest')
      )
    }

    const requestData = {
      session: request.session,
      user: request.user,
      response: request.response,
    }

    const actor = await AuthManager.checkAuth(socket)
    const isModerator = actor.role !== 'user'
    const isSelf = actor.id === requestData.user

    const existingSignup = await db.query.sessionSignups.findFirst({
      where: and(
        eq(sessionSignups.session, requestData.session),
        eq(sessionSignups.user, requestData.user)
      ),
    })

    if (!isModerator && !isSelf) {
      throw new Error(loc.no.error.messages.insufficient_permissions)
    }

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, requestData.session),
    })

    if (!session) {
      throw new Error(loc.no.error.messages.not_in_db(requestData.session))
    }

    if (session.date.getTime() < Date.now() && !isModerator) {
      throw new Error(loc.no.session.errorMessages.no_edit_historical)
    }

    await db
      .insert(sessionSignups)
      .values({
        id: existingSignup?.id,
        ...requestData,
      })
      .onConflictDoUpdate({
        target: [sessionSignups.id],
        set: { response: requestData.response, deletedAt: null },
      })

    console.debug(
      new Date().toISOString(),
      socket.id,
      `Signed up for session with response: ${requestData.response}`,
      session.id
    )

    broadcast('all_sessions', await SessionManager.getAllSessions())
    const { default: SessionScheduler } = await import('./session.scheduler')
    await SessionScheduler.reschedule()

    return { success: true }
  }

  async onDeleteSession(
    socket: TypedSocket,
    request: DeleteSessionRequest
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
const SessionManager = new SessionManagerClass()

export default SessionManager
