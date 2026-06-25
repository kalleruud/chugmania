import type { SessionWithSignups } from '@common/models/session'
import { and, asc, gt, isNull } from 'drizzle-orm'
import db from '../../database/database'
import { sessions } from '../../database/schema'
import { broadcast } from '../server'
import SessionManager from './session.manager'

export default class SessionScheduler {
  private static readonly MAX_TIMEOUT_MS = 2 ** 31 - 1

  private static scheduledTimeout: NodeJS.Timeout | null = null
  private static checkTimeout: NodeJS.Timeout | null = null

  static async start(): Promise<void> {
    const nextSession = await SessionScheduler.findNextSession()

    if (!nextSession) {
      console.debug(
        new Date().toISOString(),
        'No upcoming sessions to schedule'
      )
      return
    }

    const delayMs = Math.max(nextSession.date.getTime() - Date.now())

    if (delayMs > SessionScheduler.MAX_TIMEOUT_MS) {
      return SessionScheduler.rescheduleCheck()
    }

    SessionScheduler.reschedule(delayMs)
    console.debug(
      new Date().toISOString(),
      `Scheduled session "${nextSession.name}" to start in ${delayMs}ms`,
      nextSession.id
    )
  }

  private static async findNextSession(): Promise<SessionWithSignups | null> {
    const now = new Date()

    const nextSessionRow = await db.query.sessions.findFirst({
      where: and(gt(sessions.date, now), isNull(sessions.deletedAt)),
      orderBy: asc(sessions.date),
    })

    if (!nextSessionRow) return null
    return SessionManager.getSession(nextSessionRow.id)
  }

  private static async onSessionStart(): Promise<void> {
    console.debug(
      new Date().toISOString(),
      'Session started, broadcasting all_sessions'
    )

    broadcast('all_sessions', await SessionManager.getAllSessions())
    await SessionScheduler.start()
  }

  private static reschedule(delay: number): void {
    if (SessionScheduler.scheduledTimeout) {
      clearTimeout(SessionScheduler.scheduledTimeout)
    }

    SessionScheduler.scheduledTimeout = setTimeout(
      SessionScheduler.onSessionStart,
      delay
    )
  }

  private static rescheduleCheck(): void {
    if (SessionScheduler.checkTimeout) {
      clearTimeout(SessionScheduler.checkTimeout)
    }

    SessionScheduler.checkTimeout = setTimeout(
      SessionScheduler.start,
      SessionScheduler.MAX_TIMEOUT_MS
    )

    console.debug(new Date().toISOString(), 'Rescheduled check')
  }
}
