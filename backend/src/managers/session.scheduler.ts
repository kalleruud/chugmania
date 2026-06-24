import type { SessionWithSignups } from '@common/models/session'
import { and, asc, gt, isNull } from 'drizzle-orm'
import db from '../../database/database'
import { sessions } from '../../database/schema'
import { broadcast } from '../socket'
import { getAllSessions, getSession } from './session.queries'

class SessionSchedulerClass {
  private scheduledTimeout: NodeJS.Timeout | null = null

  private async findNextSession(): Promise<SessionWithSignups | null> {
    const now = new Date()

    const nextSessionRow = await db.query.sessions.findFirst({
      where: and(gt(sessions.date, now), isNull(sessions.deletedAt)),
      orderBy: asc(sessions.date),
    })

    if (!nextSessionRow) return null
    return getSession(nextSessionRow.id)
  }

  async scheduleNext(): Promise<void> {
    if (SessionScheduler.scheduledTimeout) {
      SessionScheduler.cancel()
    }

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
      await SessionScheduler.onSessionStart()
      return
    }

    console.debug(
      new Date().toISOString(),
      `Scheduled session "${nextSession.name}" to start in ${delayMs}ms`,
      nextSession.id
    )

    SessionScheduler.scheduledTimeout = setTimeout(
      () => SessionScheduler.onSessionStart(),
      delayMs
    )
  }

  private async onSessionStart(): Promise<void> {
    console.debug(
      new Date().toISOString(),
      'Session started, broadcasting all_sessions'
    )

    broadcast('all_sessions', await getAllSessions())
    SessionScheduler.cancel()
    await SessionScheduler.scheduleNext()
  }

  async reschedule(): Promise<void> {
    console.debug(
      new Date().toISOString(),
      'Resetting session scheduler (session created/edited/rsvp)'
    )
    SessionScheduler.cancel()
    await SessionScheduler.scheduleNext()
  }

  cancel(): void {
    if (!SessionScheduler.scheduledTimeout) {
      return console.log('No session scheduled')
    }

    clearTimeout(SessionScheduler.scheduledTimeout)
    SessionScheduler.scheduledTimeout = null
    console.debug(new Date().toISOString(), 'Cancelled scheduled session')
  }
}
const SessionScheduler = new SessionSchedulerClass()

export default SessionScheduler
