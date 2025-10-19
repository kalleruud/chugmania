import {
  Attendee,
  createEvents,
  ParticipationStatus,
  type EventAttributes,
} from 'ics'
import {
  SessionSignup,
  SessionWithSignups,
} from '../../../common/models/session'
import SessionManager from './session.manager'

export default class CalendarManager {
  public static readonly PRODUCT_ID = 'chugmania/sessions'

  public static async getAllSessionsCalendar(baseUrl: string): Promise<string> {
    return CalendarManager.createIcsCalendar(
      await SessionManager.getSessions(),
      baseUrl,
      'Chugmania Sessions'
    )
  }

  public static async getSessionCalendar(
    baseUrl: string,
    sessionId: string
  ): Promise<string> {
    const session = await SessionManager.getSession(sessionId)

    if (!session) {
      throw new Error('Session not found')
    }

    return CalendarManager.createIcsCalendar([session], baseUrl, session.name)
  }

  private static createIcsCalendar(
    sessionList: SessionWithSignups[],
    baseUrl: string,
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
    baseUrl: string,
    calendarName: string
  ): EventAttributes {
    const start = new Date(session.date)
    const end = new Date(start)
    end.setUTCHours(23, 59, 0, 0)

    const createdAt = session.createdAt ?? start
    const updatedAt = session.updatedAt ?? createdAt
    const descriptionText = session.description?.trim()

    return {
      title: session.name,
      description: descriptionText,
      location: session.location ?? undefined,
      url: `${baseUrl}/sessions`,
      uid: `${session.id}@chugmania`,
      sequence: updatedAt.getTime() > createdAt.getTime() ? 1 : 0,
      productId: CalendarManager.PRODUCT_ID,
      calName: calendarName,
      classification: 'PRIVATE',
      transp: 'OPAQUE',
      busyStatus: 'BUSY',
      categories: ['Chugmania', 'Session'],
      start: CalendarManager.toUtcArray(start),
      startInputType: 'utc',
      startOutputType: 'utc',
      end: CalendarManager.toUtcArray(end),
      endInputType: 'utc',
      endOutputType: 'utc',
      created: CalendarManager.toUtcArray(createdAt),
      lastModified: CalendarManager.toUtcArray(updatedAt),
      attendees: session.signups.map(this.createEventAttendee),
    } satisfies EventAttributes
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
