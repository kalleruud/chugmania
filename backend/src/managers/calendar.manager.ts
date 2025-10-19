import { eq } from 'drizzle-orm'
import { createEvents, type EventAttributes } from 'ics'
import db from '../../database/database'
import { sessionSignups, sessions, users } from '../../database/schema'

const PRODUCT_ID = '-//Chugmania//Sessions//EN'

export default class CalendarManager {
  static async getAllSessionsCalendar(
    protocol: string,
    host: string | undefined,
    baseUrl: string
  ): Promise<string> {
    const sessionRows = await db
      .select()
      .from(sessions)
      .orderBy(sessions.date, sessions.createdAt)

    const signupsBySession = await CalendarManager.getSignupsBySession()

    return CalendarManager.createIcsCalendar(
      sessionRows,
      signupsBySession,
      baseUrl,
      'Chugmania Sessions'
    )
  }

  static async getSessionCalendar(
    sessionId: string,
    protocol: string,
    host: string | undefined,
    baseUrl: string
  ): Promise<string> {
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    })

    if (!session) {
      throw new Error('Session not found')
    }

    const signupRows = await db
      .select({
        sessionId: sessionSignups.session,
        userEmail: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(sessionSignups)
      .where(eq(sessionSignups.session, sessionId))
      .innerJoin(users, eq(sessionSignups.user, users.id))

    const attendees = signupRows.map(signup => ({
      email: signup.userEmail,
      name: `${signup.firstName} ${signup.lastName ?? ''}`.trim(),
    }))

    const signupsBySession = new Map<
      string,
      Array<{ email: string; name: string }>
    >()
    signupsBySession.set(sessionId, attendees)

    return CalendarManager.createIcsCalendar(
      [session],
      signupsBySession,
      baseUrl,
      session.name
    )
  }

  private static async getSignupsBySession(): Promise<
    Map<string, Array<{ email: string; name: string }>>
  > {
    const signupRows = await db
      .select({
        sessionId: sessionSignups.session,
        userEmail: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(sessionSignups)
      .innerJoin(users, eq(sessionSignups.user, users.id))

    const signupsBySession = new Map<
      string,
      Array<{ email: string; name: string }>
    >()
    for (const signup of signupRows) {
      const attendees = signupsBySession.get(signup.sessionId) ?? []
      attendees.push({
        email: signup.userEmail,
        name: `${signup.firstName} ${signup.lastName ?? ''}`.trim(),
      })
      signupsBySession.set(signup.sessionId, attendees)
    }

    return signupsBySession
  }

  private static createIcsCalendar(
    sessionList: (typeof sessions.$inferSelect)[],
    signupsBySession: Map<string, Array<{ email: string; name: string }>>,
    baseUrl: string,
    calendarName: string
  ): string {
    const events = sessionList.map(session =>
      CalendarManager.createSessionEvent(
        session,
        signupsBySession.get(session.id) ?? [],
        baseUrl,
        calendarName
      )
    )

    const { error, value } = createEvents(events, {
      productId: PRODUCT_ID,
      calName: calendarName,
    })

    if (error || !value) throw error ?? new Error('Failed to generate calendar')

    return value
  }

  private static createSessionEvent(
    session: typeof sessions.$inferSelect,
    attendees: Array<{ email: string; name: string }>,
    baseUrl: string,
    calendarName: string
  ): EventAttributes {
    const start = new Date(session.date)
    const end = new Date(start)
    end.setUTCHours(23, 59, 0, 0)

    const createdAt = session.createdAt ?? start
    const updatedAt = session.updatedAt ?? createdAt
    const descriptionText = session.description?.trim()

    const eventAttendees = attendees.map(attendee => ({
      name: attendee.name,
      email: attendee.email,
      rsvp: true,
    }))

    return {
      title: session.name,
      description: descriptionText,
      location: session.location ?? undefined,
      url: `${baseUrl}/sessions`,
      uid: `${session.id}@chugmania`,
      sequence: updatedAt.getTime() > createdAt.getTime() ? 1 : 0,
      productId: PRODUCT_ID,
      calName: calendarName,
      start: CalendarManager.toUtcArray(start),
      startInputType: 'utc',
      startOutputType: 'utc',
      end: CalendarManager.toUtcArray(end),
      endInputType: 'utc',
      endOutputType: 'utc',
      created: CalendarManager.toUtcArray(createdAt),
      lastModified: CalendarManager.toUtcArray(updatedAt),
      attendees: eventAttendees,
    }
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
