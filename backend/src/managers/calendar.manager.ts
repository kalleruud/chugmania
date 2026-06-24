import type { SessionResponse } from '@backend/database/schema'
import type { SessionWithSignups } from '@common/models/session'
import { getEndOfDate } from '@common/utils/date'
import {
  type Attendee,
  createEvents,
  type EventAttributes,
  type ParticipationStatus,
} from 'ics'
import SessionManager from './session.manager'
import UserManager from './user.manager'

const isProduction = process.env.NODE_ENV === 'production'
const CALENDAR_NAME = 'Chugmania'

class CalendarManagerClass {
  public readonly PRODUCT_ID = 'chugmania/sessions'

  public async getAllSessionsCalendar(baseUrl: URL): Promise<string> {
    return await CalendarManager.createIcsCalendar(
      await SessionManager.getAllSessions(),
      baseUrl,
      isProduction ? CALENDAR_NAME : CALENDAR_NAME + ' (dev)'
    )
  }

  private async createIcsCalendar(
    sessionList: SessionWithSignups[],
    baseUrl: URL,
    calendarName: string
  ): Promise<string> {
    const events = await Promise.all(
      sessionList.map(session =>
        CalendarManager.createSessionEvent(session, baseUrl, calendarName)
      )
    )

    const { error, value } = createEvents(events, {
      productId: CalendarManager.PRODUCT_ID,
      calName: calendarName,
    })

    if (error || !value) throw error ?? new Error('Failed to generate calendar')

    return value
  }

  private async createSessionEvent(
    session: SessionWithSignups,
    baseUrl: URL,
    calendarName: string
  ): Promise<EventAttributes> {
    let status: EventAttributes['status']
    switch (session.status) {
      case 'cancelled':
        status = 'CANCELLED'
        break
      case 'tentative':
        status = 'TENTATIVE'
        break
      default:
        status = 'CONFIRMED'
    }

    baseUrl.pathname = `sessions`

    const attendees = await Promise.all(
      session.signups.map(signup =>
        CalendarManager.createEventAttendee({
          user: signup.user.id,
          response: signup.response,
        })
      )
    )

    return {
      title: '🍺 ' + session.name,
      description: session.description?.trim(),
      location: session.location ?? undefined,
      url: `${baseUrl}/${session.id}`,
      uid: `${session.id}@chugmania`,
      sequence: CalendarManager.toSequence(
        session.updatedAt ?? session.createdAt
      ),
      productId: CalendarManager.PRODUCT_ID,
      calName: calendarName,
      classification: 'PRIVATE',
      transp: 'OPAQUE',
      busyStatus: 'BUSY',
      categories: ['Chugmania', 'Session'],
      status,
      start: CalendarManager.toUtcArray(session.date),
      startInputType: 'utc',
      startOutputType: 'utc',
      end: CalendarManager.toUtcArray(getEndOfDate(session.date)),
      endInputType: 'utc',
      endOutputType: 'utc',
      created: CalendarManager.toUtcArray(session.createdAt),
      lastModified: session.updatedAt
        ? CalendarManager.toUtcArray(session.updatedAt)
        : undefined,
      attendees: attendees,
    }
  }

  private async createEventAttendee(signup: {
    user: string
    response: SessionResponse
  }): Promise<Attendee> {
    let partstat: ParticipationStatus
    switch (signup.response) {
      case 'yes':
        partstat = 'ACCEPTED'
        break
      case 'no':
        partstat = 'DECLINED'
        break
      case 'maybe':
        partstat = 'TENTATIVE'
        break
      default:
        partstat = 'NEEDS-ACTION'
    }

    const user = await UserManager.getUserById(signup.user)

    return {
      name: `${user.firstName} ${user.lastName}`,
      email: user.email.split('@')[0] + '@chugmania.no',
      rsvp: true,
      partstat: partstat,
      role: 'OPT-PARTICIPANT',
      cutype: 'INDIVIDUAL',
    }
  }

  private toSequence(date: Date) {
    return (
      date.getUTCFullYear() +
      date.getUTCMonth() +
      date.getUTCDate() +
      date.getUTCHours() +
      date.getUTCMinutes() +
      date.getUTCSeconds()
    )
  }

  private toUtcArray(date: Date) {
    const components: [number, number, number, number, number] = [
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
    ]
    return components
  }
}
const CalendarManager = new CalendarManagerClass()

export default CalendarManager
