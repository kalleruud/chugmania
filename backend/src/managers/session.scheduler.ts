import type { SessionWithSignups } from '@common/models/session'
import { and, asc, gt, isNull } from 'drizzle-orm'
import db from '../../database/database'
import { sessions } from '../../database/schema'
import { broadcast } from '../server'
import SessionManager from './session.manager'

export default class SessionScheduler {
  private static readonly CHECK_INTERVAL_MS = 60 * 60 * 1_000 // 1 hour
  private static readonly SCHEDULE_WINDOW_MS =
    2 * SessionScheduler.CHECK_INTERVAL_MS

  private static scheduledTimeout: NodeJS.Timeout | null = null

  static async start(): Promise<void> {
    SessionScheduler.cancel()
    const nextSession = await SessionScheduler.findNextSession()

    if (!nextSession) {
      console.debug(
        new Date().toISOString(),
        'No upcoming sessions to schedule'
      )
      return
    }

    const delayMs = Math.max(nextSession.date.getTime() - Date.now())

    if (delayMs > SessionScheduler.SCHEDULE_WINDOW_MS) {
      console.debug(
        new Date().toISOString(),
        `Next session "${nextSession.name}" starts outside the scheduling window`,
        nextSession.id
      )
      return
    }

    console.debug(
      new Date().toISOString(),
      `Scheduled session "${nextSession.name}" to start in ${delayMs}ms`,
      nextSession.id
    )

    SessionScheduler.scheduledTimeout = setTimeout(
      SessionScheduler.onSessionStart,
      delayMs
    )

    setTimeout(SessionScheduler.start, SessionScheduler.CHECK_INTERVAL_MS)
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
    SessionScheduler.cancel()
    await SessionScheduler.start()
  }

  private static cancel(): void {
    if (!SessionScheduler.scheduledTimeout) return

    clearTimeout(SessionScheduler.scheduledTimeout)
    SessionScheduler.scheduledTimeout = null
    console.debug(new Date().toISOString(), 'Cancelled scheduled session')
  }
}
