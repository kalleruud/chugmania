import type { SessionWithSignups } from '@common/models/session'
import { asc } from 'drizzle-orm'
import type { Server } from 'socket.io'
import db from '../../database/database'
import { sessions } from '../../database/schema'
import { broadcast } from '../server'
import SessionManager from './session.manager'

let instance: SessionScheduler | null = null

export default class SessionScheduler {
  private currentTimeout: NodeJS.Timeout | null = null
  private nextScheduledSessionId: string | null = null

  static getInstance(): SessionScheduler {
    if (!instance) {
      instance = new SessionScheduler()
    }
    return instance
  }

  async findNextSession(): Promise<SessionWithSignups | null> {
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

  async scheduleNext(io: Server): Promise<void> {
    this.cancel()

    const nextSession = await this.findNextSession()

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
      await this.onSessionStart(io)
      return
    }

    console.debug(
      new Date().toISOString(),
      `Scheduled session "${nextSession.name}" to start in ${delayMs}ms`,
      nextSession.id
    )

    this.nextScheduledSessionId = nextSession.id
    this.currentTimeout = setTimeout(() => this.onSessionStart(io), delayMs)
  }

  private async onSessionStart(io: Server): Promise<void> {
    console.debug(
      new Date().toISOString(),
      'Session started, broadcasting all_sessions'
    )

    broadcast('all_sessions', await SessionManager.getAllSessions())

    this.nextScheduledSessionId = null
    this.currentTimeout = null

    await this.scheduleNext(io)
  }

  async reset(io: Server): Promise<void> {
    console.debug(
      new Date().toISOString(),
      'Resetting session scheduler (session created/edited/rsvp)'
    )
    this.cancel()
    await this.scheduleNext(io)
  }

  cancel(): void {
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
