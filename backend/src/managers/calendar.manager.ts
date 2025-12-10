import type { SessionSignup, SessionWithSignups } from '@common/models/session'
import { getEndOfDate } from '@common/utils/date'
import {
  type Attendee,
  createEvents,
  type EventAttributes,
  type ParticipationStatus,
} from 'ics'
import SessionManager from './session.manager'

export default class CalendarManager {
  public static readonly PRODUCT_ID = 'chugmania/sessions'

  public static async getAllSessionsCalendar(baseUrl: URL): Promise<string> {
    return CalendarManager.createIcsCalendar(
      await SessionManager.getAllSessions(),
      baseUrl,
      'Chugmania Sessions'
    )
  }

  private static createIcsCalendar(
    sessionList: SessionWithSignups[],
    baseUrl: URL,
    calendarName: string
  ): string {
    const events = sessionList.map(session =>
      CalendarManager.createSessionEvent(session, baseUrl, calendarName)
    )

    const { error, value } = createEvents(events, {
      productId: CalendarManager.PRODUCT_ID,
      calName: calendarName,
    })

    if (error || !value) throw error ?? new Error('Failed to generate calendar')

    return value
  }

  private static createSessionEvent(
    session: SessionWithSignups,
    baseUrl: URL,
    calendarName: string
  ): EventAttributes {
    const descriptionText = session.description?.trim()

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

    return {
      title: '🍺 ' + session.name,
      description: descriptionText,
      location: session.location ?? undefined,
      url: `${baseUrl}/${session.id}`,
      uid: `${session.id}@chugmania`,
      sequence: this.toSequence(session.updatedAt ?? session.createdAt),
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
      attendees: session.signups.map(this.createEventAttendee),
    }
  }

  private static createEventAttendee(signup: SessionSignup) {
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

    return {
      name: `${signup.user.firstName} ${signup.user.lastName}`,
      email: signup.user.email,
      rsvp: true,
      partstat: partstat,
      role: 'OPT-PARTICIPANT',
      cutype: 'INDIVIDUAL',
    } satisfies Attendee
  }

  private static toSequence(date: Date) {
    return (
      date.getUTCFullYear() +
      date.getUTCMonth() +
      date.getUTCDate() +
      date.getUTCHours() +
      date.getUTCMinutes() +
      date.getUTCSeconds()
    )
  }

  private static toUtcArray(date: Date) {
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
