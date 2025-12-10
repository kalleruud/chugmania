import type { SessionWithSignups } from '@common/models/session'
import { asc } from 'drizzle-orm'
import type { Server } from 'socket.io'
import db from '../../database/database'
import { sessions } from '../../database/schema'
import { broadcast } from '../server'
import SessionManager from './session.manager'

export default class SessionScheduler {
  private static currentTimeout: NodeJS.Timeout | null = null
  private static nextScheduledSessionId: string | null = null
  private static io: Server | null = null

  static init(io: Server): void {
    SessionScheduler.io = io
  }

  static async findNextSession(): Promise<SessionWithSignups | null> {
    const now = new Date()

    const nextSessionRow = await db.query.sessions.findFirst({
      where: (fields, { and, gt, isNull }) =>
        and(gt(fields.date, now), isNull(fields.deletedAt)),
      orderBy: asc(sessions.date),
    })

    if (!nextSessionRow) {
      return null
    }

    return SessionManager.getSession(nextSessionRow.id)
  }

  static async scheduleNext(io?: Server): Promise<void> {
    const server = io || SessionScheduler.io
    if (!server) {
      throw new Error('Server instance not set in SessionScheduler')
    }

    SessionScheduler.cancel()

    const nextSession = await SessionScheduler.findNextSession()

    if (!nextSession) {
      console.debug(
        new Date().toISOString(),
        'No upcoming sessions to schedule'
      )
      return
    }

    const delayMs = nextSession.date.getTime() - Date.now()

    if (delayMs <= 0) {
      console.debug(
        new Date().toISOString(),
        'Next session is in the past, triggering immediately',
        nextSession.id
      )
      await SessionScheduler.onSessionStart(server)
      return
    }

    console.debug(
      new Date().toISOString(),
      `Scheduled session "${nextSession.name}" to start in ${delayMs}ms`,
      nextSession.id
    )

    SessionScheduler.nextScheduledSessionId = nextSession.id
    SessionScheduler.currentTimeout = setTimeout(
      () => SessionScheduler.onSessionStart(server),
      delayMs
    )
  }

  private static async onSessionStart(server: Server): Promise<void> {
    console.debug(
      new Date().toISOString(),
      'Session started, broadcasting all_sessions'
    )

    broadcast('all_sessions', await SessionManager.getAllSessions())

    SessionScheduler.nextScheduledSessionId = null
    SessionScheduler.currentTimeout = null

    await this.scheduleNext(server)
  }

  static async reschedule(): Promise<void> {
    console.debug(
      new Date().toISOString(),
      'Resetting session scheduler (session created/edited/rsvp)'
    )
    this.cancel()
    await this.scheduleNext()
  }

  static cancel(): void {
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout)
      console.debug(
        new Date().toISOString(),
        'Cancelled scheduled session',
        this.nextScheduledSessionId
      )
    }
    this.currentTimeout = null
    this.nextScheduledSessionId = null
  }
}
