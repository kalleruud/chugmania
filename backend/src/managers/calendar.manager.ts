import loc from '@/lib/locales'
import type { SessionResponse } from '@backend/database/schema'
import type { SessionWithSignups } from '@common/models/session'
import { getEndOfDate } from '@common/utils/date'
import accumulateSignups from '@common/utils/signupAccumulator'
import {
  type Attendee,
  createEvents,
  type EventAttributes,
  type ParticipationStatus,
} from 'ics'
import MatchManager from './match.manager'
import SessionManager from './session.manager'
import TimeEntryManager from './timeEntry.manager'
import UserManager from './user.manager'

export default class CalendarManager {
  public static readonly PRODUCT_ID = 'chugmania/sessions'

  public static async getAllSessionsCalendar(baseUrl: URL): Promise<string> {
    return await CalendarManager.createIcsCalendar(
      await SessionManager.getAllSessions(),
      baseUrl,
      'Chugmania Sessions'
    )
  }

  private static async createIcsCalendar(
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

  private static async createSessionEvent(
    session: SessionWithSignups,
    baseUrl: URL,
    calendarName: string
  ): Promise<EventAttributes> {
    const descriptionText = session.description?.trim()

    const timeEntries = (await TimeEntryManager.getAllTimeEntries()).filter(
      te => te.session === session.id
    )

    const matches = (await MatchManager.getAllMatches()).filter(
      m => m.session === session.id
    )

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
      accumulateSignups(session.id, session.signups, timeEntries, matches).map(
        this.createEventAttendee
      )
    )

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
      attendees,
    }
  }

  private static async createEventAttendee(signup: {
    user: string
    response: SessionResponse
  }) {
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
    if (!user) throw new Error(loc.no.error.messages.not_in_db(signup.user))

    return {
      name: `${user.firstName} ${user.lastName}`,
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
