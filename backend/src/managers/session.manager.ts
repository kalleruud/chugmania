import loc from '@common/locale/locales'
import {
  isCreateSessionRequest,
  isDatePollOpen,
  isDeleteSessionRequest,
  isDeleteSessionSignupRequest,
  isEditSessionRequest,
  isRsvpSessionRequest,
  isVoteSessionDateRequest,
  type SessionDateVote,
  type SessionSignup,
  type SessionWithSignups,
} from '@common/models/session'
import type { EventReq, EventRes } from '@common/models/socket.io'
import { isPast } from '@common/utils/date'
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import db from '../../database/database'
import { sessions, sessionSignups, users } from '../../database/schema'
import SessionSource from '../../database/sources/session.source'
import TransactionSource from '../../database/sources/transaction.source'
import { broadcast, type TypedSocket } from '../server'
import AuthManager from './auth.manager'
import ChugTimeManager from './chugtime.manager'
import MatchManager from './match.manager'
import RatingManager from './rating.manager'
import SessionScheduler from './session.scheduler'
import TimeEntryManager from './timeEntry.manager'
import TournamentManager from './tournament/tournament.manager'
import UserManager from './user.manager'

export default class SessionManager {
  public static ensureSessionSignup(
    sessionId: string,
    userId: string
  ): boolean {
    const existingSignup = db
      .select()
      .from(sessionSignups)
      .where(
        and(
          eq(sessionSignups.session, sessionId),
          eq(sessionSignups.user, userId)
        )
      )
      .get()

    if (existingSignup && !existingSignup.deletedAt) return false
    const session = SessionSource.getActiveById(sessionId)
    if (session && isDatePollOpen(session)) return false

    db.insert(sessionSignups)
      .values({
        id: existingSignup?.id,
        session: sessionId,
        user: userId,
        response: 'yes',
      })
      .onConflictDoUpdate({
        target: [sessionSignups.id],
        set: { response: 'yes', deletedAt: null },
      })
      .run()

    return true
  }

  public static async getAllSessions(): Promise<SessionWithSignups[]> {
    const sessionRows = await db
      .select()
      .from(sessions)
      .where(isNull(sessions.deletedAt))
      .orderBy(desc(sessions.date), asc(sessions.createdAt))

    if (sessionRows.length === 0) {
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
        dateVotes: SessionManager.getSessionDateVotes(session.id),
      }))
    )
  }

  public static async getSession(
    id: string
  ): Promise<SessionWithSignups | null> {
    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.id, id), isNull(sessions.deletedAt)),
    })

    if (!session || session.deletedAt) {
      console.warn(
        new Date().toISOString(),
        loc.no.error.messages.not_in_db(id)
      )
      return null
    }

    return {
      ...session,
      signups: await SessionManager.getSessionSignups(session.id),
      dateVotes: SessionManager.getSessionDateVotes(session.id),
    }
  }

  public static getSessionDateVotes(sessionId: string): SessionDateVote[] {
    return SessionSource.getDateVotes(sessionId).map(row => ({
      dates: row.dates,
      user: UserManager.toUserInfo(row.user).userInfo,
    }))
  }

  public static async getSessionSignups(
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

    if (signupRows.length === 0) {
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

    await db.insert(sessions).values({
      id: request.id,
      name: request.name,
      description: request.description,
      location: request.location,
      status: request.status,
      date: request.date ? new Date(request.date) : new Date(),
    })

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Created session',
      request.name
    )

    broadcast('all_sessions', await SessionManager.getAllSessions())
    await SessionScheduler.start()

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

    const session = SessionSource.getActiveById(request.id)

    if (!session) {
      throw new Error(loc.no.error.messages.not_in_db(request.id))
    }

    const id = request.id
    const date = request.date ? new Date(request.date) : request.date
    const next = {
      date: date === undefined ? session.date : date,
      status: request.status ?? session.status,
      dateOptions:
        request.dateOptions === undefined
          ? session.dateOptions
          : request.dateOptions,
      dateVotingClosed: request.dateVotingClosed ?? session.dateVotingClosed,
    }
    const wasPollOpen = isDatePollOpen(session)
    const opensPoll = !wasPollOpen && isDatePollOpen(next)
    const chosenDate = wasPollOpen && next.date ? next.date.getTime() : null

    if (next.date === null && next.status !== 'tentative') {
      throw new Error(loc.no.session.datePoll.invalidPoll)
    }

    TransactionSource.run(() => {
      const updated = SessionSource.update(session.id, {
        name: request.name,
        description: request.description,
        location: request.location,
        status: request.status,
        dateOptions: request.dateOptions,
        dateVotingClosed: chosenDate === null ? request.dateVotingClosed : true,
        date,
        deletedAt: request.deletedAt
          ? new Date(request.deletedAt)
          : request.deletedAt,
      })

      if (!updated) throw new Error('Update failed')
      if (request.deletedAt) TournamentManager.remove(session.id)
      if (opensPoll) SessionSource.resetPoll(session.id)
      if (chosenDate !== null && next.dateOptions?.includes(chosenDate))
        SessionSource.applyDateVotes(session.id, chosenDate)
    })

    console.debug(new Date().toISOString(), socket.id, 'Updated session', id)

    RatingManager.recalculate()
    if (request.deletedAt) {
      broadcast('all_matches', await MatchManager.getAllMatches())
      broadcast('all_time_entries', await TimeEntryManager.getAllTimeEntries())
    }
    broadcast('all_sessions', await SessionManager.getAllSessions())
    broadcast('all_rankings', RatingManager.onGetRatings())
    await ChugTimeManager.publish()
    TournamentManager.publish(socket.id)
    await SessionScheduler.start()

    return { success: true }
  }

  static async onRsvpSession(
    socket: TypedSocket,
    request: EventReq<'rsvp_session'>
  ): Promise<EventRes<'rsvp_session'>> {
    if (
      !isRsvpSessionRequest(request) ||
      !['yes', 'no', 'maybe'].includes(request.response)
    ) {
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

    if (!session || session.deletedAt) {
      throw new Error(loc.no.error.messages.not_in_db(request.session))
    }

    if (isDatePollOpen(session)) {
      throw new Error(loc.no.session.datePoll.pendingError)
    }

    if (isPast(session) && !isModerator) {
      throw new Error(loc.no.session.errorMessages.no_edit_historical)
    }

    SessionSource.setSignup(request.session, request.user, request.response)

    console.debug(
      new Date().toISOString(),
      socket.id,
      `Signed up for session with response: ${request.response}`,
      session.id
    )

    broadcast('all_sessions', await SessionManager.getAllSessions())
    TournamentManager.publish(socket.id)

    return { success: true }
  }

  static async onDeleteSessionSignup(
    socket: TypedSocket,
    request: EventReq<'delete_session_signup'>
  ): Promise<EventRes<'delete_session_signup'>> {
    if (!isDeleteSessionSignupRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('DeleteSessionSignupRequest')
      )
    }

    const actor = await AuthManager.checkAuth(socket, ['admin', 'moderator'])

    const session = SessionSource.getActiveById(request.session)
    if (!session) {
      throw new Error(loc.no.error.messages.not_in_db(request.session))
    }

    TransactionSource.run(() =>
      SessionSource.deleteSignup(request.session, request.user)
    )

    console.debug(
      new Date().toISOString(),
      socket.id,
      `${actor.id} removed ${request.user} from session`,
      session.id
    )

    broadcast('all_sessions', await SessionManager.getAllSessions())
    TournamentManager.publish(socket.id)

    return { success: true }
  }

  static async onVoteSessionDate(
    socket: TypedSocket,
    request: EventReq<'vote_session_date'>
  ): Promise<EventRes<'vote_session_date'>> {
    if (!isVoteSessionDateRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('VoteSessionDateRequest')
      )
    }

    const actor = await AuthManager.checkAuth(socket)

    const session = SessionSource.getActiveById(request.session)

    if (!session) {
      throw new Error(loc.no.error.messages.not_in_db(request.session))
    }

    if (!isDatePollOpen(session)) {
      throw new Error(loc.no.session.datePoll.closedError)
    }

    const options = new Set(session.dateOptions)
    if (!request.dates.every(date => options.has(date))) {
      throw new Error(
        loc.no.error.messages.invalid_request('VoteSessionDateRequest')
      )
    }

    TransactionSource.run(() => {
      SessionSource.setDateVote(session.id, actor.id, [
        ...new Set(request.dates),
      ])
      SessionSource.setSignup(session.id, actor.id, 'maybe')
    })

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Voted for session dates',
      session.id
    )

    broadcast('all_sessions', await SessionManager.getAllSessions())

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
