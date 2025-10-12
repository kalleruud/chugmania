import { asc, eq, isNull } from 'drizzle-orm'
import express from 'express'
import { createEvents, type EventAttributes } from 'ics'
import { Server } from 'socket.io'
import ViteExpress from 'vite-express'
import {
  WS_CONNECT_NAME,
  WS_DISCONNECT_NAME,
} from '../../common/utils/constants'
import db from '../database/database'
import { sessions } from '../database/schema'
import ConnectionManager from './managers/connection.manager'

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 6996
const app = express()

app.get('/api/sessions/calendar.ics', async (req, res) => {
  try {
    const sessionRows = await db
      .select()
      .from(sessions)
      .where(isNull(sessions.deletedAt))
      .orderBy(asc(sessions.date), asc(sessions.createdAt))

    const calendar = createSessionsCalendar(
      sessionRows,
      req.protocol,
      req.get('host'),
      'Chugmania Sessions'
    )

    res
      .type('text/calendar; charset=utf-8')
      .setHeader('Content-Disposition', 'inline; filename="sessions.ics"')
      .setHeader('Cache-Control', 'no-store')
      .send(calendar)
  } catch (error) {
    logError('Failed to create sessions calendar', error)
    res.status(500).send('Failed to load sessions calendar')
  }
})

app.get('/api/sessions/:id/calendar.ics', async (req, res) => {
  try {
    const sessionId = req.params.id
    if (!sessionId) {
      res.status(400).send('Session id is required')
      return
    }

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    })

    if (!session || session.deletedAt) {
      res.status(404).send('Session not found')
      return
    }

    const calendar = createSessionsCalendar(
      [session],
      req.protocol,
      req.get('host'),
      session.name
    )
    res
      .type('text/calendar; charset=utf-8')
      .setHeader(
        'Content-Disposition',
        `inline; filename="session-${session.id}.ics"`
      )
      .setHeader('Cache-Control', 'no-store')
      .send(calendar)
  } catch (error) {
    logError('Failed to create session calendar', error)
    res.status(500).send('Failed to load session calendar')
  }
})

const server = ViteExpress.listen(app, PORT)
const io = new Server(server, {
  cors: {
    origin: [process.env.ORIGIN ?? 'http://localhost:' + PORT],
    credentials: true,
  },
})

io.on(WS_CONNECT_NAME, s =>
  ConnectionManager.connect(s).then(() => {
    s.on(WS_DISCONNECT_NAME, () => ConnectionManager.disconnect(s))
  })
)

const PRODUCT_ID = '-//Chugmania//Sessions//EN'

function createSessionsCalendar(
  sessionList: (typeof sessions.$inferSelect)[],
  protocol: string,
  host: string | undefined,
  calendarName: string
) {
  const baseUrl =
    host !== undefined
      ? `${protocol}://${host}`
      : (process.env.ORIGIN ?? 'http://localhost:' + PORT)

  const events = sessionList.map(session =>
    createSessionEvent(session, baseUrl, calendarName)
  )

  const { error, value } = createEvents(events, {
    productId: PRODUCT_ID,
    calName: calendarName,
  })

  if (error || !value) throw error ?? new Error('Failed to generate calendar')

  return value
}

function createSessionEvent(
  session: typeof sessions.$inferSelect,
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
    productId: PRODUCT_ID,
    calName: calendarName,
    start: toUtcArray(start),
    startInputType: 'utc',
    startOutputType: 'utc',
    end: toUtcArray(end),
    endInputType: 'utc',
    endOutputType: 'utc',
    created: toUtcArray(createdAt),
    lastModified: toUtcArray(updatedAt),
  }
}

function toUtcArray(date: Date) {
  const components: [number, number, number, number, number] = [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
  ]
  return components
}

function logError(context: string, error: unknown) {
  const timestamp = new Date().toISOString()
  if (error instanceof Error) {
    console.error(timestamp, context, error.message, error.stack)
  } else {
    console.error(timestamp, context, error)
  }
}
