import loc from '@common/locale/locales'
import type { SessionSignup, SessionWithSignups } from '@common/models/session'
import { getUserFullName } from '@common/models/user'
import { getEndOfDate } from '@common/utils/date'
import {
  type Attendee,
  createEvents,
  type EventAttributes,
  type ParticipationStatus,
} from 'ics'
import SessionManager from './session.manager'

const isProduction = process.env.NODE_ENV === 'production'
const calendarEmailPattern =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i

export default class CalendarManager {
  public static readonly PRODUCT_ID = 'chugmania/sessions'

  public static async getAllSessionsCalendar(baseUrl: URL): Promise<string> {
    return CalendarManager.createIcsCalendar(
      await SessionManager.getAllSessions(),
      baseUrl,
      isProduction ? loc.no.chugmania : loc.no.chugmania + ' (dev)'
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
      method: '',
    })

    if (error || !value) throw error ?? new Error('Failed to generate calendar')

    return value
  }

  private static createSessionEvent(
    session: SessionWithSignups,
    baseUrl: URL,
    calendarName: string
  ): EventAttributes {
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
      attendees: session.signups
        .map(CalendarManager.createEventAttendee)
        .filter(attendee => attendee !== undefined),
    }
  }

  private static createEventAttendee({
    user,
    response,
  }: SessionSignup): Attendee | undefined {
    if (!calendarEmailPattern.test(user.email)) return undefined

    let partstat: ParticipationStatus
    switch (response) {
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

    const separator = user.email.indexOf('@')
    const localPart = encodeURIComponent(user.email.slice(0, separator))

    return {
      name: getUserFullName(user),
      email: localPart + user.email.slice(separator),
      rsvp: false,
      partstat: partstat,
      role: 'OPT-PARTICIPANT',
      cutype: 'INDIVIDUAL',
    }
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
